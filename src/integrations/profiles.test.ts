import { strict as assert } from 'node:assert';
import {
	builtInRegistry,
	shellyProfile,
	homematicCcuProfile,
	homematicCloudProfile,
	hueProfile,
	philipsAirProfile,
	ikeaTradfriProfile,
	ikeaMatterProfile,
	ikeaZigbeeProfile,
} from './profiles';
import { auditMapping, normalize } from './registry';
describe('AP-09 Shelly contract fixtures', () => {
	it('keeps channels distinct, requires confirmation and preserves false feedback', () => {
		const discovered = shellyProfile.discover({
			'shelly.0.synthetic.Relay0.Switch': { type: 'boolean', write: true },
			'shelly.0.synthetic.Relay1.Switch': { type: 'boolean', write: true },
		});
		assert.equal(discovered.length, 2);
		assert.notEqual(discovered[0].physicalId, discovered[1].physicalId);
		for (const binding of discovered) {
			assert.equal(binding.confirmed, false);
			builtInRegistry().validate(binding);
			assert.equal(normalize(binding, binding.capabilities[0], { val: false, ts: 1 }, 1).value, false);
		}
	});
	it('does not invent controls or units for unknown raw values', () => {
		assert.deepEqual(
			shellyProfile.discover({ 'shelly.0.device.brightness': { type: 'number', unit: 'unknown', write: true } }),
			[],
		);
	});
});
describe('AP-13 optional IKEA backend paths', () => {
	it('keeps Tradfri, Matter and Zigbee profiles distinct and does not require any backend', () => {
		assert.deepEqual(ikeaTradfriProfile.discover({}), []);
		for (const [profile, prefix] of [
			[ikeaTradfriProfile, 'tradfri'],
			[ikeaMatterProfile, 'matter'],
			[ikeaZigbeeProfile, 'zigbee'],
		] as const) {
			const binding = profile.discover({ [`${prefix}.0.synthetic.state`]: { type: 'boolean', write: true } })[0];
			assert.equal(binding.integrationId, profile.id);
			assert.equal(binding.confirmed, false);
			builtInRegistry().validate(binding);
		}
	});
});
describe('AP-12 model-selected Philips Air backend', () => {
	it('maps exposed named levels and rejects unknown status codes and timer writes', () => {
		const binding = philipsAirProfile.discover({
			'philips-air.0.control.fanSpeed': { type: 'string', write: true },
			'philips-air.0.sensor.pm25': { type: 'number', unit: 'µg/m³' },
			'philips-air.0.control.timerCode': { type: 'string', write: true },
		})[0];
		builtInRegistry().validate(binding);
		const fan = binding.capabilities.find(c => c.capability === 'fan')!;
		assert.equal(normalize(binding, fan, { val: 'turbo', ts: 1 }, 1).value, 4);
		assert.equal(normalize(binding, fan, { val: 'unknown-device-code', ts: 1 }, 1).quality, 'invalid');
		assert.ok(!binding.capabilities.some(c => c.writeId?.endsWith('timerCode')));
		assert.ok(!binding.capabilities.some(c => c.capability === 'thermostatSetpoint'));
	});
});
describe('AP-11 Hue normalization', () => {
	it('converts logarithmic light level to lux and excludes unapproved groups', () => {
		const fixtures = {
			'hue.0.synthetic.lightlevel': { type: 'number', unit: '', write: false },
			'hue.0.synthetic.presence': { type: 'boolean', write: false },
			'hue.0.groups.excluded.on': { type: 'boolean', write: true },
		};
		const bindings = hueProfile.discover(fixtures);
		assert.equal(bindings.length, 1);
		assert.equal(bindings[0].capabilities.length, 2);
		const light = bindings[0].capabilities.find(c => c.capability === 'illuminance')!;
		assert.equal(normalize(bindings[0], light, { val: 20001, ts: 1 }, 1).value, 100);
		builtInRegistry().validate(bindings[0]);
	});
});
describe('AP-10 separate Homematic transports', () => {
	it('maps CCU fractional levels and Cloud group temperatures without a private extension', () => {
		const ccu = homematicCcuProfile.discover({
			'hm-rpc.0.synthetic.1.LEVEL': { type: 'number', unit: '', min: 0, max: 1, write: true },
		})[0];
		assert.equal(normalize(ccu, ccu.capabilities[0], { val: 0.5, ts: 10 }, 10).value, 50);
		builtInRegistry().validate(ccu);
		const cloud = homematicCloudProfile.discover({
			'hmip.0.groups.synthetic.setPointTemperature': { type: 'number', unit: '°C', write: true },
			'hmip.0.groups.synthetic.activeProfile': { type: 'string', write: true },
		})[0];
		assert.equal(cloud.capabilities.length, 2);
		assert.equal(cloud.confirmed, false);
		builtInRegistry().validate(cloud);
		assert.ok(!cloud.capabilities.some(c => c.capability === 'nativeDeadline'));
	});
});

describe('Anonymized discovery regressions', () => {
	it('keeps measured temperature and setpoint distinct in either object order and both transports', () => {
		for (const [profile, prefix, actual, setpoint] of [
			[homematicCloudProfile, 'hmip.7.groups.sample', 'actualTemperature', 'setPointTemperature'],
			[homematicCcuProfile, 'hm-rpc.7.sample.1', 'ACTUAL_TEMPERATURE', 'SET_TEMPERATURE'],
		] as const) {
			const entries = [
				[`${prefix}.${setpoint}`, { type: 'number', unit: '°C', write: true, role: 'level.temperature' }],
				[`${prefix}.${actual}`, { type: 'number', unit: '°C', write: false, role: 'value.temperature' }],
			] as const;
			for (const ordered of [entries, [...entries].reverse()]) {
				const binding = profile.discover(Object.fromEntries(ordered))[0];
				const measured = binding.capabilities.find(c => c.capability === 'temperatureSensor')!;
				const target = binding.capabilities.find(c => c.capability === 'thermostatSetpoint')!;
				assert.equal(measured.readId, `${prefix}.${actual}`);
				assert.equal(measured.writeId, undefined);
				assert.equal(target.writeId, `${prefix}.${setpoint}`);
				assert.equal(normalize(binding, measured, { val: 18, ts: 1 }, 1).value, 18);
			}
		}
		assert.deepEqual(
			homematicCloudProfile.discover({
				'hmip.7.sample.fakeTemperature': { type: 'number', unit: '°C' },
				'hmip.7.sample.temperature': { type: 'number', unit: '°C', write: true, role: 'level.temperature' },
			}),
			[],
		);
	});
	it('converts explicit Shelly Wh, gain and separate external temperature probes', () => {
		const objects = {
			'shelly.7.sample.Relay0.Energy': { type: 'number', unit: 'Wh', write: true },
			'shelly.7.sample.lights.gain': { type: 'number', unit: '%', min: 0, max: 100, write: true },
			'shelly.7.sample.ext.temperatureC1': { type: 'number', unit: '°C', role: 'value.temperature' },
			'shelly.7.sample.ext.temperatureC2': { type: 'number', unit: '°C', role: 'value.temperature' },
		};
		const bindings = shellyProfile.discover(objects);
		assert.equal(bindings.length, 4);
		for (const b of bindings) {
			for (const m of b.capabilities) {
				auditMapping(m, objects);
			}
		}
		const energy = bindings.find(b => b.capabilities[0].capability === 'energy')!;
		assert.equal(normalize(energy, energy.capabilities[0], { val: 1250, ts: 1 }, 1).value, 1.25);
		assert.equal(energy.capabilities[0].writeId, undefined);
		assert.equal(bindings.filter(b => b.capabilities[0].capability === 'temperatureSensor').length, 2);
		assert.deepEqual(shellyProfile.discover({ 'shelly.7.sample.Energy': { type: 'number', unit: 'J' } }), []);
	});
	it('does not scale already-percent fractional-backend values twice or accept arbitrary units', () => {
		for (const [profile, path] of [
			[homematicCcuProfile, 'hm-rpc.7.sample.LEVEL'],
			[homematicCloudProfile, 'hmip.7.sample.dimLevel'],
		] as const) {
			const binding = profile.discover({ [path]: { type: 'number', unit: '%', write: true } })[0];
			assert.equal(normalize(binding, binding.capabilities[0], { val: 50, ts: 1 }, 1).value, 50);
			assert.deepEqual(profile.discover({ [path]: { type: 'number', unit: 'V', write: true } }), []);
		}
	});
	it('excludes Hue root-level aggregates and sensor enable controls using resource semantics', () => {
		const objects = {
			'hue.7.arbitrary_group.on': { type: 'boolean', write: true },
			'hue.7.arbitrary_zone.level': { type: 'number', unit: '%' },
			'hue.7.arbitrary_sensor.on': { type: 'boolean', write: true },
			'hue.7.arbitrary_sensor.presence': { type: 'boolean' },
			'hue.7.arbitrary_lamp.on': { type: 'boolean', write: true },
		};
		const context = {
			resources: {
				'hue.7.arbitrary_group': { type: 'Room', id: '81' },
				'hue.7.arbitrary_zone': { role: 'Zone', id: '82' },
				'hue.7.arbitrary_sensor': { type: 'ZLLPresence', id: '83' },
				'hue.7.arbitrary_lamp': { type: 'Color temperature light', id: '84' },
			},
		};
		const mappings = hueProfile.discover(objects, context).flatMap(b => b.capabilities);
		assert.deepEqual(mappings.map(m => m.readId).sort(), [
			'hue.7.arbitrary_lamp.on',
			'hue.7.arbitrary_sensor.presence',
		]);
		assert.deepEqual(hueProfile.discover({ 'hue.7.unknown.on': { type: 'boolean', write: true } }), []);
	});
	it('quarantines duplicate Hue actuator aliases without confusing light and sensor numeric IDs', () => {
		const objects = {
			'hue.7.alias_a.on': { type: 'boolean', write: true },
			'hue.7.alias_b.on': { type: 'boolean', write: true },
			'hue.7.motion.presence': { type: 'boolean' },
		};
		const context = {
			resources: {
				'hue.7.alias_a': { type: 'Dimmable light', id: '91' },
				'hue.7.alias_b': { type: 'Dimmable light', id: '91' },
				'hue.7.motion': { type: 'ZLLPresence', id: '91' },
			},
		};
		assert.deepEqual(
			hueProfile
				.discover(objects, context)
				.flatMap(b => b.capabilities)
				.map(m => m.capability),
			['motion'],
		);
		delete (context.resources as Record<string, unknown>)['hue.7.alias_b'];
		delete (objects as Record<string, unknown>)['hue.7.alias_b.on'];
		const bindings = hueProfile.discover(objects, context);
		assert.equal(bindings.length, 2);
		assert.notEqual(bindings[0].physicalId, bindings[1].physicalId);
		assert.ok(bindings.every(b => !b.confirmed));
	});
	it('normalizes Hue unitless documented percent levels and raw bri with exact source units', () => {
		for (const [leaf, meta, raw] of [
			['level', { type: 'number', role: 'level.dimmer', min: 0, max: 100 }, 50],
			['bri', { type: 'number', min: 0, max: 254 }, 127],
		] as const) {
			const objects = { [`hue.7.sample.${leaf}`]: { ...meta, write: true } };
			const binding = hueProfile.discover(objects, {
				resources: { 'hue.7.sample': { type: 'Dimmable light', id: '92' } },
			})[0];
			auditMapping(binding.capabilities[0], objects);
			assert.equal(normalize(binding, binding.capabilities[0], { val: raw, ts: 1 }, 1).value, 50);
		}
		assert.deepEqual(hueProfile.discover({ 'hue.7.sample.level': { type: 'number' } }), []);
	});
	it('exposes legacy Air percent feedback and power only as reads, leaving unknown mode codes unmapped', () => {
		const binding = philipsAirProfile.discover({
			'philips-air.7.control.cxPower': { type: 'boolean', write: true },
			'philips-air.7.status.cxFanPercent': { type: 'number', unit: '%', write: true },
			'philips-air.7.control.cxFanMode': { type: 'string', write: true, states: { arbitrary: 'arbitrary' } },
			'philips-air.7.status.cxTimerCode': { type: 'number', write: true },
		})[0];
		assert.equal(binding.capabilities.length, 2);
		assert.ok(binding.capabilities.every(m => !m.writeId && !m.confirmId));
		const fan = binding.capabilities.find(m => m.capability === 'fan')!;
		assert.equal(normalize(binding, fan, { val: 40, ts: 1 }, 1).value, 40);
		assert.equal(normalize(binding, fan, { val: 40, ts: 1 }, 900000).quality, 'stale');
		assert.equal(normalize(binding, fan, { val: null, ts: 1 }, 1).quality, 'unknown');
		assert.equal(normalize(binding, fan, { val: 40, ts: 1, q: 32 }, 1).quality, 'invalid');
	});
});
