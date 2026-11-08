import type { Configuration } from '../model/contracts';
import { functionSchema, bindingSchema } from '../model/contracts';
import { emptyConfiguration, validateConfiguration } from './configuration';
export function referenceConfiguration(name: 'apartment' | 'aquarium' | 'air'): Configuration {
	const config = emptyConfiguration('UTC');
	config.actor = 'synthetic-example';
	config.createdAt = 0;
	const add = (
		entity: string,
		capabilities: {
			name: string;
			type: string;
			unit?: string;
			write?: boolean;
			min?: number;
			max?: number;
		}[],
	): void => {
		config.bindings.push(
			bindingSchema.parse({
				id: entity,
				physicalId: `synthetic-${entity}`,
				integrationId: 'generic',
				family: 'synthetic',
				backendVersion: '1',
				confirmed: true,
				capabilities: capabilities.map(c => ({
					capability: c.name,
					valueType: c.type,
					unit: c.unit ?? '',
					readId: `test.0.${entity}.${c.name}`,
					...(c.write
						? { writeId: `test.0.${entity}.${c.name}`, confirmId: `test.0.${entity}.${c.name}` }
						: {}),
					min: c.min,
					max: c.max,
					confirmation: 'backend',
					maxAgeMs: c.name === 'motion' ? 900000 : 300000,
				})),
			}),
		);
	};
	config.groups.push({
		id: 'area',
		name: name === 'aquarium' ? 'Aquarium' : name === 'air' ? 'Air quality area' : 'Living area',
		kind: name === 'aquarium' ? 'installation' : 'room',
	});
	if (name !== 'air') {
		add('light', [{ name: 'switch', type: 'boolean', write: true }]);
		add('motion', [
			{ name: 'motion', type: 'boolean' },
			{ name: 'illuminance', type: 'number', unit: 'lx' },
		]);
		config.functions.push(
			functionSchema.parse({
				id: 'light',
				name: 'Daylight',
				groupId: 'area',
				kind: 'lighting',
				actuator: { entityId: 'light', capability: 'switch' },
				operatingMode: name === 'apartment' ? 'demand' : 'automatic',
				inputs: {
					motion: { entityId: 'motion', capability: 'motion' },
					lux: { entityId: 'motion', capability: 'illuminance' },
				},
				parameters: { holdMs: 300000, luxThreshold: 100 },
				rules:
					name === 'aquarium'
						? [
								{
									id: 'day',
									block: 'schedule',
									windows: [{ days: [0, 1, 2, 3, 4, 5, 6], start: '08:00', end: '20:00' }],
									value: true,
								},
								{ id: 'night', block: 'minimum', value: false, priority: 1 },
							]
						: [],
			}),
		);
	}
	if (name === 'aquarium') {
		add('circulation', [{ name: 'switch', type: 'boolean', write: true }]);
		config.functions.push(
			functionSchema.parse({
				id: 'circulation',
				name: 'Continuous circulation',
				groupId: 'area',
				kind: 'equipment',
				operatingMode: 'continuous',
				actuator: { entityId: 'circulation', capability: 'switch' },
				limits: { essential: true, minimumValue: true },
			}),
		);
	} else if (name === 'apartment') {
		add('thermostat', [
			{ name: 'thermostatSetpoint', type: 'number', unit: '°C', write: true, min: 5, max: 30 },
			{ name: 'temperatureSensor', type: 'number', unit: '°C' },
		]);
		config.functions.push(
			functionSchema.parse({
				id: 'climate',
				name: 'Room climate',
				groupId: 'area',
				kind: 'climate',
				actuator: { entityId: 'thermostat', capability: 'thermostatSetpoint' },
				inputs: { temperature: { entityId: 'thermostat', capability: 'temperatureSensor' } },
				parameters: { target: 21, setback: 18 },
				limits: { min: 16, max: 24, minimumValue: 18 },
			}),
		);
	} else {
		add('purifier', [
			{ name: 'fan', type: 'number', unit: '%', write: true, min: 0, max: 100 },
			{ name: 'airQuality', type: 'number', unit: 'µg/m³' },
		]);
		config.functions.push(
			functionSchema.parse({
				id: 'air',
				name: 'Clean air',
				groupId: 'area',
				kind: 'air',
				operatingMode: 'demand',
				actuator: { entityId: 'purifier', capability: 'fan' },
				inputs: { airQuality: { entityId: 'purifier', capability: 'airQuality' } },
				parameters: { threshold: 25, high: 75, low: 25, hysteresis: 5 },
				limits: { min: 0, max: 100 },
			}),
		);
	}
	return validateConfiguration(config);
}
