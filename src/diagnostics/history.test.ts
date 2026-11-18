import { strict as assert } from 'node:assert';
import { History } from './history';
import { contextProfiles } from '../integrations/context-profiles';
import { HomeRuntime } from '../runtime/home';
import { emptyConfiguration } from '../config/configuration';
import { ManualClock } from '../runtime/clock';
describe('AP-08 bounded history', () => {
	it('deduplicates missing samples while retaining quality, source and real measurement changes', () => {
		const h = new History();
		const row = {
			entityId: 'fixture',
			capability: 'charging',
			value: null,
			unit: '',
			measuredAt: 0,
			receivedAt: 0,
			sourceId: 'fixture.0.charging',
			quality: 'unavailable' as const,
		};
		for (let t = 0; t < 60000; t += 1000) {
			h.observation({ ...row, measuredAt: t, receivedAt: t });
		}
		assert.equal(h.record.observations.length, 1);
		h.observation({ ...row, sourceId: 'fixture.1.charging', measuredAt: 60000, receivedAt: 60000 });
		h.observation({ ...row, quality: 'unknown', measuredAt: 61000, receivedAt: 61000 });
		h.observation({ ...row, quality: 'valid', value: false, measuredAt: 62000, receivedAt: 62000 });
		h.observation({ ...row, quality: 'valid', value: false, measuredAt: 63000, receivedAt: 63000 });
		h.observation({ ...row, measuredAt: 64000, receivedAt: 64000 });
		assert.equal(h.record.observations.length, 6);
	});
	it('persists a stable missing source once, retries storage failure and persists its recovery without a device writer', async () => {
		const clock = new ManualClock(100000),
			cfg = emptyConfiguration();
		const b = contextProfiles()
			.find(p => p.id === 'mihome-vacuum')!
			.discover({ 'mihome-vacuum.7.info.is_charging': { type: 'boolean', read: true } })[0];
		cfg.bindings = [b];
		cfg.sources = [
			{
				id: 'charge',
				enabled: true,
				kind: 'generic',
				ref: { entityId: b.id, capability: 'charging' },
				absenceConfirmMs: 300000,
				presenceConfirmations: 1,
			},
		];
		let available = false,
			writes = 0,
			persists = 0;
		const runtime = new HomeRuntime(
			() => cfg,
			{
				read: async () => (available ? { val: false, ts: 200000, ack: true } : null),
				metadata: async () => ({ type: 'boolean', read: true }),
				write: async () => {
					writes++;
				},
				persist: async key => {
					if (key === 'history' && ++persists === 1) {
						throw Error('fixture_storage_failure');
					}
				},
			},
			clock,
		);
		await runtime.initialize();
		try {
			await runtime.tick();
			assert.equal(runtime.history.storageError, true);
			for (let n = 0; n < 120; n++) {
				clock.advance(1000);
				await runtime.tick();
			}
			assert.equal(runtime.history.record.observations.length, 1);
			assert.equal(persists, 2);
			assert.equal(runtime.history.storageError, false);
			available = true;
			clock.advance(30000);
			await runtime.tick();
			assert.equal(persists, 3);
			assert.equal(runtime.sourceObservations.charge.quality, 'valid');
			assert.equal(writes, 0);
		} finally {
			runtime.close();
		}
	});
	it('deduplicates readings, rotates, recovers valid rows and strips support data', () => {
		const history = new History(2, 1000),
			row = {
				entityId: 'private_name',
				capability: 'motion',
				value: true,
				unit: '',
				measuredAt: 100,
				receivedAt: 100,
				sourceId: 'secret.0.motion',
				quality: 'valid' as const,
			};
		history.observation(row);
		history.observation(row);
		assert.equal(history.record.observations.length, 1);
		history.restore({
			version: 1,
			observations: [{ broken: true }, { ...row, measuredAt: 200, receivedAt: 200 }],
			events: [],
		});
		assert.equal(history.dropped, 1);
		history.event({ type: 'decision', scope: 'private_name', code: 'motion', revision: 1, at: 200 });
		const exported = JSON.stringify(history.supportExport());
		assert.ok(!exported.includes('private_name'));
		assert.ok(!exported.includes('secret.0.motion'));
		history.rotate(2000);
		assert.equal(history.record.observations.length, 0);
		history.clear();
		assert.equal(history.record.events.length, 0);
	});
});
