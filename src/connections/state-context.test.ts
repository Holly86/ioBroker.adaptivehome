import { strict as assert } from 'node:assert';
import { SourceConnections } from './sources';
import { connectionSchema } from './schema';
describe('Independent state-map forecast and evidence', () => {
	it('rejects an individual future receipt even when the oldest receipt looks recent', async () => {
		const c = connectionSchema.parse({
			id: 'proof',
			kind: 'json-file',
			fileKey: 'proof',
			enabled: true,
			outputs: [{ key: 'value', type: 'number', path: ['value'], timestampPaths: [['first'], ['second']] }],
		});
		const s = new SourceConnections(
			'adaptivehome.7',
			{
				readState: async () => null,
				readFile: async () => ({ value: 0.4, first: 190000, second: 210000 }),
				getJSON: async () => {
					throw Error();
				},
			},
			() => 200000,
		);
		await s.refresh([c]);
		assert.equal(s.read('adaptivehome.7.connections.proof.value')?.val, null);
	});
	it('uses only selected future samples and the oldest real receipt, without refreshing data on a cache read', async () => {
		let now = 100000;
		const values: any = {};
		for (let i = 0; i < 5; i++) {
			values[`f${i}`] = { val: now + (i - 1) * 60000, ts: 90000, ack: true };
			values[`l${i}`] = { val: i, ts: 90000, ack: true };
			values[`h${i}`] = { val: i + 2, ts: 92000, ack: true };
		}
		const c = connectionSchema.parse({
			id: 'forecast',
			kind: 'state-map',
			enabled: true,
			intervalMs: 1000,
			maxAgeMs: 30000,
			inputs: Object.keys(values).map(key => ({ key, stateId: `weather.7.${key}` })),
			outputs: [
				{
					key: 'median',
					type: 'number',
					unit: '°C',
					path: [],
					transform: 'forecastMedian',
					forecast: {
						samples: 3,
						cadenceMs: 60000,
						horizonMs: 179000,
						points: Array.from({ length: 5 }, (_, i) => ({
							at: ['values', `f${i}`],
							minimum: ['values', `l${i}`],
							maximum: ['values', `h${i}`],
							timestamps: [
								['timestamps', `f${i}`],
								['timestamps', `l${i}`],
								['timestamps', `h${i}`],
							],
						})),
					},
				},
			],
		});
		const s = new SourceConnections(
			'adaptivehome.7',
			{
				readState: async id => values[id.split('.').at(-1)!] || null,
				readFile: async () => null,
				getJSON: async () => {
					throw Error();
				},
			},
			() => now,
		);
		await s.refresh([c]);
		const p = 'adaptivehome.7.connections.forecast.median';
		assert.equal(s.read(p)?.val, 4);
		assert.equal(s.read(`${p}.verifiedAt`)?.val, 90000);
		now += 1000;
		await s.refresh([c]);
		assert.equal(s.read(`${p}.verifiedAt`)?.val, 90000);
		values.l3.ack = false;
		now += 1000;
		await s.refresh([c]);
		assert.equal(s.read(p)?.val, null);
	});
	it('requires every contributing timestamp for an aggregate', async () => {
		const c = connectionSchema.parse({
			id: 'v',
			kind: 'state-map',
			enabled: true,
			inputs: [
				{ key: 'a', stateId: 'valve.7.a' },
				{ key: 'b', stateId: 'valve.7.b' },
			],
			outputs: [
				{
					key: 'max',
					type: 'number',
					path: [],
					paths: [
						['values', 'a'],
						['values', 'b'],
					],
					timestampPaths: [
						['timestamps', 'a'],
						['timestamps', 'b'],
					],
					transform: 'maximum',
				},
			],
		});
		const s = new SourceConnections(
			'adaptivehome.7',
			{
				readState: async id => ({ val: 0.4, ts: id.endsWith('a') ? 1000 : 190000, ack: true }),
				readFile: async () => null,
				getJSON: async () => {
					throw Error();
				},
			},
			() => 200000,
		);
		await s.refresh([c]);
		assert.equal(s.read('adaptivehome.7.connections.v.max')?.val, null);
	});
});
