import type { NativeTransportConfig } from './schema';
import type { HmipProfile, HmipSnapshot } from './heating-backend';
import type { SourceDocument } from './sources';

/** Adapter-hosted API only. No credentials, authentication or socket creation occur here. */
export interface ExistingHmipSession {
	callRestApi(endpoint: string, body: Record<string, unknown>): Promise<unknown>;
}
type Data = Record<string, any>;
const object = (value: unknown): Data => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw Error('hmip_response_invalid');
	}
	return value;
};
const fields = (value: unknown, keys: string[]): Data => {
	const record = object(value);
	return Object.fromEntries(keys.filter(k => Object.hasOwn(record, k)).map(k => [k, record[k]]));
};
/** Real getProfile replies omit index/name. Bind these to independently read group metadata. */
export function normalizeHmipProfile(raw: unknown, group: Data, index: string): HmipProfile {
	const profile = object(raw),
		metadata = object(object(group.profiles)[index]);
	const id = metadata.profileId ?? metadata.id;
	if (
		typeof id !== 'string' ||
		!id ||
		(metadata.id !== undefined && metadata.profileId !== undefined && metadata.id !== metadata.profileId) ||
		profile.id !== id ||
		profile.groupId !== group.id ||
		profile.homeId !== group.homeId ||
		metadata.enabled !== true ||
		profile.type !== 'HEATING_COOLING' ||
		!profile.profileDays ||
		Object.keys(profile.profileDays).length !== 7 ||
		['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].some(
			day =>
				!Number.isFinite(profile.profileDays[day]?.baseValue) ||
				!Array.isArray(profile.profileDays[day]?.periods),
		) ||
		(metadata.index !== undefined && metadata.index !== index) ||
		(profile.index !== undefined && profile.index !== index) ||
		typeof metadata.name !== 'string' ||
		(profile.name !== undefined && profile.name !== metadata.name)
	) {
		throw Error('hmip_profile_identity_changed');
	}
	return { ...profile, index, name: metadata.name } as HmipProfile;
}
/** Real GET-like REST reads through the existing authenticated client, with bounded shared caching. */
export class HmipSessionSource {
	private cached?: SourceDocument;
	private pending?: Promise<SourceDocument>;
	private profiles = new Map<string, { fingerprint: string; profile: HmipProfile; checkedAt: number }>();
	constructor(
		private api: ExistingHmipSession,
		private clientCharacteristics: Record<string, unknown>,
		private now: () => number = Date.now,
		private cacheMs = 15000,
	) {
		if (!Number.isInteger(cacheMs) || cacheMs < 1000 || cacheMs > 300000) {
			throw Error('hmip_read_interval_invalid');
		}
	}
	async read(): Promise<SourceDocument> {
		if (
			this.cached?.fetchedAt !== undefined &&
			this.now() >= this.cached.fetchedAt &&
			this.now() - this.cached.fetchedAt < this.cacheMs
		) {
			return this.cached;
		}
		if (this.pending) {
			return this.pending;
		}
		this.pending = this.load();
		try {
			return await this.pending;
		} finally {
			this.pending = undefined;
		}
	}
	private async load(): Promise<SourceDocument> {
		const raw = object(await this.api.callRestApi('home/getCurrentState', this.clientCharacteristics)),
			home = object(raw.home),
			groups = object(raw.groups),
			devices = object(raw.devices),
			at = this.now();
		if (!home.id || home.connected !== true) {
			throw Error('hmip_home_offline');
		}
		const document = {
			at,
			home: fields(home, ['id', 'connected']),
			groups: Object.fromEntries(
				Object.entries(groups).map(([id, g]) => [
					id,
					fields(g, [
						'id',
						'homeId',
						'type',
						'channels',
						'profiles',
						'activeProfile',
						'controlMode',
						'unreach',
						'partyMode',
						'boostMode',
						'setPointTemperature',
						'actualTemperature',
						'humidity',
						'windowState',
						'lastStatusUpdate',
					]),
				]),
			),
			devices: Object.fromEntries(
				Object.entries(devices).map(([id, d]) => [
					id,
					fields(d, ['id', 'type', 'modelType', 'functionalChannels', 'lastStatusUpdate']),
				]),
			),
		};
		this.cached = { document, fetchedAt: at };
		return this.cached;
	}
	async snapshot(t: NativeTransportConfig, fresh = false): Promise<HmipSnapshot> {
		if (fresh) {
			if (this.pending) {
				await this.pending;
			}
			this.cached = undefined;
			this.profiles.delete(t.groupId);
		}
		const read = await this.read(),
			data = object(read.document),
			group = object(data.groups[t.groupId]);
		const members = (group.channels as { deviceId: string }[])
			.map(c => data.devices[c.deviceId])
			.filter(d => d?.type === 'HEATING_THERMOSTAT');
		if (
			group.id !== t.groupId ||
			group.homeId !== data.home.id ||
			members.length !== t.memberIds.length ||
			members.some(d => !t.memberIds.includes(d.id))
		) {
			throw Error('hmip_membership_changed');
		}
		const metadata = object(group.profiles)[t.profileIndex],
			fingerprint = JSON.stringify(metadata),
			old = this.profiles.get(t.groupId);
		const identity = object(metadata);
		// The backend uses profileId; some compatible implementations expose id.
		// Conflicting identifiers must never be resolved by choosing one silently.
		const profileId = identity.profileId ?? identity.id;
		if (
			typeof profileId !== 'string' ||
			!profileId ||
			(identity.id !== undefined && identity.profileId !== undefined && identity.id !== identity.profileId)
		) {
			throw Error('hmip_profile_identity_changed');
		}
		let profile =
			old?.fingerprint === fingerprint &&
			this.now() >= old.checkedAt &&
			this.now() - old.checkedAt <= t.profileMaxAgeMs
				? old.profile
				: undefined;
		if (!profile) {
			profile = normalizeHmipProfile(
				await this.api.callRestApi('group/heating/getProfile', {
					groupId: t.groupId,
					profileIndex: t.profileIndex,
					profileName: object(metadata).name,
				}),
				group,
				t.profileIndex,
			);
			if (
				profile.groupId !== t.groupId ||
				profile.index !== t.profileIndex ||
				profile.homeId !== group.homeId ||
				profile.id !== profileId
			) {
				throw Error('hmip_profile_identity_changed');
			}
			this.profiles.set(t.groupId, { fingerprint, profile, checkedAt: this.now() });
		}
		return {
			at: data.at,
			group: {
				id: group.id,
				homeId: group.homeId,
				activeProfile: group.activeProfile,
				controlMode: group.controlMode,
				unreach: group.unreach,
				partyMode: group.partyMode,
				boostMode: group.boostMode,
				setPointTemperature: group.setPointTemperature,
				profile,
				profileCheckedAt: this.profiles.get(t.groupId)!.checkedAt,
			},
			members: members.map(d => {
				const c0 = object(d.functionalChannels?.[0]),
					c1 = object(d.functionalChannels?.[1]);
				return {
					id: d.id,
					checkedAt: data.at,
					configPending: c0.configPending,
					unreach: c0.unreach,
					lowBat: c0.lowBat,
					setPointTemperature: c1.setPointTemperature,
				};
			}),
		};
	}
	invalidateProfile(groupId: string): void {
		this.profiles.delete(groupId);
	}
	async profileRequest(
		endpoint: 'group/heating/getProfile' | 'group/heating/updateProfile',
		body: Record<string, unknown>,
	): Promise<unknown> {
		if (!['group/heating/getProfile', 'group/heating/updateProfile'].includes(endpoint)) {
			throw Error('hmip_endpoint_denied');
		}
		const result = await this.api.callRestApi(endpoint, body);
		if (endpoint.endsWith('updateProfile')) {
			this.cached = undefined;
			this.profiles.delete(String(body.groupId));
		}
		if (endpoint === 'group/heating/getProfile') {
			const data = object((await this.read()).document),
				group = object(data.groups[String(body.groupId)]);
			return normalizeHmipProfile(result, group, String(body.profileIndex));
		}
		return result;
	}
	async handleRead(sender: string, allowedSenders: string[]): Promise<SourceDocument> {
		if (!allowedSenders.includes(sender) || !/^system\.adapter\.adaptivehome\.\d+$/.test(sender)) {
			throw Error('source_sender_denied');
		}
		return this.read();
	}
}
