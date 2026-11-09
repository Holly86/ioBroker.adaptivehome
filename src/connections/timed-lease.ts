import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { nativeHeatingProgramSchema, type NativeHeatingProgram } from '../integrations/native-program';
import type { HmipProfile, HmipSnapshot } from './heating-backend';
import type { NativeTransportConfig } from './schema';

const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
export const heatingFingerprint = (value: unknown): string => {
	const stable = (v: any): any =>
		Array.isArray(v)
			? v.map(stable)
			: v && typeof v === 'object'
				? Object.fromEntries(
						Object.keys(v)
							.sort()
							.map(k => [k, stable(v[k])]),
					)
				: v;
	return createHash('sha256')
		.update(JSON.stringify(stable(value)))
		.digest('hex');
};
export const controlFingerprint = (s: HmipSnapshot): string => {
	const { profileCheckedAt: _at, ...group } = s.group;
	return heatingFingerprint({
		group,
		partyContext: s.partyContext,
		members: s.members.map(({ checkedAt: _checked, ...m }) => m).sort((a, b) => a.id.localeCompare(b.id)),
	});
};
export function constantHeatingFallback(profile: HmipProfile, value: number): boolean {
	return (
		Object.keys(profile.profileDays).length === 7 &&
		days.every(
			d =>
				profile.profileDays[d]?.baseValue === value &&
				Array.isArray(profile.profileDays[d]?.periods) &&
				profile.profileDays[d].periods.length === 0,
		)
	);
}
/** HmIP accepts local dates without an offset. Reject a DST transition, never guess a fold. */
export function timedLeaseEndTime(at: number, now: number, timezone: string): string {
	if (!Number.isFinite(at) || !Number.isFinite(now) || at <= now || at % 300000 || at > now + 900000) {
		throw Error('native_timed_deadline_invalid');
	}
	const offset = (t: number): string | undefined =>
		new Intl.DateTimeFormat('en', { timeZone: timezone, timeZoneName: 'longOffset' })
			.formatToParts(t)
			.find(p => p.type === 'timeZoneName')?.value;
	if (offset(now - 3600000) !== offset(at + 3600000)) {
		throw Error('native_timed_dst_ambiguous');
	}
	const p = Object.fromEntries(
		new Intl.DateTimeFormat('en-CA', {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23',
		})
			.formatToParts(at)
			.map(p => [p.type, p.value]),
	);
	return `${p.year}_${p.month}_${p.day} ${p.hour}:${p.minute}`;
}
export interface TimedLeaseAcceptance {
	homeId: string;
	timezone: string;
	validUntil: number;
	evidenceHash: string;
	targets: { physicalId: string; baselineHash: string; memberIds: string[] }[];
	checks: {
		internetExpiry: boolean;
		accessPointRestartExpiry: boolean;
		sharedDeadline: boolean;
		appPriority: boolean;
		windowDuringLease: boolean;
		cloudTraffic: boolean;
	};
}
export interface TimedLeaseJournal {
	commands: Record<
		string,
		{
			targetId: string;
			program: NativeHeatingProgram;
			baselineHash: string;
			endTime: string;
			sentAt: number;
			phase: 'reserved' | 'accepted' | 'uncertain' | 'not-sent';
		}
	>;
}
export interface TimedLeasePort {
	snapshot(target: NativeTransportConfig, fresh?: boolean): Promise<HmipSnapshot>;
	authorize(target: NativeTransportConfig): Promise<boolean>;
	activate(groupId: string, temperature: number, endTime: string): Promise<void>;
	persist(journal: TimedLeaseJournal): Promise<void>;
}
/** Trusted executor-only commissioning authority, never an acceptance certificate. */
export interface ManualLeaseAuthority {
	check(target: NativeTransportConfig, snapshot: HmipSnapshot, program: NativeHeatingProgram): Promise<void>;
}
const envelope = z.strictObject({
	protocol: z.literal('adaptivehome.hmip-native.v1'),
	operation: z.enum(['inspect', 'apply']),
	targetId: z.string().min(1).max(64),
	program: nativeHeatingProgramSchema.optional(),
	deadline: z.number().finite().optional(),
});
/** Native absolute end date over an unchanged constant fallback. No weekly target period, timer or cancel path. */
export class HmipTimedLeaseEndpoint {
	private journal: TimedLeaseJournal;
	private busy = false;
	private issued = new Set<string>();
	constructor(
		private targets: NativeTransportConfig[],
		private port: TimedLeasePort,
		private acceptance: TimedLeaseAcceptance | undefined,
		private now: () => number = Date.now,
		saved?: TimedLeaseJournal,
		private allowedSenders: string[] = [],
		private commissioning?: ManualLeaseAuthority,
	) {
		this.journal = structuredClone(saved ?? { commands: {} });
		for (const c of Object.values(this.journal.commands)) {
			if (c.phase === 'reserved') {
				c.phase = 'uncertain';
			}
		}
	}
	async handle(input: unknown, sender: string): Promise<unknown> {
		if (!this.allowedSenders.includes(sender) || !/^system\.adapter\.adaptivehome\.\d+$/.test(sender)) {
			throw Error('native_sender_denied');
		}
		const r = envelope.parse(input),
			target = this.targets.find(t => t.id === r.targetId && t.enabled && t.strategy === 'timed-lease');
		if (!target) {
			throw Error('native_timed_target_denied');
		}
		if (r.operation === 'apply') {
			if (this.busy) {
				throw Error('native_backend_busy');
			}
			this.busy = true;
			try {
				if (!r.program || r.deadline === undefined) {
					throw Error('native_timed_request_invalid');
				}
				await this.apply(target, r.program, r.deadline);
			} finally {
				this.busy = false;
			}
		}
		return this.inspect(target);
	}
	private async state(t: NativeTransportConfig, fresh = false): Promise<HmipSnapshot> {
		const s = await this.port.snapshot(t, fresh),
			now = this.now(),
			g = s.group;
		const current = (at: number | undefined, age: number): boolean =>
			Number.isFinite(at) && at! <= now && now - at! <= age;
		if (
			!current(s.at, t.maxAgeMs) ||
			!current(g.profileCheckedAt, t.profileMaxAgeMs) ||
			!s.partyContext?.complete ||
			s.partyContext.homeId !== g.homeId ||
			g.id !== t.groupId ||
			g.activeProfile !== t.profileIndex ||
			g.profile.index !== t.profileIndex ||
			g.profile.groupId !== g.id ||
			g.profile.homeId !== g.homeId ||
			g.controlMode !== 'AUTOMATIC' ||
			g.unreach !== false ||
			g.boostMode !== false ||
			typeof g.partyMode !== 'boolean' ||
			s.members.length !== t.memberIds.length ||
			new Set(s.members.map(m => m.id)).size !== t.memberIds.length ||
			s.members.some(
				m =>
					!t.memberIds.includes(m.id) ||
					!current(m.checkedAt, t.maxAgeMs) ||
					m.unreach !== false ||
					m.lowBat !== false,
			)
		) {
			throw Error('native_timed_state_unverified');
		}
		return s;
	}
	private accepted(t: NativeTransportConfig, s: HmipSnapshot): boolean {
		const a = this.acceptance,
			target = a?.targets.find(x => x.physicalId === t.physicalId);
		return (
			!!a &&
			a.homeId === s.group.homeId &&
			Number.isFinite(a.validUntil) &&
			a.validUntil > this.now() &&
			/^[a-f0-9]{64}$/.test(a.evidenceHash) &&
			[
				'internetExpiry',
				'accessPointRestartExpiry',
				'sharedDeadline',
				'appPriority',
				'windowDuringLease',
				'cloudTraffic',
			].every(k => a.checks[k as keyof TimedLeaseAcceptance['checks']] === true) &&
			!!target &&
			target.baselineHash === heatingFingerprint(s.group.profile) &&
			isDeepStrictEqual([...target.memberIds].sort(), [...t.memberIds].sort())
		);
	}
	private blockers(t: NativeTransportConfig, s: HmipSnapshot, fallback: number): string[] {
		const reasons = [];
		if (
			s.partyContext!.absenceType !== 'NOT_ABSENT' &&
			!(s.partyContext!.absenceType === 'PARTY' && s.partyContext!.parties.length)
		) {
			reasons.push('native_home_absence_or_vacation_protected');
		}
		if (!this.commissioning && !this.accepted(t, s)) {
			reasons.push('native_timed_physical_acceptance_missing');
		}
		if (!constantHeatingFallback(s.group.profile, fallback)) {
			reasons.push('native_timed_constant_fallback_missing');
		}
		if (Object.values(this.journal.commands).some(c => c.phase === 'reserved' || c.phase === 'uncertain')) {
			reasons.push('native_previous_command_uncertain');
		}
		for (const party of s.partyContext!.parties) {
			const owner = Object.values(this.journal.commands).find(
				c =>
					c.phase === 'accepted' &&
					this.targets.find(t => t.id === c.targetId)?.groupId === party.groupId &&
					c.program.expiresAt > this.now() &&
					c.program.target === party.temperature &&
					c.program.profileId === party.profileId &&
					c.endTime === s.partyContext!.endTime,
			);
			if (!owner || !this.issued.has(owner.program.commandId)) {
				reasons.push('native_app_party_or_unknown_owner');
			}
		}
		if (!s.group.partyMode && s.group.setPointTemperature !== fallback) {
			reasons.push('native_manual_target_protected');
		}
		return [...new Set(reasons)];
	}
	private async apply(t: NativeTransportConfig, p: NativeHeatingProgram, deadline: number): Promise<void> {
		const now = this.now();
		if (
			p.strategy !== 'timed-lease' ||
			p.physicalId !== t.physicalId ||
			p.profileId !== t.profileIndex ||
			p.createdAt > now ||
			now - p.createdAt > 60000 ||
			p.activateAt !== Math.floor(p.createdAt / 60000) * 60000 ||
			p.expiresAt <= now + 60000 ||
			p.expiresAt > now + 900000 ||
			p.expiresAt % 300000 ||
			![p.target, p.fallback].every(v => Number.isFinite(v) && v >= t.min && v <= t.max && (v * 2) % 1 === 0) ||
			new Set(p.days.map(d => d.day)).size !== 7 ||
			p.days.some(d => d.base !== p.fallback || d.periods.length !== 0) ||
			!Number.isFinite(deadline) ||
			deadline <= now ||
			deadline > p.createdAt + 30000
		) {
			throw Error('native_timed_program_invalid');
		}
		const previous = this.journal.commands[p.commandId];
		if (previous) {
			if (!isDeepStrictEqual(previous.program, p) || previous.targetId !== t.id) {
				throw Error('native_command_replay_conflict');
			}
			if (previous.phase !== 'accepted') {
				throw Error('native_previous_command_uncertain');
			}
			return;
		}
		if (!(await this.port.authorize(t))) {
			throw Error('native_writer_not_exclusive');
		}
		const s = await this.state(t, true),
			reasons = this.blockers(t, s, p.fallback),
			endTime = timedLeaseEndTime(p.expiresAt, this.now(), p.timezone);
		if (reasons.length) {
			throw Error(reasons[0]);
		}
		await this.commissioning?.check(t, s, p);
		if (!this.commissioning && this.acceptance!.validUntil < p.expiresAt) {
			throw Error('native_timed_acceptance_expires_first');
		}
		if (!this.commissioning && this.acceptance!.timezone !== p.timezone) {
			throw Error('native_timed_timezone_unverified');
		}
		if (s.members.some(m => m.configPending !== false)) {
			throw Error('native_members_pending');
		}
		if (s.partyContext!.parties.length && s.partyContext!.endTime !== endTime) {
			throw Error('native_shared_deadline_may_not_change');
		}
		if (s.group.partyMode) {
			throw Error('native_existing_lease_may_not_be_overwritten');
		}
		const recent = Object.values(this.journal.commands).filter(
			c => c.phase !== 'not-sent' && this.now() - c.sentAt < 3600000,
		);
		if (
			Object.keys(this.journal.commands).length >= 4096 ||
			recent.length >= 40 ||
			recent.some(c => this.now() - c.sentAt < 5000)
		) {
			throw Error('native_local_command_budget');
		}
		this.journal.commands[p.commandId] = {
			targetId: t.id,
			program: p,
			baselineHash: heatingFingerprint(s.group.profile),
			endTime,
			sentAt: this.now(),
			phase: 'reserved',
		};
		await this.port.persist(structuredClone(this.journal));
		let mayHaveSent = false;
		try {
			const again = await this.state(t, true);
			await this.commissioning?.check(t, again, p);
			if (
				!(await this.port.authorize(t)) ||
				this.now() >= deadline ||
				controlFingerprint(again) !== controlFingerprint(s)
			) {
				throw Error('native_preflight_changed');
			}
			mayHaveSent = true;
			await this.port.activate(t.groupId, p.target, endTime);
			const readback = await this.state(t, true);
			if (
				readback.group.partyMode !== true ||
				readback.group.setPointTemperature !== p.target ||
				readback.partyContext!.endTime !== endTime ||
				heatingFingerprint(readback.group.profile) !== heatingFingerprint(s.group.profile)
			) {
				throw Error('native_timed_deadline_readback_missing');
			}
			this.journal.commands[p.commandId].phase = 'accepted';
			await this.port.persist(structuredClone(this.journal));
			this.issued.add(p.commandId);
		} catch {
			this.journal.commands[p.commandId].phase = mayHaveSent ? 'uncertain' : 'not-sent';
			await this.port.persist(structuredClone(this.journal));
			throw Error(mayHaveSent ? 'native_write_uncertain' : 'native_timed_not_dispatched');
		}
	}
	private async inspect(t: NativeTransportConfig): Promise<unknown> {
		const s = await this.state(t),
			entry = Object.values(this.journal.commands)
				.filter(c => c.targetId === t.id && c.phase !== 'not-sent')
				.at(-1),
			base = entry?.program.fallback ?? s.group.setPointTemperature;
		const reasons = this.blockers(t, s, base),
			capabilities = {
				fullWeeklyProfile: true,
				absoluteExpiry: !this.commissioning && this.accepted(t, s),
				sharedExistingSession: true,
				expiryMechanism: 'native-shared-party-deadline',
			};
		if (reasons.length) {
			return {
				protocol: 'adaptivehome.hmip-native.v1',
				ready: false,
				capabilities,
				reason: reasons[0],
				observedAt: s.at,
			};
		}
		const at = Math.floor(s.at / 60000) * 60000,
			p: NativeHeatingProgram = entry?.program ?? {
				protocol: 'adaptivehome.native-heating.v1',
				strategy: 'timed-lease',
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
		const active = this.now() < p.expiresAt && !!entry,
			expected = active ? p.target : p.fallback;
		const matches = active
			? s.group.partyMode === true && s.partyContext!.endTime === entry.endTime
			: s.group.partyMode === false;
		const devicePending =
			s.members.some(
				m =>
					m.configPending !== false ||
					m.setPointTemperature !== expected ||
					(!!entry &&
						(!Number.isFinite(m.updatedAt) || m.updatedAt! < (active ? entry.sentAt : p.expiresAt))),
			) ||
			(!!entry &&
				(!Number.isFinite(s.group.updatedAt) || s.group.updatedAt! < (active ? entry.sentAt : p.expiresAt)));
		const shared = Object.values(this.journal.commands).find(
			c => c.phase === 'accepted' && c.endTime === s.partyContext!.endTime && c.program.expiresAt > this.now(),
		);
		return {
			protocol: 'adaptivehome.hmip-native.v1',
			ready: true,
			capabilities,
			observedAt: Math.min(s.at, ...s.members.map(m => m.checkedAt)),
			report: {
				program: p,
				sharedDeadlineAt: shared?.program.expiresAt,
				status: matches ? 'applied' : 'rejected',
				automatic: true,
				fallbackVerified: constantHeatingFallback(s.group.profile, p.fallback),
				absoluteExpiryVerified: !this.commissioning && matches,
				appOverride: !matches || s.group.setPointTemperature !== expected,
				devicePending,
				effectiveTarget: s.group.setPointTemperature,
			},
		};
	}
}
