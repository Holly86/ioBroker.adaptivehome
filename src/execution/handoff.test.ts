import { strict as assert } from 'node:assert';
import { inspectHandoff, handoffTransition, type HandoffObservation, type HandoffJournal } from './handoff';
function fixture() {
	const now = 1000000,
		plan = {
			protocol: 'adaptivehome.handoff.v1' as const,
			id: 'fictional-plan',
			createdAt: now,
			expiresAt: now + 300000,
			configurationHash: 'a'.repeat(64),
			packageHash: 'b'.repeat(64),
			targets: [
				{
					physicalId: 'valve-group',
					oldWriter: 'old-policy',
					newWriter: 'new-policy',
					baselineHash: 'c'.repeat(64),
					rollbackProfileHash: 'd'.repeat(64),
					manualRevision: 'manual-1',
					requiresNativeExpiry: true,
				},
			],
		};
	const observation: HandoffObservation = {
		at: now,
		configurationHash: plan.configurationHash,
		packageHash: plan.packageHash,
		writers: [
			{ id: 'old-policy', running: true, physicalIds: ['valve-group'] },
			{ id: 'new-policy', running: false, physicalIds: ['valve-group'] },
		],
		targets: [
			{
				physicalId: 'valve-group',
				profileHash: plan.targets[0].baselineHash,
				manualRevision: 'manual-1',
				nativeExpiryVerified: true,
				fallbackVerified: true,
				feedbackVerified: true,
				nativeLeaseActive: false,
			},
		],
	};
	return { now, plan, observation };
}
describe('Pure handoff preparation and rollback proposals', () => {
	it('waits for native lease expiry before proposing any baseline restore, even after the activation plan expired', () => {
		const f = fixture(),
			j = handoffTransition(f.plan, undefined, 'prepare', f.observation, f.now).journal;
		j.phase = 'new-active';
		f.observation.writers[0].running = false;
		f.observation.writers[1].running = false;
		let r = handoffTransition(f.plan, j, 'rollback', f.observation, f.now);
		f.observation.targets[0].nativeLeaseActive = true;
		r = handoffTransition(f.plan, r.journal, 'new-stopped', f.observation, f.now);
		assert.equal(r.proposal, undefined);
		assert.ok(r.blockers.includes('handoff_wait_native_expiry'));
		const later = f.now + 900001;
		f.observation.at = later;
		f.observation.targets[0].nativeLeaseActive = false;
		r = handoffTransition(f.plan, r.journal, 'new-stopped', f.observation, later);
		assert.equal(r.proposal?.kind, 'restore-reviewed-baseline-through-executor');
	});
	it('requires full fresh physical/expiry proof and whole old-writer coverage before proposing a stop', () => {
		for (const mutate of [
			(o: HandoffObservation) => {
				o.targets[0].nativeExpiryVerified = false;
			},
			(o: HandoffObservation) => {
				o.writers[0].physicalIds.push('unselected-output');
			},
			(o: HandoffObservation) => {
				o.targets[0].manualRevision = 'new-wish';
			},
			(o: HandoffObservation) => {
				o.writers.push({ id: 'third-writer', running: true, physicalIds: ['valve-group'] });
			},
			(o: HandoffObservation) => {
				o.packageHash = 'e'.repeat(64);
			},
		]) {
			const f = fixture();
			mutate(f.observation);
			const r = handoffTransition(f.plan, undefined, 'prepare', f.observation, f.now);
			assert.ok(r.blockers.length);
			assert.equal(r.proposal, undefined);
		}
	});
	it('proposes old-stop, verifies it, then proposes new-start; duplicate transitions do not replay actions', () => {
		const f = fixture();
		let r = handoffTransition(f.plan, undefined, 'prepare', f.observation, f.now);
		assert.equal(r.proposal?.kind, 'stop-old-writers');
		r = handoffTransition(f.plan, r.journal, 'old-stopped', f.observation, f.now);
		assert.equal(r.proposal, undefined);
		f.observation.writers[0].running = false;
		r = handoffTransition(f.plan, r.journal, 'old-stopped', f.observation, f.now);
		assert.equal(r.proposal?.kind, 'start-new-writer');
		assert.equal(handoffTransition(f.plan, r.journal, 'old-stopped', f.observation, f.now).proposal, undefined);
		f.observation.writers[1].running = true;
		r = handoffTransition(f.plan, r.journal, 'new-ready', f.observation, f.now);
		assert.equal(r.journal.phase, 'new-active');
		assert.equal(r.proposal, undefined);
	});
	it('losing physical acceptance between stop and start cannot activate the new writer', () => {
		const f = fixture(),
			prepared = handoffTransition(f.plan, undefined, 'prepare', f.observation, f.now).journal;
		f.observation.writers[0].running = false;
		f.observation.targets[0].nativeExpiryVerified = false;
		const r = handoffTransition(f.plan, prepared, 'old-stopped', f.observation, f.now);
		assert.equal(r.proposal, undefined);
		assert.ok(r.blockers.includes('handoff_physical_acceptance_missing'));
	});
	it('rollback stops the new writer before any restore and preserves newer app/manual changes', () => {
		const f = fixture(),
			j = handoffTransition(f.plan, undefined, 'prepare', f.observation, f.now).journal;
		j.phase = 'new-active';
		f.observation.writers[0].running = false;
		f.observation.writers[1].running = true;
		f.observation.targets[0].manualRevision = 'app-2';
		let r = handoffTransition(f.plan, j, 'rollback', f.observation, f.now);
		assert.equal(r.proposal?.kind, 'stop-new-writer');
		r = handoffTransition(f.plan, r.journal, 'new-stopped', f.observation, f.now);
		assert.equal(r.proposal, undefined);
		f.observation.writers[1].running = false;
		r = handoffTransition(f.plan, r.journal, 'new-stopped', f.observation, f.now);
		assert.equal(r.proposal, undefined);
		assert.ok(r.blockers.includes('handoff_preserve_new_manual_wishes'));
		r = handoffTransition(f.plan, r.journal, 'baseline-reviewed', f.observation, f.now);
		assert.equal(r.proposal?.kind, 'resume-old-writers-with-current-manual-wishes');
		f.observation.writers[0].running = true;
		r = handoffTransition(f.plan, r.journal, 'old-resumed', f.observation, f.now);
		assert.equal(r.journal.phase, 'rolled-back');
	});
	it('binds reviewed restore to original baseline identity and refuses stale or changed plans', () => {
		const f = fixture(),
			r = inspectHandoff(f.plan, f.observation, f.now),
			restore = r.actions.find(x => x.kind === 'restore-reviewed-baseline-through-executor')!;
		assert.equal(restore.guards[0].expectedProfileHash, 'c'.repeat(64));
		assert.equal(restore.guards[0].restoreProfileHash, 'd'.repeat(64));
		assert.equal(restore.guards[0].manualRevision, 'manual-1');
		assert.ok(
			inspectHandoff(f.plan, { ...f.observation, at: f.now - 30001 }, f.now).blockers.includes(
				'handoff_evidence_expired',
			),
		);
		const journal: HandoffJournal = handoffTransition(f.plan, undefined, 'prepare', f.observation, f.now).journal;
		assert.throws(
			() => handoffTransition({ ...f.plan, id: 'changed' }, journal, 'rollback', f.observation, f.now),
			/plan_changed/,
		);
	});
});
