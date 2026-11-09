import { z } from 'zod';
import { heatingFingerprint } from '../connections/timed-lease';

const hash = z.string().regex(/^[a-f0-9]{64}$/),
	ref = z.string().min(1).max(256);
export const handoffPlanSchema = z.strictObject({
	protocol: z.literal('adaptivehome.handoff.v1'),
	id: ref,
	createdAt: z.number().finite(),
	expiresAt: z.number().finite(),
	configurationHash: hash,
	packageHash: hash,
	targets: z
		.array(
			z.strictObject({
				physicalId: ref,
				oldWriter: ref,
				newWriter: ref,
				baselineHash: hash,
				rollbackProfileHash: hash.optional(),
				manualRevision: ref,
				requiresNativeExpiry: z.boolean(),
			}),
		)
		.min(1)
		.max(512),
});
export type HandoffPlan = z.infer<typeof handoffPlanSchema>;
export interface HandoffObservation {
	at: number;
	configurationHash: string;
	packageHash: string;
	writers: { id: string; running: boolean; physicalIds: string[] }[];
	targets: {
		physicalId: string;
		profileHash: string;
		manualRevision: string;
		nativeExpiryVerified: boolean;
		fallbackVerified: boolean;
		feedbackVerified: boolean;
		nativeLeaseActive: boolean;
	}[];
}
export interface HandoffJournal {
	planHash: string;
	phase:
		'prepared' | 'old-stopped' | 'new-active' | 'new-stopped' | 'baseline-reviewed' | 'rolled-back' | 'uncertain';
	manualChanges: string[];
}
export interface HandoffAction {
	id: string;
	kind:
		| 'stop-old-writers'
		| 'start-new-writer'
		| 'stop-new-writer'
		| 'restore-reviewed-baseline-through-executor'
		| 'resume-old-writers-with-current-manual-wishes';
	writerIds: string[];
	physicalIds: string[];
	guards: { physicalId: string; expectedProfileHash: string; manualRevision: string; restoreProfileHash: string }[];
}
/** Preparation only: no runtime, filesystem, lifecycle or device writer is available to this module. */
export function inspectHandoff(
	raw: unknown,
	observation: HandoffObservation,
	now: number,
): { plan: HandoffPlan; blockers: string[]; actions: HandoffAction[] } {
	const plan = handoffPlanSchema.parse(raw),
		blockers: string[] = [];
	if (
		observation.targets.length !== plan.targets.length ||
		new Set(observation.targets.map(t => t.physicalId)).size !== observation.targets.length ||
		new Set(observation.writers.map(w => w.id)).size !== observation.writers.length
	) {
		blockers.push('handoff_observation_scope_invalid');
	}
	if (
		plan.createdAt > now ||
		plan.expiresAt <= now ||
		plan.expiresAt > plan.createdAt + 300000 ||
		!Number.isFinite(observation.at) ||
		observation.at > now ||
		now - observation.at > 30000
	) {
		blockers.push('handoff_evidence_expired');
	}
	if (plan.configurationHash !== observation.configurationHash || plan.packageHash !== observation.packageHash) {
		blockers.push('handoff_configuration_or_package_changed');
	}
	if (
		new Set(plan.targets.map(t => t.physicalId)).size !== plan.targets.length ||
		plan.targets.some(t => t.oldWriter === t.newWriter)
	) {
		blockers.push('handoff_scope_invalid');
	}
	for (const t of plan.targets) {
		const current = observation.targets.find(x => x.physicalId === t.physicalId);
		if (!current || current.profileHash !== t.baselineHash || current.manualRevision !== t.manualRevision) {
			blockers.push(`handoff_baseline_or_manual_changed:${t.physicalId}`);
		}
		if (
			!current?.fallbackVerified ||
			!current.feedbackVerified ||
			(t.requiresNativeExpiry && !current.nativeExpiryVerified)
		) {
			blockers.push(`handoff_physical_acceptance_missing:${t.physicalId}`);
		}
	}
	for (const id of new Set(plan.targets.map(t => t.oldWriter))) {
		const writer = observation.writers.find(w => w.id === id),
			scope = plan.targets.filter(t => t.oldWriter === id).map(t => t.physicalId);
		if (
			!writer?.running ||
			writer.physicalIds.length !== scope.length ||
			writer.physicalIds.some(p => !scope.includes(p))
		) {
			blockers.push(`handoff_old_writer_scope_unverified:${id}`);
		}
	}
	for (const id of new Set(plan.targets.map(t => t.newWriter))) {
		const w = observation.writers.find(w => w.id === id),
			scope = plan.targets.filter(t => t.newWriter === id).map(t => t.physicalId);
		if (!w || w.physicalIds.length !== scope.length || w.physicalIds.some(p => !scope.includes(p))) {
			blockers.push(`handoff_new_writer_scope_unverified:${id}`);
		}
		if (observation.writers.find(w => w.id === id)?.running !== false) {
			blockers.push(`handoff_new_writer_not_stopped:${id}`);
		}
	}
	for (const writer of observation.writers) {
		if (
			writer.running &&
			writer.physicalIds.some(p => plan.targets.some(t => t.physicalId === p && t.oldWriter !== writer.id))
		) {
			blockers.push(`handoff_conflicting_writer:${writer.id}`);
		}
	}
	const physicalIds = plan.targets.map(t => t.physicalId),
		old = [...new Set(plan.targets.map(t => t.oldWriter))],
		next = [...new Set(plan.targets.map(t => t.newWriter))],
		planHash = heatingFingerprint(plan);
	const guards = plan.targets.map(t => ({
		physicalId: t.physicalId,
		expectedProfileHash: t.baselineHash,
		manualRevision: t.manualRevision,
		restoreProfileHash: t.rollbackProfileHash ?? t.baselineHash,
	}));
	const make = (kind: HandoffAction['kind'], writerIds: string[]): HandoffAction => ({
		id: heatingFingerprint({ planHash, kind }),
		kind,
		writerIds,
		physicalIds,
		guards,
	});
	return {
		plan,
		blockers: [...new Set(blockers)],
		actions: [
			make('stop-old-writers', old),
			make('start-new-writer', next),
			make('stop-new-writer', next),
			make('restore-reviewed-baseline-through-executor', []),
			make('resume-old-writers-with-current-manual-wishes', old),
		],
	};
}
/** A pure transition must be persisted by the operator's coordinator BEFORE acting on its proposal. */
export function handoffTransition(
	plan: HandoffPlan,
	journal: HandoffJournal | undefined,
	event: 'prepare' | 'old-stopped' | 'new-ready' | 'rollback' | 'new-stopped' | 'baseline-reviewed' | 'old-resumed',
	observation: HandoffObservation,
	now: number,
): { journal: HandoffJournal; proposal?: HandoffAction; blockers: string[] } {
	const checked = inspectHandoff(plan, observation, now),
		planHash = heatingFingerprint(checked.plan),
		j = structuredClone(journal ?? { planHash, phase: 'prepared' as const, manualChanges: [] });
	if (j.planHash !== planHash) {
		throw Error('handoff_plan_changed');
	}
	const fresh = Number.isFinite(observation.at) && observation.at <= now && now - observation.at <= 30000;
	const configMatches =
		plan.configurationHash === observation.configurationHash && plan.packageHash === observation.packageHash;
	const allStopped = (ids: string[]): boolean =>
		ids.every(id => observation.writers.find(w => w.id === id)?.running === false);
	const old = [...new Set(plan.targets.map(t => t.oldWriter))],
		next = [...new Set(plan.targets.map(t => t.newWriter))];
	j.manualChanges = [
		...new Set([
			...j.manualChanges,
			...plan.targets
				.filter(t => {
					const current = observation.targets.find(x => x.physicalId === t.physicalId);
					return current?.manualRevision !== t.manualRevision || current.profileHash !== t.baselineHash;
				})
				.map(t => t.physicalId),
		]),
	];
	const result = (
		kind?: HandoffAction['kind'],
		blockers: string[] = [],
	): { journal: HandoffJournal; proposal?: HandoffAction; blockers: string[] } => ({
		journal: j,
		proposal: kind ? checked.actions.find(a => a.kind === kind) : undefined,
		blockers,
	});
	if (!fresh) {
		return result(undefined, ['handoff_evidence_expired']);
	}
	if (event !== 'rollback' && checked.blockers.includes('handoff_observation_scope_invalid')) {
		return result(undefined, ['handoff_observation_scope_invalid']);
	}
	if (event === 'prepare' && j.phase === 'prepared') {
		return checked.blockers.length ? result(undefined, checked.blockers) : result('stop-old-writers');
	}
	if (event === 'rollback') {
		j.phase = 'uncertain';
		return result('stop-new-writer');
	}
	if (event === 'new-stopped' && ['uncertain', 'new-active', 'old-stopped'].includes(j.phase)) {
		if (!allStopped(next)) {
			return result(undefined, ['handoff_new_writer_still_running']);
		}
		if (!allStopped(old)) {
			return result(undefined, ['handoff_old_writer_restarted']);
		}
		if (
			plan.targets.some(
				t =>
					t.requiresNativeExpiry &&
					observation.targets.find(x => x.physicalId === t.physicalId)?.nativeLeaseActive !== false,
			)
		) {
			return result(undefined, ['handoff_wait_native_expiry']);
		}
		j.phase = 'new-stopped';
		if (!configMatches) {
			return result(undefined, ['handoff_recovery_configuration_changed']);
		}
		return j.manualChanges.length
			? result(undefined, ['handoff_preserve_new_manual_wishes'])
			: result('restore-reviewed-baseline-through-executor');
	}
	if (event === 'baseline-reviewed' && j.phase === 'new-stopped') {
		if (
			!configMatches ||
			!allStopped(next) ||
			!allStopped(old) ||
			observation.targets.some(t => !t.fallbackVerified || !t.feedbackVerified) ||
			plan.targets.some(
				t =>
					t.requiresNativeExpiry &&
					observation.targets.find(x => x.physicalId === t.physicalId)?.nativeLeaseActive !== false,
			)
		) {
			return result(undefined, ['handoff_baseline_review_unverified']);
		}
		j.phase = 'baseline-reviewed';
		return result('resume-old-writers-with-current-manual-wishes');
	}
	if (event === 'old-resumed' && j.phase === 'baseline-reviewed') {
		if (!allStopped(next) || !old.every(id => observation.writers.find(w => w.id === id)?.running === true)) {
			return result(undefined, ['handoff_writer_state_unverified']);
		}
		j.phase = 'rolled-back';
		return result();
	}
	if (!configMatches || j.manualChanges.length || plan.expiresAt <= now) {
		j.phase = 'uncertain';
		return result('stop-new-writer', ['handoff_preflight_changed']);
	}
	if (event === 'old-stopped' && j.phase === 'prepared') {
		if (
			!allStopped(old) ||
			!allStopped(next) ||
			observation.writers.some(
				w => w.running && w.physicalIds.some(p => plan.targets.some(t => t.physicalId === p)),
			)
		) {
			return result(undefined, ['handoff_stop_not_confirmed']);
		}
		if (
			plan.targets.some(t => {
				const current = observation.targets.find(x => x.physicalId === t.physicalId);
				return (
					!current ||
					current.profileHash !== t.baselineHash ||
					!current.fallbackVerified ||
					!current.feedbackVerified ||
					(t.requiresNativeExpiry && !current.nativeExpiryVerified)
				);
			})
		) {
			return result(undefined, ['handoff_physical_acceptance_missing']);
		}
		j.phase = 'old-stopped';
		return result('start-new-writer');
	}
	if (event === 'new-ready' && j.phase === 'old-stopped') {
		if (
			!allStopped(old) ||
			observation.writers.some(
				w =>
					w.running &&
					!next.includes(w.id) &&
					w.physicalIds.some(p => plan.targets.some(t => t.physicalId === p)),
			) ||
			!next.every(id => observation.writers.find(w => w.id === id)?.running === true) ||
			plan.targets.some(t => {
				const current = observation.targets.find(x => x.physicalId === t.physicalId);
				return (
					!current || !current.feedbackVerified || (t.requiresNativeExpiry && !current.nativeExpiryVerified)
				);
			})
		) {
			return result(undefined, ['handoff_new_writer_not_confirmed']);
		}
		j.phase = 'new-active';
		return result();
	}
	return result(undefined, ['handoff_transition_or_replay_rejected']);
}
