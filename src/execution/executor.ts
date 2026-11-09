import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
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
import { auditMapping, normalize, readObservation, mappingReadIds } from '../integrations/registry';
import type { Clock } from '../runtime/clock';
import { deadline, systemClock } from '../runtime/clock';
import { conditionMatches } from './conditions';
import { windowMatches } from '../config/schedule';
import { compileNativeHeatingProgram, parseNativeHeatingReport } from '../integrations/native-program';

export interface ManualWish {
	at: number;
	until: number;
	actor: string;
	value: Scalar;
	quietRequiredMs?: number;
	quietSince?: number;
}
export const manualActive = (wish: ManualWish | undefined, now: number): boolean =>
	!!wish && (wish.quietRequiredMs !== undefined || wish.until > now);
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
	private signalBaselines = new Map<string, { at: number; seenAt: number; value: Scalar | null }>();
	private quietEvaluated = new Map<string, number>();
	private actuatorBaselines = new Map<string, Observation>();
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
		for (const wish of Object.values(this.journal.manual)) {
			delete wish.quietSince;
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
	async recordManual(fn: FunctionConfig, value: Scalar, actor: string): Promise<void> {
		const { physicalId } = this.binding(fn),
			now = this.clock.now();
		this.journal.manual[physicalId] = {
			at: now,
			until: now + fn.limits.manualHoldMs,
			value,
			actor,
			...((value === false || value === 0) && fn.behavior?.manualOffQuietMs
				? { quietRequiredMs: fn.behavior.manualOffQuietMs }
				: {}),
		};
		this.quietEvaluated.delete(physicalId);
		await this.persist();
	}
	async observeActuator(fn: FunctionConfig, observed: Observation): Promise<void> {
		const previous = this.actuatorBaselines.get(fn.id);
		if (observed.quality !== 'valid') {
			this.actuatorBaselines.delete(fn.id);
			return;
		}
		this.actuatorBaselines.set(fn.id, observed);
		if (
			!previous ||
			previous.value === observed.value ||
			observed.measuredAt <= previous.measuredAt ||
			observed.value === null
		) {
			return;
		}
		const binding = this.configuration().bindings.find(b => b.id === fn.actuator.entityId)!;
		const own = this.journal.commands.some(
			c =>
				c.physicalId === binding.physicalId &&
				c.sentAt <= observed.measuredAt &&
				((c.nativeProgram &&
					observed.programCommandId === c.commandId &&
					(observed.value === c.nativeProgram.target || observed.value === c.nativeProgram.fallback)) ||
					(c.generation === this.generation &&
						observed.measuredAt <= c.deadline &&
						c.intent.typedValue === observed.value)),
		);
		if (!own && (this.journal.manual[binding.physicalId]?.at ?? -1) < observed.measuredAt) {
			await this.recordManual(fn, observed.value, 'observed_device_change');
		}
	}
	private blocksManual(fn: FunctionConfig, intent: Intent): boolean {
		const binding = this.configuration().bindings.find(b => b.id === fn.actuator.entityId)!;
		const wish = this.journal.manual[binding.physicalId];
		const sessionLease =
			!!wish &&
			intent.manualLeaseAt !== undefined &&
			intent.reasonCode === 'house_session_expired' &&
			fn.behavior?.sessionOffMs !== undefined &&
			intent.manualLeaseAt === wish?.at &&
			(intent.typedValue === false || intent.typedValue === 0) &&
			wish.value !== false &&
			wish.value !== 0 &&
			this.clock.now() >= wish.at + fn.behavior.sessionOffMs;
		const awayLease =
			!!wish &&
			intent.manualLeaseAt !== undefined &&
			intent.reasonCode === 'house_away_off' &&
			fn.behavior?.awayOff &&
			intent.manualLeaseAt === wish.at &&
			intent.validFrom >= wish.at &&
			intent.guardInputs?.presence?.value === false &&
			(intent.typedValue === false || intent.typedValue === 0);
		return manualActive(wish, this.clock.now()) && !sessionLease && !awayLease && intent.origin !== 'manual';
	}
	private settleHouseLease(command: Command): void {
		const wish = this.journal.manual[command.physicalId];
		if (
			command.intent.reasonCode === 'house_away_off' &&
			wish &&
			wish.at === command.intent.manualLeaseAt &&
			wish.value !== false &&
			wish.value !== 0
		) {
			wish.until = this.clock.now();
		}
	}
	async observeManualInputs(fn: FunctionConfig, inputs: Record<string, Observation | null>): Promise<void> {
		const now = this.clock.now(),
			binding = this.configuration().bindings.find(b => b.id === fn.actuator.entityId)!;
		for (const name of new Set([
			...(fn.behavior?.manualSignatureInputs ?? []),
			...(fn.behavior?.manualSignals ?? []).map(s => s.input),
		])) {
			const observation = inputs[name],
				key = `${fn.id}:${name}`,
				previous = this.signalBaselines.get(key);
			if (!observation || observation.quality !== 'valid' || observation.measuredAt > now) {
				this.signalBaselines.delete(key);
				continue;
			}
			this.signalBaselines.set(key, { at: observation.measuredAt, seenAt: now, value: observation.value });
			if (
				!previous ||
				now - previous.seenAt > (fn.behavior?.continuityMs ?? 30000) ||
				observation.measuredAt <= previous.at ||
				now - observation.measuredAt > 20000
			) {
				continue;
			}
			const signal = fn.behavior?.manualSignals.find(s => s.input === name);
			if (!signal && previous.value === observation.value) {
				continue;
			}
			// A matching component of our own finite activation is not human input.
			const own = this.journal.commands.some(
				c =>
					c.physicalId === binding.physicalId &&
					c.generation === this.generation &&
					c.sentAt <= observation.measuredAt &&
					observation.measuredAt <= c.deadline &&
					c.effects?.some(e => e.capability === fn.inputs[name].capability && e.value === observation.value),
			);
			if (own && !signal) {
				continue;
			}
			let manualValue = !signal?.offValues.includes(observation.value!);
			if (!signal || signal.useActuatorValue) {
				const mapping = binding.capabilities.find(m => m.capability === fn.actuator.capability)!;
				const actual = await readObservation(
					binding,
					mapping,
					id => this.port.read(id),
					() => this.clock.now(),
				);
				manualValue =
					actual.quality === 'valid' && actual.value !== false && actual.value !== 0 && actual.value !== null;
			}
			await this.recordManual(fn, manualValue, `manual_input:${name}`);
		}
		const wish = this.journal.manual[binding.physicalId];
		if (wish?.quietRequiredMs === undefined) {
			return;
		}
		const motion = inputs.motion,
			previousAt = this.quietEvaluated.get(binding.physicalId);
		this.quietEvaluated.set(binding.physicalId, now);
		if (
			!motion ||
			motion.quality !== 'valid' ||
			motion.value !== false ||
			previousAt === undefined ||
			now - previousAt > (fn.behavior?.continuityMs ?? 30000)
		) {
			if (wish.quietSince !== undefined) {
				delete wish.quietSince;
				await this.persist();
			}
			return;
		}
		if (wish.quietSince === undefined) {
			wish.quietSince = now;
			await this.persist();
		}
		if (now - wish.quietSince >= wish.quietRequiredMs) {
			delete wish.quietRequiredMs;
			wish.until = now;
			await this.persist();
		}
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
		const config = this.configuration();
		const ownerBindings = new Set(config.bindings.filter(b => b.physicalId === binding.physicalId).map(b => b.id));
		const owners = config.functions.filter(candidate => ownerBindings.has(candidate.actuator.entityId));
		if (owners.length !== 1) {
			throw new Error('duplicate_function_owner');
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
		const binding = config.bindings.find(b => b.id === fn.actuator.entityId)!;
		const effects = [
			{ mapping, value: intent.typedValue },
			...(intent.typedValue !== false && intent.typedValue !== 0
				? (fn.activation ?? []).map(effect => {
						const component = binding.capabilities.find(m => m.capability === effect.capability);
						if (
							!component?.writeId ||
							!component.confirmId ||
							component.confirmation === 'none' ||
							component === mapping
						) {
							throw new Error('activation_mapping_invalid');
						}
						validateValue(
							{ ...fn, limits: { ...fn.limits, min: undefined, max: undefined } },
							effect.value,
							component.valueType,
							component.min,
							component.max,
							component.writeValues ?? component.values,
						);
						return { mapping: component, value: effect.value };
					})
				: []),
		];
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
			validateValue(
				fn,
				intent.typedValue,
				mapping.valueType,
				mapping.min,
				mapping.max,
				mapping.writeValues ?? mapping.values,
			);
			const audit = this.audits.get(physicalId);
			if (!audit || now - audit.at > (audit.valid ? 30000 : 1000)) {
				try {
					const metadata: Record<string, StateMetadata> = {};
					for (const id of new Set(effects.flatMap(e => mappingReadIds(e.mapping)))) {
						const meta = await this.port.metadata(id);
						if (meta) {
							metadata[id] = meta;
						}
					}
					for (const effect of effects) {
						auditMapping(effect.mapping, metadata);
					}
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
				const observed = await readObservation(
					prerequisiteBinding,
					{ ...prerequisiteMapping, readId: prerequisiteMapping.confirmId! },
					id => this.port.read(id),
					() => this.clock.now(),
				);
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
			if (this.blocksManual(fn, intent) && !protections.length) {
				throw new Error('manual_priority');
			}
			const recent = (this.journal.budgets[physicalId] || []).filter(at => now - at < 3600000 || at > now);
			if (recent.length + effects.length > fn.limits.commandsPerHour) {
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
			if (this.blocksManual(fn, intent) && !protections.length) {
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
				effects:
					effects.length > 1
						? effects.map(e => ({
								capability: e.mapping.capability,
								targetPath: e.mapping.writeId!,
								confirmId: e.mapping.confirmId!,
								value: e.value,
								matched: false,
							}))
						: undefined,
			};
			this.journal.commands.push(command);
			this.journal.commands = this.journal.commands.slice(-512);
			this.journal.budgets[physicalId] = [...recent, ...effects.map(() => now)];
			if (intent.origin === 'manual') {
				await this.recordManual(fn, intent.typedValue, intent.actor);
			}
			await this.persist(); // Reserve quota and idempotency before dispatch, also across crashes.
			const latestInputs = await this.port.inputs(fn),
				latestProtection = fn.limits.protection.filter(p => conditionMatches(p.when, latestInputs) === true);
			const blockedByHuman = this.blocksManual(fn, intent) && !latestProtection.length;
			if (
				this.configuration().revision !== intent.configRevision ||
				intent.expiresAt <= this.clock.now() ||
				blockedByHuman ||
				(intent.origin !== 'manual' &&
					!latestProtection.length &&
					fn.inputs.inhibit &&
					(latestInputs.inhibit?.quality !== 'valid' || latestInputs.inhibit.value !== false)) ||
				Object.entries(intent.guardInputs ?? {}).some(
					([name, expected]) =>
						latestInputs[name]?.quality !== 'valid' ||
						latestInputs[name]?.measuredAt !== expected.measuredAt ||
						latestInputs[name]?.value !== expected.value,
				) ||
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
				// Appearance components precede power. A partial write remains uncertain and locked.
				for (const effect of [...effects.slice(1), effects[0]]) {
					const mapping = effect.mapping;
					if (
						this.configuration().revision !== intent.configRevision ||
						intent.expiresAt <= this.clock.now() ||
						(!protections.length && this.blocksManual(fn, intent))
					) {
						throw new Error('dispatch_conditions_changed');
					}
					const currentInputs = await this.port.inputs(fn);
					if (
						Object.entries(intent.guardInputs ?? {}).some(
							([name, expected]) =>
								currentInputs[name]?.quality !== 'valid' ||
								currentInputs[name]?.measuredAt !== expected.measuredAt ||
								currentInputs[name]?.value !== expected.value,
						) ||
						fn.limits.protection.some(p => conditionMatches(p.when, currentInputs) === null) ||
						fn.limits.protection.some(
							p => conditionMatches(p.when, currentInputs) === true && p.value !== intent.typedValue,
						) ||
						(intent.origin !== 'manual' &&
							!protections.length &&
							fn.inputs.inhibit &&
							(currentInputs.inhibit?.quality !== 'valid' || currentInputs.inhibit.value !== false))
					) {
						throw new Error('dispatch_inputs_changed');
					}
					if (mapping.freshness || mapping.codec === 'nativeHeatingProgram') {
						const current = await readObservation(
							binding,
							mapping,
							id => this.port.read(id),
							() => this.clock.now(),
						);
						if (current.quality !== 'valid') {
							throw new Error('actuator_freshness_unavailable');
						}
					}
					if (
						(this.blocksManual(fn, intent) && !protections.length) ||
						this.configuration().revision !== intent.configRevision ||
						intent.expiresAt <= this.clock.now()
					) {
						throw new Error('dispatch_conditions_changed');
					}
					if (mapping.codec === 'nativeHeatingProgram') {
						const current = parseNativeHeatingReport((await this.port.read(mapping.readId))?.val);
						if (
							!current ||
							current.program.physicalId !== binding.physicalId ||
							current.program.profileId !== fn.nativeProgram?.profileId ||
							!current.automatic ||
							current.appOverride ||
							current.devicePending ||
							!current.fallbackVerified ||
							!current.absoluteExpiryVerified
						) {
							throw new Error('native_backend_not_ready');
						}
						command.nativeProgram = compileNativeHeatingProgram(
							fn,
							binding,
							Number(effect.value),
							this.clock.now(),
							config.timezone,
							command.commandId,
							intent.nativeFallback,
						);
						await this.persist();
						if (
							this.blocksManual(fn, intent) ||
							this.configuration().revision !== intent.configRevision ||
							intent.expiresAt <= this.clock.now()
						) {
							throw new Error('native_preflight_changed');
						}
						const verified = await this.port.inputs(fn);
						if (
							Object.entries(intent.guardInputs ?? {}).some(
								([name, expected]) =>
									verified[name]?.quality !== 'valid' ||
									verified[name]?.measuredAt !== expected.measuredAt ||
									verified[name]?.value !== expected.value,
							) ||
							this.blocksManual(fn, intent) ||
							this.configuration().revision !== intent.configRevision ||
							intent.expiresAt <= this.clock.now() ||
							fn.limits.protection.some(
								p =>
									conditionMatches(p.when, verified) === null ||
									(conditionMatches(p.when, verified) === true && p.value !== intent.typedValue),
							)
						) {
							throw new Error('native_preflight_changed');
						}
						await this.port.write(mapping.writeId!, JSON.stringify(command.nativeProgram));
						continue;
					}
					let value: Scalar =
						typeof effect.value === 'number'
							? (effect.value - mapping.offset) / mapping.scale
							: effect.value;
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
				}
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
			const compound = this.journal.commands.findLast(
				c =>
					c.physicalId === physicalId &&
					c.generation === this.generation &&
					c.phase === 'accepted' &&
					!c.feedbackMatched &&
					c.deadline >= now &&
					c.effects?.some(e => e.confirmId === id),
			);
			if (compound && state.ack && !state.q && state.ts <= now && followsDispatch(state, compound.sentAt, now)) {
				const component = compound.effects!.find(e => e.confirmId === id)!;
				const binding = config.bindings.find(b => b.id === fn.actuator.entityId)!;
				const componentMapping = binding.capabilities.find(m => m.capability === component.capability)!;
				const observed = normalize(
					binding,
					{ ...componentMapping, readId: id, freshness: undefined, eventTimestampId: undefined },
					state,
					now,
				);
				component.matched =
					observed.quality === 'valid' &&
					(typeof observed.value === 'number' && typeof component.value === 'number'
						? Math.abs(observed.value - component.value) <= componentMapping.tolerance
						: observed.value === component.value);
				if (compound.effects!.every(e => e.matched)) {
					compound.feedbackMatched = true;
					compound.deviceConfirmed = compound.effects!.every(
						e => binding.capabilities.find(m => m.capability === e.capability)?.confirmation === 'device',
					);
					compound.phase = compound.deviceConfirmed ? 'device_confirmed' : 'accepted';
					compound.uncertainty = compound.deviceConfirmed ? undefined : 'backend_feedback_only';
					this.journal.transitions[physicalId] = { at: now, value: compound.intent.typedValue };
					this.settleHouseLease(compound);
				}
				await this.persist();
				continue;
			}
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
			if (latest?.effects) {
				continue;
			}
			if (latest && state.ack && id === mapping.confirmId && !state.q && state.ts <= now) {
				if (!followsDispatch(state, latest.sentAt, now)) {
					latest.uncertainty = 'feedback_timestamp_before_dispatch';
					await this.persist();
					continue;
				}
				const binding = config.bindings.find(b => b.id === fn.actuator.entityId)!;
				if (mapping.codec === 'nativeHeatingProgram') {
					const report = parseNativeHeatingReport(state.val);
					if (!report || !isDeepStrictEqual(report.program, latest.nativeProgram)) {
						latest.uncertainty = 'native_program_not_correlated';
						await this.persist();
						continue;
					}
				}
				const observation = normalize(
					binding,
					{ ...mapping, readId: id, freshness: undefined, eventTimestampId: undefined },
					state,
					now,
				);
				const expected = latest.intent.typedValue,
					actual = observation.value;
				const matched = latest.nativeProgram
					? true
					: typeof actual === 'number' && typeof expected === 'number'
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
					this.settleHouseLease(latest);
					await this.persist();
					continue;
				}
				// An intermediate backend value is uncertain, not positive proof of human activity.
				latest.uncertainty = 'intermediate_or_external_feedback';
				await this.persist();
				continue;
			}
			const sourceBinding = config.bindings.find(b => b.id === fn.actuator.entityId)!;
			const normalized = normalize(
				sourceBinding,
				{ ...mapping, readId: id, freshness: undefined, eventTimestampId: undefined },
				state,
				now,
			);
			if (
				mapping.codec === 'nativeHeatingProgram' &&
				state.ack &&
				normalized.quality === 'valid' &&
				normalized.value !== null
			) {
				const report = parseNativeHeatingReport(state.val);
				const own = this.journal.commands.some(
					c =>
						c.physicalId === physicalId &&
						c.nativeProgram &&
						isDeepStrictEqual(c.nativeProgram, report?.program),
				);
				if (own) {
					this.journal.transitions[physicalId] = { at: now, value: normalized.value };
					await this.persist();
					continue;
				}
			}
			if (!state.ack && !ownDispatch && normalized.quality === 'valid' && normalized.value !== null) {
				const value = normalized.value;
				await this.recordManual(fn, value, 'external_state_command');
			} else if (state.ack && !latest && normalized.quality === 'valid' && normalized.value !== null) {
				// A positively observed changed device value grants conservative manual priority.
				const previous = this.journal.transitions[physicalId];
				const value = normalized.value;
				if (previous && previous.value !== value && state.ts >= previous.at && !state.q) {
					await this.recordManual(fn, value, 'external_device_change');
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
					for (const id of command.effects?.map(e => e.confirmId) ?? [mapping.confirmId!]) {
						const state = await deadline(this.port.read(id), 1000);
						if (state) {
							await this.feedback(id, state);
						}
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
		if (command?.effects) {
			const binding = this.configuration().bindings.find(b => b.id === fn.actuator.entityId)!;
			for (const effect of command.effects) {
				const component = binding.capabilities.find(m => m.capability === effect.capability)!;
				const raw = await this.port.read(effect.confirmId);
				if (
					!raw?.ack ||
					raw.q ||
					raw.ts > this.clock.now() ||
					!followsDispatch(raw, command.sentAt, this.clock.now())
				) {
					return false;
				}
				const value = normalize(
					binding,
					{ ...component, readId: effect.confirmId, freshness: undefined, eventTimestampId: undefined },
					raw,
					this.clock.now(),
				);
				if (
					value.quality !== 'valid' ||
					(typeof value.value === 'number' && typeof effect.value === 'number'
						? Math.abs(value.value - effect.value) > component.tolerance
						: value.value !== effect.value)
				) {
					return false;
				}
			}
			delete this.journal.blocked[physicalId];
			command.feedbackMatched = true;
			command.deviceConfirmed = command.effects.every(
				e => binding.capabilities.find(m => m.capability === e.capability)?.confirmation === 'device',
			);
			command.uncertainty = 'reconciled_fresh_feedback';
			this.journal.transitions[physicalId] = { at: this.clock.now(), value: command.intent.typedValue };
			await this.persist();
			return true;
		}
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
		if (
			command.nativeProgram &&
			!isDeepStrictEqual(parseNativeHeatingReport(raw.val)?.program, command.nativeProgram)
		) {
			return false;
		}
		const observation = normalize(
			binding,
			{ ...mapping, readId: mapping.confirmId!, freshness: undefined, eventTimestampId: undefined },
			raw,
			this.clock.now(),
		);
		const actual = observation.value,
			expected = command.intent.typedValue;
		const matched = command.nativeProgram
			? true
			: typeof actual === 'number' && typeof expected === 'number'
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
		this.signalBaselines.clear();
		this.actuatorBaselines.clear();
		this.quietEvaluated.clear();
		for (const wish of Object.values(this.journal.manual)) {
			delete wish.quietSince;
		}
	}
}
