import type { DiscoveryContext, StateMetadata, IntegrationRegistry } from '../integrations/registry';
import type { DeviceBinding } from '../model/contracts';

export interface SetupInstance {
	instance: string;
	enabled: boolean;
	version: string;
	profiles: { id: string; name: string; readOnly: boolean }[];
}
/** Only non-secret instance metadata is returned to the setup forms. */
export function setupCatalog(
	rows: { id: string; value?: any; doc?: any }[],
	registry: IntegrationRegistry,
): SetupInstance[] {
	const backends = new Set(registry.list().flatMap(p => p.backends));
	return rows
		.flatMap(row => {
			const instance = row.id.replace(/^system\.adapter\./, '');
			if (!/^[a-zA-Z0-9_-]+\.\d+$/.test(instance)) {
				return [];
			}
			const adapter = instance.slice(0, instance.lastIndexOf('.'));
			if (!backends.has(adapter) && adapter !== 'sql') {
				return [];
			}
			const common = (row.doc ?? row.value)?.common ?? {};
			return [
				{
					instance,
					enabled: common.enabled === true,
					version: String(common.version ?? ''),
					profiles: registry
						.list()
						.filter(p => p.backends.includes(adapter))
						.map(p => ({ id: p.id, name: p.name, readOnly: p.readOnly === true })),
				},
			];
		})
		.sort((a, b) => a.instance.localeCompare(b.instance));
}

export function discoveryBackends(registry: IntegrationRegistry, instance?: unknown): string[] {
	const backends = [...new Set(registry.list().flatMap(p => p.backends))];
	if (instance === undefined) {
		return backends;
	}
	if (
		typeof instance !== 'string' ||
		!/^[a-zA-Z0-9_-]+\.\d+$/.test(instance) ||
		!backends.includes(instance.slice(0, instance.lastIndexOf('.')))
	) {
		throw Error('setup_instance_invalid');
	}
	return [instance];
}

export function setupNames(
	bindings: DeviceBinding[],
	objects: Record<string, StateMetadata>,
	context: DiscoveryContext,
	language: unknown,
): DeviceBinding[] {
	return bindings.map(binding => {
		const path = binding.capabilities[0]?.readId ?? '';
		let parent = path.slice(0, path.lastIndexOf('.')),
			name: unknown;
		while (parent.includes('.') && !name) {
			name = context.resources[parent]?.name;
			parent = parent.slice(0, parent.lastIndexOf('.'));
		}
		name ||= objects[path]?.name;
		if (name && typeof name === 'object') {
			const translated = name as Record<string, unknown>;
			name =
				translated[language === 'de' ? 'de' : 'en'] ??
				translated.en ??
				translated.de ??
				Object.values(translated).find(v => typeof v === 'string');
		}
		return typeof name === 'string' && name.trim() ? { ...binding, name: name.trim().slice(0, 128) } : binding;
	});
}
