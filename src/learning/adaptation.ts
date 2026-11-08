import type { Configuration, FunctionConfig } from '../model/contracts';
import type { History } from '../diagnostics/history';
import type { ExecutionJournal } from '../execution/executor';
import type { ModelVersion } from './model';
import type { AdaptationPlan } from './optimizer';
import { optimize, planSchema, validatePlan } from './optimizer';
import { summarizeEnergy } from '../context/context';
export interface EffectMetric {
	score: number;
	count: number;
	from: number;
	until: number;
	energyKind: string | null;
	energyCoverage: number;
	description: string;
}
export interface PlanState {
	plan: AdaptationPlan;
	status: 'suggestion' | 'active' | 'evaluating' | 'verified' | 'rolled_back' | 'paused' | 'cancelled';
	activatedAt?: number;
	acceptedByOperator?: boolean;
	previousPlanId?: string;
	baseline: EffectMetric | null;
	effect: EffectMetric | null;
	commandIds: string[];
	deviceConfirmations: number;
	nextReview: number;
	rollbackReason?: string;
}
export interface AdaptationRecord {
	version: 1;
	plans: PlanState[];
	active: Record<string, string>;
	changes: Record<string, number[]>;
	paused: Record<string, boolean>;
	rejected: Record<string, string[]>;
}
export function effectMetric(
	fn: FunctionConfig,
	history: History,
	journal: ExecutionJournal,
	from: number,
	until: number,
): EffectMetric | null {
	const input =
		fn.kind === 'climate'
			? fn.inputs.temperature
			: fn.kind === 'air'
				? fn.inputs.airQuality
				: (fn.inputs.presence ?? fn.inputs.motion);
	if (!input) {
		return null;
	}
	const observations = history.record.observations.filter(
		o =>
			o.entityId === input.entityId &&
			o.capability === input.capability &&
			o.quality === 'valid' &&
			o.measuredAt >= from &&
			o.measuredAt <= until,
	);
	if (observations.length < 3) {
		return null;
	}
	const actuator = history.record.observations
		.filter(
			o =>
				o.entityId === fn.actuator.entityId &&
				o.capability === fn.actuator.capability &&
				o.quality === 'valid' &&
				o.measuredAt <= until,
		)
		.sort((a, b) => a.measuredAt - b.measuredAt);
	let comfort = 0;
	if (fn.kind === 'climate') {
		comfort =
			observations.reduce(
				(sum, o) =>
					sum + (typeof o.value === 'number' ? Math.max(0, (fn.parameters.target ?? o.value) - o.value) : 0),
				0,
			) / observations.length;
	} else if (fn.kind === 'air') {
		comfort =
			observations.reduce(
				(sum, o) =>
					sum +
					(typeof o.value === 'number' ? Math.max(0, o.value - (fn.parameters.threshold ?? o.value)) : 0),
				0,
			) / observations.length;
	} else {
		const positives = observations.filter(o => o.value === true);
		if (!positives.length) {
			return null;
		}
		let compared = 0,
			missed = 0;
		for (const usage of positives) {
			const actual = actuator.findLast(
				o => o.measuredAt <= usage.measuredAt + 1000 && o.measuredAt >= usage.measuredAt - 300000,
			);
			if (!actual) {
				continue;
			}
			compared++;
			if (actual.value === false || actual.value === 0) {
				missed++;
			}
		}
		if (!compared) {
			return null;
		}
		comfort = missed / compared;
	}
	const powerRef = fn.inputs.power;
	const energy = powerRef
		? summarizeEnergy(
				history.record.observations.filter(
					o => o.entityId === powerRef.entityId && o.capability === powerRef.capability,
				),
				from,
				until,
			)
		: null;
	const hours = Math.max((until - from) / 3600000, 1 / 3600);
	const switches =
		journal.commands.filter(
			c => c.intent.functionId === fn.id && c.sentAt >= from && c.sentAt < until && c.feedbackMatched,
		).length / hours;
	const energyScore =
		energy?.kWh !== null && energy?.kWh !== undefined && energy.coverage >= 0.8 ? energy.kWh / hours : 0;
	return {
		score:
			comfort * fn.autonomy.objectives.comfort +
			switches * fn.autonomy.objectives.switching +
			energyScore * fn.autonomy.objectives.energy,
		count: observations.length,
		from,
		until,
		energyKind: energy?.kind ?? null,
		energyCoverage: energy?.coverage ?? 0,
		description:
			'Observed short-window outcome and switch-rate comparison; environmental causes are not controlled. No energy-saving claim.',
	};
}
export class AdaptationController {
	record: AdaptationRecord = { version: 1, plans: [], active: {}, changes: {}, paused: {}, rejected: {} };
	private busy = false;
	constructor(private persist: (record: AdaptationRecord) => Promise<void>) {}
	restore(raw: AdaptationRecord): void {
		if (
			raw?.version !== 1 ||
			!Array.isArray(raw.plans) ||
			!raw.active ||
			!raw.changes ||
			!raw.paused ||
			!raw.rejected
		) {
			throw new Error('adaptation_journal_invalid');
		}
		for (const state of raw.plans) {
			planSchema.parse(state.plan);
		}
		this.record = { ...raw, plans: raw.plans.slice(-128) };
	}
	active(fn: string): PlanState | undefined {
		return this.record.plans.find(p => p.plan.planId === this.record.active[fn]);
	}
	effective(fn: FunctionConfig, config: Configuration, manual: boolean): FunctionConfig {
		const state = this.active(fn.id);
		if (
			!state ||
			!['active', 'evaluating', 'verified'].includes(state.status) ||
			state.plan.baseRevision !== config.revision ||
			manual ||
			fn.autonomy.paused ||
			fn.autonomy.excluded ||
			this.record.paused[fn.id] ||
			!fn.autonomy.granted
		) {
			return fn;
		}
		return {
			...fn,
			parameters: { ...fn.parameters, ...state.plan.parameters },
			rules: [...fn.rules, ...state.plan.rules],
		};
	}
	private async activate(
		state: PlanState,
		fn: FunctionConfig,
		config: Configuration,
		model: ModelVersion,
		history: History,
		journal: ExecutionJournal,
		now: number,
	): Promise<void> {
		validatePlan(state.plan, fn, config, model, now);
		const changes = (this.record.changes[fn.id] || []).filter(at => now - at < 86400000 || at > now);
		if (changes.length >= fn.autonomy.changesPerDay) {
			throw new Error('adaptation_change_budget');
		}
		const next = structuredClone(this.record),
			activated = next.plans.find(p => p.plan.planId === state.plan.planId)!;
		activated.previousPlanId = next.active[fn.id];
		activated.baseline = effectMetric(fn, history, journal, now - fn.autonomy.evaluateAfterMs, now);
		if (!activated.baseline) {
			throw new Error('effect_baseline_insufficient');
		}
		activated.status = 'active';
		activated.activatedAt = now;
		activated.nextReview = now + fn.autonomy.evaluateAfterMs;
		next.changes[fn.id] = [...changes, now];
		next.active[fn.id] = state.plan.planId;
		await this.persist(next);
		this.record = next;
	}
	private async rollback(state: PlanState, reason: string, config: Configuration, now: number): Promise<void> {
		const id = state.plan.functionId;
		state.status = 'rolled_back';
		state.rollbackReason = reason;
		delete this.record.active[id];
		this.record.rejected[id] = [...(this.record.rejected[id] || []), state.plan.modelVersion].slice(-32);
		const previous = this.record.plans.find(p => p.plan.planId === state.previousPlanId);
		if (
			previous &&
			previous.plan.baseRevision === config.revision &&
			previous.plan.expiresAt > now &&
			['verified', 'evaluating', 'active'].includes(previous.status) &&
			reason !== 'manual_override' &&
			reason !== 'permission_or_configuration_changed'
		) {
			this.record.active[id] = previous.plan.planId;
		}
		await this.persist(this.record);
	}
	async advance(
		config: Configuration,
		models: Record<string, ModelVersion[]>,
		history: History,
		journal: ExecutionJournal,
		now: number,
	): Promise<void> {
		if (this.busy) {
			return;
		}
		this.busy = true;
		try {
			for (const fn of config.functions) {
				let state = this.active(fn.id);
				if (state) {
					const binding = config.bindings.find(b => b.id === fn.actuator.entityId)!,
						wish = journal.manual[binding.physicalId];
					if (
						state.plan.baseRevision !== config.revision ||
						!fn.autonomy.granted ||
						fn.autonomy.excluded ||
						fn.autonomy.paused ||
						['classic', 'observe'].includes(fn.autonomy.mode) ||
						(fn.autonomy.mode === 'suggest' && !state.acceptedByOperator)
					) {
						await this.rollback(state, 'permission_or_configuration_changed', config, now);
						continue;
					}
					if (wish && wish.at >= (state.activatedAt ?? Infinity)) {
						await this.rollback(state, 'manual_override', config, now);
						continue;
					}
					const commands = journal.commands.filter(c => c.intent.planId === state!.plan.planId);
					state.commandIds = commands.map(c => c.commandId);
					state.deviceConfirmations = commands.filter(c => c.deviceConfirmed).length;
					if (commands.some(c => c.phase === 'uncertain' || c.phase === 'failed')) {
						await this.rollback(state, 'command_effect_uncertain', config, now);
						continue;
					}
					const source =
						fn.inputs.presence ?? fn.inputs.motion ?? fn.inputs.airQuality ?? fn.inputs.temperature;
					const latest = source
						? history.record.observations.findLast(
								o => o.entityId === source.entityId && o.capability === source.capability,
							)
						: undefined;
					if (latest && (latest.quality !== 'valid' || now - latest.measuredAt > fn.autonomy.maxGapMs)) {
						await this.rollback(state, 'learning_data_broken', config, now);
						continue;
					}
					if (state.plan.expiresAt <= now) {
						await this.rollback(state, 'plan_expired', config, now);
						continue;
					}
					if (state.deviceConfirmations) {
						state.status = 'evaluating';
					}
					if (now >= state.nextReview) {
						const metric = effectMetric(fn, history, journal, state.activatedAt!, now);
						state.effect = metric;
						if (!metric || !state.baseline || !state.deviceConfirmations) {
							await this.rollback(state, 'effect_evidence_insufficient', config, now);
							continue;
						}
						if (
							metric.score >
							state.baseline.score + fn.autonomy.degradation * Math.max(1, state.baseline.score)
						) {
							await this.rollback(state, 'observed_outcome_degraded', config, now);
							continue;
						}
						state.status = 'verified';
						state.nextReview = now + fn.autonomy.evaluateAfterMs;
						await this.persist(this.record);
					}
					continue;
				}
				if (['classic', 'observe'].includes(fn.autonomy.mode) || this.record.paused[fn.id]) {
					continue;
				}
				const model = models[fn.id]?.at(-1);
				if (!model?.admitted || this.record.rejected[fn.id]?.includes(model.version)) {
					continue;
				}
				const existing = this.record.plans.find(
					p =>
						p.plan.functionId === fn.id &&
						p.plan.baseRevision === config.revision &&
						p.plan.modelVersion === model.version,
				);
				if (existing) {
					if (existing.status === 'suggestion' && ['bounded', 'full'].includes(fn.autonomy.mode)) {
						try {
							await this.activate(existing, fn, config, model, history, journal, now);
						} catch (error) {
							existing.rollbackReason = error instanceof Error ? error.message : 'activation_rejected';
						}
					}
					continue;
				}
				let plan: AdaptationPlan | null;
				try {
					plan = optimize(fn, config, model, now);
				} catch {
					continue;
				}
				if (!plan) {
					continue;
				}
				state = {
					plan,
					status: 'suggestion',
					baseline: null,
					effect: null,
					commandIds: [],
					deviceConfirmations: 0,
					nextReview: plan.reviewAt,
				};
				this.record.plans.push(state);
				this.record.plans = this.record.plans.slice(-128);
				await this.persist(this.record);
				if (['bounded', 'full'].includes(fn.autonomy.mode)) {
					try {
						await this.activate(state, fn, config, model, history, journal, now);
					} catch (error) {
						state.rollbackReason = error instanceof Error ? error.message : 'activation_rejected';
					}
				}
			}
		} finally {
			this.busy = false;
		}
	}
	async action(
		functionId: string,
		action: string,
		config: Configuration,
		models: Record<string, ModelVersion[]>,
		history: History,
		journal: ExecutionJournal,
		now: number,
	): Promise<PlanState | undefined> {
		const fn = config.functions.find(f => f.id === functionId);
		if (!fn) {
			throw new Error('unknown_function');
		}
		let state =
			this.active(functionId) ??
			this.record.plans.findLast(p => p.plan.functionId === functionId && p.status === 'suggestion');
		if (action === 'pause') {
			this.record.paused[functionId] = true;
			if (state) {
				state.status = 'paused';
				delete this.record.active[functionId];
			}
			await this.persist(this.record);
			return state;
		}
		if (action === 'resume') {
			delete this.record.paused[functionId];
			state ??= this.record.plans.findLast(p => p.plan.functionId === functionId && p.status === 'paused');
			if (state) {
				const model = models[functionId]?.find(m => m.version === state!.plan.modelVersion);
				if (model) {
					state.status = 'suggestion';
					await this.activate(state, fn, config, model, history, journal, now);
				}
			}
			await this.persist(this.record);
			return state;
		}
		if (!state) {
			throw new Error('no_adaptation');
		}
		if (action === 'accept') {
			state.acceptedByOperator = true;
			const model = models[functionId]?.find(m => m.version === state.plan.modelVersion);
			if (!model) {
				throw new Error('model_not_admitted');
			}
			await this.activate(state, fn, config, model, history, journal, now);
			return state;
		}
		if (action === 'cancel' || action === 'revert') {
			await this.rollback(state, action === 'cancel' ? 'operator_cancelled' : 'operator_rollback', config, now);
			if (action === 'cancel') {
				state.status = 'cancelled';
			}
			return state;
		}
		throw new Error('unknown_adaptation_action');
	}
}
