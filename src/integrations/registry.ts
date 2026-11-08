import { CapabilityMapping, DeviceBinding, Observation, Scalar } from '../model/contracts';
export interface StateValue { val: unknown; ts: number; lc?: number; ack?: boolean; q?: number; from?: string }
export interface StateMetadata { type: string; unit?: string; read?: boolean; write?: boolean; min?: number; max?: number; role?: string; states?: Record<string,string> }
export interface IntegrationManifest {
    apiVersion: 1; id: string; name: string; backends: string[]; capabilities: string[];
    discover(objects: Record<string, StateMetadata>): DeviceBinding[];
}
const units: Record<string, string[]> = {
    switch: [''], dimmer: ['%'], color: [''], temperatureSensor: ['°C'], thermostatSetpoint: ['°C'],
    windowContact: [''], motion: [''], illuminance: ['lx'], power: ['W'], energy: ['kWh'], fan: ['%', ''], airQuality: ['µg/m³', 'ppm', ''],
};
export class IntegrationRegistry {
    private integrations = new Map<string, IntegrationManifest>();
    register(manifest: IntegrationManifest): void {
        if (manifest.apiVersion !== 1 || this.integrations.has(manifest.id)) throw new Error('integration_contract');
        this.integrations.set(manifest.id, manifest);
    }
    list(): IntegrationManifest[] { return [...this.integrations.values()]; }
    validate(binding: DeviceBinding): void {
        const manifest = this.integrations.get(binding.integrationId);
        if (!manifest) throw new Error('unknown_integration');
        const seen = new Set<string>();
        for (const mapping of binding.capabilities) {
            for(const path of [mapping.readId,mapping.writeId,mapping.confirmId].filter((v):v is string => !!v)) {
                if(binding.integrationId !== 'generic' && !manifest.backends.some(backend => path.startsWith(backend + '.')))throw new Error('backend_scope');
                if(mapping.writeId === path && /^(system\.|adaptivehome\.)/.test(path))throw new Error('protected_state');
            }
            if (seen.has(mapping.capability) || !manifest.capabilities.includes(mapping.capability)) throw new Error('unsupported_capability');
            seen.add(mapping.capability);
            if (units[mapping.capability] && !units[mapping.capability].includes(mapping.unit)) throw new Error('unit_mismatch');
            if (mapping.writeId && (!mapping.confirmId || mapping.confirmation === 'none')) throw new Error('unconfirmable_write');
            if (mapping.min !== undefined && mapping.max !== undefined && mapping.min > mapping.max) throw new Error('invalid_range');
        }
    }
}
export function normalize(binding: DeviceBinding, mapping: CapabilityMapping, raw: StateValue | null, now: number): Observation {
    const result: Observation = {entityId: binding.id, capability: mapping.capability, value: null, unit: mapping.unit,
        measuredAt: raw?.ts ?? now, receivedAt: now, lastChange: raw?.lc, sourceId: mapping.readId, quality: 'unavailable'};
    if (!raw) return result;
    if (raw.q && raw.q !== 0) { result.quality = 'invalid'; return result; }
    if (raw.val === null || raw.val === undefined) { result.quality = 'unknown'; return result; }
    if (typeof raw.val !== (mapping.sourceType ?? mapping.valueType) || (typeof raw.val === 'number' && !Number.isFinite(raw.val))) { result.quality = 'invalid'; return result; }
    const decoded = mapping.valueMap ? mapping.valueMap[String(raw.val)] : raw.val;
    if(decoded === undefined || typeof decoded !== mapping.valueType){result.quality = 'invalid';return result;}
    const value = typeof decoded === 'number' ? decoded * mapping.scale + mapping.offset : decoded as Scalar;
    if (typeof value === 'number' && ((mapping.min !== undefined && value < mapping.min) || (mapping.max !== undefined && value > mapping.max))) {
        result.quality = 'invalid'; return result;
    }
    if (mapping.values && !mapping.values.includes(value)) { result.quality = 'invalid'; return result; }
    result.value = value;
    result.quality = raw.ts > now ? 'unknown' : now - raw.ts > mapping.maxAgeMs ? 'stale' : 'valid';
    return result;
}
export function auditMapping(mapping: CapabilityMapping, metadata: Record<string, StateMetadata>): void {
    for (const point of [mapping.readId, mapping.writeId, mapping.confirmId].filter((v): v is string => !!v)) {
        const meta = metadata[point];
        if (!meta || meta.type !== (mapping.sourceType ?? mapping.valueType)) throw new Error('state_type_or_missing');
        if (point === mapping.writeId && !meta.write) throw new Error('state_readonly');
        if (point !== mapping.writeId && meta.read === false) throw new Error('state_unreadable');
        if ((meta.unit ?? '') !== (mapping.sourceUnit ?? mapping.unit)) throw new Error('source_unit_mismatch');
    }
}
