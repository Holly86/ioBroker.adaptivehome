import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { nativeHeatingProgramSchema, type NativeHeatingProgram } from '../integrations/native-program';
import type { NativeTransportConfig } from './schema';

const requestSchema = z.strictObject({
	protocol: z.literal('adaptivehome.hmip-native.v1'),
	operation: z.enum(['inspect', 'apply']),
	targetId: z.string().min(1).max(64),
	program: nativeHeatingProgramSchema.optional(),
	deadline: z.number().finite().optional(),
});
export interface HmipProfile {
	id: string;
	homeId: string;
	groupId: string;
	index: string;
	name: string;
	type: string;
	profileDays: Record<
		string,
		{ baseValue: number; periods: { starttime: string; endtime: string; value: number }[] }
	>;
}
export interface HmipSnapshot {
	at: number;
	partyContext?: {
		homeId: string;
		complete: boolean;
		endTime?: string;
		absenceType?: string;
		parties: { groupId: string; temperature: number; profileId: string }[];
	};
	group: {
		id: string;
		homeId: string;
		activeProfile: string;
		controlMode: string;
		unreach: boolean;
		partyMode: boolean;
		boostMode: boolean;
		setPointTemperature: number;
		profile: HmipProfile;
		profileCheckedAt: number;
		updatedAt?: number;
	};
	members: {
		id: string;
		checkedAt: number;
		configPending: boolean;
		unreach: boolean;
		lowBat: boolean;
		setPointTemperature: number;
		updatedAt?: number;
	}[];
}
export interface ExpiryProof {
	commandId: string;
	expiresAt: number;
	physicalId: string;
	deviceEnforced: true;
}
export interface HeatingBackendPort {
	/** Supplied by the existing backend, reusing its already authenticated client. */
	callRestApi(
		endpoint: 'group/heating/getProfile' | 'group/heating/updateProfile',
		body: Record<string, unknown>,
	): Promise<unknown>;
	snapshot(target: NativeTransportConfig, fresh?: boolean): Promise<HmipSnapshot>;
	authorize(target: NativeTransportConfig): Promise<boolean>;
	persist(record: HeatingTransportJournal): Promise<void>;
	/** Optional REAL device/server absolute-expiry facility, never a process timer. */
	expiry?: {
		install(program: NativeHeatingProgram): Promise<ExpiryProof>;
		read(program: NativeHeatingProgram): Promise<ExpiryProof | null>;
	};
}
export interface HeatingTransportJournal {
	commands: Record<
		string,
		{
			hash: string;
			targetId: string;
			phase: 'reserved' | 'accepted' | 'uncertain';
			program: NativeHeatingProgram;
			baseline: HmipProfile;
			sentAt: number;
		}
	>;
}
const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const hhmm = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export function hmipProfile(program: NativeHeatingProgram, baseline: HmipProfile): HmipProfile {
	return {
		...baseline,
		profileDays: Object.fromEntries(
			program.days.map(d => [
				days[d.day],
				{
					baseValue: d.base,
					periods: d.periods.map(p => ({ starttime: hhmm(p.start), endtime: hhmm(p.end), value: p.value })),
				},
			]),
		),
	};
}
function matchesProfile(a: HmipProfile, b: HmipProfile): boolean {
	// Preserve and verify the actual server identity and label, not just temperatures.
	return isDeepStrictEqual(a, b);
}
function controlState(s: HmipSnapshot): unknown {
	const { profileCheckedAt: _profileCheckedAt, ...group } = s.group;
	return {
		group,
		members: s.members
			.map(({ checkedAt: _checkedAt, ...member }) => member)
			.sort((a, b) => a.id.localeCompare(b.id)),
	};
}
function proofMatches(proof: ExpiryProof | null, p: NativeHeatingProgram): boolean {
	return (
		!!proof &&
		proof.deviceEnforced === true &&
		proof.commandId === p.commandId &&
		proof.physicalId === p.physicalId &&
		proof.expiresAt === p.expiresAt
	);
}
/** Backend-side SDK endpoint. It is never installed by editing another adapter's node_modules. */
export class HmipNativeEndpoint {
	private journal: HeatingTransportJournal;
	private busy = false;
	private restored = false;
	constructor(
		private targets: NativeTransportConfig[],
		private port: HeatingBackendPort,
		private now: () => number = Date.now,
		saved?: HeatingTransportJournal,
		private allowedSenders: string[] = [],
	) {
		this.journal = structuredClone(saved ?? { commands: {} });
		this.restored = !!saved;
	}
	async handle(input: unknown, sender: string): Promise<unknown> {
		if (!this.allowedSenders.includes(sender) || !/^system\.adapter\.adaptivehome\.\d+$/.test(sender)) {
			throw Error('native_sender_denied');
		}
		const request = requestSchema.parse(input),
			t = this.targets.find(t => t.id === request.targetId);
		if (!t?.enabled || t.min > t.max) {
			throw Error('native_target_not_authorized');
		}
		if (this.busy) {
			throw Error('native_backend_busy');
		}
		this.busy = true;
		try {
			if (this.restored) {
				for (const c of Object.values(this.journal.commands)) {
					if (c.phase === 'reserved') {
						c.phase = 'uncertain';
					}
				}
				await this.port.persist(this.journal);
				this.restored = false;
			}
			if (request.operation === 'apply') {
				if (!request.program) {
					throw Error('native_program_missing');
				}
				if (request.program.strategy !== 'weekly-profile' || t.strategy !== 'weekly-profile') {
					throw Error('native_transport_strategy_mismatch');
				}
				if (request.deadline === undefined) {
					throw Error('native_dispatch_expired');
				}
				await this.apply(t, request.program, request.deadline);
			}
			return await this.inspect(t);
		} finally {
			this.busy = false;
		}
	}
	private async state(t: NativeTransportConfig, fresh = false): Promise<HmipSnapshot> {
		const s = await this.port.snapshot(t, fresh),
			now = this.now();
		if (
			!Number.isFinite(s.at) ||
			!Number.isFinite(s.group.profileCheckedAt) ||
			s.group.profileCheckedAt > now ||
			now - s.group.profileCheckedAt > t.profileMaxAgeMs ||
			s.at > now ||
			now - s.at > t.maxAgeMs ||
			s.group.id !== t.groupId ||
			s.group.activeProfile !== t.profileIndex ||
			s.group.controlMode !== 'AUTOMATIC' ||
			s.group.unreach !== false ||
			s.group.partyMode !== false ||
			s.group.boostMode !== false ||
			s.group.profile.groupId !== t.groupId ||
			s.group.profile.homeId !== s.group.homeId ||
			s.group.profile.index !== t.profileIndex ||
			s.members.length !== new Set(s.members.map(m => m.id)).size ||
			t.memberIds.some(id => !s.members.some(m => m.id === id)) ||
			s.members.some(
				m =>
					!t.memberIds.includes(m.id) ||
					!Number.isFinite(m.checkedAt) ||
					m.checkedAt > now ||
					now - m.checkedAt > t.maxAgeMs ||
					m.unreach !== false ||
					m.lowBat !== false,
			)
		) {
			throw Error('native_device_snapshot_invalid');
		}
		return s;
	}
	private validate(t: NativeTransportConfig, p: NativeHeatingProgram): void {
		const now = this.now();
		if (
			p.physicalId !== t.physicalId ||
			p.profileId !== t.profileIndex ||
			p.createdAt > now ||
			now - p.createdAt > 60000 ||
			p.activateAt < now + 1000 ||
			p.activateAt >= p.expiresAt ||
			p.expiresAt > now + 86400000 ||
			p.activateAt % 60000 ||
			p.expiresAt % 60000 ||
			new Set(p.days.map(d => d.day)).size !== 7 ||
			![p.target, p.fallback].every(v => v >= t.min && v <= t.max && (v * 2) % 1 === 0)
		) {
			throw Error('native_program_invalid');
		}
		// The payload must be exactly the declared one-shot absolute window, including DST.
		const expected = p.days.map(d => ({
			day: d.day,
			base: p.fallback,
			periods: [] as { start: number; end: number; value: number }[],
		}));
		for (let at = p.activateAt; at < p.expiresAt; at += 60000) {
			const parts = new Intl.DateTimeFormat('en-US', {
				timeZone: p.timezone,
				weekday: 'short',
				hour: '2-digit',
				minute: '2-digit',
				hourCycle: 'h23',
			}).formatToParts(at);
			const get = (type: string): string => parts.find(v => v.type === type)!.value;
			const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
				minute = Number(get('hour')) * 60 + Number(get('minute'));
			const periods = expected.find(d => d.day === day)!.periods,
				last = periods.at(-1);
			if (last?.end === minute) {
				last.end++;
			} else if (periods.some(v => v.start <= minute && minute < v.end)) {
				throw Error('native_dst_fold_requires_backend_resolution');
			} else {
				periods.push({ start: minute, end: minute + 1, value: p.target });
			}
		}
		if (!isDeepStrictEqual(expected, p.days)) {
			throw Error('native_program_period_mismatch');
		}
	}
	private async apply(t: NativeTransportConfig, p: NativeHeatingProgram, dispatchDeadline: number): Promise<void> {
		const hash = createHash('sha256').update(JSON.stringify(p)).digest('hex'),
			old = this.journal.commands[p.commandId];
		if (old) {
			if (old.hash !== hash || old.targetId !== t.id) {
				throw Error('native_command_replay_conflict');
			}
			if (old.phase !== 'accepted') {
				throw Error('native_previous_command_uncertain');
			}
			return;
		}
		this.validate(t, p);
		if (this.now() >= dispatchDeadline || dispatchDeadline > p.createdAt + 30000) {
			throw Error('native_dispatch_expired');
		}
		if (Object.keys(this.journal.commands).length >= 4096) {
			throw Error('native_journal_capacity');
		}
		if (Object.values(this.journal.commands).some(c => c.targetId === t.id && c.phase !== 'accepted')) {
			throw Error('native_previous_command_uncertain');
		}
		const recent = Object.values(this.journal.commands).filter(c => this.now() - c.sentAt < 3600000);
		if (recent.some(c => this.now() - c.sentAt < 5000) || recent.length >= 40) {
			throw Error('native_local_command_budget');
		}
		// A repeating weekly profile alone is NOT an absolute expiry. No update without this capability.
		if (!this.port.expiry) {
			throw Error('native_absolute_expiry_unsupported');
		}
		if (!(await this.port.authorize(t))) {
			throw Error('native_writer_not_exclusive');
		}
		const state = await this.state(t, true);
		if (state.members.some(m => m.configPending !== false)) {
			throw Error('native_members_pending');
		}
		const baseline = (await this.port.callRestApi('group/heating/getProfile', {
			groupId: t.groupId,
			profileIndex: t.profileIndex,
			profileName: state.group.profile.name,
		})) as HmipProfile;
		if (!matchesProfile(baseline, state.group.profile)) {
			throw Error('native_profile_identity_changed');
		}
		this.journal.commands[p.commandId] = {
			baseline: structuredClone(baseline),
			hash,
			targetId: t.id,
			phase: 'reserved',
			program: p,
			sentAt: this.now(),
		};
		await this.port.persist(this.journal);
		try {
			if (this.now() >= dispatchDeadline) {
				throw Error('native_dispatch_expired');
			}
			const expiry = await this.port.expiry.install(p);
			if (!proofMatches(expiry, p)) {
				throw Error('native_absolute_expiry_unverified');
			}
			if (
				!(await this.port.authorize(t)) ||
				!isDeepStrictEqual(controlState(await this.state(t, true)), controlState(state))
			) {
				throw Error('native_preflight_changed');
			}
			this.validate(t, p);
			if (this.now() >= dispatchDeadline) {
				throw Error('native_dispatch_expired');
			}
			this.journal.commands[p.commandId].sentAt = this.now();
			await this.port.callRestApi('group/heating/updateProfile', {
				groupId: t.groupId,
				profileIndex: t.profileIndex,
				profile: hmipProfile(p, baseline),
			});
			const readback = (await this.port.callRestApi('group/heating/getProfile', {
				groupId: t.groupId,
				profileIndex: t.profileIndex,
				profileName: baseline.name,
			})) as HmipProfile;
			if (!matchesProfile(readback, hmipProfile(p, baseline))) {
				throw Error('native_profile_readback_mismatch');
			}
			this.journal.commands[p.commandId].phase = 'accepted';
			await this.port.persist(this.journal);
		} catch {
			this.journal.commands[p.commandId].phase = 'uncertain';
			await this.port.persist(this.journal);
			throw Error('native_write_uncertain');
		}
	}
	private async inspect(t: NativeTransportConfig): Promise<unknown> {
		const s = await this.state(t),
			command = Object.values(this.journal.commands)
				.filter(c => c.targetId === t.id)
				.at(-1);
		const capabilities = {
			fullWeeklyProfile: true,
			absoluteExpiry: !!this.port.expiry,
			sharedExistingSession: true,
		};
		if (!command) {
			const profile = s.group.profile;
			const base = s.group.setPointTemperature;
			const constant =
				matchesProfile(profile, s.group.profile) &&
				days.every(
					day =>
						profile.profileDays[day]?.baseValue === base && profile.profileDays[day].periods.length === 0,
				) &&
				s.members.every(m => m.configPending === false && m.setPointTemperature === base);
			if (!constant) {
				return {
					protocol: 'adaptivehome.hmip-native.v1',
					capabilities,
					ready: false,
					reason: 'native_baseline_not_accepted',
					observedAt: s.at,
				};
			}
			// A verified constant native baseline has no elevated period to recur. It is read, never installed here.
			const at = Math.floor(s.at / 60000) * 60000;
			const program: NativeHeatingProgram = {
				protocol: 'adaptivehome.native-heating.v1',
				strategy: 'weekly-profile',
				commandId: 'baseline',
				physicalId: t.physicalId,
				profileId: t.profileIndex,
				createdAt: at - 180000,
				activateAt: at - 120000,
				expiresAt: at - 60000,
				timezone: 'UTC',
				target: base,
				fallback: base,
				days: days.map((_, day) => ({ day, base, periods: [] })),
			};
			return {
				protocol: 'adaptivehome.hmip-native.v1',
				capabilities,
				ready: true,
				observedAt: Math.min(s.at, ...s.members.map(m => m.checkedAt)),
				report: {
					program,
					status: 'applied',
					automatic: true,
					fallbackVerified: true,
					absoluteExpiryVerified: true,
					appOverride: false,
					devicePending: false,
					effectiveTarget: base,
				},
			};
		}
		if (command.phase !== 'accepted') {
			return {
				protocol: 'adaptivehome.hmip-native.v1',
				capabilities,
				ready: false,
				reason: 'native_previous_command_uncertain',
				observedAt: s.at,
			};
		}
		const p = command.program,
			profile = s.group.profile;
		const expected = this.now() >= p.activateAt && this.now() < p.expiresAt ? p.target : p.fallback;
		const expiry = await this.port.expiry?.read(p),
			contents = matchesProfile(profile, hmipProfile(p, command.baseline));
		const pending = s.members.some(
			m => m.configPending !== false || m.checkedAt < command.sentAt || m.setPointTemperature !== expected,
		);
		return {
			protocol: 'adaptivehome.hmip-native.v1',
			capabilities,
			ready: true,
			observedAt: Math.min(s.at, ...s.members.map(m => m.checkedAt)),
			report: {
				program: p,
				status: contents ? 'applied' : 'rejected',
				automatic: s.group.controlMode === 'AUTOMATIC',
				fallbackVerified: contents,
				absoluteExpiryVerified: proofMatches(expiry ?? null, p),
				appOverride: s.group.partyMode || s.group.setPointTemperature !== expected,
				devicePending: pending,
				effectiveTarget: s.group.setPointTemperature,
			},
		};
	}
}
