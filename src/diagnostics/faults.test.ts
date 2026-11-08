import { strict as assert } from 'node:assert';
import { referenceConfiguration } from '../config/examples';
import type { HomePort } from '../runtime/home';
import { HomeRuntime } from '../runtime/home';
import { ManualClock } from '../runtime/clock';
import { addTypeHints } from '../integrations/type-hints';
import { shellyProfile } from '../integrations/profiles';
import { LocalLearning } from '../learning/local';
describe('AP-24 integrated failure regressions', () => {
	it('retains a slightly future movement until valid and does not replay it after restart', async () => {
		const config = referenceConfiguration('apartment');
		config.functions = [config.functions[0]];
		const clock = new ManualClock(1000),
			states = new Map<string, { val: boolean | number; ts: number; ack: boolean }>([
				['test.0.light.switch', { val: false, ts: 1000, ack: true }],
				['test.0.motion.motion', { val: true, ts: 1001, ack: true }],
				['test.0.motion.illuminance', { val: 10, ts: 1000, ack: true }],
			]),
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
				writes.push(value);
				states.set(id, { val: value as boolean, ts: clock.now(), ack: true });
			},
		};
		const runtime = new HomeRuntime(() => config, port, clock);
		try {
			await runtime.initialize();
			await runtime.tick();
			assert.equal(writes.length, 0);
			clock.advance(1);
			await runtime.tick();
			assert.equal(writes.length, 1);
			await runtime.executor.pollFeedback();
			assert.equal(runtime.executor.journal.commands[0].feedbackMatched, true);
		} finally {
			runtime.close();
		}
		clock.advance(1);
		const restarted = new HomeRuntime(() => config, port, clock);
		try {
			await restarted.initialize();
			await restarted.tick();
			assert.equal(writes.length, 1);
		} finally {
			restarted.close();
		}
	});
	it('keeps a healthy minimum service running when another audit and optional history storage fail', async () => {
		const config = referenceConfiguration('aquarium');
		config.functions[0].operatingMode = 'automatic';
		config.functions[0].rules = [
			{
				id: 'on',
				block: 'minimum',
				enabled: true,
				conditions: [],
				windows: [],
				value: true,
				priority: 1,
				excludeDates: [],
			},
		];
		const writes: string[] = [];
		const port: HomePort = {
			read: async () => ({ val: false, ts: 1000, ack: true }),
			metadata: async id => {
				if (id.includes('light')) {
					throw new Error('private-installation-address');
				}
				return { type: 'boolean', write: true };
			},
			persist: async key => {
				if (key === 'history') {
					throw new Error('optional_store_down');
				}
			},
			write: async id => {
				writes.push(id);
			},
		};
		const runtime = new HomeRuntime(() => config, port, new ManualClock(1000));
		try {
			await runtime.initialize();
			await runtime.tick();
			assert.ok(writes.includes('test.0.circulation.switch'));
			assert.ok(!writes.includes('test.0.light.switch'));
			assert.equal(runtime.traces.light.reasonCode, 'execution_failed');
			assert.ok(!JSON.stringify(runtime.history.supportExport()).includes('private-installation-address'));
		} finally {
			runtime.close();
		}
	});
	it('uses the real type detector only for advisory hints, and rejects corrupt model journals', () => {
		const metadata = {
			'shelly.0.synthetic.Switch': { type: 'boolean', role: 'switch.light', read: true, write: true },
		};
		const bindings = addTypeHints(shellyProfile.discover(metadata), metadata);
		assert.equal(bindings[0].confirmed, false);
		assert.ok(bindings[0].detectedTypes.length);
		const learning = new LocalLearning(async () => undefined);
		assert.throws(() => learning.restore({ version: 1, models: { bad: [{}] }, errors: {} } as never));
		learning.close();
	});
});
