import { randomUUID } from 'node:crypto';
import type {
	CapabilityMapping,
	Command,
	Configuration,
	FunctionConfig,
	Intent,
	Observation,
	Scalar,
	DeviceBinding,
} from '../model/contracts';
import { validateValue } from '../config/configuration';
import type { StateMetadata, StateValue } from '../integrations/registry';
import { auditMapping, normalize } from '../integrations/registry';
import type { Clock } from '../runtime/clock';
import { deadline, systemClock } from '../runtime/clock';
import { conditionMatches } from './conditions';
import { windowMatches } from '../config/schedule';

export interface ManualWish {
	at: number;
	until: number;
	actor: string;
	value: Scalar;
}
export interface ExecutionJournal {
	commands: Command[];
	manual: Record<string, ManualWish>;
	budgets: Record<string, number[]>;
	transitions: Record<
		string,
		{
			at: number;
			value: Scalar;
		}
	>;
	blocked: Record<string, string>;
}
export interface ExecutionPort {
	authorizeBinding?(binding: DeviceBinding): void;
	read(id: string): Promise<StateValue | null>;
	metadata(id: string): Promise<StateMetadata | null>;
	write(id: string, value: Scalar): Promise<void>;
	persist(journal: ExecutionJournal): Promise<void>;
	inputs(fn: FunctionConfig): Promise<Record<string, Observation | null>>;
}
/** Freshness still uses ts. lc may only bridge <=1s of host clock jitter for a changed value. */
function followsDispatch(state: StateValue, sentAt: number, now: number): boolean {
	return (
		state.ts >= sentAt ||
		(state.ts >= sentAt - 1000 &&
			typeof state.lc === 'number' &&
			Number.isFinite(state.lc) &&
			state.lc >= sentAt &&
			state.lc <= now)
	);
}
export class Executor {
	readonly generation = randomUUID();
	journal: ExecutionJournal = { commands: [], manual: {}, budgets: {}, transitions: {}, blocked: {} };
	private active = new Set<string>();
	private audits = new Map<
		string,
		{
			at: number;
			valid: boolean;
		}
	>();
	private persistTail: Promise<void> = Promise.resolve();
	constructor(
		private configuration: () => Configuration,
		private port: ExecutionPort,
		private clock: Clock = systemClock,
	) {}
	async restore(saved?: ExecutionJournal): Promise<void> {
		if (saved) {
			this.journal = saved;
		}
		for (const command of this.journal.commands) {
			if (['requested', 'validated', 'accepted'].includes(command.phase) && !command.feedbackMatched) {
				command.phase = 'uncertain';
				command.uncertainty = 'restart_requires_reconciliation';
				this.journal.blocked[command.physicalId] = command.commandId;
			}
		}
		await this.persist();
	}
	private persist(): Promise<void> {
		const snapshot = structuredClone(this.journal);
		const next = this.persistTail.catch(() => undefined).then(() => this.port.persist(snapshot));
		this.persistTail = next;
		return next;
	}
	private binding(fn: FunctionConfig): {
		physicalId: string;
		mapping: CapabilityMapping;
	} {
		const binding = this.configuration().bindings.find(b => b.id === fn.actuator.entityId);
		if (binding) {
			this.port.authorizeBinding?.(binding);
		}
		const mapping = binding?.capabilities.find(m => m.capability === fn.actuator.capability);
		if (!binding?.confirmed || !mapping?.writeId || !mapping.confirmId || mapping.confirmation === 'none') {
			throw new Error('binding_not_authorized');
		}
		return { physicalId: binding.physicalId, mapping };
	}
	async execute(intent: Intent): Promise<Command> {
		const existing = this.journal.commands.find(c => c.intent.intentId === intent.intentId);
		if (existing) {
			return structuredClone(existing);
		}
		const config = this.configuration(),
			fn = config.functions.find(f => f.id === intent.functionId);
		if (!fn) {
			throw new Error('unknown_function');
		}
		const { physicalId, mapping } = this.binding(fn);
		if (this.active.has(physicalId)) {
			throw new Error('device_busy');
		}
		this.active.add(physicalId);
		try {
			if (this.journal.blocked[physicalId]) {
				throw new Error('device_uncertain_reconcile');
			}
			const now = this.clock.now();
			if (
				config.revision !== intent.configRevision ||
				intent.entityId !== fn.actuator.entityId ||
				intent.capability !== fn.actuator.capability
			) {
				throw new Error('revision_or_scope_changed');
			}
			if (!fn.enabled || intent.validFrom > now || intent.expiresAt <= now) {
				throw new Error('intent_expired_or_disabled');
			}
			if (
				fn.operatingMode === 'maintenance' &&
				intent.origin !== 'manual' &&
				intent.reasonCode !== 'technical_protection'
			) {
				throw new Error('maintenance');
			}
			validateValue(fn, intent.typedValue, mapping.valueType, mapping.min, mapping.max, mapping.values);
			const audit = this.audits.get(physicalId);
			if (!audit || now - audit.at > (audit.valid ? 30000 : 1000)) {
				try {
					const metadata: Record<string, StateMetadata> = {};
					for (const id of new Set([mapping.readId, mapping.writeId!, mapping.confirmId!])) {
						const meta = await this.port.metadata(id);
						if (meta) {
							metadata[id] = meta;
						}
					}
					auditMapping(mapping, metadata);
					this.audits.set(physicalId, { at: now, valid: true });
				} catch (error) {
					this.audits.set(physicalId, { at: now, valid: false });
					throw error;
				}
			} else if (!audit.valid) {
				throw new Error('audit_retry_wait');
			}
			const inputs = await this.port.inputs(fn);
			for (const dependency of fn.dependencies) {
				const prerequisite = config.functions.find(f => f.id === dependency.functionId)!;
				const prerequisiteBinding = config.bindings.find(b => b.id === prerequisite.actuator.entityId)!;
				const prerequisiteMapping = prerequisiteBinding.capabilities.find(
					c => c.capability === prerequisite.actuator.capability,
				)!;
				const raw = await this.port.read(prerequisiteMapping.confirmId!);
				const observed = normalize(prerequisiteBinding, prerequisiteMapping, raw, this.clock.now());
				if (
					!raw?.ack ||
					observed.quality !== 'valid' ||
					observed.value !== dependency.requiredValue ||
					(dependency.confirmation === 'device' && prerequisiteMapping.confirmation !== 'device')
				) {
					throw new Error('dependency_unconfirmed');
				}
			}
			const protections = fn.limits.protection.filter(p => conditionMatches(p.when, inputs) === true);
			const unknownProtection = fn.limits.protection.some(p => conditionMatches(p.when, inputs) === null);
			if (unknownProtection) {
				throw new Error('protection_unknown');
			}
			if (new Set(protections.map(p => JSON.stringify(p.value))).size > 1) {
				throw new Error('conflicting_protection');
			}
			if (protections.length && intent.typedValue !== protections[0].value) {
				throw new Error('technical_protection');
			}
			if (fn.limits.essential && !protections.length && intent.typedValue !== fn.limits.minimumValue) {
				throw new Error('minimum_service');
			}
			if (
				fn.limits.allowedWindows.length &&
				!protections.length &&
				!fn.limits.essential &&
				!fn.limits.allowedWindows.some(window => windowMatches(window, this.clock.now(), config.timezone))
			) {
				throw new Error('outside_operating_window');
			}
			const manual = this.journal.manual[physicalId];
			if (manual && manual.until > this.clock.now() && intent.origin !== 'manual' && !protections.length) {
				throw new Error('manual_priority');
			}
			const recent = (this.journal.budgets[physicalId] || []).filter(at => now - at < 3600000 || at > now);
			if (recent.length >= fn.limits.commandsPerHour) {
				throw new Error('command_budget');
			}
			const last = this.journal.transitions[physicalId];
			const minimum = last?.value === false || last?.value === 0 ? fn.limits.minOffMs : fn.limits.minOnMs;
			if (last && last.value !== intent.typedValue && now - last.at < minimum && !protections.length) {
				throw new Error('minimum_dwell');
			}
			// Recheck after every asynchronous preflight; a new revision or hand wish wins.
			if (this.configuration().revision !== intent.configRevision || intent.expiresAt <= this.clock.now()) {
				throw new Error('preflight_stale');
			}
			const currentWish = this.journal.manual[physicalId];
			if (
				currentWish &&
				currentWish.until > this.clock.now() &&
				intent.origin !== 'manual' &&
				!protections.length
			) {
				throw new Error('manual_priority');
			}
			const pending = this.journal.commands.find(
				c => c.physicalId === physicalId && c.phase === 'accepted' && !c.feedbackMatched,
			);
			if (pending) {
				throw new Error('awaiting_feedback');
			}
			const command: Command = {
				commandId: randomUUID(),
				intent: structuredClone(intent),
				generation: this.generation,
				targetPath: mapping.writeId!,
				physicalId,
				deadline: Math.min(intent.expiresAt, now + 30000),
				idempotencyKey: intent.intentId,
				phase: 'validated',
				dispatchAccepted: false,
				feedbackMatched: false,
				deviceConfirmed: false,
				sentAt: this.clock.now(),
			};
			this.journal.commands.push(command);
			this.journal.commands = this.journal.commands.slice(-512);
			this.journal.budgets[physicalId] = [...recent, now];
			if (intent.origin === 'manual') {
				this.journal.manual[physicalId] = {
					at: now,
					until: now + fn.limits.manualHoldMs,
					value: intent.typedValue,
					actor: intent.actor,
				};
			}
			await this.persist(); // Reserve quota and idempotency before dispatch, also across crashes.
			const latestInputs = await this.port.inputs(fn),
				latestProtection = fn.limits.protection.filter(p => conditionMatches(p.when, latestInputs) === true);
			const blockedByHuman =
				this.journal.manual[physicalId] &&
				this.journal.manual[physicalId].until > this.clock.now() &&
				intent.origin !== 'manual' &&
				!latestProtection.length;
			if (
				this.configuration().revision !== intent.configRevision ||
				intent.expiresAt <= this.clock.now() ||
				blockedByHuman ||
				fn.limits.protection.some(p => conditionMatches(p.when, latestInputs) === null) ||
				latestProtection.some(p => p.value !== intent.typedValue)
			) {
				command.phase = 'failed';
				command.uncertainty = 'preflight_cancelled_before_dispatch';
				await this.persist();
				throw new Error('dispatch_conditions_changed');
			}
			command.phase = 'accepted';
			try {
				let value: Scalar =
					typeof intent.typedValue === 'number'
						? (intent.typedValue - mapping.offset) / mapping.scale
						: intent.typedValue;
				if (mapping.valueMap) {
					const encoded = Object.entries(mapping.valueMap).find(([, v]) => v === value)?.[0];
					if (encoded === undefined) {
						throw new Error('unknown_device_code');
					}
					value =
						mapping.sourceType === 'number'
							? Number(encoded)
							: mapping.sourceType === 'boolean'
								? encoded === 'true'
								: encoded;
				}
				await this.port.write(mapping.writeId!, value);
				command.dispatchAccepted = true;
			} catch {
				command.phase = 'uncertain';
				command.uncertainty = 'dispatch_result_unknown';
				this.journal.blocked[physicalId] = command.commandId;
			}
			await this.persist();
			return structuredClone(command);
		} finally {
			this.active.delete(physicalId);
		}
	}
	async feedback(id: string, state: StateValue): Promise<void> {
		const config = this.configuration(),
			now = this.clock.now();
		for (const fn of config.functions) {
			let target: { physicalId: string; mapping: CapabilityMapping };
			try {
				target = this.binding(fn);
			} catch {
				continue;
			}
			const { physicalId, mapping } = target;
			if (![mapping.readId, mapping.writeId, mapping.confirmId].includes(id)) {
				continue;
			}
			const candidates = this.journal.commands.filter(
				c =>
					c.physicalId === physicalId &&
					c.generation === this.generation &&
					c.deadline >= now &&
					c.phase === 'accepted' &&
					!c.feedbackMatched,
			);
			const ownDispatch = state.ack === false && !!state.from?.startsWith('system.adapter.adaptivehome.');
			if (ownDispatch) {
				continue;
			}
			const latest = candidates.at(-1);
			if (latest && state.ack && id === mapping.confirmId && !state.q && state.ts <= now) {
				if (!followsDispatch(state, latest.sentAt, now)) {
					latest.uncertainty = 'feedback_timestamp_before_dispatch';
					await this.persist();
					continue;
				}
				const binding = config.bindings.find(b => b.id === fn.actuator.entityId)!;
				const observation = normalize(binding, { ...mapping, readId: id }, state, now);
				const expected = latest.intent.typedValue,
					actual = observation.value;
				const matched =
					typeof actual === 'number' && typeof expected === 'number'
						? Math.abs(actual - expected) <= mapping.tolerance
						: actual === expected;
				if (observation.quality === 'valid' && matched) {
					latest.feedbackMatched = true;
					latest.deviceConfirmed = mapping.confirmation === 'device';
					latest.phase = latest.deviceConfirmed ? 'device_confirmed' : 'accepted';
					if (!latest.deviceConfirmed) {
						latest.uncertainty = 'backend_feedback_only';
					}
					this.journal.transitions[physicalId] = { at: now, value: expected };
					await this.persist();
					continue;
				}
				// An intermediate backend value is uncertain, not positive proof of human activity.
				latest.uncertainty = 'intermediate_or_external_feedback';
				await this.persist();
				continue;
			}
			const sourceBinding = config.bindings.find(b => b.id === fn.actuator.entityId)!;
			const normalized = normalize(sourceBinding, { ...mapping, readId: id }, state, now);
			if (!state.ack && !ownDispatch && normalized.quality === 'valid' && normalized.value !== null) {
				const value = normalized.value;
				this.journal.manual[physicalId] = {
					at: now,
					until: now + fn.limits.manualHoldMs,
					actor: 'external_state_command',
					value,
				};
				await this.persist();
			} else if (state.ack && !latest && normalized.quality === 'valid' && normalized.value !== null) {
				// A positively observed changed device value grants conservative manual priority.
				const previous = this.journal.transitions[physicalId];
				const value = normalized.value;
				if (previous && previous.value !== value && state.ts >= previous.at && !state.q) {
					this.journal.manual[physicalId] = {
						at: now,
						until: now + fn.limits.manualHoldMs,
						actor: 'external_device_change',
						value,
					};
					await this.persist();
				}
			}
		}
	}
	async expire(): Promise<void> {
		let changed = false;
		for (const command of this.journal.commands) {
			if (command.phase === 'accepted' && !command.feedbackMatched && command.deadline < this.clock.now()) {
				command.phase = 'uncertain';
				command.uncertainty = 'feedback_timeout';
				this.journal.blocked[command.physicalId] = command.commandId;
				changed = true;
			}
		}
		if (changed) {
			await this.persist();
		}
	}
	async pollFeedback(): Promise<void> {
		const pending = this.journal.commands.filter(
			c => c.generation === this.generation && c.phase === 'accepted' && !c.feedbackMatched,
		);
		await Promise.all(
			pending.map(async command => {
				const fn = this.configuration().functions.find(f => f.id === command.intent.functionId);
				if (!fn) {
					return;
				}
				try {
					const { mapping } = this.binding(fn);
					const state = await deadline(this.port.read(mapping.confirmId!), 1000);
					if (state) {
						await this.feedback(mapping.confirmId!, state);
					}
				} catch {
					/* A failed read affects only this pending command. */
				}
			}),
		);
	}
	async reconcile(functionId: string): Promise<boolean> {
		const fn = this.configuration().functions.find(f => f.id === functionId);
		if (!fn) {
			throw new Error('unknown_function');
		}
		const { physicalId, mapping } = this.binding(fn),
			blockedId = this.journal.blocked[physicalId];
		if (!blockedId) {
			return true;
		}
		const command = this.journal.commands.find(c => c.commandId === blockedId);
		const raw = await this.port.read(mapping.confirmId!);
		if (
			!command ||
			!raw?.ack ||
			raw.q ||
			!followsDispatch(raw, command.sentAt, this.clock.now()) ||
			raw.ts > this.clock.now() ||
			this.clock.now() - raw.ts > mapping.maxAgeMs
		) {
			return false;
		}
		const binding = this.configuration().bindings.find(b => b.id === fn.actuator.entityId)!;
		const observation = normalize(binding, { ...mapping, readId: mapping.confirmId! }, raw, this.clock.now());
		const actual = observation.value,
			expected = command.intent.typedValue;
		const matched =
			typeof actual === 'number' && typeof expected === 'number'
				? Math.abs(actual - expected) <= mapping.tolerance
				: actual === expected;
		if (observation.quality !== 'valid' || !matched) {
			return false;
		}
		delete this.journal.blocked[physicalId];
		command.feedbackMatched = true;
		command.deviceConfirmed = mapping.confirmation === 'device';
		command.uncertainty = 'reconciled_fresh_feedback';
		this.journal.transitions[physicalId] = { at: this.clock.now(), value: command.intent.typedValue };
		await this.persist();
		return true;
	}
	async resume(functionId: string): Promise<void> {
		const fn = this.configuration().functions.find(f => f.id === functionId);
		if (!fn) {
			throw new Error('unknown_function');
		}
		delete this.journal.manual[this.binding(fn).physicalId];
		await this.persist();
	}
	invalidateAudit(): void {
		this.audits.clear();
	}
}
