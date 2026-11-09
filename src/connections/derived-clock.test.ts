import { strict as assert } from 'node:assert';
import { SourceConnections } from './sources';
import { connectionSchema } from './schema';
describe('Time-derived changes preserve source proof', () => {
	it('advances a declared window without forging a receipt and rejects changed source data at the same receipt time', async () => {
		let now = Date.UTC(2026, 0, 12, 9, 59),
			enabled = true;
		const checkedAt = now - 60000;
		const c = connectionSchema.parse({
			id: 'window',
			kind: 'json-file',
			fileKey: 'source',
			enabled: true,
			intervalMs: 1000,
			maxAgeMs: 86400000,
			outputs: [
				{
					key: 'allowed',
					type: 'boolean',
					path: [],
					timestampPath: ['checkedAt'],
					transform: 'cases',
					defaultValue: false,
					cases: [
						{
							requires: [{ path: ['enabled'], equals: true }],
							window: { days: [1], start: '10:00', end: '11:00' },
							timezone: 'UTC',
							value: true,
						},
					],
				},
			],
		});
		const source = new SourceConnections(
				'adaptivehome.7',
				{
					readState: async () => null,
					readFile: async () => ({ checkedAt, enabled }),
					getJSON: async () => {
						throw Error();
					},
				},
				() => now,
			),
			p = 'adaptivehome.7.connections.window.allowed';
		await source.refresh([c]);
		assert.equal(source.read(p)?.val, false);
		now += 60000;
		await source.refresh([c]);
		assert.equal(source.read(p)?.val, true);
		assert.equal(source.read(`${p}.verifiedAt`)?.val, checkedAt);
		assert.equal(source.read(p)?.ts, now);
		enabled = false;
		now += 1000;
		await source.refresh([c]);
		assert.equal(source.read(p)?.val, null);
	});
	it('rolls a forecast sample window forward while preserving the original oldest source receipt', async () => {
		let now = 100000;
		const data: any = {
			checkedAt: 90000,
			points: Array.from({ length: 6 }, (_, i) => ({ at: 100000 + (i - 1) * 60000, lo: i, hi: i + 2 })),
		};
		const c = connectionSchema.parse({
			id: 'weather',
			kind: 'json-file',
			fileKey: 'source',
			enabled: true,
			intervalMs: 1000,
			maxAgeMs: 300000,
			outputs: [
				{
					key: 'median',
					type: 'number',
					path: [],
					transform: 'forecastMedian',
					forecast: {
						samples: 3,
						cadenceMs: 60000,
						horizonMs: 180000,
						points: data.points.map((_: unknown, i: number) => ({
							at: ['points', i, 'at'],
							minimum: ['points', i, 'lo'],
							maximum: ['points', i, 'hi'],
							timestamps: [['checkedAt']],
						})),
					},
				},
			],
		});
		const source = new SourceConnections(
				'adaptivehome.7',
				{
					readState: async () => null,
					readFile: async () => data,
					getJSON: async () => {
						throw Error();
					},
				},
				() => now,
			),
			p = 'adaptivehome.7.connections.weather.median';
		await source.refresh([c]);
		assert.equal(source.read(p)?.val, 4);
		now += 60000;
		await source.refresh([c]);
		assert.equal(source.read(p)?.val, 5);
		assert.equal(source.read(`${p}.verifiedAt`)?.val, 90000);
		data.points[4].hi += 10;
		now += 1000;
		await source.refresh([c]);
		assert.equal(source.read(p)?.val, null);
	});
});
