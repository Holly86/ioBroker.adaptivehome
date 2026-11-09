import type { HmipProfile, HmipSnapshot } from '../connections/heating-backend';
import type { NativeTransportConfig } from '../connections/schema';
import { constantHeatingFallback, heatingFingerprint } from '../connections/timed-lease';
import type { RestoreRecipe } from './handoff-coordinator';

/** Finite profile restoration via the existing-session SDK port. Recurring schedules are never replayed. */
export function constantProfileRestoreRecipe(
	target: NativeTransportConfig,
	raw: HmipProfile,
	validUntil: number,
	port: {
		snapshot(target: NativeTransportConfig, fresh?: boolean): Promise<HmipSnapshot>;
		profileRequest(endpoint: 'group/heating/updateProfile', body: Record<string, unknown>): Promise<unknown>;
		writersStopped(): Promise<boolean>;
		manualRevision(): Promise<string>;
	},
	now: () => number = Date.now,
): RestoreRecipe {
	const profile = structuredClone(raw),
		base = profile.profileDays.MONDAY?.baseValue;
	if (
		!Number.isFinite(base) ||
		base < target.min ||
		base > target.max ||
		(base * 2) % 1 ||
		!constantHeatingFallback(profile, base) ||
		profile.type !== 'HEATING_COOLING' ||
		profile.groupId !== target.groupId ||
		profile.index !== target.profileIndex
	) {
		throw Error('handoff_constant_restore_only');
	}
	return {
		physicalId: target.physicalId,
		profileHash: heatingFingerprint(profile),
		validUntil,
		apply: async guard => {
			const s = await port.snapshot(target, true);
			const previousBase = s.group.profile.profileDays.MONDAY?.baseValue;
			if (
				guard.physicalId !== target.physicalId ||
				guard.restoreProfileHash !== heatingFingerprint(profile) ||
				guard.expectedProfileHash !== heatingFingerprint(s.group.profile) ||
				s.group.profile.id !== profile.id ||
				s.group.homeId !== profile.homeId ||
				s.group.id !== target.groupId ||
				s.group.activeProfile !== target.profileIndex ||
				!Number.isFinite(validUntil) ||
				validUntil <= now() ||
				validUntil > now() + 300000 ||
				!Number.isFinite(s.at) ||
				s.at > now() ||
				now() - s.at > target.maxAgeMs ||
				s.group.partyMode !== false ||
				s.group.windowState !== 'CLOSED' ||
				s.group.boostMode !== false ||
				s.group.controlMode !== 'AUTOMATIC' ||
				s.group.unreach !== false ||
				!constantHeatingFallback(s.group.profile, previousBase) ||
				s.group.setPointTemperature !== previousBase ||
				s.members.length !== target.memberIds.length ||
				new Set(s.members.map(m => m.id)).size !== target.memberIds.length ||
				s.members.some(
					m =>
						!target.memberIds.includes(m.id) ||
						m.configPending !== false ||
						m.unreach !== false ||
						m.lowBat !== false,
				) ||
				!(await port.writersStopped()) ||
				(await port.manualRevision()) !== guard.manualRevision
			) {
				throw Error('handoff_restore_guard_changed');
			}
			const sentAt = now(),
				changed = guard.expectedProfileHash !== guard.restoreProfileHash;
			if (changed) {
				await port.profileRequest('group/heating/updateProfile', {
					groupId: target.groupId,
					profileIndex: target.profileIndex,
					profile,
				});
			}
			const after = await port.snapshot(target, true);
			if (
				heatingFingerprint(after.group.profile) !== guard.restoreProfileHash ||
				after.members.some(m => m.configPending !== false) ||
				(changed &&
					(!Number.isFinite(after.group.updatedAt) ||
						after.group.updatedAt! < sentAt ||
						after.members.some(
							m =>
								!Number.isFinite(m.updatedAt) ||
								m.updatedAt! < sentAt ||
								m.setPointTemperature !== base,
						))) ||
				!(await port.writersStopped()) ||
				(await port.manualRevision()) !== guard.manualRevision
			) {
				throw Error('handoff_restore_unconfirmed');
			}
		},
	};
}
