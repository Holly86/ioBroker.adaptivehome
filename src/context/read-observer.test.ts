import { strict as assert } from 'node:assert';
import { manualRequest, rgbHue, roomUsage, calendarAvailable, ReadPresence } from './read-observer';
import { readOnlyHmipPort } from '../connections/read-only-port';
describe('Independent read-only source projections', () => {
	it('reads explicit persistent requests; unreadable or malformed stores never release a manual lock', () => {
		assert.equal(manualRequest({ rooms: { zone: { mode: 'manual' } } }, 'zone'), true);
		assert.equal(manualRequest({ rooms: {} }, 'zone'), false);
		assert.equal(manualRequest(null, 'zone'), null);
		assert.equal(manualRequest({ rooms: { zone: { mode: 'unexpected' } } }, 'zone'), null);
	});
	it('keeps RGB feedback and strict light/motion semantics independent of old reports', () => {
		assert.equal(rgbHue([255, 0, 0]), 0);
		assert.equal(rgbHue([0, 255, 0]), 120);
		assert.equal(rgbHue([0, 0, 255]), 240);
		assert.equal(rgbHue([8, 8, 8]), 0);
		assert.equal(rgbHue([256, 0, 0]), null);
		assert.equal(roomUsage([false, false], [null], false), false);
		assert.equal(roomUsage([null], [true], false), true);
		assert.equal(roomUsage([true], [], null), null);
		assert.equal(roomUsage([null], [], false), null);
	});
	it('retains travel, finite school coverage, same-day afternoon groups, all-day exclusive ends and stale/unknown handling', () => {
		const now = Date.parse('2027-04-12T14:00:00Z'),
			data = {
				fetchedAt: now - 1000,
				complete: true,
				from: now - 86400000,
				through: now + 86400000,
				events: [] as any[],
			};
		const rules = {
			timezone: 'Europe/Paris',
			maxAgeMs: 3600000,
			awayKind: 'remote',
			school: {
				agKind: 'club',
				departure: '07:30',
				return: '13:30',
				agReturn: '17:30',
				validFrom: '2027-01-01',
				validThrough: '2027-12-31',
				publicHolidays: [],
				holidays: [],
			},
		};
		assert.equal(calendarAvailable(data, rules, now), true);
		data.events.push({ kind: 'club', start: now + 3600000, end: now + 7200000 });
		assert.equal(calendarAvailable(data, rules, now), false);
		assert.equal(calendarAvailable({ ...data, fetchedAt: now - 3600001 }, rules, now), null);
		assert.equal(
			calendarAvailable(data, { ...rules, school: { ...rules.school, validThrough: '2027-04-11' } }, now),
			null,
		);
		assert.equal(
			calendarAvailable(
				{ ...data, events: [{ kind: 'remote', allDay: true, start: '2027-04-11', end: '2027-04-12' }] },
				{ ...rules, school: undefined },
				now,
			),
			true,
		);
		assert.equal(
			calendarAvailable(
				{ ...data, events: [{ kind: 'remote', allDay: true, start: '2027-04-12', end: '2027-04-13' }] },
				rules,
				now,
			),
			false,
		);
		assert.equal(
			calendarAvailable({ ...data, events: [{ kind: 'remote', start: 'garbage', end: now }] }, rules, now),
			null,
		);
	});
	it('requires real fresh negative scans through the absence delay and resets after uncertainty/session changes', () => {
		const p = new ReadPresence(),
			at = 1000000,
			people = (t: number) => [{ value: false, verifiedAt: t }];
		assert.equal(p.evaluate(people(at), [], 'scan-a', at, 300000), null);
		for (let t = at + 30000; t < at + 300000; t += 30000) {
			assert.equal(p.evaluate(people(t), [], 'scan-a', t, 300000), null);
		}
		assert.equal(p.evaluate(people(at + 300000), [], 'scan-a', at + 300000, 300000), false);
		assert.equal(p.evaluate(people(at), [], 'scan-a', at + 330000, 300000), null);
		assert.equal(p.evaluate(people(at + 360000), [], 'scan-b', at + 360000, 300000), null);
	});
	it('does not corroborate an old hallway event with a phone that arrived much later', () => {
		const p = new ReadPresence(),
			at = 1000000,
			positive = [{ key: 'corridor', active: true, at, verifiedAt: at, maxAgeMs: 300000, corroborate: true }];
		assert.equal(p.evaluate([{ value: false, verifiedAt: at }], positive, 'a', at, 300000), null);
		const later = at + 120000;
		assert.equal(
			p.evaluate(
				[{ value: true, verifiedAt: later, eventAt: later }],
				[{ ...positive[0], verifiedAt: later }],
				'a',
				later,
				300000,
			),
			true,
		);
		assert.equal(
			p.evaluate(
				[{ value: false, verifiedAt: later + 30000 }],
				[{ ...positive[0], verifiedAt: later + 30000 }],
				'a',
				later + 30000,
				300000,
			),
			null,
		);
	});
	it('records corroboration for every activity input even when an earlier room is already active', () => {
		const p = new ReadPresence(),
			at = 1000000;
		const first = { key: 'room', active: true, at, verifiedAt: at, maxAgeMs: 300000, corroborate: false },
			hall = { ...first, key: 'corridor', corroborate: true };
		assert.equal(p.evaluate([{ value: true, verifiedAt: at, eventAt: at }], [first, hall], 'a', at, 300000), true);
		const later = at + 120000;
		assert.equal(
			p.evaluate(
				[{ value: false, verifiedAt: later }],
				[
					{ ...first, active: false, verifiedAt: later },
					{ ...hall, verifiedAt: later },
				],
				'a',
				later,
				300000,
			),
			true,
		);
	});
	it('the final API facade rejects mutations even if a caller bypasses native authorization', async () => {
		const calls: string[] = [],
			port = readOnlyHmipPort({
				callRestApi: async (e, _b, opts) => {
					assert.deepEqual(opts, { heatingStrict: true, timeout: 15000 });
					calls.push(e);
					return {};
				},
			});
		await port.callRestApi('home/getCurrentState', {});
		await port.callRestApi('group/heating/getProfile', {});
		for (const endpoint of ['group/heating/updateProfile', 'device/setSwitchState', 'auth/requestToken']) {
			await assert.rejects(port.callRestApi(endpoint, {}), /read_only/);
		}
		assert.deepEqual(calls, ['home/getCurrentState', 'group/heating/getProfile']);
	});
});
