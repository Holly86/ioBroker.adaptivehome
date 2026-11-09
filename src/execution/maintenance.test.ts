import { strict as assert } from 'node:assert';
import {
	HmipTimedLeaseEndpoint,
	heatingFingerprint,
	timedLeaseEndTime,
	type TimedLeaseAcceptance,
	type TimedLeaseJournal,
	type TimedLeasePort,
} from '../connections/timed-lease';
import type { HmipSnapshot, HmipProfile } from '../connections/heating-backend';
import { nativeTransportSchema } from '../connections/schema';
import { compileNativeHeatingProgram } from '../integrations/native-program';
import { referenceConfiguration } from '../config/examples';
import { createHmipBackendHost } from '../connections/hmip-host';
import { NativeConnections } from '../connections/runtime';
import { mappingSchema } from '../model/contracts';
import { Executor } from './executor';
import { validateConfiguration } from '../config/configuration';
import { CommissioningExecutor, type CommissioningGrant, type CommissioningJournal } from './commissioning';
import {
	HandoffCoordinator,
	RegisteredHandoffExecutor,
	handoffReviewHash,
	manualWishRevision,
	mergeManualWishes,
	type CoordinatorObservation,
	type CoordinatorJournal,
	type RegisteredWriter,
} from './handoff-coordinator';
import { MaintenanceStore } from './maintenance-store';
import { ManualWishBridge } from './manual-wish-bridge';
import { constantProfileRestoreRecipe } from './native-restore';
import { inspectHandoff } from './handoff';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

function fixture() {
	let now = Date.UTC(2028, 3, 10, 10),
		authorized = true,
		badReadback = false;
	let journal: TimedLeaseJournal = { commands: {} };
	const cfg = referenceConfiguration('apartment'),
		fn = cfg.functions.find(f => f.kind === 'climate')!,
		binding = cfg.bindings.find(b => b.id === fn.actuator.entityId)!;
	fn.nativeProgram = {
		strategy: 'timed-lease',
		profileId: 'PROFILE_3',
		fallback: 17,
		maxHorizonMs: 900000,
		activationDelayMs: 0,
		backendContractVerified: true,
	};
	const targets = ['a', 'b'].map(id =>
		nativeTransportSchema.parse({
			id,
			strategy: 'timed-lease',
			enabled: true,
			backend: 'hmip.7',
			groupId: `group-${id}`,
			physicalId: `physical-${id}`,
			profileIndex: 'PROFILE_3',
			memberIds: [`valve-${id}-1`, `valve-${id}-2`],
			min: 5,
			max: 30,
		}),
	);
	const states: Record<string, HmipSnapshot> = Object.fromEntries(
		targets.map(t => {
			const profile: HmipProfile = {
				id: `profile-${t.id}`,
				homeId: 'home-fictional',
				groupId: t.groupId,
				index: 'PROFILE_3',
				name: 'Fallback',
				type: 'HEATING_COOLING',
				profileDays: Object.fromEntries(
					['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map(d => [
						d,
						{ baseValue: 17, periods: [] },
					]),
				),
			};
			return [
				t.id,
				{
					at: now,
					group: {
						id: t.groupId,
						homeId: profile.homeId,
						activeProfile: 'PROFILE_3',
						controlMode: 'AUTOMATIC',
						unreach: false,
						partyMode: false,
						windowState: 'CLOSED',
						boostMode: false,
						setPointTemperature: 17,
						profile,
						profileCheckedAt: now,
						updatedAt: now,
					},
					members: t.memberIds.map(id => ({
						id,
						checkedAt: now,
						updatedAt: now,
						configPending: false,
						unreach: false,
						lowBat: false,
						setPointTemperature: 17,
					})),
				},
			];
		}),
	);
	const context: NonNullable<HmipSnapshot['partyContext']> = {
		homeId: 'home-fictional',
		complete: true,
		absenceType: 'NOT_ABSENT',
		parties: [],
	};
	const calls: { groupId: string; temperature: number; endTime: string }[] = [];
	const acceptance: TimedLeaseAcceptance = {
		homeId: 'home-fictional',
		timezone: 'UTC',
		validUntil: now + 86400000,
		evidenceHash: 'a'.repeat(64),
		targets: targets.map(t => ({
			physicalId: t.physicalId,
			baselineHash: heatingFingerprint(states[t.id].group.profile),
			memberIds: t.memberIds,
		})),
		checks: {
			internetExpiry: true,
			accessPointRestartExpiry: true,
			sharedDeadline: true,
			appPriority: true,
			windowDuringLease: true,
			cloudTraffic: true,
		},
	};
	const leases = new Map<string, { until: number; target: number }>();
	const port: TimedLeasePort = {
		snapshot: async t => structuredClone({ ...states[t.id], partyContext: context }),
		authorize: async () => authorized,
		persist: async j => {
			journal = structuredClone(j);
		},
		activate: async (groupId, temperature, endTime) => {
			calls.push({ groupId, temperature, endTime });
			const t = targets.find(t => t.groupId === groupId)!,
				s = states[t.id];
			s.group.partyMode = true;
			s.group.setPointTemperature = temperature;
			s.group.updatedAt = now;
			context.endTime = badReadback ? 'wrong' : endTime;
			context.parties.push({ groupId, temperature, profileId: t.profileIndex });
			s.members.forEach(m => {
				m.configPending = true;
			});
			const until = Date.parse(`${endTime.replace(/_/g, '-').replace(' ', 'T')}:00Z`);
			leases.set(t.id, { until, target: temperature });
		},
	};
	const make = (saved?: TimedLeaseJournal) =>
		new HmipTimedLeaseEndpoint(targets, port, acceptance, () => now, saved, ['system.adapter.adaptivehome.7']);
	const endpoint = make();
	const program = (id = 'a', commandId = `cmd-${id}`) =>
		compileNativeHeatingProgram(
			fn,
			{ ...binding, physicalId: targets.find(t => t.id === id)!.physicalId },
			21,
			now,
			'UTC',
			commandId,
		);
	const request = (operation = 'inspect', id = 'a', p?: ReturnType<typeof program>) => ({
		protocol: 'adaptivehome.hmip-native.v1',
		operation,
		targetId: id,
		...(p ? { program: p, deadline: now + 10000 } : {}),
	});
	const run = (operation = 'inspect', id = 'a', p?: ReturnType<typeof program>) =>
		endpoint.handle(request(operation, id, p), 'system.adapter.adaptivehome.7') as Promise<any>;
	const advance = (ms: number) => {
		now += ms;
		for (const [id, s] of Object.entries(states)) {
			s.at = now;
			s.group.profileCheckedAt = now;
			s.members.forEach(m => (m.checkedAt = now));
			if (leases.has(id) && now >= leases.get(id)!.until) {
				s.group.partyMode = false;
				s.group.setPointTemperature = 17;
				s.group.updatedAt = now;
				s.members.forEach(m => {
					m.setPointTemperature = 17;
					m.configPending = false;
					m.updatedAt = now;
				});
				context.parties = context.parties.filter(p => p.groupId !== s.group.id);
			}
		}
		if (!context.parties.length) {
			context.endTime = undefined;
		}
	};
	return {
		cfg,
		binding,
		endpoint,
		fn,
		targets,
		states,
		context,
		calls,
		acceptance,
		port,
		make,
		program,
		request,
		run,
		journal: () => journal,
		time: () => now,
		advance,
		authorize: (v: boolean) => {
			authorized = v;
		},
		badReadback: () => {
			badReadback = true;
		},
		confirm: (id = 'a') =>
			states[id].members.forEach(m => {
				m.configPending = false;
				m.setPointTemperature = 21;
				m.updatedAt = now;
			}),
	};
}

function commissioningFixture() {
	const f = fixture();
	let saved: CommissioningJournal | undefined,
		failPersist = false;
	const grant: CommissioningGrant = {
		id: 'manual-fixture',
		operator: 'operator-fixture',
		createdAt: f.time(),
		expiresAt: f.time() + 3600000,
		configurationHash: 'a'.repeat(64),
		packageHash: 'b'.repeat(64),
		homeId: 'home-fictional',
		timezone: 'UTC',
		maxCommands: 2,
		maxLeaseMs: 900000,
		steps: ['first', 'second'],
		targets: f.targets.map(t => ({
			targetId: t.id,
			physicalId: t.physicalId,
			profileHash: heatingFingerprint(f.states[t.id].group.profile),
			memberIds: t.memberIds,
			values: [21],
		})),
	};
	const authority = {
		at: f.time(),
		operator: grant.operator,
		present: true,
		exclusive: true,
		configurationHash: grant.configurationHash,
		packageHash: grant.packageHash,
		grantId: grant.id,
		revoked: false,
	};
	const port = {
		...f.port,
		authority: async () => ({ ...authority }),
		persist: async (j: CommissioningJournal) => {
			if (failPersist) throw Error('disk');
			saved = structuredClone(j);
		},
	};
	const make = (old?: CommissioningJournal) =>
		new CommissioningExecutor(grant, f.targets, port, f.time, old, ['system.adapter.adaptivehome.7']);
	const executor = make(),
		request = (stepId = 'first', targetId = 'a') => ({
			protocol: 'adaptivehome.commission.v1',
			operation: 'step',
			operator: grant.operator,
			grantId: grant.id,
			stepId,
			targetId,
			program: f.program(targetId, 'manual-' + stepId),
			deadline: f.time() + 10000,
		});
	return {
		f,
		grant,
		authority,
		port,
		make,
		executor,
		request,
		saved: () => saved,
		failPersist: () => {
			failPersist = true;
		},
	};
}
describe('Bounded manual commissioning executor', () => {
	it('executes a single manual step without fabricating normal physical acceptance', async () => {
		const t = commissioningFixture();
		Object.keys(t.f.acceptance.checks).forEach(k => ((t.f.acceptance.checks as any)[k] = false));
		const r: any = await t.executor.handle(t.request(), 'system.adapter.adaptivehome.7');
		assert.equal(t.f.calls.length, 1);
		assert.equal(r.routineControlReady, false);
		assert.equal(r.physicalAcceptanceGranted, false);
		assert.equal(r.observation.capabilities.absoluteExpiry, false);
		assert.equal(r.observation.report.absoluteExpiryVerified, false);
		assert.equal(r.observation.report.devicePending, true);
		assert.ok(Object.values(t.f.acceptance.checks).every(v => !v));
		await t.executor.handle(t.request(), 'system.adapter.adaptivehome.7');
		assert.equal(t.f.calls.length, 1);
	});
	it('rejects forged senders, operators, steps, values, extra scope and oversized grants', async () => {
		for (const mutate of [
			(r: any) => (r.operator = 'intruder'),
			(r: any) => (r.stepId = 'unlisted'),
			(r: any) => (r.program.target = 22),
			(r: any) => (r.program.physicalId = 'other'),
			(r: any) => (r.extra = 'script'),
		]) {
			const t = commissioningFixture(),
				r: any = t.request();
			mutate(r);
			await assert.rejects(t.executor.handle(r, 'system.adapter.adaptivehome.7'));
			assert.equal(t.f.calls.length, 0);
		}
		const t = commissioningFixture();
		await assert.rejects(t.executor.handle(t.request(), 'system.adapter.admin.0'));
		t.grant.expiresAt += 1;
		assert.throws(() => t.make(), /grant_invalid/);
	});
	it('checks attendance, exclusive old-writer stop, revocation, package and original profile again before dispatch', async () => {
		for (const mutate of [
			(t: any) => (t.authority.present = false),
			(t: any) => (t.authority.exclusive = false),
			(t: any) => (t.authority.revoked = true),
			(t: any) => (t.authority.packageHash = 'c'.repeat(64)),
			(t: any) => (t.authority.at -= 30001),
			(t: any) => (t.f.states.a.group.profile.name = 'changed'),
		]) {
			const t = commissioningFixture();
			mutate(t);
			await assert.rejects(t.executor.handle(t.request(), 'system.adapter.adaptivehome.7'));
			assert.equal(t.f.calls.length, 0);
		}
	});
	it('cannot write if initial durable reservation fails and does not replay after restart', async () => {
		const t = commissioningFixture();
		t.failPersist();
		await assert.rejects(t.executor.handle(t.request(), 'system.adapter.adaptivehome.7'), /persistence_failed/);
		assert.equal(t.f.calls.length, 0);
		const u = commissioningFixture();
		await u.executor.handle(u.request(), 'system.adapter.adaptivehome.7');
		await assert.rejects(
			u.make(u.saved()).handle(u.request('second', 'b'), 'system.adapter.adaptivehome.7'),
			/step_denied/,
		);
		assert.equal(u.f.calls.length, 1);
	});
	it('preserves uncertain sends and rejects App ownership, nonconstant fallback and stale members', async () => {
		for (const alter of [
			(t: any) => {
				t.f.states.a.group.partyMode = true;
				t.f.context.parties = [{ groupId: 'group-a', temperature: 21, profileId: 'PROFILE_3' }];
			},
			(t: any) =>
				t.f.states.a.group.profile.profileDays.MONDAY.periods.push({
					starttime: '08:00',
					endtime: '09:00',
					value: 21,
				}),
			(t: any) => (t.f.states.a.members[0].checkedAt -= 30001),
		]) {
			const t = commissioningFixture();
			alter(t);
			await assert.rejects(t.executor.handle(t.request(), 'system.adapter.adaptivehome.7'));
			assert.equal(t.f.calls.length, 0);
		}
		const t = commissioningFixture();
		t.port.activate = async () => {
			throw Error('unknown');
		};
		const e = t.make();
		await assert.rejects(e.handle(t.request(), 'system.adapter.adaptivehome.7'));
		assert.equal(t.saved()!.steps.first.phase, 'uncertain');
		await assert.rejects(
			e.handle(t.request('second', 'b'), 'system.adapter.adaptivehome.7'),
			/uncertainty|step_denied/,
		);
	});
	it('read-only and routine control backend hosts cannot accept the commissioning command', async () => {
		for (const mode of ['read-only', 'control'] as const) {
			const t = commissioningFixture();
			let mutations = 0;
			const host = createHmipBackendHost({
				api: {
					callRestApi: async () => {
						mutations++;
						throw Error('not called');
					},
				},
				clientCharacteristics: {},
				targets: t.f.targets,
				allowedSenders: ['system.adapter.adaptivehome.7'],
				mode,
				authorize: async () => true,
				persist: async () => {},
				persistTimed: async () => {},
			});
			await assert.rejects(
				host.handle({
					command: 'adaptivehomeCommission',
					message: t.request(),
					from: 'system.adapter.adaptivehome.7',
				}),
				/commission_disabled/,
			);
			assert.equal(mutations, 0);
		}
	});
});

function coordinatorFixture() {
	let now = 1000000,
		failSave = false,
		failStart = false;
	const manual: Record<string, any> = { p: null },
		events: string[] = [],
		imports: Record<string, Record<string, any>> = { old: { p: null }, next: { p: null } };
	let saved: CoordinatorJournal | undefined;
	const plan = {
		protocol: 'adaptivehome.handoff.v1' as const,
		id: 'fictional-handoff',
		createdAt: now,
		expiresAt: now + 300000,
		configurationHash: 'a'.repeat(64),
		packageHash: 'b'.repeat(64),
		targets: [
			{
				physicalId: 'p',
				oldWriter: 'old',
				newWriter: 'next',
				baselineHash: 'c'.repeat(64),
				rollbackProfileHash: 'd'.repeat(64),
				manualRevision: manualWishRevision(null),
				requiresNativeExpiry: true,
			},
		],
	};
	const o: CoordinatorObservation = {
		at: now,
		configurationHash: plan.configurationHash,
		packageHash: plan.packageHash,
		writers: [
			{ id: 'old', running: true, physicalIds: ['p'] },
			{ id: 'next', running: false, physicalIds: ['p'] },
		],
		targets: [
			{
				physicalId: 'p',
				profileHash: plan.targets[0].baselineHash,
				manualRevision: manualWishRevision(null),
				nativeExpiryVerified: true,
				fallbackVerified: true,
				feedbackVerified: true,
				nativeLeaseActive: false,
			},
		],
		manualWishes: manual,
	};
	const observe = async () => {
		o.at = now;
		o.targets[0].manualRevision = manualWishRevision(manual.p);
		return structuredClone(o);
	};
	const writers: RegisteredWriter[] = ['old', 'next'].map(id => ({
		id,
		physicalIds: ['p'],
		start: async () => {
			events.push('start:' + id);
			if (failStart && id === 'next') throw Error('start lost');
			assert.ok(!o.writers.find(w => w.id !== id)!.running);
			o.writers.find(w => w.id === id)!.running = true;
		},
		stop: async () => {
			events.push('stop:' + id);
			o.writers.find(w => w.id === id)!.running = false;
		},
		importManualWishes: async w => {
			events.push('manual:' + id);
			imports[id] = structuredClone(w);
		},
		readManualWishes: async () => structuredClone(imports[id]),
	}));
	const executor = new RegisteredHandoffExecutor(
		writers,
		[
			{
				physicalId: 'p',
				profileHash: 'd'.repeat(64),
				validUntil: now + 300000,
				apply: async () => {
					events.push('restore');
					assert.ok(o.writers.every(w => !w.running));
					o.targets[0].profileHash = 'd'.repeat(64);
				},
			},
		],
		observe,
		() => now,
	);
	const port = {
		observe,
		authorize: async () => true,
		executor,
		persist: async (j: CoordinatorJournal) => {
			if (failSave) throw Error('disk');
			saved = structuredClone(j);
		},
	};
	const make = (j?: CoordinatorJournal) => new HandoffCoordinator(plan, port, () => now, j);
	return {
		plan,
		o,
		manual,
		events,
		imports,
		writers,
		observe,
		port,
		make,
		coordinator: make(),
		saved: () => saved,
		time: () => now,
		advance: (ms: number) => {
			now += ms;
		},
		failSave: () => {
			failSave = true;
		},
		failStart: () => {
			failStart = true;
		},
	};
}
describe('Executable durable handoff and rollback coordinator', () => {
	it('persists before stop, transfers wishes before start, verifies each owner and restores before old resume', async () => {
		const f = coordinatorFixture();
		await f.coordinator.activate();
		assert.equal(f.coordinator.state().transition.phase, 'new-active');
		assert.deepEqual(f.events, ['stop:old', 'manual:next', 'start:next']);
		await f.coordinator.activate();
		assert.equal(f.events.length, 3);
		const r = await f.coordinator.rollback();
		assert.deepEqual(r.blockers, []);
		assert.equal(r.journal.transition.phase, 'rolled-back');
		assert.deepEqual(f.events.slice(3), ['stop:next', 'restore', 'manual:old', 'start:old']);
		await f.coordinator.rollback();
		assert.equal(f.events.length, 7);
	});
	it('blocks effects on failed reservation, incomplete old scope and incomplete target evidence', async () => {
		const f = coordinatorFixture();
		f.failSave();
		await assert.rejects(f.coordinator.activate(), /persistence_failed/);
		assert.equal(f.events.length, 0);
		for (const mutate of [
			(x: any) => x.o.writers[0].physicalIds.push('another-output'),
			(x: any) => (x.o.targets = []),
			(x: any) => (x.o.targets[0].feedbackVerified = false),
			(x: any) => x.o.writers[1].physicalIds.push('another-output'),
		]) {
			const t = coordinatorFixture();
			mutate(t);
			await assert.rejects(t.coordinator.activate());
			assert.equal(t.events.length, 0);
		}
	});
	it('waits for native expiry even after activation plan expires', async () => {
		const f = coordinatorFixture();
		await f.coordinator.activate();
		f.o.targets[0].nativeLeaseActive = true;
		let r = await f.coordinator.rollback();
		assert.ok(r.blockers.includes('handoff_wait_native_expiry'));
		assert.ok(!f.events.includes('restore'));
		f.advance(900001);
		f.o.targets[0].nativeLeaseActive = false;
		r = await f.coordinator.rollback(handoffReviewHash(await f.observe()));
		assert.equal(r.journal.transition.phase, 'rolled-back');
	});
	it('requires a review bound to current manual wishes and preserves them in old owner', async () => {
		const f = coordinatorFixture();
		await f.coordinator.activate();
		f.manual.p = { at: f.time(), until: f.time() + 3600000, value: 19, actor: 'human' };
		let r = await f.coordinator.rollback();
		assert.ok(r.blockers.includes('handoff_preserve_new_manual_wishes'));
		const review = handoffReviewHash(await f.observe());
		f.manual.p = { ...f.manual.p, value: 20 };
		r = await f.coordinator.rollback(review);
		assert.ok(r.blockers.length);
		r = await f.coordinator.rollback(handoffReviewHash(await f.observe()));
		assert.equal(r.journal.transition.phase, 'rolled-back');
		assert.equal(f.imports.old.p.value, 20);
		assert.ok(!f.events.includes('restore'));
	});
	it('never restarts the new owner or repeats an uncertain action after process recovery', async () => {
		const f = coordinatorFixture();
		await f.coordinator.activate();
		const restarted = f.make(f.saved());
		await assert.rejects(restarted.activate(), /restart/);
		assert.equal(f.events.filter(x => x === 'start:next').length, 1);
		await restarted.rollback();
		assert.equal(f.events.filter(x => x === 'start:next').length, 1);
		const g = coordinatorFixture();
		g.failStart();
		await assert.rejects(g.coordinator.activate(), /start lost/);
		await assert.rejects(g.coordinator.activate(), /uncertainty/);
		const r = await g.coordinator.rollback();
		assert.ok(r.blockers.includes('handoff_uncertain_action_requires_review'));
		assert.ok(!g.events.includes('start:old'));
	});
	it('rechecks physical proof and newer manual data between transition and actual start', async () => {
		for (const change of [
			(f: any) => (f.o.targets[0].nativeExpiryVerified = false),
			(f: any) => (f.manual.p = { at: f.time(), until: f.time() + 10000, actor: 'new human', value: 19 }),
		]) {
			const f = coordinatorFixture(),
				original = f.writers[1].importManualWishes;
			f.writers[1].importManualWishes = async (w, id, expected) => {
				await original(w, id, expected);
				change(f);
			};
			await assert.rejects(f.coordinator.activate());
			assert.ok(!f.events.includes('start:next'));
		}
	});
	it('does not invent a winner for conflicting simultaneous wishes', () => {
		const a = { at: 10, until: 20, actor: 'human', value: false };
		assert.throws(() => mergeManualWishes(a, { ...a, value: true }), /manual_conflict/);
		assert.equal(mergeManualWishes(a, { ...a, at: 11, value: true })!.value, true);
	});
});

describe('Concrete durable maintenance file store', () => {
	it('locks competing owners, fsyncs atomic snapshots and requires positive recovery proof', async () => {
		const d = await fs.mkdtemp(path.join(os.tmpdir(), 'adaptive-maintenance-'));
		const store = await MaintenanceStore.open<any>(d);
		await store.save({ phase: 'reserved' });
		assert.equal((await store.read())!.phase, 'reserved');
		await assert.rejects(MaintenanceStore.open(d));
		const lock = await fs.readFile(path.join(d, 'owner.lock')),
			token = createHash('sha256').update(lock).digest('hex');
		await assert.rejects(
			MaintenanceStore.open(d, { expectedLockHash: token, previousOwnerStopped: async () => false }),
			/recovery_denied/,
		);
		const recovered = await MaintenanceStore.open<any>(d, {
			expectedLockHash: token,
			previousOwnerStopped: async () => true,
		});
		await assert.rejects(store.save({ phase: 'bad' }), /owner_lost/);
		assert.equal((await recovered.read())!.phase, 'reserved');
		await recovered.close();
	});
});

describe('Maintenance late-response and bounded-authority regressions', () => {
	it('a timed-out fresh snapshot cannot dispatch a command after the timeout', async () => {
		const t = commissioningFixture(),
			original = t.port.snapshot;
		let release!: () => void;
		const waiting = new Promise<void>(r => (release = r));
		t.port.snapshot = async (target, fresh) => {
			await waiting;
			return original(target, fresh);
		};
		const executor = new CommissioningExecutor(
			t.grant,
			t.f.targets,
			t.port,
			t.f.time,
			undefined,
			['system.adapter.adaptivehome.7'],
			20,
		);
		await assert.rejects(executor.handle(t.request(), 'system.adapter.adaptivehome.7'), /deadline_exceeded/);
		release();
		await new Promise(r => setTimeout(r, 40));
		assert.equal(t.f.calls.length, 0);
		assert.equal(t.saved()!.steps.first.phase, 'uncertain');
	});
	it('manual command count and grant lifetime remain enforced across different valid steps', async () => {
		const t = commissioningFixture();
		t.grant.maxCommands = 1;
		const e = t.make();
		await e.handle(t.request(), 'system.adapter.adaptivehome.7');
		t.f.advance(5000);
		t.authority.at = t.f.time();
		await assert.rejects(e.handle(t.request('second', 'b'), 'system.adapter.adaptivehome.7'), /budget/);
		assert.equal(t.f.calls.length, 1);
		const u = commissioningFixture();
		u.grant.expiresAt = u.f.time() + 300000;
		await assert.rejects(u.make().handle(u.request(), 'system.adapter.adaptivehome.7'));
		assert.equal(u.f.calls.length, 0);
	});
	it('revocation after durable reservation prevents the lifecycle effect', async () => {
		const f = coordinatorFixture();
		let permitted = true;
		f.port.authorize = async () => permitted;
		const save = f.port.persist;
		f.port.persist = async j => {
			await save(j);
			if (Object.values(j.actions).some(a => a.phase === 'reserved')) permitted = false;
		};
		await assert.rejects(f.coordinator.activate());
		assert.equal(f.events.length, 0);
	});
	it('an aborted effect does not resume after a late authority response', async () => {
		const f = coordinatorFixture(),
			controller = new AbortController();
		let release!: (b: boolean) => void;
		const authorization = new Promise<boolean>(r => (release = r)),
			action = inspectHandoff(f.plan, await f.observe(), f.time()).actions[0];
		const work = f.port.executor.execute(f.plan, action, await f.observe(), controller.signal, () => authorization);
		controller.abort();
		release(true);
		await assert.rejects(work, /cancelled/);
		assert.equal(f.events.length, 0);
	});
});

describe('Real manual-wish journal transfer', () => {
	it('preserves manual OFF and unrelated journals, resets quiet progress, and rejects a stale destination revision', async () => {
		const d = await fs.mkdtemp(path.join(os.tmpdir(), 'adaptive-manual-')),
			store = await MaintenanceStore.open<any>(d);
		await store.save({
			manual: { unrelated: { at: 1, until: 100, value: true, actor: 'other' } },
			commands: [{ id: 'keep' }],
			budgets: { keep: [10] },
			blocked: { keep: 'unknown' },
		});
		const bridge = new ManualWishBridge(store, ['p']),
			before = await bridge.read(),
			wish = { at: 10, until: 100, value: false, actor: 'human', quietRequiredMs: 1200000, quietSince: 10 };
		await bridge.import({ p: wish }, 'one', heatingFingerprint(before));
		const value = await store.read();
		assert.equal(value.manual.p.value, false);
		assert.equal(value.manual.p.quietSince, undefined);
		assert.equal(value.blocked.keep, 'unknown');
		assert.equal(value.commands[0].id, 'keep');
		assert.ok(value.manual.unrelated);
		await assert.rejects(bridge.import({ p: wish }, 'stale', heatingFingerprint(before)), /cas_conflict/);
		await store.close();
	});
	it('a late native start is stopped by a fresh rollback after explicit reconciliation', async () => {
		const f = coordinatorFixture();
		f.failStart();
		await assert.rejects(f.coordinator.activate());
		await f.coordinator.rollback();
		f.o.writers[1].running = true;
		const state = f.coordinator.state(),
			start = Object.entries(state.actions).find(([, a]) => a.kind === 'start-new-writer')!;
		await f.coordinator.reconcileLifecycle(start[0], handoffReviewHash(await f.observe()));
		const r = await f.coordinator.rollback();
		assert.equal(r.journal.transition.phase, 'rolled-back');
		assert.ok(f.events.includes('stop:next'));
		assert.equal(f.events.filter(x => x === 'start:next').length, 1);
	});
});

describe('Native constant-profile recovery executor', () => {
	it('uses only the pinned existing-session updateProfile path and refuses old weekly periods or newer wishes', async () => {
		const f = fixture(),
			t = f.targets[0],
			old = structuredClone(f.states.a.group.profile),
			desired = structuredClone(old);
		for (const d of Object.values(desired.profileDays)) d.baseValue = 18;
		const calls: string[] = [];
		let revision = 'manual-1';
		const port = {
			snapshot: async () => structuredClone(f.states.a),
			profileRequest: async (endpoint: any, body: any) => {
				calls.push(endpoint);
				f.states.a.group.profile = structuredClone(body.profile);
				f.states.a.group.updatedAt = f.time();
				f.states.a.members.forEach(m => {
					m.updatedAt = f.time();
					m.setPointTemperature = 18;
				});
			},
			writersStopped: async () => true,
			manualRevision: async () => revision,
		};
		const recipe = constantProfileRestoreRecipe(t, desired, f.time() + 60000, port, f.time),
			guard = {
				physicalId: t.physicalId,
				expectedProfileHash: heatingFingerprint(old),
				restoreProfileHash: recipe.profileHash,
				manualRevision: revision,
			};
		revision = 'new-human';
		await assert.rejects(recipe.apply(guard));
		assert.equal(calls.length, 0);
		revision = 'manual-1';
		await recipe.apply(guard);
		assert.deepEqual(calls, ['group/heating/updateProfile']);
		desired.profileDays.MONDAY.periods.push({ starttime: '10:00', endtime: '11:00', value: 21 });
		assert.throws(
			() => constantProfileRestoreRecipe(t, desired, f.time() + 60000, port, f.time),
			/constant_restore_only/,
		);
	});
});
