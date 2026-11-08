import { strict as assert } from 'node:assert';
import type { Observation } from '../model/contracts';
import { autonomySchema } from '../model/contracts';
import { trainLocal } from './model';
export function usageDataset(): Observation[] {
	const rows: Observation[] = [];
	const start = Date.parse('2026-10-01T00:00:00Z');
	for (let day = 0; day < 8; day++) {
		for (let hour = 0; hour < 24; hour++) {
			const at = start + day * 86400000 + hour * 3600000;
			rows.push({
				entityId: 'usage',
				capability: 'motion',
				value: hour >= 8 && hour <= 17,
				unit: '',
				measuredAt: at,
				receivedAt: at,
				sourceId: 'synthetic.0.motion',
				quality: 'valid',
			});
		}
	}
	return rows;
}
describe('AP-20 chronological local learning', () => {
	it('learns positive usage from separate days and reports holdout evidence without invented confidence', () => {
		const observations = usageDataset(),
			profile = autonomySchema.parse({ mode: 'observe' });
		const model = trainLocal({
			kind: 'usage',
			timezone: 'UTC',
			now: observations.at(-1)!.measuredAt,
			observations,
			profile,
			baselineStartMinute: 600,
		});
		assert.equal(model.admitted, true);
		assert.equal(model.startMinute, 480);
		assert.ok(model.trainUntil < model.evaluationFrom);
		assert.equal(model.candidateMAE, 0);
		assert.equal(model.baselineMAE, 120);
	});
	it('rejects future knowledge, missing coverage and absent positive evidence', () => {
		const observations = usageDataset(),
			profile = autonomySchema.parse({ mode: 'observe' });
		const future = trainLocal({ kind: 'usage', timezone: 'UTC', now: 0, observations, profile });
		assert.equal(future.admitted, false);
		assert.equal(future.validSamples, 0);
		const gaps = trainLocal({
			kind: 'usage',
			timezone: 'UTC',
			now: observations.at(-1)!.measuredAt,
			observations: observations.filter((_, i) => i % 2 === 0),
			profile,
		});
		assert.equal(gaps.admitted, false);
		const absent = trainLocal({
			kind: 'usage',
			timezone: 'UTC',
			now: observations.at(-1)!.measuredAt,
			observations: observations.map(o => ({ ...o, value: false })),
			profile,
		});
		assert.equal(absent.admitted, false);
	});
});
