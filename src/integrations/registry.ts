import type { CapabilityMapping, DeviceBinding, Observation, Scalar } from '../model/contracts';
import { parseNativeHeatingReport } from './native-program';
export interface StateValue {
	val: unknown;
	ts: number;
	lc?: number;
	ack?: boolean;
	q?: number;
	from?: string;
}
export interface StateMetadata {
	type: string;
	unit?: string;
	read?: boolean;
	write?: boolean;
	min?: number;
	max?: number;
	role?: string;
	states?: Record<string, string>;
}
/** Optional, non-secret parent metadata for resource-aware discovery (API v1 additive). */
export interface ResourceMetadata {
	role?: string;
	type?: string;
	id?: string;
}
export interface DiscoveryContext {
	resources: Record<string, ResourceMetadata>;
}
export interface IntegrationManifest {
	apiVersion: 1;
	id: string;
	name: string;
	backends: string[];
	capabilities: string[];
	discover(objects: Record<string, StateMetadata>, context?: DiscoveryContext): DeviceBinding[];
}
const units: Record<string, string[]> = {
	switch: [''],
	dimmer: ['%'],
	color: [''],
	temperatureSensor: ['°C'],
	thermostatSetpoint: ['°C'],
	windowContact: [''],
	motion: [''],
	illuminance: ['lx'],
	power: ['W'],
	energy: ['kWh'],
	fan: ['%', ''],
	airQuality: ['µg/m³', 'ppm', ''],
};
export class IntegrationRegistry {
	private integrations = new Map<string, IntegrationManifest>();
	register(manifest: IntegrationManifest): void {
		if (manifest.apiVersion !== 1 || this.integrations.has(manifest.id)) {
			throw new Error('integration_contract');
		}
		this.integrations.set(manifest.id, manifest);
	}
	list(): IntegrationManifest[] {
		return [...this.integrations.values()];
	}
	validate(binding: DeviceBinding): void {
		const manifest = this.integrations.get(binding.integrationId);
		if (!manifest) {
			throw new Error('unknown_integration');
		}
		const seen = new Set<string>();
		for (const mapping of binding.capabilities) {
			for (const path of [mapping.readId, mapping.writeId, mapping.confirmId].filter((v): v is string => !!v)) {
				if (
					binding.integrationId !== 'generic' &&
					!manifest.backends.some(backend => path.startsWith(`${backend}.`))
				) {
					throw new Error('backend_scope');
				}
				if (mapping.writeId === path && /^(system\.|adaptivehome\.)/.test(path)) {
					throw new Error('protected_state');
				}
			}
			if (seen.has(mapping.capability) || !manifest.capabilities.includes(mapping.capability)) {
				throw new Error('unsupported_capability');
			}
			seen.add(mapping.capability);
			for (const value of mapping.writeValues ?? []) {
				if (
					typeof value !== mapping.valueType ||
					(mapping.values && !mapping.values.includes(value)) ||
					(typeof value === 'number' &&
						((mapping.min !== undefined && value < mapping.min) ||
							(mapping.max !== undefined && value > mapping.max)))
				) {
					throw new Error('write_value_invalid');
				}
			}
			if (units[mapping.capability] && !units[mapping.capability].includes(mapping.unit)) {
				throw new Error('unit_mismatch');
			}
			if (mapping.writeId && (!mapping.confirmId || mapping.confirmation === 'none')) {
				throw new Error('unconfirmable_write');
			}
			if (mapping.min !== undefined && mapping.max !== undefined && mapping.min > mapping.max) {
				throw new Error('invalid_range');
			}
		}
	}
}
function timestampValue(value: unknown): number {
	return typeof value === 'number'
		? value
		: typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?$/.test(value)
			? Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`)
			: NaN;
}
export function normalize(
	binding: DeviceBinding,
	mapping: CapabilityMapping,
	raw: StateValue | null,
	now: number,
	evidence?: { verifiedAt?: StateValue | null; reachable?: StateValue | null; event?: StateValue | null },
): Observation {
	const result: Observation = {
		entityId: binding.id,
		capability: mapping.capability,
		value: null,
		unit: mapping.unit,
		measuredAt: raw?.ts ?? now,
		receivedAt: now,
		lastChange: raw?.lc,
		sourceId: mapping.readId,
		quality: 'unavailable',
	};
	if (!raw) {
		return result;
	}
	if (!Number.isFinite(raw.ts) || raw.ts < 0) {
		result.quality = 'invalid';
		return result;
	}
	if (raw.q !== undefined && raw.q !== 0) {
		result.quality = 'invalid';
		return result;
	}
	if (raw.val === null || raw.val === undefined) {
		result.quality = 'unknown';
		return result;
	}
	if (
		typeof raw.val !== (mapping.sourceType ?? mapping.valueType) ||
		(typeof raw.val === 'number' && !Number.isFinite(raw.val))
	) {
		result.quality = 'invalid';
		return result;
	}
	if (typeof raw.val !== 'string' && typeof raw.val !== 'number' && typeof raw.val !== 'boolean') {
		result.quality = 'invalid';
		return result;
	}
	const report = mapping.codec === 'nativeHeatingProgram' ? parseNativeHeatingReport(raw.val) : null;
	if (
		mapping.codec === 'nativeHeatingProgram' &&
		(!report ||
			report.program.physicalId !== binding.physicalId ||
			report.status !== 'applied' ||
			!report.automatic ||
			!report.fallbackVerified ||
			!report.absoluteExpiryVerified ||
			report.appOverride ||
			report.devicePending ||
			report.program.createdAt > now ||
			report.program.activateAt >= report.program.expiresAt ||
			report.effectiveTarget !==
				(now >= report.program.activateAt && now < report.program.expiresAt
					? report.program.target
					: report.program.fallback))
	) {
		result.quality = 'unknown';
		return result;
	}
	const decoded = report ? report.effectiveTarget : mapping.valueMap ? mapping.valueMap[String(raw.val)] : raw.val;
	if (report) {
		result.programCommandId = report.program.commandId;
	}
	if (report && now < report.program.expiresAt) {
		result.scheduledValue = report.program.target;
		result.scheduledUntil = report.program.expiresAt;
	}
	if (decoded === undefined || typeof decoded !== mapping.valueType) {
		result.quality = 'invalid';
		return result;
	}
	if (typeof decoded === 'string' && decoded.length > 512) {
		result.quality = 'invalid';
		return result;
	}
	const converted =
		mapping.codec === 'hueLightLevel' && typeof decoded === 'number'
			? Math.pow(10, (decoded - 1) / 10000)
			: decoded;
	const value = typeof converted === 'number' ? converted * mapping.scale + mapping.offset : (converted as Scalar);
	if (typeof value === 'number' && !Number.isFinite(value)) {
		result.quality = 'invalid';
		return result;
	}
	if (
		typeof value === 'number' &&
		((mapping.min !== undefined && value < mapping.min) || (mapping.max !== undefined && value > mapping.max))
	) {
		result.quality = 'invalid';
		return result;
	}
	if (mapping.values && !mapping.values.includes(value)) {
		result.quality = 'invalid';
		return result;
	}
	result.value = value;
	result.quality = raw.ts > now ? 'unknown' : now - raw.ts > mapping.maxAgeMs ? 'stale' : 'valid';
	if (mapping.eventTimestampId) {
		const event = evidence?.event;
		// Hue's zone-less ISO timestamps are UTC, independent of the controller locale.
		const at = timestampValue(event?.val);
		if (
			event?.ack !== true ||
			!Number.isFinite(event.ts) ||
			(event.q !== undefined && event.q !== 0) ||
			event.ts > now ||
			!Number.isFinite(at) ||
			at < 0 ||
			at > now
		) {
			result.quality = 'unknown';
			return result;
		}
		result.measuredAt = at;
	}
	if (mapping.freshness) {
		const proof = evidence?.verifiedAt,
			reachable = evidence?.reachable;
		const at = proof?.val;
		if (
			proof?.ack !== true ||
			!Number.isFinite(proof.ts) ||
			(proof.q !== undefined && proof.q !== 0) ||
			typeof at !== 'number' ||
			!Number.isFinite(at) ||
			at < raw.ts ||
			at > now ||
			proof.ts > now
		) {
			result.quality = 'unknown';
			return result;
		}
		result.verifiedAt = at;
		if (
			mapping.freshness.reachableId &&
			(reachable?.ack !== true ||
				!Number.isFinite(reachable.ts) ||
				(reachable.q !== undefined && reachable.q !== 0) ||
				reachable.ts > now ||
				reachable.val !== true)
		) {
			result.quality = reachable?.val === false ? 'unavailable' : 'unknown';
			return result;
		}
		result.quality = now - at > mapping.freshness.maxAgeMs ? 'stale' : raw.ts > now ? 'unknown' : 'valid';
	}
	return result;
}

export function mappingReadIds(mapping: CapabilityMapping): string[] {
	return [
		...new Set(
			[
				mapping.readId,
				mapping.writeId,
				mapping.confirmId,
				mapping.eventTimestampId,
				mapping.freshness?.verifiedAtId,
				mapping.freshness?.reachableId,
			].filter((v): v is string => !!v),
		),
	];
}
/** Uses the same evidence contract for decisions, dependencies and final execution checks. */
export async function readObservation(
	binding: DeviceBinding,
	mapping: CapabilityMapping,
	read: (id: string) => Promise<StateValue | null>,
	now: () => number,
): Promise<Observation> {
	const [raw, verifiedAt, reachable, event] = await Promise.all([
		read(mapping.readId),
		mapping.freshness ? read(mapping.freshness.verifiedAtId) : null,
		mapping.freshness?.reachableId ? read(mapping.freshness.reachableId) : null,
		mapping.eventTimestampId ? read(mapping.eventTimestampId) : null,
	]);
	const at = now(),
		evidence = { verifiedAt, reachable, event };
	let result = normalize(binding, mapping, raw, at, evidence);
	// Resolve tiny cross-process clock jitter by waiting for real time, never by changing report timestamps.
	const timestamps = [
		raw?.ts,
		verifiedAt?.ts,
		reachable?.ts,
		event?.ts,
		timestampValue(verifiedAt?.val),
		timestampValue(event?.val),
	].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
	const ahead = Math.max(at, ...timestamps) - at;
	if (result.quality === 'unknown' && result.value !== null && ahead > 0 && ahead <= 20) {
		await new Promise(resolve => setTimeout(resolve, Math.ceil(ahead) + 1));
		result = normalize(binding, mapping, raw, now(), evidence);
	}
	return result;
}
export function auditMapping(mapping: CapabilityMapping, metadata: Record<string, StateMetadata>): void {
	for (const [point, type] of [
		[mapping.freshness?.verifiedAtId, 'number'],
		[mapping.freshness?.reachableId, 'boolean'],
	] as const) {
		if (point && (metadata[point]?.type !== type || metadata[point].read === false || point === mapping.writeId)) {
			throw new Error('freshness_evidence_invalid');
		}
	}
	if (
		mapping.eventTimestampId &&
		(!['number', 'string'].includes(metadata[mapping.eventTimestampId]?.type) ||
			metadata[mapping.eventTimestampId].read === false)
	) {
		throw new Error('event_evidence_invalid');
	}
	for (const point of [mapping.readId, mapping.writeId, mapping.confirmId].filter((v): v is string => !!v)) {
		const meta = metadata[point];
		if (!meta || meta.type !== (mapping.sourceType ?? mapping.valueType)) {
			throw new Error('state_type_or_missing');
		}
		if (point === mapping.writeId && !meta.write) {
			throw new Error('state_readonly');
		}
		if (point !== mapping.writeId && meta.read === false) {
			throw new Error('state_unreadable');
		}
		if ((meta.unit ?? '') !== (mapping.sourceUnit ?? mapping.unit)) {
			throw new Error('source_unit_mismatch');
		}
	}
}
