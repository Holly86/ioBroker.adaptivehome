export const LEARNING_MODES = ['classic', 'observe', 'suggest', 'bounded', 'full'] as const;
export type LearningMode = (typeof LEARNING_MODES)[number];
export const FUNCTION_KINDS = ['lighting', 'climate', 'air', 'equipment'] as const;
export type FunctionKind = (typeof FUNCTION_KINDS)[number];
export const OPERATING_MODES = ['automatic', 'demand', 'continuous', 'maintenance'] as const;
export type OperatingMode = (typeof OPERATING_MODES)[number];

export interface Group {
	id: string;
	name: string;
	kind: 'room' | 'installation';
}
export interface FunctionRequirement {
	kind: FunctionKind;
	required: string[];
	optional: string[];
	scenarios: string[];
}
export const CATALOG: FunctionRequirement[] = [
	{
		kind: 'lighting',
		required: ['switch'],
		optional: ['dimmer', 'color', 'motion', 'illuminance'],
		scenarios: ['S02', 'S10', 'S11', 'S12', 'S13', 'S14'],
	},
	{
		kind: 'climate',
		required: ['thermostatSetpoint'],
		optional: ['temperatureSensor', 'windowContact', 'nativeSchedule', 'nativeDeadline'],
		scenarios: ['S04', 'S16', 'S17', 'S20'],
	},
	{ kind: 'air', required: ['fan'], optional: ['airQuality', 'power', 'filterLife'], scenarios: ['S04', 'S18'] },
	{ kind: 'equipment', required: ['switch'], optional: ['power', 'energy', 'flow'], scenarios: ['S03', 'S28'] },
];

/** Semantic purpose is selected by the operator, never inferred from a relay's brand. */
export const REFERENCE_CASES = [
	{
		id: 'apartment',
		groups: [{ id: 'living', name: 'Living area', kind: 'room' }],
		functions: ['lighting', 'climate'],
		scenarios: ['S02', 'S04', 'S05', 'S11'],
	},
	{
		id: 'aquarium',
		groups: [{ id: 'habitat', name: 'Aquarium', kind: 'installation' }],
		functions: ['equipment', 'lighting'],
		scenarios: ['S03', 'S28'],
	},
	{
		id: 'air',
		groups: [{ id: 'studio', name: 'Air quality area', kind: 'room' }],
		functions: ['air'],
		scenarios: ['S04', 'S18'],
	},
] as const;
