import { strict as assert } from 'node:assert';
import { bindingSchema, mappingSchema } from '../model/contracts';
import { auditMapping, IntegrationRegistry, normalize } from './registry';
describe('AP-03 integration contract', () => {
	const registry = new IntegrationRegistry();
	registry.register({
		apiVersion: 1,
		id: 'example',
		name: 'Example',
		backends: ['example.0'],
		capabilities: ['switch', 'temperatureSensor'],
		discover: () => [],
	});
	const mapping = mappingSchema.parse({
		capability: 'switch',
		valueType: 'boolean',
		readId: 'example.0.relay',
		writeId: 'example.0.relay',
		confirmId: 'example.0.relay',
	});
	const binding = bindingSchema.parse({
		id: 'output',
		physicalId: 'synthetic-output',
		integrationId: 'example',
		family: 'example',
		backendVersion: '1',
		capabilities: [mapping],
	});
	it('keeps missing, future, stale and invalid measurements distinct from false', () => {
		assert.equal(normalize(binding, mapping, null, 1000).value, null);
		assert.equal(normalize(binding, mapping, { val: false, ts: 1000, lc: 0 }, 1000).quality, 'valid');
		assert.equal(normalize(binding, mapping, { val: false, ts: 1001 }, 1000).quality, 'unknown');
		assert.equal(normalize(binding, mapping, { val: false, ts: 0 }, 999999).quality, 'stale');
		assert.equal(normalize(binding, mapping, { val: 'false', ts: 1000 }, 1000).quality, 'invalid');
	});
	it('checks exact permissions, unit conversion and feedback paths', () => {
		registry.validate(binding);
		assert.throws(
			() => registry.validate({ ...binding, capabilities: [{ ...mapping, confirmId: undefined }] }),
			/unconfirmable/,
		);
		assert.throws(
			() =>
				registry.validate({
					...binding,
					capabilities: [{ ...mapping, capability: 'temperatureSensor', unit: 'F' }],
				}),
			/unit/,
		);
		assert.throws(() => auditMapping(mapping, { [mapping.readId]: { type: 'boolean', write: false } }), /readonly/);
		const temp = mappingSchema.parse({
			capability: 'temperatureSensor',
			readId: 'example.0.temp',
			valueType: 'number',
			unit: '°C',
			sourceUnit: '°F',
			scale: 5 / 9,
			offset: (-32 * 5) / 9,
		});
		assert.equal(normalize(binding, temp, { val: 68, ts: 1 }, 1).value, 20);
	});
});
