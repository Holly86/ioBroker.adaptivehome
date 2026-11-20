const assert = require('node:assert/strict');
const setup = require('../admin/setup');
const { referenceConfiguration } = require('../build/config/examples');
const { validateConfiguration } = require('../build/config/configuration');
const { builtInRegistry } = require('../build/integrations/profiles');
const empty = () => ({ ...referenceConfiguration('apartment'), groups: [], bindings: [], functions: [] });
describe('guided setup draft contract', () => {
	it('adds arbitrary named areas without changing existing advanced settings or its input', () => {
		const original = referenceConfiguration('apartment'),
			before = JSON.stringify(original);
		const draft = setup.addArea(original, 'Studio', 'installation');
		assert.equal(JSON.stringify(original), before);
		assert.deepEqual(draft.functions, original.functions);
		assert.deepEqual(draft.functions[0].limits, original.functions[0].limits);
		assert.equal(draft.groups.at(-1).name, 'Studio');
		validateConfiguration(draft, builtInRegistry());
	});
	it('imports read-only mappings without write grants and keeps freshness evidence', () => {
		const candidate = referenceConfiguration('apartment').bindings[0],
			before = JSON.stringify(candidate);
		const draft = setup.addDevice(empty(), candidate, 'Reading source', false, false),
			b = draft.bindings[0];
		assert.equal(b.confirmed, false);
		assert.equal(
			b.capabilities.some(m => m.writeId || m.writeValues),
			false,
		);
		assert.equal(JSON.stringify(candidate), before);
		assert.equal(b.physicalId, candidate.physicalId);
		assert.deepEqual(b.capabilities[0].freshness, candidate.capabilities[0].freshness);
		validateConfiguration(draft, builtInRegistry());
	});
	it('requires explicit ownership review for prepared control', () => {
		const candidate = referenceConfiguration('apartment').bindings.find(b => b.capabilities.some(m => m.writeId));
		assert.throws(() => setup.addDevice(empty(), candidate, 'Light', true, false), /ownership/);
		const draft = setup.addDevice(empty(), candidate, 'Light', true, true);
		assert.equal(draft.bindings[0].confirmed, true);
		assert.equal(draft.functions.length, 0);
	});
	it('rejects aliases and intersecting group members rather than adding a second identity', () => {
		const candidate = referenceConfiguration('apartment').bindings[0];
		const draft = setup.addDevice(empty(), candidate, 'First', false, false);
		assert.throws(
			() => setup.addDevice(draft, { ...candidate, id: 'alias' }, 'Alias', false, false),
			/device_exists/,
		);
		draft.bindings[0].memberPhysicalIds = ['shared-member'];
		assert.throws(
			() =>
				setup.addDevice(
					draft,
					{ ...candidate, id: 'group2', physicalId: 'group2', memberPhysicalIds: ['shared-member'] },
					'Group',
					false,
					false,
				),
			/device_exists/,
		);
	});
	for (const [kind, example, cap, extra] of [
		['lighting', 'apartment', 'switch', { hold: 20, threshold: 120 }],
		['climate', 'apartment', 'thermostatSetpoint', { target: 21, setback: 18 }],
		['air', 'air', 'fan', { airThreshold: 25, low: 25, high: 75 }],
		['equipment', 'aquarium', 'switch', { start: '21:00', end: '06:00', days: [1, 2, 3] }],
	]) {
		it(`prepares ${kind} disabled with valid typed inputs and no learning permission`, () => {
			const config = referenceConfiguration(example);
			config.functions = [];
			const actuator = setup.refs(config, cap, true)[0].value;
			const options = { name: 'Anonymous function', groupId: config.groups[0].id, kind, actuator, ...extra };
			for (const [key, capability] of [
				['motion', 'motion'],
				['lux', 'illuminance'],
				['temperature', 'temperatureSensor'],
				['airQuality', 'airQuality'],
			]) {
				options[key] = setup.refs(config, capability)[0]?.value;
			}
			const draft = setup.addFunction(config, options);
			validateConfiguration(draft, builtInRegistry());
			assert.equal(draft.functions[0].enabled, false);
			assert.equal(draft.functions[0].autonomy.granted, false);
			assert.equal(config.functions.length, 0);
			if (kind === 'lighting') {
				assert.equal(draft.functions[0].parameters.holdMs, 1200000);
			}
			assert.throws(() => setup.addFunction(draft, options), /output_owned/);
		});
	}
	it('does not offer OFF-only outputs, native profile transports or wrong types as simple switches', () => {
		const config = referenceConfiguration('apartment');
		for (const b of config.bindings) {
			for (const m of b.capabilities) {
				if (m.capability === 'switch') {
					m.writeValues = [false];
				}
			}
		}
		assert.equal(setup.refs(config, 'switch', true).length, 0);
	});
	it('rejects invalid dates, missing sources, excessive targets and empty names without changing the draft', () => {
		const config = referenceConfiguration('apartment');
		config.functions = [];
		const options = {
			kind: 'lighting',
			name: 'Light',
			groupId: config.groups[0].id,
			actuator: setup.refs(config, 'switch', true)[0].value,
			hold: 5,
			threshold: 50,
		};
		const before = JSON.stringify(config);
		assert.throws(() => setup.addFunction(config, options), /selection/);
		assert.throws(() => setup.addArea(config, '  ', 'room'), /name/);
		assert.equal(JSON.stringify(config), before);
	});
});
