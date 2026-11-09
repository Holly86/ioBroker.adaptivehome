import { strict as assert } from 'node:assert';
import { referenceConfiguration } from '../config/examples';
import type { Observation } from '../model/contracts';
import { lightingDecision } from './lighting';
import type { PolicyContext, PolicyMemory } from './policy';
const observation = (value: boolean | number, at: number, capability = 'motion'): Observation => ({
	entityId: 'sensor',
	capability,
	value,
	unit: '',
	measuredAt: at,
	receivedAt: at,
	quality: 'valid',
	sourceId: 'test.0.sensor',
});
describe('AP-15 motion lighting', () => {
	const fn = referenceConfiguration('apartment').functions[0];
	function context(now: number): PolicyContext {
		return {
			now,
			startedAt: 100,
			timezone: 'UTC',
			inputs: { motion: observation(true, now), lux: observation(10, now, 'illuminance') },
			actual: observation(false, now, 'switch'),
			owns: false,
			manual: false,
		};
	}
	it('extends a five-minute quiet deadline with new movement', () => {
		const memory: PolicyMemory = {};
		assert.equal(lightingDecision(fn, context(1000), memory).value, true);
		const owned = { ...context(2000), owns: true };
		lightingDecision(fn, owned, memory);
		for (let now = 3000; now < 302999; now += 10000) {
			lightingDecision(
				fn,
				{ ...owned, now, inputs: { ...owned.inputs, motion: observation(false, 3000) } },
				memory,
			);
		}
		assert.equal(
			lightingDecision(
				fn,
				{ ...owned, now: 302999, inputs: { ...owned.inputs, motion: observation(false, 3000) } },
				memory,
			).value,
			undefined,
		);
		assert.equal(
			lightingDecision(
				fn,
				{ ...owned, now: 303000, inputs: { ...owned.inputs, motion: observation(false, 3000) } },
				memory,
			).value,
			false,
		);
	});
	it('does not take ownership of a foreign light or replay old motion after restart', () => {
		const ctx = context(1000);
		assert.equal(
			lightingDecision(fn, { ...ctx, actual: observation(true, 1000, 'switch') }, {}).reason,
			'externally_on',
		);
		assert.equal(lightingDecision(fn, { ...ctx, startedAt: 2000 }, {}).value, undefined);
		assert.equal(
			lightingDecision(
				fn,
				{ ...ctx, inputs: { ...ctx.inputs, motion: { ...ctx.inputs.motion!, quality: 'unknown' } } },
				{},
			).reason,
			'motion_unavailable',
		);
	});
});
