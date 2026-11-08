import { strict as assert } from 'node:assert';
import definition from '../../examples/integrations/lumenlab.json';
import { profileFromDefinition, registerDefinitions, runIntegrationContract } from './sdk';
import { builtInRegistry } from './profiles';
describe('AP-14 declarative third-party SDK', () => {
	it('loads a new manufacturer without changing policy modules or lifecycle', () => {
		const registry = builtInRegistry();
		registerDefinitions(registry, [definition]);
		const result = runIntegrationContract(definition, {
			now: 1000,
			objects: {
				'lumenlab.0.lamp.actuation.output': { type: 'boolean', write: true },
				'lumenlab.0.lamp.sensing.daylight': { type: 'number', unit: 'lx' },
			},
			states: {},
		});
		assert.deepEqual(result, { bindings: 2, observations: 2 });
		assert.ok(registry.list().some(m => m.id === 'lumenlab'));
	});
	it('rejects incompatible APIs, executable fields and regex injection', () => {
		assert.throws(() => profileFromDefinition({ ...definition, apiVersion: 2 }));
		assert.throws(() => profileFromDefinition({ ...definition, script: 'anything' }));
		assert.throws(() =>
			profileFromDefinition({ ...definition, rules: [{ ...definition.rules[0], suffix: '(a+)+$' }] }),
		);
	});
});
