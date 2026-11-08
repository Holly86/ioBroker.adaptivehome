import type { Configuration, Intent } from '../model/contracts';
export interface Arbitration {
	accepted: Intent[];
	rejected: {
		intent: Intent;
		reason: string;
	}[];
}
export function arbitrate(intents: Intent[], config: Configuration): Arbitration {
	const result: Arbitration = { accepted: [], rejected: [] },
		owners = new Set<string>();
	const ranked = [...intents].sort((a, b) => b.priority - a.priority || a.intentId.localeCompare(b.intentId));
	for (const intent of ranked) {
		const binding = config.bindings.find(b => b.id === intent.entityId),
			key = binding?.physicalId;
		if (!key || owners.has(key)) {
			result.rejected.push({ intent, reason: key ? 'lower_priority' : 'unknown_device' });
		} else {
			owners.add(key);
			result.accepted.push(intent);
		}
	}
	return result;
}
