import { strict as assert } from 'node:assert';
import { referenceConfiguration } from '../config/examples';
import { ManualClock } from '../runtime/clock';
import type { HomePort } from '../runtime/home';
import { HomeRuntime } from '../runtime/home';
import { trainLocal } from './model';
import { usageDataset } from './model.test';
import { effectMetric } from './adaptation';
describe('AP-23 closed local automation through the real executor', () => {
	async function setup(mode: 'classic' | 'observe' | 'suggest' | 'bounded' | 'full' = 'full', baselineOn = false) {
		const config = referenceConfiguration('apartment');
		config.functions = [config.functions[0]];
		const fn = config.functions[0],
			rows = usageDataset().map(o => ({ ...o, entityId: 'motion' })),
			now = rows.at(-1)!.measuredAt + 9 * 3600000;
		fn.autonomy = {
			...fn.autonomy,
			mode,
			granted: true,
			capabilities: ['switch'],
			blocks: ['schedule', 'sensor'],
			parameters: { holdMs: { min: 60000, max: 600000 } },
			evaluateAfterMs: 10000,
			objectives: { comfort: 1, energy: 0, switching: 0 },
		};
		const mapping = config.bindings[0].capabilities[0];
		mapping.confirmation = 'device';
		const clock = new ManualClock(now),
			states = new Map<string, { val: unknown; ts: number; ack: boolean }>(),
			writes: unknown[] = [];
		const port: HomePort = {
			read: async id => states.get(id) ?? null,
			metadata: async id => ({
				type: id.endsWith('illuminance') ? 'number' : 'boolean',
				unit: id.endsWith('illuminance') ? 'lx' : '',
				write: true,
			}),
			persist: async () => undefined,
			write: async (id, value) => {
				writes.push({ id, value });
				const state = { val: value, ts: clock.now(), ack: true };
				states.set(id, state);
				await runtime.feedback(id, { ...state, from: 'system.adapter.synthetic.0' });
			},
		};
		const runtime = new HomeRuntime(() => config, port, clock);
		await runtime.initialize();
		const model = trainLocal({
			kind: 'usage',
			timezone: 'UTC',
			now: rows.at(-1)!.measuredAt,
			observations: rows,
			profile: fn.autonomy,
			baselineStartMinute: 600,
		});
		model.trainedAt = now;
		runtime.learning.record.models[fn.id] = [model];
		// Comparable pre-activation observations are synthetic measured inputs, not mocked success flags.
		for (let n = 3; n >= 1; n--) {
			const at = now - n * 2000;
			runtime.history.observation({ ...rows[0], measuredAt: at, receivedAt: at, value: true });
			runtime.history.observation({
				...rows[0],
				entityId: 'light',
				capability: 'switch',
				sourceId: mapping.readId,
				measuredAt: at,
				receivedAt: at,
				value: baselineOn,
			});
		}
		states.set(mapping.readId, { val: false, ts: now, ack: true });
		states.set('test.0.motion.motion', { val: true, ts: now + 1, ack: true });
		states.set('test.0.motion.illuminance', { val: 10, ts: now, ack: true });
		clock.advance(1);
		return { config, fn, clock, states, writes, runtime, model };
	}
	it('activates parameters and a new permitted rule combination without approval, then confirms/evaluates the device', async () => {
		const s = await setup();
		try {
			await s.runtime.tick();
			const active = s.runtime.adaptation.active('light');
			assert.ok(active);
			assert.ok(active.plan.rules.length);
			assert.equal(s.writes.length, 1);
			assert.equal(s.runtime.executor.journal.commands[0].intent.origin, 'learned_policy');
			assert.equal(s.runtime.executor.journal.commands[0].intent.reasonCode, 'rule_schedule');
			assert.equal(s.runtime.executor.journal.commands[0].deviceConfirmed, true);
			for (let n = 0; n < 3; n++) {
				s.clock.advance(2000);
				s.states.set('test.0.motion.motion', { val: true, ts: s.clock.now(), ack: true });
				await s.runtime.tick();
			}
			s.clock.advance(5000);
			await s.runtime.tick();
			assert.equal(s.runtime.adaptation.active('light')?.status, 'verified');
			assert.ok(s.runtime.adaptation.active('light')?.effect);
		} finally {
			s.runtime.close();
		}
	});
	it('keeps observe/suggest passive for learned activation and bounded mode parameter-only', async () => {
		for (const mode of ['classic', 'observe', 'suggest', 'bounded'] as const) {
			const s = await setup(mode);
			try {
				await s.runtime.tick();
				const active = s.runtime.adaptation.active('light');
				if (mode === 'bounded') {
					assert.ok(active);
					assert.equal(active.plan.rules.length, 0);
				} else {
					assert.equal(active, undefined);
				}
			} finally {
				s.runtime.close();
			}
		}
	});
	it('automatically rolls back a degraded measured outcome and retains a newer manual wish', async () => {
		const s = await setup('full', true);
		try {
			await s.runtime.tick();
			const state = s.runtime.adaptation.active('light')!;
			assert.ok(
				effectMetric(s.fn, s.runtime.history, s.runtime.executor.journal, s.clock.now() - 10000, s.clock.now()),
			);
			assert.equal(state.baseline!.score, 0);
			// Backend continues reporting off during measured usage: confirmed command is not proof of useful effect.
			for (let n = 0; n < 3; n++) {
				s.clock.advance(2000);
				const at = s.clock.now();
				s.runtime.history.observation({
					entityId: 'motion',
					capability: 'motion',
					value: true,
					unit: '',
					measuredAt: at,
					receivedAt: at,
					quality: 'valid',
					sourceId: 'test.0.motion.motion',
				});
				s.runtime.history.observation({
					entityId: 'light',
					capability: 'switch',
					value: false,
					unit: '',
					measuredAt: at,
					receivedAt: at,
					quality: 'valid',
					sourceId: 'test.0.light.switch',
				});
			}
			s.clock.advance(5000);
			await s.runtime.adaptation.advance(
				s.config,
				s.runtime.learning.record.models,
				s.runtime.history,
				s.runtime.executor.journal,
				s.clock.now(),
			);
			assert.equal(state.status, 'rolled_back');
			assert.equal(state.rollbackReason, 'observed_outcome_degraded');
			const other = await setup();
			try {
				await other.runtime.tick();
				other.clock.advance(1);
				await other.runtime.manual('light', false, 'new-manual', 'operator');
				await other.runtime.tick();
				assert.equal(other.runtime.adaptation.active('light'), undefined);
				assert.equal(other.runtime.executor.journal.manual['synthetic-light'].value, false);
			} finally {
				other.runtime.close();
			}
		} finally {
			s.runtime.close();
		}
	});
	it('keeps an accepted suggestion active and resumes a paused plan within its original grant', async () => {
		const s = await setup('suggest');
		const action = (name: string) =>
			s.runtime.adaptation.action(
				'light',
				name,
				s.config,
				s.runtime.learning.record.models,
				s.runtime.history,
				s.runtime.executor.journal,
				s.clock.now(),
			);
		try {
			await s.runtime.tick();
			assert.equal(s.runtime.adaptation.active('light'), undefined);
			await action('accept');
			await s.runtime.tick();
			assert.equal(s.runtime.adaptation.active('light')?.acceptedByOperator, true);
			await action('pause');
			assert.equal(s.runtime.adaptation.active('light'), undefined);
			await action('resume');
			await s.runtime.tick();
			assert.equal(s.runtime.adaptation.active('light')?.acceptedByOperator, true);
		} finally {
			s.runtime.close();
		}
	});
});
