import { strict as assert } from 'node:assert';
import { referenceConfiguration } from '../config/examples';
import { functionSchema, mappingSchema } from '../model/contracts';
import type { Observation } from '../model/contracts';
import { normalize, readObservation } from '../integrations/registry';
import { lightingDecision } from '../policies/lighting';
import { houseDecision } from '../policies/house';
import { climateDecision } from '../policies/climate';
import type { PolicyContext, PolicyMemory } from '../policies/policy';
import { ManualClock } from './clock';
import { HomeRuntime } from './home';
import { Executor, manualActive } from '../execution/executor';
import type { StateValue } from '../integrations/registry';
import { compileNativeHeatingProgram } from '../integrations/native-program';
import { validateConfiguration } from '../config/configuration';

const observation = (value: boolean | number, at: number, capability = 'motion'): Observation => ({
	entityId: 'synthetic',
	capability,
	value,
	unit: '',
	measuredAt: at,
	receivedAt: at,
	quality: 'valid',
	sourceId: 'fixture.0.state',
});
const context = (now: number): PolicyContext => ({
	now,
	startedAt: 100,
	timezone: 'UTC',
	inputs: { motion: observation(true, now), lux: observation(2, now) },
	actual: observation(false, now),
	owns: false,
	manual: false,
});

describe('Anonymized freshness and policy parity regressions', () => {
	it('interprets zone-less event timestamps as UTC and rejects unconfirmed or malformed timestamp evidence', () => {
		const binding = referenceConfiguration('apartment').bindings[0];
		const mapping = mappingSchema.parse({
			capability: 'manualEvent',
			readId: 'fixture.0.button',
			valueType: 'number',
			eventTimestampId: 'fixture.0.lastupdated',
		});
		const at = Date.parse('2026-01-05T12:00:00Z'),
			raw = { val: 4002, ts: at, ack: true };
		const value = normalize(binding, mapping, raw, at, {
			event: { val: '2026-01-05T12:00:00', ts: at, ack: true },
		});
		assert.equal(value.measuredAt, at);
		assert.equal(value.quality, 'valid');
		assert.notEqual(
			normalize(binding, mapping, raw, at, { event: { val: 'next Thursday', ts: at, ack: true } }).quality,
			'valid',
		);
		assert.notEqual(
			normalize(binding, mapping, raw, at, { event: { val: at, ts: NaN, ack: true } }).quality,
			'valid',
		);
	});
	it('extends a ten-minute welcome only while continuously owned and cancels its timer for a manual adjustment', () => {
		const fn = functionSchema.parse({
				...referenceConfiguration('apartment').functions[0],
				behavior: { welcomeHoldMs: 600000 },
			}),
			memory: PolicyMemory = {};
		const make = (now: number, presence: boolean, motion = false): PolicyContext => ({
			...context(now),
			owns: true,
			actual: observation(true, now),
			inputs: {
				presence: observation(presence, now),
				motion: observation(motion, now),
				lux: observation(2, now),
			},
		});
		houseDecision(fn, { ...make(1000, false), owns: false, actual: observation(false, 1000) }, memory);
		assert.equal(
			houseDecision(fn, { ...make(2000, true), owns: false, actual: observation(false, 2000) }, memory)?.value,
			true,
		);
		for (let now = 12000; now <= 502000; now += 10000) {
			houseDecision(fn, make(now, true, now === 502000), memory);
		}
		for (let now = 512000; now < 1102000; now += 10000) {
			houseDecision(fn, make(now, true), memory);
		}
		assert.equal(houseDecision(fn, make(1102000, true), memory)?.value, false);
		const changed = structuredClone(memory);
		assert.equal(
			houseDecision(fn, { ...make(1102001, true), manual: true, manualAt: 1102001, manualValue: true }, changed),
			undefined,
		);
		assert.equal(changed.welcomeUntil, undefined);
	});
	it('bounds thermal trials and refuses a deep setback without low projected humidity', () => {
		const fn = functionSchema.parse({
			...referenceConfiguration('apartment').functions.find(f => f.kind === 'climate')!,
			parameters: { target: 21, setback: 15 },
			climate: {
				comfortWindows: [{ days: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '00:00' }],
				usageHoldMs: 1000,
				deepIdle: { afterMs: 60000, value: 13, maxHumidityAtTarget: 60 },
			},
		});
		const memory: PolicyMemory = {},
			make = (now: number, humidity = 30): PolicyContext => ({
				...context(now),
				inputs: {
					usage: observation(false, now),
					temperature: observation(19, now),
					humidity: observation(humidity, now),
				},
			});
		climateDecision(fn, make(1000), memory);
		assert.equal(climateDecision(fn, make(61000), memory).value, 13);
		assert.equal(climateDecision(fn, make(62000, 90), memory).value, 15);
		delete fn.climate!.usageHoldMs;
		delete fn.climate!.deepIdle;
		fn.nativeProgram = {
			profileId: 'PROFILE_2',
			fallback: 17,
			maxHorizonMs: 86400000,
			activationDelayMs: 120000,
			backendContractVerified: true,
		};
		fn.climate!.thermalAssist = {
			stalledMs: 60000,
			stepMs: 60000,
			maxTrialMs: 180000,
			maxIncrease: 2,
			maxSetpoint: 23,
			minDeficit: 1,
			minProgress: 0.3,
			highValve: 0.8,
		};
		const trial: PolicyMemory = {},
			heat = (now: number, valve = 0.1): PolicyContext => ({
				...context(now),
				actual: observation(21, now),
				inputs: { temperature: observation(18, now), valve: observation(valve, now) },
			});
		climateDecision(fn, heat(1000), trial);
		assert.equal(climateDecision(fn, heat(61000), trial).value, 22);
		assert.equal(climateDecision(fn, heat(121000), trial).value, 23);
		assert.equal(climateDecision(fn, heat(121001, 0.9), trial).value, 21);
		assert.equal(climateDecision(fn, heat(181000), trial).value, 21);
	});
	it('separates unchanged event time from device-scoped verification, rejecting missing, future, invalid and offline evidence', async () => {
		const binding = referenceConfiguration('apartment').bindings[0];
		const mapping = mappingSchema.parse({
			capability: 'motion',
			readId: 'fixture.0.motion',
			valueType: 'boolean',
			maxAgeMs: 900000,
			freshness: { verifiedAtId: 'fixture.0.checkedAt', reachableId: 'fixture.0.reachable', maxAgeMs: 30000 },
		});
		const raw = { val: false, ts: 1000, ack: true },
			proof = { val: 1300000, ts: 1300000, ack: true },
			reachable = { val: true, ts: 1000, ack: true };
		const value = normalize(binding, mapping, raw, 1300000, { verifiedAt: proof, reachable });
		assert.equal(value.quality, 'valid');
		assert.equal(value.measuredAt, 1000);
		assert.equal(value.verifiedAt, 1300000);
		assert.equal(normalize(binding, mapping, raw, 1300000).quality, 'unknown');
		for (const bad of [
			{ ...proof, val: 1300001 },
			{ ...proof, val: NaN },
			{ ...proof, q: 1 },
			{ ...proof, ack: false },
		]) {
			assert.notEqual(normalize(binding, mapping, raw, 1300000, { verifiedAt: bad, reachable }).quality, 'valid');
		}
		assert.equal(normalize(binding, mapping, raw, 1330001, { verifiedAt: proof, reachable }).quality, 'stale');
		assert.equal(
			normalize(binding, mapping, raw, 1300000, { verifiedAt: proof, reachable: { ...reachable, val: false } })
				.quality,
			'unavailable',
		);
		assert.equal(
			normalize(binding, mapping, { ...raw, val: null }, 1300000, { verifiedAt: proof, reachable }).quality,
			'unknown',
		);
		assert.equal(
			normalize(binding, mapping, { ...raw, q: 1 }, 1300000, { verifiedAt: proof, reachable }).quality,
			'invalid',
		);
		const read = await readObservation(
			binding,
			mapping,
			async id => (id === mapping.readId ? raw : id === mapping.freshness!.verifiedAtId ? proof : reachable),
			() => 1300000,
		);
		assert.deepEqual(read, value);
	});
	it('completes twenty minutes of continuously verified quiet despite a fifteen-minute event age, and abandons ownership on gaps', () => {
		const fn = structuredClone(referenceConfiguration('apartment').functions[0]);
		fn.parameters.holdMs = 1200000;
		const memory: PolicyMemory = {};
		assert.equal(lightingDecision(fn, context(1000), memory).value, true);
		for (let now = 2000; now < 1202000; now += 10000) {
			assert.equal(
				lightingDecision(
					fn,
					{
						...context(now),
						owns: true,
						inputs: { motion: observation(false, 2000), lux: observation(2, now) },
					},
					memory,
				).value,
				undefined,
			);
		}
		assert.equal(
			lightingDecision(
				fn,
				{ ...context(1202000), owns: true, inputs: { motion: observation(false, 2000) } },
				memory,
			).value,
			false,
		);
		memory.commandId = 'old-owner';
		assert.equal(
			lightingDecision(
				fn,
				{ ...context(1300000), owns: true, inputs: { motion: observation(false, 2000) } },
				memory,
			).value,
			undefined,
		);
		assert.equal(memory.commandId, undefined);
		assert.equal(
			lightingDecision(
				fn,
				{ ...context(1301000), owns: true, inputs: { motion: observation(false, 2000) } },
				memory,
			).value,
			undefined,
		);
		assert.equal(
			lightingDecision(fn, { ...context(1302000), inputs: { motion: observation(true, 1200000) } }, {}).value,
			undefined,
		);
	});
	it('requires the strict lux threshold even inside the hysteresis band', () => {
		const fn = structuredClone(referenceConfiguration('apartment').functions[0]);
		fn.parameters.luxThreshold = 6;
		fn.parameters.luxRearmAbove = 10;
		const memory: PolicyMemory = {};
		assert.equal(lightingDecision(fn, context(1000), memory).value, true);
		assert.equal(
			lightingDecision(
				fn,
				{ ...context(2000), inputs: { motion: observation(true, 2000), lux: observation(7, 2000) } },
				memory,
			).value,
			undefined,
		);
	});
	it('rearms manual OFF only after continuous quiet, resets through motion, unavailable reads and restart, and handles repeated button codes', async () => {
		const cfg = referenceConfiguration('apartment'),
			fn = cfg.functions[0],
			clock = new ManualClock(1000);
		fn.behavior = {
			continuityMs: 30000,
			manualOffQuietMs: 1200000,
			awayOff: false,
			manualSignals: [{ input: 'button', offValues: [4002] }],
			manualSignatureInputs: [],
		};
		fn.inputs.button = fn.inputs.motion;
		const port = {
			read: async () => null,
			metadata: async () => null,
			write: async () => {
				throw Error('no writes allowed');
			},
			persist: async () => undefined,
			inputs: async () => ({}),
		};
		const executor = new Executor(() => cfg, port, clock),
			physical = cfg.bindings.find(b => b.id === fn.actuator.entityId)!.physicalId;
		await executor.observeManualInputs(fn, { button: observation(4002, 1000), motion: observation(false, 1000) });
		assert.equal(Object.keys(executor.journal.manual).length, 0);
		clock.advance(1000);
		await executor.observeManualInputs(fn, { button: observation(4002, 2000), motion: observation(false, 1000) });
		assert.equal(executor.journal.manual[physical].value, false);
		for (let step = 0; step < 120; step++) {
			clock.advance(10000);
			await executor.observeManualInputs(fn, { motion: observation(false, 1000) });
		}
		assert.equal(manualActive(executor.journal.manual[physical], clock.now()), true);
		await executor.observeManualInputs(fn, { motion: observation(true, clock.now()) });
		for (let step = 0; step < 121; step++) {
			clock.advance(10000);
			await executor.observeManualInputs(fn, { motion: observation(false, clock.now()) });
		}
		assert.equal(manualActive(executor.journal.manual[physical], clock.now()), false);
		await executor.recordManual(fn, false, 'operator');
		const restarted = new Executor(() => cfg, port, clock);
		await restarted.restore(structuredClone(executor.journal));
		clock.advance(3600000);
		await restarted.observeManualInputs(fn, { motion: observation(false, clock.now()) });
		assert.equal(manualActive(restarted.journal.manual[physical], clock.now()), true);
	});
	it('uses stable presence edges for away and welcome without startup/reconnect replay or adopting a manual light', () => {
		const fn = functionSchema.parse({
			...referenceConfiguration('apartment').functions[0],
			behavior: { awayOff: true, welcomeHoldMs: 600000 },
		});
		const memory: PolicyMemory = {},
			ctx = context(1000);
		assert.equal(
			houseDecision(
				fn,
				{ ...ctx, inputs: { presence: observation(false, 1000), lux: observation(2, 1000) } },
				memory,
			),
			undefined,
		);
		assert.equal(
			houseDecision(
				fn,
				{ ...ctx, now: 2000, inputs: { presence: observation(true, 2000), lux: observation(2, 2000) } },
				memory,
			)?.reason,
			'house_welcome_on',
		);
		assert.equal(
			houseDecision(fn, { ...ctx, now: 3000, inputs: { presence: observation(false, 3000) } }, memory)?.value,
			false,
		);
		assert.equal(
			houseDecision(fn, { ...ctx, now: 4000, inputs: { presence: observation(false, 3000) } }, memory),
			undefined,
		);
		assert.equal(
			houseDecision(
				fn,
				{
					...ctx,
					now: 5000,
					actual: observation(true, 5000),
					inputs: { presence: observation(true, 5000), lux: observation(2, 5000) },
				},
				memory,
			)?.reason,
			'welcome_externally_on',
		);
		assert.equal(
			houseDecision(fn, { ...ctx, now: 100000, inputs: { presence: observation(false, 100000) } }, memory)
				?.reason,
			'house_continuity_lost',
		);
		assert.equal(
			houseDecision(fn, { ...ctx, now: 101000, inputs: { presence: observation(false, 101000) } }, memory),
			undefined,
		);
	});
	it('starts a thirty-minute session only for a new manual event, preserves its lease and cancels an older session on newer OFF', () => {
		const fn = functionSchema.parse({
				...referenceConfiguration('apartment').functions[0],
				behavior: { sessionOffMs: 1800000 },
			}),
			memory: PolicyMemory = {};
		assert.equal(houseDecision(fn, context(1000), memory), undefined);
		const ctx = { ...context(2000), manual: true, manualAt: 1500, manualValue: true };
		houseDecision(fn, ctx, memory);
		for (let now = 3000; now < 1801500; now += 10000) {
			houseDecision(fn, { ...ctx, now }, memory);
		}
		assert.equal(houseDecision(fn, { ...ctx, now: 1801500 }, memory)?.manualLeaseAt, 1500);
		assert.equal(
			houseDecision(fn, { ...ctx, now: 1802000, manualAt: 1801900, manualValue: false }, memory),
			undefined,
		);
		assert.equal(
			houseDecision(fn, { ...context(2000000), startedAt: 1999999, manualAt: 1500, manualValue: true }, {})
				?.value,
			undefined,
		);
	});
	it('keeps climate gates authoritative over schedules, preheats only the start, and does not apply sensor offsets twice', () => {
		const fn = functionSchema.parse({
			...referenceConfiguration('apartment').functions.find(f => f.kind === 'climate')!,
			parameters: { target: 22, setback: 17 },
			inputs: { weather: { entityId: 'sensor', capability: 'temperatureSensor' } },
			climate: {
				weatherBelow: 17,
				preheatMs: 1800000,
				comfortWindows: [{ days: [1], start: '07:00', end: '09:00' }],
			},
		});
		const at = Date.parse('2026-01-05T08:45:00Z'),
			ctx = { ...context(at), inputs: { weather: observation(5, at), temperature: observation(19, at) } };
		assert.equal(climateDecision(fn, ctx, {}).value, 22);
		assert.equal(climateDecision(fn, { ...ctx, now: Date.parse('2026-01-05T06:45:00Z') }, {}).value, 22);
		assert.equal(climateDecision(fn, { ...ctx, now: Date.parse('2026-01-05T09:00:00Z') }, {}).value, 17);
		assert.equal(
			climateDecision(
				fn,
				{ ...ctx, inputs: { ...ctx.inputs, weather: { ...ctx.inputs.weather, quality: 'stale' } } },
				{},
			).value,
			17,
		);
		fn.inputs.window = { entityId: 'sensor', capability: 'windowContact' };
		assert.equal(
			climateDecision(fn, { ...ctx, inputs: { ...ctx.inputs, window: observation(true, at) } }, {}).value,
			undefined,
		);
	});
	it('compiles a bounded native profile with autonomous fallback and rejects an unverified backend and ambiguous DST fold', () => {
		const cfg = referenceConfiguration('apartment'),
			fn = functionSchema.parse({
				...cfg.functions.find(f => f.kind === 'climate')!,
				nativeProgram: {
					profileId: 'PROFILE_2',
					fallback: 17,
					maxHorizonMs: 86400000,
					backendContractVerified: true,
				},
			});
		const binding = cfg.bindings.find(b => b.id === fn.actuator.entityId)!;
		const now = Date.parse('2026-01-05T21:00:00Z');
		fn.climate = { comfortWindows: [{ days: [1], start: '18:00', end: '23:00' }], preheatMs: 0, weekly: [] };
		const program = compileNativeHeatingProgram(fn, binding, 21, now, 'UTC', 'synthetic-command');
		assert.equal(program.expiresAt, Date.parse('2026-01-05T23:00:00Z'));
		assert.equal(program.days[1].periods[0].end, 1380);
		assert.equal(program.days[2].base, 17);
		fn.nativeProgram!.backendContractVerified = false;
		assert.throws(
			() => compileNativeHeatingProgram(fn, binding, 21, now, 'UTC', 'synthetic-command'),
			/unverified/,
		);
		fn.nativeProgram!.backendContractVerified = true;
		delete fn.climate;
		assert.throws(
			() =>
				compileNativeHeatingProgram(
					fn,
					binding,
					21,
					Date.parse('2026-10-24T23:00:00Z'),
					'Europe/Berlin',
					'fold',
				),
			/dst_fold/,
		);
	});
	it('runs the real HomeRuntime and Executor across twenty minutes, with an unchanged motion event and fresh per-device read proof', async () => {
		const cfg = referenceConfiguration('apartment');
		cfg.functions = [cfg.functions[0]];
		const fn = cfg.functions[0];
		fn.parameters.holdMs = 1200000;
		const clock = new ManualClock(100000),
			states: Record<string, StateValue> = {},
			writes: unknown[] = [];
		for (const binding of cfg.bindings) {
			for (const mapping of binding.capabilities) {
				states[mapping.readId] = {
					val: mapping.valueType === 'boolean' ? false : 2,
					ts: clock.now(),
					ack: true,
				};
				mapping.freshness = { verifiedAtId: `${mapping.readId}_checked`, maxAgeMs: 30000 };
			}
		}
		validateConfiguration(cfg);
		const motion = cfg.bindings
			.find(b => b.id === fn.inputs.motion.entityId)!
			.capabilities.find(m => m.capability === 'motion')!;
		const light = cfg.bindings.find(b => b.id === fn.actuator.entityId)!.capabilities[0];
		const runtime = new HomeRuntime(
			() => cfg,
			{
				read: async id =>
					id.endsWith('_checked') ? { val: clock.now(), ts: clock.now(), ack: true } : (states[id] ?? null),
				metadata: async id => ({
					type: id.endsWith('_checked') ? 'number' : typeof states[id]?.val,
					write: true,
					unit: id.includes('illuminance') ? 'lx' : '',
				}),
				write: async (id, value) => {
					writes.push(value);
					states[id] = { val: value, ts: clock.now(), ack: true };
				},
				persist: async () => undefined,
			},
			clock,
		);
		await runtime.initialize();
		await runtime.tick();
		clock.advance(1000);
		states[motion.readId] = { val: true, ts: clock.now(), ack: true };
		await runtime.tick();
		assert.deepEqual(writes, [true]);
		clock.advance(1000);
		await runtime.tick();
		states[motion.readId] = { val: false, ts: clock.now(), ack: true };
		await runtime.tick();
		for (let step = 0; step < 120; step++) {
			clock.advance(10000);
			await runtime.tick();
		}
		assert.deepEqual(writes, [true, false]);
		assert.equal(states[light.readId].val, false);
		runtime.close();
	});
});
