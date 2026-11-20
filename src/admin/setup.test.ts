import { strict as assert } from 'node:assert';
import { setupCatalog, setupNames, discoveryBackends } from './setup';
import { builtInRegistry } from '../integrations/profiles';
import { referenceConfiguration } from '../config/examples';

describe('guided setup metadata', () => {
	const registry = builtInRegistry();
	it('returns only supported instance summaries, never native credentials', () => {
		const rows = ['shelly.8', 'sql.7', 'unknown.2', 'shelly.80.config'].map(instance => ({
			id: `system.adapter.${instance}`,
			value: { common: { enabled: true, version: '1' }, native: { password: 'synthetic-secret' } },
		}));
		const result = setupCatalog(rows, registry);
		assert.deepEqual(
			result.map(x => x.instance),
			['shelly.8', 'sql.7'],
		);
		assert.equal(JSON.stringify(result).includes('synthetic-secret'), false);
		assert.equal(result[0].profiles.length > 0, true);
	});
	it('restricts discovery to an exact supported instance', () => {
		assert.deepEqual(discoveryBackends(registry, 'shelly.8'), ['shelly.8']);
		for (const input of ['shelly.*', 'shelly.8.extra', 'system.0', {}, null]) {
			assert.throws(() => discoveryBackends(registry, input));
		}
		assert.equal(discoveryBackends(registry).includes('shelly'), true);
	});
	it('uses translated parent names without changing mappings or ownership', () => {
		const candidate = referenceConfiguration('apartment').bindings[0];
		const path = candidate.capabilities[0].readId,
			parent = path.slice(0, path.lastIndexOf('.'));
		const result = setupNames(
			[candidate],
			{},
			{ resources: { [parent]: { name: { de: 'Testleuchte', en: 'Test light' } } } },
			'de',
		)[0];
		assert.equal(result.name, 'Testleuchte');
		assert.deepEqual(result.capabilities, candidate.capabilities);
		assert.equal(result.confirmed, candidate.confirmed);
		assert.equal(candidate.name, undefined);
	});
	it('bounds fallback labels and ignores malformed names', () => {
		const candidate = referenceConfiguration('apartment').bindings[0],
			path = candidate.capabilities[0].readId;
		const result = setupNames(
			[candidate],
			{ [path]: { type: 'boolean', name: 'x'.repeat(200) } },
			{ resources: {} },
			'en',
		);
		assert.equal(result[0].name?.length, 128);
		assert.equal(setupNames([candidate], {}, { resources: {} }, 'en')[0].name, undefined);
	});
});
