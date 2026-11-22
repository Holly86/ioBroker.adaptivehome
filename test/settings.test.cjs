const assert = require('node:assert/strict');
const settings = require('../admin/settings');

describe('instance settings native boundary', () => {
	it('shows object/list/null defaults as valid editable JSON without rewriting native types', () => {
		const original = { sourceFiles: {}, integrationProfiles: [], controlClients: [], modelProvider: null };
		const edited = Object.fromEntries(
			Object.entries(original).map(([key, value]) => [key, settings.display(value, settings.fields[key][0])]),
		);
		assert.deepEqual(settings.changes(original, edited), {});
		assert.equal(edited.modelProvider, 'null');
		assert.equal(settings.parse('', 'nullableObject'), null);
		assert.deepEqual(settings.parse('', 'array'), []);
	});
	it('returns only changed native fields and leaves private values, control grants and future fields untouched', () => {
		const original = {
			sourceFiles: { example: '/data/example.json' },
			modelToken: 'fixture-token',
			sourceEndpoints: '{"example":{"url":"http://127.0.0.1"}}',
			commissioningEnabled: false,
			futureField: { preserve: true },
		};
		const before = structuredClone(original);
		const diff = settings.changes(original, {
			sourceFiles: '{"example":"/data/other.json"}',
			modelToken: original.modelToken,
			sourceEndpoints: original.sourceEndpoints,
		});
		assert.deepEqual(diff, { sourceFiles: { example: '/data/other.json' } });
		assert.deepEqual(original, before);
		assert.equal(Object.hasOwn(diff, 'commissioningEnabled'), false);
		assert.equal(Object.hasOwn(diff, 'modelToken'), false);
	});
	it('keeps encrypted-native inputs as strings and complex profile inputs as arrays/objects', () => {
		const diff = settings.changes(
			{ integrationProfiles: [], modelProvider: null, sourceEndpoints: '' },
			{
				integrationProfiles: '[{"id":"example"}]',
				modelProvider: '{"id":"example"}',
				sourceEndpoints: '{"example":{}}',
			},
		);
		assert(Array.isArray(diff.integrationProfiles));
		assert.deepEqual(diff.modelProvider, { id: 'example' });
		assert.equal(diff.sourceEndpoints, '{"example":{}}');
	});
	it('refuses invalid JSON, mismatched field shapes and unknown native keys', () => {
		for (const [kind, value] of [
			['object', '[]'],
			['object', '{"example":42}'],
			['array', '{}'],
			['nullableObject', '[]'],
			['jsonString', 'broken'],
		]) {
			assert.throws(() => settings.parse(value, kind));
		}
		assert.throws(() => settings.changes({}, { commissioningEnabled: 'true' }), /unknown_native_field/);
		assert.throws(() => settings.changes({}, { sourceFiles: '{broken' }));
	});
});
