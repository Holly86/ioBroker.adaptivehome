import * as utils from '@iobroker/adapter-core';
import type { ConfigRecord } from './config/configuration';
import { ConfigurationStore } from './config/configuration';
import { HomeRuntime } from './runtime/home';
import type { ExecutionJournal } from './execution/executor';
import type { DiscoveryContext, StateMetadata, StateValue, IntegrationRegistry } from './integrations/registry';
import { builtInRegistry, discoverProfiles } from './integrations/profiles';
import { registerDefinitions } from './integrations/sdk';
import type { ControlClient } from './runtime/control';
import { clientSchema, MUTATIONS, OperationGuard, verifyControl } from './runtime/control';
import { OptionalProvider, providerSchema } from './learning/provider';
import { deadline } from './runtime/clock';
import { addTypeHints } from './integrations/type-hints';
import { SourceConnections } from './connections/sources';
import type { SourceDocument } from './connections/sources';
import { getSourceJSON, readSourceFile, resolveSourceEndpoint } from './connections/io';
import { NativeConnections } from './connections/runtime';
import { SqlLogging } from './diagnostics/sql-logging';
class Adaptivehome extends utils.Adapter {
	private registry: IntegrationRegistry = builtInRegistry();
	private runtime!: HomeRuntime;
	private clients: ControlClient[] = [];
	private guard = new OperationGuard(records => this.persistJournal('operations', records));
	private provider = new OptionalProvider(budgets => this.persistJournal('providerBudgets', budgets));
	private timer?: ReturnType<typeof setInterval>;
	private subscribedIds = new Set<string>();
	private configurationTasks: Promise<unknown> = Promise.resolve();
	private sourceConnections = new SourceConnections(this.namespace, {
		readState: async id => (await this.getForeignStateAsync(id)) as StateValue | null,
		readFile: key => readSourceFile(key, this.config.sourceFiles ?? {}),
		readBackend: backend =>
			new Promise(resolve =>
				this.sendTo(backend, 'adaptivehomeRead', { protocol: 'adaptivehome.read.v1' }, result =>
					resolve(result as unknown as SourceDocument),
				),
			),
		getJSON: async key => {
			const endpoints = JSON.parse(this.config.sourceEndpoints || '{}');
			if (!Object.hasOwn(endpoints, key)) {
				throw Error('source_endpoint_not_declared');
			}
			const resolved = await resolveSourceEndpoint(
				endpoints[key],
				async id => {
					const obj = await this.getForeignObjectAsync(`system.adapter.${id}`);
					return obj?.native ?? {};
				},
				value => this.decrypt(value),
				key => readSourceFile(key, this.config.sourceFiles ?? {}),
			);
			return getSourceJSON(resolved);
		},
	});
	private nativeConnections = new NativeConnections(this.namespace, {
		send: (backend, command, payload) => new Promise(resolve => this.sendTo(backend, command, payload, resolve)),
	});
	private connectionRound = false;
	private sqlLogging = new SqlLogging(this.namespace, {
		persist: record => this.persistJournal('sqlLogging', record),
		ready: async adapter => {
			const s = await this.getForeignStateAsync(`${adapter}.info.connection`);
			return s?.val === true && s.ack === true && !s.q;
		},
		ensureOwnState: async id => {
			if (!id.startsWith(`${this.namespace}.telemetry.`)) {
				throw Error('logging_scope');
			}
			await this.setObjectNotExistsAsync(id.slice(this.namespace.length + 1), {
				type: 'state',
				common: { name: 'Generated adapter telemetry', type: 'string', role: 'json', read: true, write: false },
				native: {},
			});
		},
		send: (adapter, command, rows) => new Promise(resolve => this.sendTo(adapter, command, rows, resolve)),
	});
	private configuration = new ConfigurationStore(
		{
			read: async () => {
				const value = await this.getStateAsync('configuration.record');
				return typeof value?.val === 'string' ? (JSON.parse(value.val) as ConfigRecord) : null;
			},
			write: async record => {
				await this.setStateAsync('configuration.record', JSON.stringify(record), true);
			},
		},
		this.registry,
	);
	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({ ...options, name: 'adaptivehome' });
		this.on('ready', () => void this.ready());
		this.on('stateChange', (id, state) => {
			if (state && this.runtime) {
				void this.runtime
					.feedback(id, state as StateValue)
					.catch(() => this.log.warn('Feedback could not be persisted'));
			}
		});
		this.on('objectChange', () => this.runtime?.executor.invalidateAudit());
		this.on('message', obj => void this.message(obj));
		this.on('unload', callback => {
			if (this.timer) {
				clearInterval(this.timer);
			}
			this.runtime?.close();
			void deadline(
				Promise.all([
					this.setStateAsync('info.connection', false, true),
					...[...this.subscribedIds].flatMap(id => [
						this.unsubscribeForeignStatesAsync(id),
						this.unsubscribeForeignObjectsAsync(id),
					]),
				]),
				1000,
			)
				.catch(() => undefined)
				.finally(callback);
		});
	}
	private async ready(): Promise<void> {
		for (const definition of Array.isArray(this.config.integrationProfiles)
			? this.config.integrationProfiles
			: []) {
			try {
				registerDefinitions(this.registry, [definition]);
			} catch {
				this.log.warn('An optional integration definition was rejected');
			}
		}
		for (const client of Array.isArray(this.config.controlClients) ? this.config.controlClients : []) {
			const parsed = clientSchema.safeParse(client);
			if (parsed.success) {
				this.clients.push(parsed.data);
			} else {
				this.log.warn('An optional control client was rejected');
			}
		}
		await this.setObjectNotExistsAsync('configuration.record', {
			type: 'state',
			common: {
				name: 'Authoritative configuration record',
				type: 'string',
				role: 'json',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.configuration.load();
		this.runtime = new HomeRuntime(() => this.configuration.record.active, {
			authorizeBinding: binding => this.registry.validate(binding),
			read: async id =>
				this.sourceConnections.metadata(id)
					? this.sourceConnections.read(id)
					: this.nativeConnections.metadata(id)
						? this.nativeConnections.read(id)
						: ((await this.getForeignStateAsync(id)) as StateValue | null),
			metadata: async id => {
				const virtual = this.sourceConnections.metadata(id) ?? this.nativeConnections.metadata(id);
				if (virtual) {
					return virtual;
				}
				const obj = await this.getForeignObjectAsync(id);
				return obj?.type === 'state' ? (obj.common as StateMetadata) : null;
			},
			write: async (id, value) => {
				if (this.nativeConnections.handles(id)) {
					await this.nativeConnections.write(id, value);
					return;
				}
				if (/^adaptivehome\./.test(id)) {
					throw Error('protected_state');
				}
				await this.setForeignStateAsync(id, value, false);
			},
			writeNative: async (id, program, dispatchDeadline) => {
				if (Date.now() >= dispatchDeadline) {
					throw Error('command_expired');
				}
				if (this.nativeConnections.handles(id)) {
					await this.nativeConnections.write(id, JSON.stringify(program), dispatchDeadline);
					return;
				}
				if (/^adaptivehome\./.test(id)) {
					throw Error('protected_state');
				}
				await this.setForeignStateAsync(id, JSON.stringify(program), false);
			},
			send: (adapter, command, payload) =>
				new Promise(resolve => this.sendTo(adapter, command, payload, resolve)),
			persist: (key, value) => this.persistJournal(key, value),
		});
		const journal = await this.getStateAsync('journal.execution');
		await this.runtime.initialize(
			typeof journal?.val === 'string' ? (JSON.parse(journal.val) as ExecutionJournal) : undefined,
		);
		const history = await this.getStateAsync('journal.history');
		if (typeof history?.val === 'string') {
			try {
				this.runtime.history.restore(JSON.parse(history.val));
			} catch {
				this.runtime.history.dropped++;
			}
		}
		const incidents = await this.getStateAsync('journal.incidents');
		if (typeof incidents?.val === 'string') {
			try {
				this.runtime.incidents.restore(JSON.parse(incidents.val));
			} catch {
				this.log.warn('Incident journal could not be read');
			}
		}
		const operations = await this.getStateAsync('journal.operations');
		if (typeof operations?.val === 'string') {
			try {
				this.guard.restore(JSON.parse(operations.val));
			} catch {
				this.guard.available = false;
				this.log.warn('Operation journal unavailable; new operator mutations are blocked');
			}
		}
		const learning = await this.getStateAsync('journal.learning');
		if (typeof learning?.val === 'string') {
			try {
				this.runtime.learning.restore(JSON.parse(learning.val));
			} catch {
				this.log.warn('Learning journal unavailable; classical control continues');
			}
		}
		const adaptation = await this.getStateAsync('journal.adaptation');
		if (typeof adaptation?.val === 'string') {
			try {
				this.runtime.adaptation.restore(JSON.parse(adaptation.val));
			} catch {
				this.log.warn('Adaptation journal unavailable; classical control continues');
			}
		}
		const budgets = await this.getStateAsync('journal.providerBudgets');
		if (typeof budgets?.val === 'string') {
			try {
				this.provider.restore(JSON.parse(budgets.val));
			} catch {
				this.provider.available = false;
				this.log.warn('Provider budget unavailable; optional model calls are blocked');
			}
		}
		await this.subscriptions();
		const sqlJournal = await this.getStateAsync('journal.sqlLogging');
		if (typeof sqlJournal?.val === 'string') {
			try {
				this.sqlLogging.restore(JSON.parse(sqlJournal.val));
			} catch {
				this.sqlLogging.restore(null);
			}
		}
		this.runtime.history.onRecord = (kind, row) =>
			this.sqlLogging.enqueue(kind, row, this.configuration.record.active.logging);
		await this.configuration.applied(this.configuration.record.active.revision);
		await this.setObjectNotExistsAsync('info.connection', {
			type: 'state',
			common: { name: 'Runtime ready', type: 'boolean', role: 'indicator.connected', read: true, write: false },
			native: {},
		});
		await this.setStateAsync('info.connection', true, true);
		this.timer = setInterval(
			() =>
				void this.connectedTick().catch(() =>
					this.log.warn('A runtime round failed; no global device action was issued'),
				),
			1000,
		);
	}
	private async connectedTick(): Promise<void> {
		if (this.connectionRound) {
			return;
		}
		this.connectionRound = true;
		try {
			const c = this.configuration.record.active;
			// Optional I/O refreshes in the background. A hung source cannot suspend healthy functions.
			void Promise.all([
				this.sourceConnections.refresh(c.connections),
				this.nativeConnections.refresh(c.nativeTransports),
			]).catch(() => undefined);
			if (c !== this.configuration.record.active) {
				return;
			}
			await this.runtime.tick();
			void this.sqlLogging.flush(c.logging).catch(() => undefined);
		} finally {
			this.connectionRound = false;
		}
	}
	private async persistJournal(key: string, value: unknown): Promise<void> {
		await this.setObjectNotExistsAsync(`journal.${key}`, {
			type: 'state',
			common: { name: `Private ${key} journal`, type: 'string', role: 'json', read: true, write: false },
			native: {},
		});
		await this.setStateAsync(`journal.${key}`, JSON.stringify(value), true);
	}
	private async subscriptions(): Promise<void> {
		this.sourceConnections.configure(this.configuration.record.active.connections);
		this.nativeConnections.configure(this.configuration.record.active.nativeTransports);
		this.runtime.configure();
		const next = new Set<string>();
		for (const binding of this.configuration.record.active.bindings) {
			for (const mapping of binding.capabilities) {
				for (const id of new Set(
					[
						mapping.readId,
						mapping.writeId,
						mapping.confirmId,
						mapping.eventTimestampId,
						mapping.freshness?.verifiedAtId,
						mapping.freshness?.reachableId,
					].filter((v): v is string => !!v),
				)) {
					next.add(id);
				}
			}
		}
		for (const id of this.subscribedIds) {
			if (!next.has(id)) {
				await this.unsubscribeForeignStatesAsync(id);
				await this.unsubscribeForeignObjectsAsync(id);
			}
		}
		for (const id of next) {
			if (!this.subscribedIds.has(id)) {
				await this.subscribeForeignStatesAsync(id);
				await this.subscribeForeignObjectsAsync(id);
			}
		}
		this.subscribedIds = next;
	}
	private activateConfiguration(data: ioBroker.MessagePayload, rollback = false): Promise<unknown> {
		const next = this.configurationTasks
			.catch(() => undefined)
			.then(async () => {
				const result = rollback
					? await this.configuration.rollback(data.expectedRevision)
					: await this.configuration.activate(data.configuration, data.expectedRevision);
				await this.subscriptions();
				await this.configuration.applied(result.revision);
				return result;
			});
		this.configurationTasks = next;
		return next;
	}
	private async message(obj: ioBroker.Message): Promise<void> {
		if (!obj.callback) {
			return;
		}
		let result: unknown;
		let operationKey: string | undefined;
		const originalCommand = obj.command;
		let command = obj.command,
			data = obj.message,
			remoteScope: string | undefined;
		try {
			if (command === 'control') {
				const envelope = verifyControl(obj.from, data, this.clients, this.config.controlSecret ?? '');
				if (envelope.expiresAt <= Date.now() || envelope.expiresAt > Date.now() + 300000) {
					throw new Error('request_expired');
				}
				if (envelope.expectedRevision !== this.configuration.record.active.revision) {
					throw new Error('revision_conflict');
				}
				remoteScope = envelope.functionId;
				data = envelope;
				command = ['pause', 'cancel', 'revert'].includes(envelope.action) ? 'adaptation' : envelope.action;
			} else if (!this.guard.isAdmin(obj.from) && command !== 'health') {
				throw new Error('admin_transport_required');
			}
			if (MUTATIONS.has(command)) {
				const reservation = await this.guard.reserve(
					obj.from,
					data,
					this.configuration.record.active.revision,
					Date.now(),
				);
				if (reservation.duplicate) {
					this.sendTo(obj.from, originalCommand, reservation.result, obj.callback);
					return;
				}
				operationKey = reservation.key;
			}
			switch (command) {
				case 'handoff':
				case 'commission': {
					if (
						!this.guard.isAdmin(obj.from) ||
						this.config.commissioningEnabled !== true ||
						!/^hmip\.\d+$/.test(this.config.commissioningBackend ?? '')
					)
						throw Error('commissioning_disabled');
					result = await deadline(
						new Promise(resolve =>
							this.sendTo(
								this.config.commissioningBackend!,
								command === 'commission' ? 'adaptivehomeCommission' : 'adaptivehomeHandoff',
								{ ...data.request, operator: obj.from },
								resolve,
							),
						),
						15000,
					);
					if (!result || typeof result !== 'object' || 'error' in result)
						throw Error('maintenance_backend_rejected');
					break;
				}
				case 'health':
					result = { ready: !!this.runtime, revision: this.configuration.record.active.revision };
					break;
				case 'status': {
					result = this.runtime.status();
					Object.assign(result as object, {
						logging: this.sqlLogging.state(),
						connections: { sources: this.sourceConnections.errors, native: this.nativeConnections.errors },
					});
					if (remoteScope) {
						const status = result as {
							functions: Record<string, unknown>;
							traces: Record<string, unknown>;
						};
						result = {
							functions: { [remoteScope]: status.functions[remoteScope] },
							traces: { [remoteScope]: status.traces[remoteScope] },
						};
					}
					break;
				}
				case 'getConfiguration':
					result = this.configuration.record;
					break;
				case 'discover': {
					const objects: Record<string, StateMetadata> = {};
					const context: DiscoveryContext = { resources: {} };
					for (const profile of this.registry.list()) {
						for (const backend of profile.backends) {
							for (const type of ['channel', 'device'] as const) {
								const parents = await this.getObjectViewAsync('system', type, {
									startkey: `${backend}.`,
									endkey: `${backend}.\u9999`,
								});
								for (const row of parents.rows.slice(0, 10000)) {
									const native = row.value?.native;
									context.resources[row.id] = {
										role: row.value?.common?.role,
										type: typeof native?.type === 'string' ? native.type : undefined,
										id: ['string', 'number'].includes(typeof native?.id)
											? String(native.id)
											: undefined,
									};
								}
							}
							const view = await this.getObjectViewAsync('system', 'state', {
								startkey: `${backend}.`,
								endkey: `${backend}.\u9999`,
							});
							for (const row of view.rows.slice(0, 10000)) {
								if (row.value?.common) {
									objects[row.id] = row.value.common as StateMetadata;
								}
							}
						}
					}
					result = addTypeHints(discoverProfiles(objects, this.registry, context), objects);
					break;
				}
				case 'previewConfiguration':
					result = this.configuration.preview(data);
					break;
				case 'exportConfiguration':
					result = this.configuration.export();
					break;
				case 'applyConfiguration':
					result = await this.activateConfiguration(data);
					break;
				case 'rollbackConfiguration':
					result = await this.activateConfiguration(data, true);
					break;
				case 'manual':
					result = await this.runtime.manual(data.functionId, data.value, data.requestId, obj.from);
					break;
				case 'resume':
					result = await this.runtime.executor.resume(data.functionId);
					break;
				case 'scene': {
					const scene = this.configuration.record.active.scenes.find(s => s.id === data.sceneId);
					if (!scene) {
						throw new Error('unknown_scene');
					}
					result = await Promise.all(
						scene.actions.map(async action => {
							try {
								return {
									functionId: action.functionId,
									result: await this.runtime.manual(
										action.functionId,
										action.value,
										`${data.requestId}:${action.functionId}`,
										obj.from,
									),
								};
							} catch (error) {
								return {
									functionId: action.functionId,
									error: error instanceof Error ? error.message : 'scene_action_failed',
								};
							}
						}),
					);
					break;
				}
				case 'reconcile':
					result = await this.runtime.executor.reconcile(data.functionId);
					break;
				case 'supportExport':
					result = this.runtime.history.supportExport();
					break;
				case 'clearHistory':
					this.runtime.history.clear();
					await this.setStateAsync('journal.history', JSON.stringify(this.runtime.history.record), true);
					result = true;
					break;
				case 'modelCandidate': {
					const fn = this.configuration.record.active.functions.find(f => f.id === data.functionId);
					if (!fn) {
						throw new Error('unknown_function');
					}
					const model = this.runtime.learning.record.models[fn.id]?.at(-1);
					result = await this.provider.propose(
						providerSchema.parse(this.config.modelProvider),
						this.config.modelToken ?? '',
						fn,
						this.configuration.record.active.revision,
						Date.now(),
						model
							? {
									type: model.modelType,
									coverage: model.coverage,
									baselineMAE: model.baselineMAE,
									candidateMAE: model.candidateMAE,
								}
							: {},
					);
					break;
				}
				case 'adaptation':
					result = await this.runtime.adaptation.action(
						data.functionId,
						data.action,
						this.configuration.record.active,
						this.runtime.learning.record.models,
						this.runtime.history,
						this.runtime.executor.journal,
						Date.now(),
					);
					break;
				default:
					throw new Error('unknown_command');
			}
			const response = { ok: true, result };
			if (operationKey) {
				await this.guard.complete(operationKey, response);
			}
			this.sendTo(obj.from, originalCommand, response, obj.callback);
		} catch (error) {
			const response = { ok: false, error: error instanceof Error ? error.message : 'request_failed' };
			if (operationKey) {
				try {
					await this.guard.complete(operationKey, response);
				} catch {
					this.log.warn('Operation result could not be persisted');
				}
			}
			this.sendTo(obj.from, originalCommand, response, obj.callback);
		}
	}
}
if (require.main !== module) {
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Adaptivehome(options);
} else {
	new Adaptivehome();
}
