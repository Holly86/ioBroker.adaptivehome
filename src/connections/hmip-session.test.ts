import { strict as assert } from 'node:assert';
import { HmipSessionSource } from './hmip-session';
import { nativeTransportSchema } from './schema';

describe('Existing HmIP session read adapter', () => {
	it('reads actual server state, preserves cached proof time, verifies membership and never authenticates a second client', async () => {
		let now = 50000;
		const calls: string[] = [],
			profile = {
				id: 'profile-id',
				homeId: 'home-id',
				groupId: 'group-id',
				index: 'PROFILE_3',
				name: 'Selected',
				type: 'HEATING_PROFILE',
				profileDays: {},
			};
		const raw = {
			home: { id: 'home-id', connected: true, secret: 'must-not-export' },
			groups: {
				'group-id': {
					id: 'group-id',
					homeId: 'home-id',
					channels: [{ deviceId: 'valve-id' }],
					profiles: { PROFILE_3: { id: 'profile-id', name: 'Selected' } },
					activeProfile: 'PROFILE_3',
					controlMode: 'AUTOMATIC',
					unreach: false,
					partyMode: false,
					boostMode: false,
					setPointTemperature: 17,
				},
			},
			devices: {
				'valve-id': {
					id: 'valve-id',
					type: 'HEATING_THERMOSTAT',
					functionalChannels: {
						0: { configPending: false, unreach: false, lowBat: false },
						1: { setPointTemperature: 17 },
					},
				},
			},
		};
		const source = new HmipSessionSource(
			{
				callRestApi: async endpoint => {
					calls.push(endpoint);
					return structuredClone(endpoint === 'home/getCurrentState' ? raw : profile);
				},
			},
			{ clientType: 'existing' },
			() => now,
		);
		const first = await source.handleRead('system.adapter.adaptivehome.7', ['system.adapter.adaptivehome.7']);
		assert.equal(first.fetchedAt, 50000);
		assert.ok(!JSON.stringify(first).includes('must-not-export'));
		now += 1000;
		assert.equal((await source.read()).fetchedAt, 50000);
		assert.equal(calls.length, 1);
		const t = nativeTransportSchema.parse({
			id: 'room',
			enabled: true,
			backend: 'hmip.9',
			groupId: 'group-id',
			physicalId: 'physical-id',
			profileIndex: 'PROFILE_3',
			memberIds: ['valve-id'],
			min: 5,
			max: 30,
		});
		const snapshot = await source.snapshot(t);
		assert.equal(snapshot.members[0].checkedAt, 50000);
		assert.equal(snapshot.group.profile.id, 'profile-id');
		await source.snapshot(t);
		assert.equal(calls.filter(c => c === 'group/heating/getProfile').length, 1);
		const priorProfileAt = snapshot.group.profileCheckedAt;
		now += 1000;
		assert.equal((await source.snapshot(t)).group.profileCheckedAt, priorProfileAt);
		source.invalidateProfile(t.groupId);
		assert.ok((await source.snapshot(t)).group.profileCheckedAt > priorProfileAt);
		now += 1000;
		assert.equal((await source.snapshot(t, true)).at, now);
		await assert.rejects(
			source.handleRead('system.adapter.other.0', ['system.adapter.adaptivehome.7']),
			/sender_denied/,
		);
		now += 15000;
		raw.groups['group-id'].channels = [];
		await assert.rejects(source.snapshot(t), /membership_changed/);
		assert.ok(calls.every(c => ['home/getCurrentState', 'group/heating/getProfile'].includes(c)));
	});
});
