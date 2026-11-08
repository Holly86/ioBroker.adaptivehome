import type { Condition, Observation } from '../model/contracts';
export function conditionMatches(condition: Condition, inputs: Record<string, Observation | null>): boolean | null {
	const observation = inputs[condition.input];
	if (!observation || observation.quality !== 'valid' || observation.value === null) {
		return null;
	}
	const a = observation.value,
		b = condition.value;
	if (typeof a !== typeof b) {
		return null;
	}
	switch (condition.op) {
		case 'eq':
			return a === b;
		case 'ne':
			return a !== b;
		case 'gt':
			return typeof a === 'number' && typeof b === 'number' ? a > b : null;
		case 'gte':
			return typeof a === 'number' && typeof b === 'number' ? a >= b : null;
		case 'lt':
			return typeof a === 'number' && typeof b === 'number' ? a < b : null;
		case 'lte':
			return typeof a === 'number' && typeof b === 'number' ? a <= b : null;
	}
}
