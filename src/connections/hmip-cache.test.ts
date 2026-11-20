import { strict as assert } from 'node:assert';
import { HmipSessionSource } from './hmip-session';

describe('shared read-only HmIP pacing', () => {
	it('shares a two-minute read cache without refreshing its original receipt', async () => {
		let now = Date.UTC(2026, 0, 12),
			calls = 0;
		const source = new HmipSessionSource(
			{
				callRestApi: async endpoint => {
					assert.equal(endpoint, 'home/getCurrentState');
					calls++;
					return { home: { id: 'anonymous-home', connected: true }, groups: {}, devices: {} };
				},
			},
			{},
			() => now,
			120000,
		);
		const first = await source.read();
		for (let i = 0; i < 7; i++) {
			now += 15000;
			const cached = await source.read();
			assert.equal(cached.fetchedAt, first.fetchedAt);
			assert.deepEqual(cached.document, first.document);
		}
		assert.equal(calls, 1);
		now += 15000;
		const next = await source.read();
		assert.equal(calls, 2);
		assert.equal(next.fetchedAt, now);
		assert.notEqual(next.fetchedAt, first.fetchedAt);
	});
});
