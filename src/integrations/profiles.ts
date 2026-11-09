import { createHash } from 'node:crypto';
import type { CapabilityMapping, DeviceBinding } from '../model/contracts';
import { bindingSchema, mappingSchema } from '../model/contracts';
import type { DiscoveryContext, IntegrationManifest, ResourceMetadata, StateMetadata } from './registry';
import { IntegrationRegistry } from './registry';
export interface DetectionRule {
	capability: string;
	suffix: RegExp;
	type: 'boolean' | 'number' | 'string';
	unit?: string;
	sourceUnit?: string;
	accept?: (metadata: StateMetadata) => boolean;
	readOnly?: boolean;
	scale?: number;
	valueMap?: Record<string, boolean | number | string>;
	normalizedType?: 'boolean' | 'number' | 'string';
	codec?: 'identity' | 'hueLightLevel';
}
export const standardRules: DetectionRule[] = [
	{
		capability: 'motion',
		suffix: /\.(?:motion|presence|PRESENCE_DETECTION_STATE)$/i,
		type: 'boolean',
		readOnly: true,
	},
	{
		capability: 'illuminance',
		suffix: /\.(?:illuminance|lux|ILLUMINATION)$/i,
		type: 'number',
		unit: 'lx',
		readOnly: true,
	},
	{
		capability: 'temperatureSensor',
		suffix: /\.(?:temperature|actualTemperature|ACTUAL_TEMPERATURE)$/i,
		type: 'number',
		unit: '°C',
		readOnly: true,
		accept: meta => !meta.write || meta.role === 'value.temperature',
	},
	{
		capability: 'thermostatSetpoint',
		suffix: /\.(?:setPointTemperature|SET_POINT_TEMPERATURE|SET_TEMPERATURE)$/i,
		type: 'number',
		unit: '°C',
	},
	{ capability: 'windowContact', suffix: /\.(?:windowOpen|WINDOW_OPEN|contact)$/i, type: 'boolean', readOnly: true },
	{ capability: 'online', suffix: /\.(?:reachable|online|connected)$/i, type: 'boolean', readOnly: true },
	{ capability: 'battery', suffix: /\.(?:lowBat|LOWBAT|LOW_BAT)$/i, type: 'boolean', readOnly: true },
	{ capability: 'power', suffix: /\.(?:power|act_power)$/i, type: 'number', unit: 'W', readOnly: true },
	{ capability: 'energy', suffix: /\.(?:energy|total)$/i, type: 'number', unit: 'kWh', readOnly: true },
];
export function createProfile(
	id: string,
	name: string,
	backends: string[],
	rules: DetectionRule[],
	channelOf = (path: string): string => path.slice(0, path.lastIndexOf('.')),
): IntegrationManifest {
	return {
		apiVersion: 1,
		id,
		name,
		backends,
		capabilities: [...new Set(rules.map(r => r.capability))],
		discover(objects) {
			const channels = new Map<string, CapabilityMapping[]>();
			for (const [path, meta] of Object.entries(objects)) {
				if (!backends.some(b => path.startsWith(`${b}.`)) || meta.read === false) {
					continue;
				}
				// Aggregate Hue groups/scenes require explicit member authorization through manual mapping.
				if (id === 'hue' && /\.(groups|scenes)\./i.test(path)) {
					continue;
				}
				const rule = rules.find(
					r =>
						r.suffix.test(path) &&
						meta.type === r.type &&
						(!r.accept || r.accept(meta)) &&
						(meta.unit ?? '') === (r.sourceUnit ?? r.unit ?? meta.unit ?? ''),
				);
				if (!rule) {
					continue;
				}
				const unit = rule.unit ?? meta.unit ?? '';
				const valueMap =
					rule.valueMap && meta.states
						? Object.fromEntries(
								Object.entries(rule.valueMap).filter(([key]) => Object.hasOwn(meta.states!, key)),
							)
						: rule.valueMap;
				const writable = meta.write && !rule.readOnly && (!rule.valueMap || !!meta.states);
				const mapping = mappingSchema.parse({
					capability: rule.capability,
					readId: path,
					valueType: rule.normalizedType ?? rule.type,
					sourceType: rule.type,
					unit,
					sourceUnit: meta.unit ?? '',
					scale: rule.scale ?? 1,
					valueMap,
					codec: rule.codec,
					...(writable ? { writeId: path, confirmId: path } : {}),
					min: rule.scale ? (meta.min === undefined ? undefined : meta.min * rule.scale) : meta.min,
					max: rule.scale ? (meta.max === undefined ? undefined : meta.max * rule.scale) : meta.max,
					values: valueMap ? [...new Set(Object.values(valueMap))] : undefined,
					confirmation: 'backend',
					maxAgeMs: rule.capability === 'motion' ? 900000 : 300000,
				});
				const channel = channelOf(path);
				const list = channels.get(channel) || [];
				if (!list.some(c => c.capability === mapping.capability)) {
					list.push(mapping);
				}
				channels.set(channel, list);
			}
			return [...channels].map(([channel, capabilities]) =>
				bindingSchema.parse({
					id: `${id}_${createHash('sha256').update(channel).digest('hex').slice(0, 12)}`,
					physicalId: `confirm:${channel}`,
					integrationId: id,
					family: name,
					backendVersion: 'unverified',
					confirmed: false,
					capabilities,
					verification: 'contract',
				}),
			);
		},
	};
}
export const shellyProfile = createProfile(
	'shelly',
	'Shelly via existing adapter',
	['shelly'],
	[
		{ capability: 'switch', suffix: /\.(?:Switch|state|on|output)$/i, type: 'boolean' },
		{ capability: 'dimmer', suffix: /\.(?:brightness|dim|gain)$/i, type: 'number', unit: '%' },
		{
			capability: 'energy',
			suffix: /\.(?:energy|total)$/i,
			type: 'number',
			unit: 'kWh',
			sourceUnit: 'Wh',
			scale: 0.001,
			readOnly: true,
		},
		{
			capability: 'temperatureSensor',
			suffix: /\.temperatureC\d*$/i,
			type: 'number',
			unit: '°C',
			readOnly: true,
			accept: meta => meta.role === 'value.temperature',
		},
		{ capability: 'color', suffix: /(?:rgb|color)$/i, type: 'string' },
		...(['red', 'green', 'blue', 'white'] as const).map(capability => ({
			capability,
			suffix: new RegExp(`\\.${capability}$`, 'i'),
			type: 'number' as const,
			unit: '',
			accept: (meta: StateMetadata) => meta.min === 0 && meta.max === 255,
		})),
		{ capability: 'manualEvent', suffix: /\.input$/i, type: 'boolean', readOnly: true },
		...standardRules,
	],
	path => (/\.temperatureC\d+$/i.test(path) ? path : path.slice(0, path.lastIndexOf('.'))),
);
export const homematicCcuProfile = createProfile(
	'homematic-ccu',
	'Homematic CCU',
	['hm-rpc'],
	[
		{ capability: 'switch', suffix: /\.STATE$/i, type: 'boolean' },
		{ capability: 'dimmer', suffix: /\.LEVEL$/i, type: 'number', unit: '%', sourceUnit: '', scale: 100 },
		{ capability: 'dimmer', suffix: /\.LEVEL$/i, type: 'number', unit: '%' },
		{ capability: 'windowContact', suffix: /\.(?:STATE|WINDOW_STATE)$/i, type: 'boolean', readOnly: true },
		...standardRules,
	],
);
export const homematicCloudProfile = createProfile(
	'homematic-cloud',
	'Homematic IP Cloud',
	['hmip'],
	[
		{ capability: 'switch', suffix: /\.(?:on|state)$/i, type: 'boolean' },
		{ capability: 'dimmer', suffix: /\.dimLevel$/i, type: 'number', unit: '%', sourceUnit: '', scale: 100 },
		{ capability: 'dimmer', suffix: /\.dimLevel$/i, type: 'number', unit: '%' },
		{ capability: 'nativeProfile', suffix: /\.activeProfile$/i, type: 'string' },
		{ capability: 'windowContact', suffix: /\.windowOpen$/i, type: 'boolean', readOnly: true },
		...standardRules,
	],
);
const hueBaseProfile = createProfile(
	'hue',
	'Philips Hue bridge',
	['hue'],
	[
		{ capability: 'switch', suffix: /\.on$/i, type: 'boolean' },
		{ capability: 'dimmer', suffix: /\.level$/i, type: 'number', unit: '%' },
		{
			capability: 'dimmer',
			suffix: /\.level$/i,
			type: 'number',
			unit: '%',
			sourceUnit: '',
			accept: meta => meta.role === 'level.dimmer' && meta.min === 0 && meta.max === 100,
		},
		{ capability: 'dimmer', suffix: /\.bri$/i, type: 'number', unit: '%', sourceUnit: '', scale: 100 / 254 },
		{ capability: 'color', suffix: /\.(?:hex|rgb)$/i, type: 'string' },
		{ capability: 'manualEvent', suffix: /\.buttonevent$/i, type: 'number', readOnly: true },
		{
			capability: 'illuminance',
			suffix: /\.lightlevel$/i,
			type: 'number',
			unit: 'lx',
			sourceUnit: '',
			codec: 'hueLightLevel',
			readOnly: true,
		},
		...standardRules,
	],
);
function hueKind(resource: ResourceMetadata | undefined): 'aggregate' | 'sensor' | 'light' | 'unknown' {
	const type = `${resource?.type ?? ''} ${resource?.role ?? ''}`;
	if (/LightGroup|Room|Zone|Entertainment|Scene|group|scene/i.test(type)) {
		return 'aggregate';
	}
	if (/\blight\b|plug/i.test(type) && !/LightLevel/i.test(type)) {
		return 'light';
	}
	if (/Presence|LightLevel|Temperature|sensor|ZLL|ZGP/i.test(type) || resource?.type === 'Switch') {
		return 'sensor';
	}
	if (resource?.role === 'switch' && !resource.type) {
		return 'light';
	}
	return 'unknown';
}
export const hueProfile: IntegrationManifest = {
	...hueBaseProfile,
	discover(objects, context) {
		const resources = context?.resources ?? {};
		const identity = (channel: string): string | undefined => {
			const resource = resources[channel],
				kind = hueKind(resource);
			return resource?.id && ['light', 'sensor'].includes(kind)
				? `${channel.split('.').slice(0, 2).join('.')}:${kind}:${resource.id}`
				: undefined;
		};
		const aliases = new Map<string, Set<string>>();
		for (const channel of Object.keys(resources)) {
			const key = identity(channel);
			if (key) {
				aliases.set(key, (aliases.get(key) ?? new Set()).add(channel));
			}
		}
		const safe = Object.fromEntries(
			Object.entries(objects).filter(([path, meta]) => {
				if (!path.startsWith('hue.')) {
					return false;
				}
				const channel = path.slice(0, path.lastIndexOf('.')),
					resource = resources[channel];
				for (
					let parent = channel;
					parent.startsWith('hue.');
					parent = parent.slice(0, parent.lastIndexOf('.'))
				) {
					if (hueKind(resources[parent]) === 'aggregate') {
						return false;
					}
				}
				if (!/\.(?:on|level|bri|hex|rgb)$/i.test(path)) {
					return true;
				}
				const key = identity(channel);
				if (key && (aliases.get(key)?.size ?? 0) > 1) {
					return false;
				}
				return (
					hueKind(resource) === 'light' || (!resource && meta.role === 'switch.light' && /\.on$/i.test(path))
				);
			}),
		);
		return hueBaseProfile.discover(safe).map(binding => {
			const channel = binding.capabilities[0].readId.slice(0, binding.capabilities[0].readId.lastIndexOf('.'));
			const key = identity(channel);
			return key ? { ...binding, physicalId: `confirm:${key}` } : binding;
		});
	},
};
export const philipsAirProfile = createProfile(
	'philips-air',
	'Philips Air model-selected backend',
	['philips-air'],
	[
		// Legacy cx paths have no verified model-specific command codec: telemetry only.
		{ capability: 'switch', suffix: /\.control\.cxPower$/i, type: 'boolean', readOnly: true },
		{ capability: 'fan', suffix: /\.status\.cxFanPercent$/i, type: 'number', unit: '%', readOnly: true },
		{ capability: 'switch', suffix: /\.control\.power$/i, type: 'boolean' },
		// Values are ordinal operating levels, not percentages or universal raw Philips codes.
		{
			capability: 'fan',
			suffix: /\.control\.fanSpeed$/i,
			type: 'string',
			normalizedType: 'number',
			unit: '',
			valueMap: { silent: 0, 1: 1, 2: 2, 3: 3, turbo: 4, auto: 5, allergenSleep: 6 },
		},
		{
			capability: 'fan',
			suffix: /\.control\.mode$/i,
			type: 'string',
			normalizedType: 'number',
			unit: '',
			valueMap: {
				off: 0,
				speed1: 1,
				speed2: 2,
				speed3: 3,
				speed4: 4,
				speed5: 5,
				sleep: 6,
				turbo: 7,
				medium: 8,
				auto: 9,
			},
		},
		{ capability: 'airQuality', suffix: /\.pm25$/i, type: 'number', unit: 'µg/m³', readOnly: true },
		{
			capability: 'filterLife',
			suffix: /\.(?:hepaFilterReplaceInHours|preFilterCleanInHours)$/i,
			type: 'number',
			unit: 'hours',
			readOnly: true,
		},
		...standardRules.filter(rule => !['power', 'thermostatSetpoint'].includes(rule.capability)),
	],
	path => path.split('.').slice(0, 2).join('.'),
);
export const ikeaTradfriProfile = createProfile(
	'ikea-tradfri',
	'IKEA Tradfri gateway',
	['tradfri'],
	[
		{ capability: 'switch', suffix: /\.(?:on|state)$/i, type: 'boolean' },
		{ capability: 'dimmer', suffix: /\.brightness$/i, type: 'number', unit: '%' },
		...standardRules,
	],
);
export const ikeaMatterProfile = createProfile(
	'ikea-matter',
	'Explicit IKEA over Matter',
	['matter'],
	[
		{ capability: 'switch', suffix: /\.(?:on|power|state)$/i, type: 'boolean' },
		{ capability: 'dimmer', suffix: /\.(?:level|brightness)$/i, type: 'number', unit: '%' },
		...standardRules,
	],
);
export const ikeaZigbeeProfile = createProfile(
	'ikea-zigbee',
	'Explicit IKEA over Zigbee',
	['zigbee'],
	[
		{ capability: 'switch', suffix: /\.(?:state|on)$/i, type: 'boolean' },
		{ capability: 'dimmer', suffix: /\.brightness$/i, type: 'number', unit: '%' },
		...standardRules,
	],
);
export const genericProfile: IntegrationManifest = {
	apiVersion: 1,
	id: 'generic',
	name: 'Explicit state mapping',
	backends: [],
	capabilities: [
		'switch',
		'dimmer',
		'color',
		'temperatureSensor',
		'thermostatSetpoint',
		'windowContact',
		'motion',
		'illuminance',
		'power',
		'energy',
		'fan',
		'airQuality',
		'flow',
		'filterLife',
		'online',
		'battery',
		'nativeProfile',
		'manualEvent',
		'red',
		'green',
		'blue',
		'white',
		'humidity',
		'valve',
		'context',
	],
	discover: () => [],
};
export function builtInRegistry(): IntegrationRegistry {
	const registry = new IntegrationRegistry();
	for (const profile of [
		genericProfile,
		shellyProfile,
		homematicCcuProfile,
		homematicCloudProfile,
		hueProfile,
		philipsAirProfile,
		ikeaTradfriProfile,
		ikeaMatterProfile,
		ikeaZigbeeProfile,
	]) {
		registry.register(profile);
	}
	return registry;
}
export function discoverProfiles(
	objects: Record<string, StateMetadata>,
	registry = builtInRegistry(),
	context?: DiscoveryContext,
): DeviceBinding[] {
	return registry.list().flatMap(profile => profile.discover(objects, context));
}
