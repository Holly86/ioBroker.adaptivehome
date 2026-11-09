import { randomUUID } from 'node:crypto';
import type {
	Configuration,
	DecisionTrace,
	FunctionConfig,
	Intent,
	Observation,
	Scalar,
	DeviceBinding,
} from '../model/contracts';
import type { StateMetadata, StateValue } from '../integrations/registry';
import { readObservation } from '../integrations/registry';
import type { ExecutionJournal } from '../execution/executor';
import { Executor, manualActive } from '../execution/executor';
import type { Clock } from './clock';
import { deadline, systemClock } from './clock';
import { Supervisor } from './supervisor';
import { PresenceContext } from '../context/context';
import { History } from '../diagnostics/history';
import type { PolicyDecision, PolicyMemory } from '../policies/policy';
import { commonDecision, noAction } from '../policies/policy';
import { lightingDecision } from '../policies/lighting';
import { houseDecision } from '../policies/house';
import { airDecision, climateDecision } from '../policies/climate';
import { equipmentDecision } from '../policies/equipment';
import { IncidentService } from '../diagnostics/incidents';
import { LocalLearning } from '../learning/local';
import { AdaptationController } from '../learning/adaptation';
import { arbitrate } from '../execution/arbiter';
import { executionReason } from '../diagnostics/reasons';
export interface HomePort {
	authorizeBinding?(binding: DeviceBinding): void;
	read(id: string): Promise<StateValue | null>;
	metadata(id: string): Promise<StateMetadata | null>;
	write(id: string, value: Scalar): Promise<void>;
	persist(key: string, data: unknown): Promise<void>;
	send?(adapter: string, command: string, payload: Record<string, unknown>): Promise<unknown>;
}
export class HomeRuntime {
	supervisor = new Supervisor();
	readonly executor: Executor;
	readonly traces: Record<string, DecisionTrace> = {};
	readonly startedAt: number;
	private presence = new PresenceContext();
	readonly history = new History();
	readonly incidents: IncidentService;
	readonly learning: LocalLearning;
	readonly adaptation: AdaptationController;
	private lastHistoryFlush = 0;
	private memories: Record<string, PolicyMemory> = {};
	private proposals: Intent[] = [];
	private ticking = false;
	private round = 0;
	constructor(
		private config: () => Configuration,
		private port: HomePort,
		readonly clock: Clock = systemClock,
	) {
		this.startedAt = clock.now();
		this.learning = new LocalLearning(record => port.persist('learning', record));
		this.adaptation = new AdaptationController(record => port.persist('adaptation', record));
		this.incidents = new IncidentService(
			record => port.persist('incidents', record),
			async (...args) => (port.send ? port.send(...args) : undefined),
		);
		this.executor = new Executor(
			config,
			{ ...port, persist: journal => port.persist('execution', journal), inputs: fn => this.inputs(fn) },
			clock,
		);
	}
	async initialize(saved?: ExecutionJournal): Promise<void> {
		await this.executor.restore(saved);
		this.configure();
	}
	configure(): void {
		this.supervisor.close();
		this.supervisor = new Supervisor();
		this.executor.invalidateAudit();
		this.memories = {};
		this.round++;
		for (const fn of this.config().functions) {
			this.supervisor.register(fn.id, async () => {
				await this.evaluate(fn, this.round);
			});
		}
	}
	async inputs(fn: FunctionConfig): Promise<Record<string, Observation | null>> {
		const result: Record<string, Observation | null> = {};
		await Promise.all(
			Object.entries(fn.inputs).map(async ([name, ref]) => {
				const binding = this.config().bindings.find(b => b.id === ref.entityId),
					mapping = binding?.capabilities.find(m => m.capability === ref.capability);
				let observation =
					binding && mapping
						? await readObservation(
								binding,
								mapping,
								id => this.port.read(id),
								() => this.clock.now(),
							)
						: null;
				if (observation && name === 'presence') {
					observation = this.presence.evaluate(
						fn.id,
						observation,
						this.clock.now(),
						fn.parameters.absenceConfirmMs ?? 300000,
						fn.parameters.presenceConfirmations ?? 1,
					);
				}
				result[name] = observation;
				if (observation) {
					this.history.observation(observation);
				}
			}),
		);
		await this.executor.observeManualInputs(fn, result);
		return result;
	}
	async manual(functionId: string, value: Scalar, requestId: string, actor: string): Promise<unknown> {
		const fn = this.config().functions.find(f => f.id === functionId);
		if (!fn) {
			throw new Error('unknown_function');
		}
		const now = this.clock.now();
		const intent: Intent = {
			...fn.actuator,
			intentId: requestId,
			functionId,
			typedValue: value,
			origin: 'manual',
			actor,
			reasonCode: 'manual',
			reasonText: 'Explicit manual request',
			sourceSnapshotId: randomUUID(),
			configRevision: this.config().revision,
			priority: 800,
			validFrom: now,
			expiresAt: now + 10000,
		};
		return this.executor.execute(intent);
	}
	async tick(): Promise<void> {
		if (this.ticking) {
			return;
		}
		this.ticking = true;
		try {
			this.proposals = [];
			await deadline(this.executor.pollFeedback(), 100).catch(() => undefined);
			await this.executor.expire();
			try {
				await deadline(
					this.adaptation.advance(
						this.config(),
						this.learning.record.models,
						this.history,
						this.executor.journal,
						this.clock.now(),
					),
					100,
				);
			} catch {
				/* Classical control remains available on adaptation storage failure. */
			}
			await this.supervisor.tick();
			const decisions = arbitrate(this.proposals, this.config());
			await Promise.all(
				decisions.accepted.map(async intent => {
					try {
						const command = await deadline(this.executor.execute(intent), 2000);
						const trace = this.traces[intent.functionId];
						if (trace) {
							trace.command = command;
						}
						const fn = this.config().functions.find(f => f.id === intent.functionId)!;
						if (
							intent.reasonCode === 'motion_on' ||
							intent.reasonCode === 'house_welcome_on' ||
							(intent.planId &&
								fn.kind === 'lighting' &&
								intent.typedValue !== false &&
								intent.typedValue !== 0)
						) {
							this.memories[intent.functionId].commandId = command.commandId;
							this.memories[intent.functionId].ownerManualAt =
								this.executor.journal.manual[command.physicalId]?.at ?? 0;
						}
						if (
							[
								'motion_quiet_expired',
								'house_welcome_expired',
								'house_session_expired',
								'house_away_off',
							].includes(intent.reasonCode)
						) {
							delete this.memories[intent.functionId].commandId;
							delete this.memories[intent.functionId].sessionUntil;
							delete this.memories[intent.functionId].welcomeUntil;
						}
						this.history.event({
							at: this.clock.now(),
							type: 'command',
							scope: intent.functionId,
							code: command.phase,
							revision: this.config().revision,
							commandId: command.commandId,
						});
					} catch (error) {
						const trace = this.traces[intent.functionId];
						if (trace) {
							trace.reasonCode = executionReason(error);
							trace.reasonText = trace.reasonCode;
						}
					}
				}),
			);
			for (const trace of Object.values(this.traces)) {
				if (/unknown|unavailable|unverified|failed|uncertain|budget|audit/.test(trace.reasonCode)) {
					this.incidents.upsert(trace.functionId, trace.reasonCode, 'warning', this.clock.now());
				} else {
					this.incidents.resolveScope(trace.functionId, this.clock.now());
				}
			}
			for (const fn of this.config().functions) {
				this.learning.observe(fn, this.config(), this.history, this.clock.now());
			}
			void this.incidents.tick(this.config(), this.clock.now()).catch(() => undefined);
			if (this.clock.now() - this.lastHistoryFlush >= 30000) {
				this.history.rotate(this.clock.now());
				this.lastHistoryFlush = this.clock.now();
				try {
					await this.port.persist('history', this.history.record);
					this.history.storageError = false;
				} catch {
					this.history.storageError = true;
				}
			}
		} finally {
			this.ticking = false;
		}
	}
	private async evaluate(fn: FunctionConfig, round: number): Promise<void> {
		const config = this.config(),
			inputs = await this.inputs(fn),
			binding = config.bindings.find(b => b.id === fn.actuator.entityId)!;
		const mapping = binding.capabilities.find(c => c.capability === fn.actuator.capability)!;
		const actual = await readObservation(
			binding,
			mapping,
			id => this.port.read(id),
			() => this.clock.now(),
		);
		await this.executor.observeActuator(fn, actual);
		const now = this.clock.now();
		this.history.observation(actual);
		if (round !== this.round || config.revision !== this.config().revision) {
			return;
		}
		const memory = (this.memories[fn.id] ??= {}),
			wish = this.executor.journal.manual[binding.physicalId];
		const ownCommand = this.executor.journal.commands.find(c => c.commandId === memory.commandId);
		const owns =
			!!ownCommand?.feedbackMatched &&
			ownCommand.generation === this.executor.generation &&
			(!wish || wish.at <= (memory.ownerManualAt ?? 0));
		if (wish && wish.at > (memory.ownerManualAt ?? 0)) {
			delete memory.commandId;
		}
		const context = {
			now,
			startedAt: this.startedAt,
			timezone: config.timezone,
			inputs,
			actual,
			owns,
			manual: manualActive(wish, now),
			manualAt: wish?.at,
			manualValue: wish?.value,
		};
		const effective = this.adaptation.effective(fn, config, context.manual);
		const baseDecision =
			effective.kind === 'lighting'
				? lightingDecision(effective, context, memory)
				: effective.kind === 'climate'
					? climateDecision(effective, context, memory)
					: effective.kind === 'air'
						? airDecision(effective, context, memory)
						: equipmentDecision(effective, context);
		const house = houseDecision(effective, context, memory);
		const common = commonDecision(effective, {
			...context,
			manual: context.manual && house?.manualLeaseAt === undefined,
		});
		let decision: PolicyDecision = common ?? house ?? baseDecision;
		if (
			effective !== fn &&
			fn.kind === 'lighting' &&
			decision.value !== undefined &&
			decision.value !== false &&
			decision.value !== 0 &&
			fn.inputs.motion &&
			(memory.lastMotion ?? 0) <= this.startedAt
		) {
			decision = noAction(
				'learned_motion_waits_fresh_event',
				'A learned motion rule requires new movement after restart',
			);
		}
		const trace: DecisionTrace = {
			actual,
			desiredValue: decision.value,
			at: now,
			functionId: fn.id,
			configRevision: config.revision,
			reasonCode: decision.reason,
			reasonText: decision.text,
			inputs,
			nextStep: decision.nextAt ? new Date(decision.nextAt).toISOString() : undefined,
		};
		this.traces[fn.id] = trace;
		this.history.event({
			at: now,
			type: 'decision',
			scope: fn.id,
			code: decision.reason,
			revision: config.revision,
		});
		if (decision.value === undefined) {
			return;
		}
		if (
			actual.quality === 'valid' &&
			(actual.value === decision.value ||
				(actual.scheduledValue === decision.value && (actual.scheduledUntil ?? 0) > now))
		) {
			trace.nextStep = 'Already matches the requested value';
			return;
		}
		const active = effective !== fn && decision.priority < 800 ? this.adaptation.active(fn.id) : undefined;
		const intent: Intent = {
			...fn.actuator,
			intentId: randomUUID(),
			functionId: fn.id,
			typedValue: decision.value,
			origin: active ? 'learned_policy' : 'configured_rule',
			planId: active?.plan.planId,
			actor: 'policy',
			reasonCode: decision.reason,
			reasonText: decision.text,
			sourceSnapshotId: randomUUID(),
			configRevision: config.revision,
			priority: decision.priority,
			manualLeaseAt: decision.manualLeaseAt,
			guardInputs:
				/^(motion_|house_)/.test(decision.reason) || fn.climate
					? Object.fromEntries(
							Object.entries(inputs)
								.filter(
									([name, observation]) =>
										(fn.climate || ['motion', 'presence', 'inhibit'].includes(name)) &&
										observation?.quality === 'valid',
								)
								.map(([name, observation]) => [
									name,
									{ measuredAt: observation!.measuredAt, value: observation!.value },
								]),
						)
					: undefined,
			validFrom: now,
			expiresAt: Math.min(decision.expiresAt ?? now + 10000, now + 10000),
		};
		trace.intent = intent;
		this.proposals.push(intent);
	}
	async feedback(id: string, state: StateValue): Promise<void> {
		await this.executor.feedback(id, state);
		const command = this.executor.journal.commands.findLast(c => c.targetPath === id);
		if (command) {
			this.history.event({
				at: this.clock.now(),
				type: 'feedback',
				scope: command.intent.functionId,
				code: command.phase,
				revision: this.config().revision,
				commandId: command.commandId,
			});
		}
	}
	status(): unknown {
		return {
			functions: Object.fromEntries(this.supervisor.status),
			traces: this.traces,
			commands: this.executor.journal.commands.slice(-50),
			history: this.history.record.events.slice(-100),
			historyStorageError: this.history.storageError,
			incidents: this.incidents.record.incidents,
			learning: Object.fromEntries(
				this.config().functions.map(fn => [
					fn.id,
					{
						models: this.learning.record.models[fn.id],
						error: this.learning.record.errors[fn.id],
						active: this.adaptation.active(fn.id),
						plans: this.adaptation.record.plans.filter(p => p.plan.functionId === fn.id),
					},
				]),
			),
		};
	}
	close(): void {
		this.supervisor.close();
		this.learning.close();
	}
}
