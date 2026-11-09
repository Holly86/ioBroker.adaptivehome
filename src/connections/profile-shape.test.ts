import { strict as assert } from 'node:assert';
import { normalizeHmipProfile } from './hmip-session';
describe('HmIP real profile response shapes', () => {
	const group = {
		id: 'group-a',
		homeId: 'home-a',
		profiles: { PROFILE_3: { profileId: 'profile-a', index: 'PROFILE_3', name: 'Selected', enabled: true } },
	};
	const raw = {
		id: 'profile-a',
		groupId: 'group-a',
		homeId: 'home-a',
		type: 'HEATING_COOLING',
		profileDays: Object.fromEntries(
			['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map(day => [
				day,
				{ baseValue: 17, periods: [] },
			]),
		),
	};
	it('binds omitted index/name to independently verified profileId metadata without changing the raw response', () => {
		const p = normalizeHmipProfile(raw, group, 'PROFILE_3');
		assert.equal(p.index, 'PROFILE_3');
		assert.equal(p.name, 'Selected');
		assert.equal((raw as any).index, undefined);
		assert.deepEqual(p.profileDays, raw.profileDays);
	});
	it('rejects conflicting aliases, mismatched claims, changed home/group and unknown profile identities', () => {
		assert.throws(() => normalizeHmipProfile({ ...raw, type: 'OTHER' }, group, 'PROFILE_3'), /identity/);
		assert.throws(() => normalizeHmipProfile({ ...raw, profileDays: {} }, group, 'PROFILE_3'), /identity/);
		assert.throws(
			() =>
				normalizeHmipProfile(
					raw,
					{ ...group, profiles: { PROFILE_3: { ...group.profiles.PROFILE_3, enabled: false } } },
					'PROFILE_3',
				),
			/identity/,
		);
		for (const change of [
			{ id: 'other' },
			{ groupId: 'other' },
			{ homeId: 'other' },
			{ index: 'PROFILE_1' },
			{ name: 'Other' },
		]) {
			assert.throws(() => normalizeHmipProfile({ ...raw, ...change }, group, 'PROFILE_3'), /identity/);
		}
		assert.throws(
			() =>
				normalizeHmipProfile(
					raw,
					{ ...group, profiles: { PROFILE_3: { ...group.profiles.PROFILE_3, id: 'other' } } },
					'PROFILE_3',
				),
			/identity/,
		);
		assert.throws(() => normalizeHmipProfile(raw, group, 'PROFILE_1'), /invalid|identity/);
	});
});
