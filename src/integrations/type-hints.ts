import { ChannelDetector } from '@iobroker/type-detector';
import type { DeviceBinding } from '../model/contracts';
import type { StateMetadata } from './registry';
/** Device types are advisory only; explicit identity/permissions and capabilities remain authoritative. */
export function addTypeHints(bindings: DeviceBinding[], metadata: Record<string, StateMetadata>): DeviceBinding[] {
	const objects: Record<string, ioBroker.Object> = {};
	for (const [id, common] of Object.entries(metadata)) {
		objects[id] = { _id: id, type: 'state', common: { name: id, ...common }, native: {} } as ioBroker.StateObject;
		const parent = id.slice(0, id.lastIndexOf('.'));
		objects[parent] ??= { _id: parent, type: 'channel', common: { name: parent }, native: {} };
	}
	const detector = new ChannelDetector(),
		keys = Object.keys(objects),
		used: string[] = [];
	return bindings.map((binding, index) => {
		const types = new Set<string>();
		if (index < 64) {
			for (const mapping of binding.capabilities) {
				for (const control of detector.detect({
					objects,
					id: mapping.readId,
					_keysOptional: keys,
					_usedIdsOptional: used,
				}) || []) {
					types.add(control.type);
				}
			}
		}
		return { ...binding, detectedTypes: [...types] };
	});
}
