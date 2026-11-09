import { strict as assert } from 'node:assert';
import {
	HmipTimedLeaseEndpoint,
	heatingFingerprint,
	timedLeaseEndTime,
	type TimedLeaseAcceptance,
	type TimedLeaseJournal,
	type TimedLeasePort,
} from './timed-lease';
import type { HmipSnapshot, HmipProfile } from './heating-backend';
import { nativeTransportSchema } from './schema';
import { compileNativeHeatingProgram } from '../integrations/native-program';
import { referenceConfiguration } from '../config/examples';
import { createHmipBackendHost } from './hmip-host';
import { NativeConnections } from './runtime';
import { mappingSchema } from '../model/contracts';
import { Executor } from '../execution/executor';
import { validateConfiguration } from '../config/configuration';

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
describe('Native dated heating lease, anonymous hardware simulator', () => {
	it('routes the timed strategy through the real Executor and configured native port', async () => {
		const f = fixture(),
			t = f.targets[0],
			prefix = 'adaptivehome.7.native.a';
		f.binding.physicalId = t.physicalId;
		f.fn.enabled = true;
		f.fn.operatingMode = 'automatic';
		f.fn.inputs = {};
		f.cfg.functions = [f.fn];
		f.cfg.nativeTransports = [t];
		const mapping = mappingSchema.parse({
			capability: 'thermostatSetpoint',
			readId: `${prefix}.report`,
			confirmId: `${prefix}.report`,
			writeId: `${prefix}.command`,
			sourceType: 'string',
			valueType: 'number',
			sourceUnit: '',
			unit: '°C',
			codec: 'nativeHeatingProgram',
			min: 5,
			max: 30,
			confirmation: 'device',
			freshness: { verifiedAtId: `${prefix}.verifiedAt`, maxAgeMs: 30000 },
		});
		f.binding.capabilities = [mapping];
		validateConfiguration(f.cfg);
		const wrong = structuredClone(f.cfg);
		wrong.nativeTransports[0].strategy = 'weekly-profile';
		assert.throws(() => validateConfiguration(wrong), /strategy_mismatch/);
		const variable = structuredClone(f.cfg);
		variable.functions[0].nativeProgram!.fallbackValues = [13, 17];
		assert.throws(() => validateConfiguration(variable), /timed_parameters/);
		const other = f.program('b');
		await f.run('apply', 'b', other);
		f.confirm('b');
		f.advance(300000);
		// Preserve one backend instance and its durable lease ownership throughout the command.
		const endpoint = f.endpoint,
			client = new NativeConnections(
				'adaptivehome.7',
				{ send: async (_b, _c, p) => endpoint.handle(p, 'system.adapter.adaptivehome.7') },
				f.time,
			);
		await client.refresh([t]);
		const executor = new Executor(
			() => f.cfg,
			{
				read: async id => client.read(id),
				metadata: async id => client.metadata(id),
				write: async () => {
					throw Error('ordinary write forbidden');
				},
				writeNative: async (id, p, d) => client.write(id, JSON.stringify(p), d),
				persist: async () => {},
				inputs: async () => ({}),
			},
			{ now: f.time },
		);
		const command = await executor.execute({
			...f.fn.actuator,
			intentId: 'timed-executor',
			functionId: f.fn.id,
			typedValue: 21,
			origin: 'configured_rule',
			actor: 'fixture',
			reasonCode: 'fixture',
			reasonText: 'simulated native lease',
			sourceSnapshotId: 'snapshot',
			configRevision: f.cfg.revision,
			priority: 40,
			validFrom: f.time(),
			expiresAt: f.time() + 10000,
		});
		assert.equal(command.dispatchAccepted, true);
		assert.equal(command.nativeProgram?.strategy, 'timed-lease');
		assert.equal(command.nativeProgram?.expiresAt, other.expiresAt);
		assert.equal(f.calls.length, 2);
	});
	it('uses only a native end date over an unchanged constant fallback and cannot recur next week', async () => {
		const f = fixture(),
			baseline = structuredClone(f.states.a.group.profile),
			p = f.program();
		assert.ok(p.days.every(d => !d.periods.length && d.base === 17));
		let r = await f.run('apply', 'a', p);
		assert.equal(r.report.devicePending, true);
		assert.equal(r.report.absoluteExpiryVerified, true);
		assert.equal(f.calls.length, 1);
		assert.deepEqual(f.states.a.group.profile, baseline);
		f.confirm();
		r = await f.run();
		assert.equal(r.report.devicePending, false);
		// The endpoint is absent while the simulated native device reaches its dated expiry.
		f.advance(p.expiresAt - f.time() + 1);
		assert.equal(f.states.a.group.setPointTemperature, 17);
		const restarted = f.make(f.journal());
		r = (await restarted.handle(f.request(), 'system.adapter.adaptivehome.7')) as any;
		assert.equal(r.report.effectiveTarget, 17);
		assert.equal(r.report.absoluteExpiryVerified, true);
		f.advance(7 * 86400000);
		assert.equal(f.states.a.group.setPointTemperature, 17);
		assert.deepEqual(f.states.a.group.profile, baseline);
		assert.equal(f.calls.length, 1);
	});
	it('allows another room at the same shared deadline but never extends or shortens an earlier room', async () => {
		const f = fixture();
		await f.run('apply', 'a', f.program());
		f.confirm();
		f.advance(300000);
		const p = f.program('b');
		for (const expiry of [p.expiresAt, p.expiresAt - 600000]) {
			await assert.rejects(f.run('apply', 'b', { ...p, expiresAt: expiry }), /shared_deadline/);
		}
		assert.equal(f.calls.length, 1);
		p.expiresAt -= 300000;
		await f.run('apply', 'b', p);
		assert.equal(f.calls[0].endTime, f.calls[1].endTime);
		await assert.rejects(
			f.run('apply', 'a', { ...f.program('a', 'new-id'), expiresAt: p.expiresAt }),
			/existing_lease/,
		);
	});
	it('protects app parties, changed shared deadlines, vacations, manual mode and lost exclusive authority', async () => {
		for (const change of [
			(f: ReturnType<typeof fixture>) => {
				f.context.parties.push({ groupId: 'foreign-app-room', temperature: 23, profileId: 'PROFILE_1' });
			},
			(f: ReturnType<typeof fixture>) => {
				f.context.absenceType = 'VACATION';
			},
			(f: ReturnType<typeof fixture>) => {
				f.states.a.group.controlMode = 'MANUAL';
			},
			(f: ReturnType<typeof fixture>) => {
				f.authorize(false);
			},
		]) {
			const f = fixture();
			change(f);
			await assert.rejects(f.run('apply', 'a', f.program()));
			assert.equal(f.calls.length, 0);
		}
		const f = fixture();
		await f.run('apply', 'a', f.program());
		f.advance(5000);
		f.context.endTime = 'external-app-end';
		await assert.rejects(f.run('apply', 'b', f.program('b')), /app_party/);
		assert.equal(f.calls.length, 1);
	});
	it('requires actual scoped hardware acceptance, an immutable complete fallback and real device timestamps', async () => {
		for (const change of [
			(f: ReturnType<typeof fixture>) => {
				f.acceptance.checks.internetExpiry = false;
			},
			(f: ReturnType<typeof fixture>) => {
				f.acceptance.targets[0].memberIds = ['different-valve'];
			},
			(f: ReturnType<typeof fixture>) => {
				f.states.a.group.profile.profileDays.MONDAY.periods.push({
					starttime: '10:00',
					endtime: '11:00',
					value: 21,
				});
			},
			(f: ReturnType<typeof fixture>) => {
				f.context.complete = false;
			},
			(f: ReturnType<typeof fixture>) => {
				f.acceptance.timezone = 'Europe/Paris';
			},
		]) {
			const f = fixture();
			change(f);
			await assert.rejects(f.run('apply', 'a', f.program()));
			assert.equal(f.calls.length, 0);
		}
		const f = fixture();
		await f.run('apply', 'a', f.program());
		f.confirm();
		f.states.a.members[1].updatedAt = f.time() - 1;
		const r = await f.run();
		assert.equal(r.report.devicePending, true);
	});
	it('persists uncertain replies and refuses replay or adoption of an active lease after restart', async () => {
		const f = fixture();
		f.badReadback();
		const p = f.program();
		await assert.rejects(f.run('apply', 'a', p), /write_uncertain/);
		assert.equal(f.journal().commands[p.commandId].phase, 'uncertain');
		await assert.rejects(f.run('apply', 'a', p), /uncertain/);
		assert.equal(f.calls.length, 1);
		const g = fixture();
		await g.run('apply', 'a', g.program());
		g.advance(5000);
		const restarted = g.make(g.journal());
		await assert.rejects(
			restarted.handle(g.request('apply', 'b', g.program('b')), 'system.adapter.adaptivehome.7'),
			/app_party/,
		);
		assert.equal(g.calls.length, 1);
	});
	it('does not dispatch after a durable reservation consumes the deadline or authority changes', async () => {
		const f = fixture(),
			persist = f.port.persist;
		f.port.persist = async j => {
			await persist(j);
			f.advance(10001);
		};
		await assert.rejects(f.run('apply', 'a', f.program()), /not_dispatched/);
		assert.equal(f.calls.length, 0);
		assert.equal(Object.values(f.journal().commands)[0].phase, 'not-sent');
	});
	it('rejects DST folds, forged weekly content, expired plans and a foreign sender', async () => {
		assert.throws(
			() =>
				timedLeaseEndTime(
					Date.parse('2027-10-31T01:10:00Z'),
					Date.parse('2027-10-31T00:55:00Z'),
					'Europe/Paris',
				),
			/dst/,
		);
		const f = fixture(),
			p = f.program();
		p.days[0].periods.push({ start: 1, end: 2, value: 21 });
		await assert.rejects(f.run('apply', 'a', p), /invalid/);
		await assert.rejects(f.make().handle(f.request(), 'system.adapter.foreign.0'), /sender/);
		assert.equal(f.calls.length, 0);
	});
	it('keeps the registered production-style read host closed even if timed control options are supplied', async () => {
		const f = fixture(),
			calls: string[] = [];
		const h = createHmipBackendHost({
			api: {
				callRestApi: async e => {
					calls.push(e);
					throw Error('unexpected');
				},
			},
			clientCharacteristics: {},
			targets: f.targets,
			allowedSenders: ['system.adapter.adaptivehome.7'],
			mode: 'read-only',
			timedAcceptance: f.acceptance,
			persistTimed: async () => {
				throw Error('must not persist');
			},
		});
		await assert.rejects(
			h.handle({
				command: 'adaptivehomeNative',
				from: 'system.adapter.adaptivehome.7',
				message: f.request('apply', 'a', f.program()),
			}),
			/read_only/,
		);
		assert.deepEqual(calls, []);
		assert.equal(h.capabilities().controlEnabled, false);
	});
});
