import { strict as assert } from 'node:assert';
import { ConfigurationStore, validateConfiguration } from './configuration';
import { referenceConfiguration } from './examples';
import { intersectWindows, windowMatches } from './schedule';
describe('AP-04 configuration transactions', () => {
	it('rejects a second function alias that could bypass an essential output or its hard limits', () => {
		const config = referenceConfiguration('aquarium');
		const alias = structuredClone(config.functions[1]);
		alias.id = 'alias';
		alias.limits.essential = false;
		delete alias.limits.minimumValue;
		config.functions.push(alias);
		assert.throws(() => validateConfiguration(config), /duplicate_function_owner/);
	});
	it('validates all three complete reference cases and rejects duplicate physical writers', () => {
		for (const kind of ['apartment', 'aquarium', 'air'] as const) {
			assert.ok(referenceConfiguration(kind).functions.length);
		}
		const config = referenceConfiguration('aquarium');
		config.bindings[2].physicalId = config.bindings[0].physicalId;
		assert.throws(() => validateConfiguration(config), /duplicate_physical_writer/);
	});
	it('rejects partial invalid changes, stale revisions and failed persistence', async () => {
		let fail = false;
		const store = new ConfigurationStore({
			read: async () => null,
			write: async () => {
				if (fail) {
					throw new Error('storage_down');
				}
			},
		});
		const first = await store.activate(referenceConfiguration('air'), 0);
		assert.equal(first.revision, 1);
		await assert.rejects(store.activate(referenceConfiguration('air'), 0), /revision_conflict/);
		await assert.rejects(
			store.activate({ ...first, functions: [{ ...first.functions[0], limits: { min: 100, max: 0 } }] }, 1),
			/contradictory/,
		);
		fail = true;
		await assert.rejects(store.activate(first, 1), /storage_down/);
		assert.equal(store.record.active.revision, 1);
	});
	it('handles overnight weekday anchoring and both DST occurrences in the configured zone', () => {
		const overnight = { days: [1], start: '22:00', end: '02:00' };
		assert.equal(windowMatches(overnight, Date.parse('2026-11-03T00:30:00Z'), 'UTC'), true);
		assert.equal(windowMatches(overnight, Date.parse('2026-11-04T00:30:00Z'), 'UTC'), false);
		const repeated = { days: [0], start: '02:00', end: '03:00' };
		assert.equal(windowMatches(repeated, Date.parse('2026-10-25T00:30:00Z'), 'Europe/Berlin'), true);
		assert.equal(windowMatches(repeated, Date.parse('2026-10-25T01:30:00Z'), 'Europe/Berlin'), true);
	});
	it('does not export channel recipients and rejects arbitrary executable fields', async () => {
		const config = referenceConfiguration('air');
		const store = new ConfigurationStore({ read: async () => null, write: async () => undefined });
		await store.activate(
			{ ...config, notificationRoutes: [{ id: 'demo', adapter: 'telegram.0', recipient: 'synthetic' }] },
			0,
		);
		assert.deepEqual(store.export().notificationRoutes, []);
		assert.throws(() => validateConfiguration({ ...config, script: 'untrusted' }));
	});
	it('intersects overnight learned windows with hard operating windows and rejects essential-off scenes', () => {
		const windows = intersectWindows(
			[{ days: [1], start: '22:00', end: '02:00' }],
			[{ days: [2], start: '01:00', end: '03:00' }],
		);
		assert.deepEqual(windows, [{ days: [2], start: '01:00', end: '02:00' }]);
		const config = referenceConfiguration('aquarium');
		config.scenes = [{ id: 'off', name: 'Off', actions: [{ functionId: 'circulation', value: false }] }];
		assert.throws(() => validateConfiguration(config), /minimum/);
	});
});
