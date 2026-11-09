import { z } from 'zod';
import { heatingFingerprint } from '../connections/timed-lease';
import {
	handoffPlanSchema,
	handoffTransition,
	type HandoffPlan,
	type HandoffJournal,
	type HandoffAction,
	type HandoffObservation,
} from './handoff';
import type { ManualWish } from './executor';
import { deadline } from '../runtime/clock';

export interface CoordinatorObservation extends HandoffObservation {
	/** Latest explicit wishes from both owners; absence is null, never inferred from device feedback. */
	manualWishes: Record<string, ManualWish | null>;
}
export interface CoordinatorJournal {
	planHash: string;
	transition: HandoffJournal;
	actions: Record<
		string,
		{ hash: string; phase: 'reserved' | 'completed' | 'uncertain'; kind: HandoffAction['kind'] }
	>;
	lastAt: number;
	reviewedBaselineHash?: string;
}
export interface HandoffCoordinatorPort {
	observe(): Promise<CoordinatorObservation>;
	/** Must be backed by a single durable owner/fence, not an unconditional true. */
	authorize(plan: HandoffPlan, cleanup: boolean): Promise<boolean>;
	persist(journal: CoordinatorJournal): Promise<void>;
	executor: RegisteredHandoffExecutor;
}
const wishSchema = z.strictObject({
	at: z.number().finite(),
	until: z.number().finite(),
	actor: z.string().min(1).max(256),
	value: z.union([z.string().max(512), z.number().finite(), z.boolean()]),
	quietRequiredMs: z.number().finite().positive().max(86400000).optional(),
	quietSince: z.number().finite().optional(),
});
export function manualWishRevision(wish: ManualWish | null): string {
	if (!wish) {
		return heatingFingerprint(null);
	}
	const { quietSince: _progress, ...humanWish } = wish;
	return heatingFingerprint(humanWish);
}
export function mergeManualWishes(a: ManualWish | null, b: ManualWish | null): ManualWish | null {
	if (!a) {
		return b ? wishSchema.parse(b) : null;
	}
	if (!b) {
		return wishSchema.parse(a);
	}
	wishSchema.parse(a);
	wishSchema.parse(b);
	if (a.at === b.at && manualWishRevision(a) !== manualWishRevision(b)) {
		throw Error('handoff_manual_conflict');
	}
	return structuredClone(a.at >= b.at ? a : b);
}
export function checkedHandoffObservation(plan: HandoffPlan, o: CoordinatorObservation, now: number): void {
	if (
		!Number.isFinite(o.at) ||
		o.at > now ||
		now - o.at > 30000 ||
		o.targets.length !== plan.targets.length ||
		new Set(o.targets.map(t => t.physicalId)).size !== o.targets.length ||
		new Set(o.writers.map(w => w.id)).size !== o.writers.length ||
		plan.targets.some(t => !o.targets.some(x => x.physicalId === t.physicalId))
	) {
		throw Error('handoff_observation_invalid');
	}
	for (const t of o.targets) {
		if (
			!/^[a-f0-9]{64}$/.test(t.profileHash) ||
			[t.nativeExpiryVerified, t.fallbackVerified, t.feedbackVerified, t.nativeLeaseActive].some(
				v => typeof v !== 'boolean',
			)
		) {
			throw Error('handoff_target_evidence_invalid');
		}
		const wish = o.manualWishes[t.physicalId];
		if (wish === undefined || t.manualRevision !== manualWishRevision(wish)) {
			throw Error('handoff_manual_revision_invalid');
		}
		if (wish) {
			wishSchema.parse(wish);
			if (wish.at > now || wish.until < wish.at) {
				throw Error('handoff_manual_time_invalid');
			}
		}
	}
	if (o.writers.some(w => typeof w.running !== 'boolean' || new Set(w.physicalIds).size !== w.physicalIds.length)) {
		throw Error('handoff_writer_evidence_invalid');
	}
}
/** Static, trusted providers. User plans cannot supply commands, scripts, paths or implementations. */
export interface RegisteredWriter {
	id: string;
	physicalIds: string[];
	start(): Promise<void>;
	stop(): Promise<void>;
	importManualWishes(
		wishes: Record<string, ManualWish | null>,
		actionId: string,
		expectedDestinationHash: string,
	): Promise<void>;
	readManualWishes(): Promise<Record<string, ManualWish | null>>;
}
export interface RestoreRecipe {
	physicalId: string;
	profileHash: string;
	validUntil: number;
	/** An already reviewed finite restore through the installation's configured device executor. */
	apply(guard: HandoffAction['guards'][number]): Promise<void>;
}
export class RegisteredHandoffExecutor {
	constructor(
		private writers: RegisteredWriter[],
		private recipes: RestoreRecipe[],
		private observe: () => Promise<CoordinatorObservation>,
		private now: () => number = Date.now,
	) {
		if (
			new Set(writers.map(w => w.id)).size !== writers.length ||
			new Set(recipes.map(r => r.physicalId)).size !== recipes.length
		) {
			throw Error('handoff_registry_duplicate');
		}
	}
	private async current(
		plan: HandoffPlan,
		expected: CoordinatorObservation,
		stopOnly = false,
	): Promise<CoordinatorObservation> {
		const o = await this.observe();
		checkedHandoffObservation(plan, o, this.now());
		if (
			!stopOnly &&
			(o.configurationHash !== expected.configurationHash ||
				o.packageHash !== expected.packageHash ||
				o.targets.some(t => {
					const e = expected.targets.find(x => x.physicalId === t.physicalId);
					return !e || t.manualRevision !== e.manualRevision || t.profileHash !== e.profileHash;
				}))
		) {
			throw Error('handoff_execution_preflight_changed');
		}
		return o;
	}
	async execute(
		plan: HandoffPlan,
		action: HandoffAction,
		expected: CoordinatorObservation,
		signal?: AbortSignal,
		authorize: () => Promise<boolean> = () => Promise.resolve(false),
	): Promise<void> {
		const live = async (): Promise<void> => {
			if (signal?.aborted) {
				throw Error('handoff_action_cancelled_or_revoked');
			}
			const allowed = await authorize();
			if (signal?.aborted || !allowed) {
				throw Error('handoff_action_cancelled_or_revoked');
			}
		};
		await live();
		const stopping = action.kind.startsWith('stop-');
		let o = await this.current(plan, expected, stopping);
		if (action.kind === 'restore-reviewed-baseline-through-executor') {
			for (const guard of action.guards) {
				o = await this.current(plan, expected);
				if (
					o.writers.some(
						w => w.running && w.physicalIds.some(p => plan.targets.some(t => t.physicalId === p)),
					) ||
					o.targets.some(t => !t.feedbackVerified || !t.fallbackVerified) ||
					o.targets.some(t => t.nativeLeaseActive)
				) {
					throw Error('handoff_restore_not_quiet');
				}
				const recipe = this.recipes.find(r => r.physicalId === guard.physicalId);
				if (
					!recipe ||
					recipe.profileHash !== guard.restoreProfileHash ||
					recipe.validUntil <= this.now() ||
					recipe.validUntil > this.now() + 300000
				) {
					throw Error('handoff_restore_recipe_expired_or_changed');
				}
				if (
					o.targets.find(t => t.physicalId === guard.physicalId)?.manualRevision !== guard.manualRevision ||
					o.targets.find(t => t.physicalId === guard.physicalId)?.profileHash !== guard.expectedProfileHash
				) {
					throw Error('handoff_restore_guard_changed');
				}
				await live();
				await recipe.apply(guard);
				// Subsequent targets compare against positively observed restoration, never stale expected hashes.
				const after = await this.observe();
				checkedHandoffObservation(plan, after, this.now());
				if (
					after.targets.find(t => t.physicalId === guard.physicalId)?.profileHash !== recipe.profileHash ||
					after.targets.some(
						t =>
							!t.feedbackVerified ||
							t.manualRevision !== o.targets.find(x => x.physicalId === t.physicalId)?.manualRevision,
					)
				) {
					throw Error('handoff_restore_unconfirmed');
				}
				expected = after;
			}
			return;
		}
		for (const id of action.writerIds) {
			const writer = this.writers.find(w => w.id === id),
				scope = plan.targets
					.filter(t =>
						action.kind === 'stop-old-writers' ||
						action.kind === 'resume-old-writers-with-current-manual-wishes'
							? t.oldWriter === id
							: t.newWriter === id,
					)
					.map(t => t.physicalId);
			if (
				!writer ||
				heatingFingerprint([...writer.physicalIds].sort()) !== heatingFingerprint([...scope].sort())
			) {
				throw Error('handoff_writer_registry_scope');
			}
			o = await this.current(plan, expected, stopping);
			const state = o.writers.find(w => w.id === id);
			if (!state || heatingFingerprint([...state.physicalIds].sort()) !== heatingFingerprint([...scope].sort())) {
				throw Error('handoff_writer_identity_changed');
			}
			if (stopping) {
				await live();
				if (state.running) {
					await writer.stop();
				}
				continue;
			}
			if (state.running || o.writers.some(w => w.running && w.physicalIds.some(p => scope.includes(p)))) {
				throw Error('handoff_writer_overlap');
			}
			const wishes = Object.fromEntries(scope.map(p => [p, o.manualWishes[p]]));
			const previous = await writer.readManualWishes();
			if (
				scope.some(
					p =>
						manualWishRevision(mergeManualWishes(wishes[p], previous[p] ?? null)) !==
						manualWishRevision(wishes[p]),
				)
			) {
				throw Error('handoff_destination_has_newer_wish');
			}
			await live();
			await writer.importManualWishes(structuredClone(wishes), action.id, heatingFingerprint(previous));
			const imported = await writer.readManualWishes();
			if (scope.some(p => manualWishRevision(imported[p] ?? null) !== manualWishRevision(wishes[p]))) {
				throw Error('handoff_manual_import_unconfirmed');
			}
			const last = await this.current(plan, expected);
			if (
				action.kind === 'start-new-writer' &&
				(plan.createdAt > this.now() ||
					plan.expiresAt <= this.now() ||
					last.targets.some(
						t =>
							!t.feedbackVerified ||
							!t.fallbackVerified ||
							(plan.targets.find(x => x.physicalId === t.physicalId)!.requiresNativeExpiry &&
								!t.nativeExpiryVerified),
					))
			) {
				throw Error('handoff_start_gate_changed');
			}
			if (last.writers.some(w => w.running && w.physicalIds.some(p => scope.includes(p)))) {
				throw Error('handoff_writer_restarted');
			}
			await live();
			await writer.start();
		}
	}
}
/** Durable orchestration; every effect has a persisted reservation and positive read-back. */
export class HandoffCoordinator {
	private journal: CoordinatorJournal;
	private busy = false;
	private poisoned = false;
	private recovered = false;
	private operationDeadline = 0;
	readonly plan: HandoffPlan;
	constructor(
		raw: unknown,
		private port: HandoffCoordinatorPort,
		private now: () => number = Date.now,
		saved?: CoordinatorJournal,
	) {
		this.plan = handoffPlanSchema.parse(raw);
		this.journal = structuredClone(
			saved ?? {
				planHash: heatingFingerprint(this.plan),
				transition: { planHash: heatingFingerprint(this.plan), phase: 'prepared', manualChanges: [] },
				actions: {},
				lastAt: now(),
			},
		);
		if (
			this.journal.planHash !== heatingFingerprint(this.plan) ||
			this.journal.transition.planHash !== this.journal.planHash ||
			Object.keys(this.journal.actions).length > 128
		) {
			throw Error('handoff_saved_journal_invalid');
		}
		if (
			!Number.isFinite(this.journal.lastAt) ||
			![
				'prepared',
				'old-stopped',
				'new-active',
				'new-stopped',
				'baseline-reviewed',
				'rolled-back',
				'uncertain',
			].includes(this.journal.transition.phase) ||
			this.journal.transition.manualChanges.some(p => !this.plan.targets.some(t => t.physicalId === p)) ||
			Object.entries(this.journal.actions).some(
				([id, a]) =>
					!/^[a-f0-9]{64}$/.test(id) ||
					!/^[a-f0-9]{64}$/.test(a.hash) ||
					!['reserved', 'completed', 'uncertain'].includes(a.phase) ||
					![
						'stop-old-writers',
						'start-new-writer',
						'stop-new-writer',
						'restore-reviewed-baseline-through-executor',
						'resume-old-writers-with-current-manual-wishes',
					].includes(a.kind),
			)
		) {
			throw Error('handoff_saved_journal_invalid');
		}
		if (saved) {
			this.recovered = true;
			for (const a of Object.values(this.journal.actions)) {
				if (a.phase === 'reserved') {
					a.phase = 'uncertain';
				}
			}
		}
	}
	state(): CoordinatorJournal {
		return structuredClone(this.journal);
	}
	async inspect(): Promise<{ journal: CoordinatorJournal; observation: CoordinatorObservation; reviewHash: string }> {
		const observation = await this.observe(true);
		return { journal: this.state(), observation, reviewHash: handoffReviewHash(observation) };
	}
	private async persist(): Promise<void> {
		try {
			await deadline(this.port.persist(this.state()), 15000);
		} catch {
			this.poisoned = true;
			throw Error('handoff_persistence_failed');
		}
	}
	private async observe(cleanup = false): Promise<CoordinatorObservation> {
		if (heatingFingerprint(this.plan) !== this.journal.planHash) {
			throw Error('handoff_plan_changed');
		}
		if (
			this.poisoned ||
			this.now() < this.journal.lastAt ||
			!(await deadline(this.port.authorize(this.plan, cleanup), 15000))
		) {
			throw Error('handoff_authority_denied');
		}
		const o = await deadline(this.port.observe(), 15000);
		checkedHandoffObservation(this.plan, o, this.now());
		this.journal.lastAt = this.now();
		return o;
	}
	private async perform(action: HandoffAction, o: CoordinatorObservation): Promise<void> {
		if (
			action.kind === 'stop-new-writer' &&
			this.journal.actions[action.id]?.phase === 'completed' &&
			action.writerIds.some(id => o.writers.find(w => w.id === id)?.running === true)
		) {
			// A fresh explicit rollback observes an unexpected restart. Reserve a NEW stop, never replay a start.
			action = {
				...action,
				id: heatingFingerprint({ base: action.id, cleanupAttempt: Object.keys(this.journal.actions).length }),
			};
		}
		const hash = heatingFingerprint({ action, wishes: action.kind.startsWith('stop-') ? null : o.manualWishes }),
			prev = this.journal.actions[action.id];
		if (prev) {
			if (prev.hash !== hash || prev.phase !== 'completed') {
				throw Error('handoff_action_uncertain_or_changed');
			}
			return;
		}
		if (Object.keys(this.journal.actions).length >= 128) {
			throw Error('handoff_action_budget');
		}
		this.journal.actions[action.id] = { hash, phase: 'reserved', kind: action.kind };
		await this.persist();
		const controller = new AbortController();
		try {
			await deadline(
				this.port.executor.execute(this.plan, action, o, controller.signal, () => this.authorizeEffect(action)),
				15000,
			);
			const after = await this.observe(action.kind !== 'start-new-writer');
			if (
				action.writerIds.some(
					id => after.writers.find(w => w.id === id)?.running !== !action.kind.startsWith('stop-'),
				)
			) {
				throw Error('handoff_lifecycle_unconfirmed');
			}
			this.journal.actions[action.id].phase = 'completed';
			await this.persist();
		} catch (e) {
			controller.abort();
			this.journal.actions[action.id].phase = 'uncertain';
			await this.persist();
			throw e;
		}
	}
	private async transition(event: Parameters<typeof handoffTransition>[2], cleanup = false): Promise<string[]> {
		const o = await this.observe(cleanup),
			result = handoffTransition(this.plan, this.journal.transition, event, o, this.now());
		this.journal.transition = result.journal;
		await this.persist();
		if (result.proposal) {
			await this.perform(result.proposal, o);
		}
		return result.blockers;
	}
	private async authorizeEffect(action: HandoffAction): Promise<boolean> {
		const allowed = await this.port.authorize(this.plan, action.kind !== 'start-new-writer');
		return allowed && (action.kind.startsWith('stop-') || this.now() < this.operationDeadline);
	}
	async activate(operationDeadline = this.now() + 30000): Promise<CoordinatorJournal> {
		return this.exclusive(async () => {
			if (operationDeadline <= this.now() || operationDeadline > this.now() + 30000) {
				throw Error('handoff_request_expired');
			}
			this.operationDeadline = operationDeadline;
			if (this.recovered || Object.values(this.journal.actions).some(a => a.phase !== 'completed')) {
				throw Error('handoff_restart_or_uncertainty_requires_rollback');
			}
			if (this.journal.transition.phase === 'new-active') {
				return this.state();
			}
			let blockers = await this.transition('prepare');
			if (!blockers.length) {
				blockers = await this.transition('old-stopped');
			}
			if (!blockers.length) {
				blockers = await this.transition('new-ready');
			}
			if (blockers.length) {
				throw Error(blockers[0]);
			}
			return this.state();
		});
	}
	/** The explicit review binds current profiles AND current wishes; it never grants physical acceptance. */
	async rollback(
		reviewHash?: string,
		operationDeadline = this.now() + 30000,
	): Promise<{ journal: CoordinatorJournal; blockers: string[] }> {
		return this.exclusive(async () => {
			if (operationDeadline <= this.now() || operationDeadline > this.now() + 30000) {
				throw Error('handoff_request_expired');
			}
			this.operationDeadline = operationDeadline;
			if (this.journal.transition.phase === 'rolled-back') {
				return { journal: this.state(), blockers: [] };
			}
			await this.transition('rollback', true);
			let o = await this.observe(true);
			if (Object.values(this.journal.actions).some(a => a.phase === 'uncertain' || a.phase === 'reserved')) {
				return { journal: this.state(), blockers: ['handoff_uncertain_action_requires_review'] };
			}
			if (
				reviewHash === handoffReviewHash(o) &&
				o.configurationHash === this.plan.configurationHash &&
				o.packageHash === this.plan.packageHash &&
				o.targets.every(t => t.fallbackVerified && t.feedbackVerified && !t.nativeLeaseActive)
			) {
				this.journal.reviewedBaselineHash = reviewHash;
				this.journal.transition.manualChanges = [
					...new Set([...this.journal.transition.manualChanges, ...this.plan.targets.map(t => t.physicalId)]),
				];
				await this.persist();
			}
			let blockers = await this.transition('new-stopped', true);
			if (blockers.includes('handoff_preserve_new_manual_wishes')) {
				o = await this.observe(true);
				if (reviewHash !== handoffReviewHash(o)) {
					return { journal: this.state(), blockers };
				}
				blockers = [];
			}
			if (!blockers.length) {
				blockers = await this.transition('baseline-reviewed', true);
			}
			if (!blockers.length) {
				blockers = await this.transition('old-resumed', true);
			}
			return { journal: this.state(), blockers };
		});
	}
	/** Reconcile a lifecycle effect from fresh positive evidence; never resends an uncertain operation. */
	async reconcileLifecycle(actionId: string, expectedReviewHash: string): Promise<void> {
		await this.exclusive(async () => {
			const o = await this.observe(true),
				a = this.journal.actions[actionId];
			if (!a || a.phase === 'completed' || expectedReviewHash !== handoffReviewHash(o)) {
				throw Error('handoff_reconcile_denied');
			}
			const restoreId = heatingFingerprint({
				planHash: this.journal.planHash,
				kind: 'restore-reviewed-baseline-through-executor',
			});
			if (actionId === restoreId && a.kind === 'restore-reviewed-baseline-through-executor') {
				if (
					o.writers.some(
						w => w.running && w.physicalIds.some(p => this.plan.targets.some(t => t.physicalId === p)),
					) ||
					o.targets.some(
						t =>
							t.nativeLeaseActive ||
							!t.feedbackVerified ||
							!t.fallbackVerified ||
							t.profileHash !==
								(this.plan.targets.find(p => p.physicalId === t.physicalId)!.rollbackProfileHash ??
									this.plan.targets.find(p => p.physicalId === t.physicalId)!.baselineHash),
					)
				) {
					throw Error('handoff_restore_not_confirmed');
				}
				a.phase = 'completed';
				await this.persist();
				return;
			}
			const kinds = [
				'stop-old-writers',
				'stop-new-writer',
				'start-new-writer',
				'resume-old-writers-with-current-manual-wishes',
			] as const;
			const kind =
				kinds.find(kind => heatingFingerprint({ planHash: this.journal.planHash, kind }) === actionId) ??
				(a.kind === 'stop-new-writer' ? 'stop-new-writer' : undefined);
			if (!kind) {
				throw Error('handoff_restore_requires_manual_recovery');
			}
			const old = kind === 'stop-old-writers' || kind === 'resume-old-writers-with-current-manual-wishes',
				ids = [...new Set(this.plan.targets.map(t => (old ? t.oldWriter : t.newWriter)))];
			if (ids.some(id => o.writers.find(w => w.id === id)?.running !== !kind.startsWith('stop-'))) {
				throw Error('handoff_reconcile_not_confirmed');
			}
			a.phase = 'completed';
			await this.persist();
		});
	}
	private async exclusive<T>(work: () => Promise<T>): Promise<T> {
		if (this.busy) {
			throw Error('handoff_coordinator_busy');
		}
		this.busy = true;
		try {
			return await work();
		} finally {
			this.busy = false;
		}
	}
}
export function handoffReviewHash(o: CoordinatorObservation): string {
	return heatingFingerprint({
		configurationHash: o.configurationHash,
		packageHash: o.packageHash,
		targets: o.targets,
		wishes: o.manualWishes,
		writers: o.writers,
	});
}
