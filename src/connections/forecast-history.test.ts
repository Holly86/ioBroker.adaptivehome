import { strict as assert } from 'node:assert';
import { SourceConnections } from './sources';
import { connectionSchema } from './schema';
import type { StateValue } from '../integrations/registry';

describe('Anonymous persistent forecast evidence', () => {
	function fixture() {
		let now = Date.UTC(2027, 3, 1),
			io = 0;
		const original = now,
			raw: Record<string, StateValue> = {};
		for (let i = 0; i < 40; i++) {
			for (const [part, value] of [
				['at', original + (i + 1) * 10800000],
				['lo', i],
				['hi', i + 2],
			] as const) {
				raw[`${part}${i}`] = { val: value, ts: original, ack: true, q: 0 };
			}
		}
		const c = connectionSchema.parse({
			id: 'weather',
			kind: 'state-map',
			enabled: true,
			intervalMs: 1000,
			maxAgeMs: 86400000,
			inputs: Object.keys(raw).map(key => ({ key, stateId: `weather.9.${key}` })),
			outputs: [
				{
					key: 'median',
					type: 'number',
					path: [],
					transform: 'forecastMedian',
					forecast: {
						samples: 24,
						cadenceMs: 10800000,
						horizonMs: 248400000,
						points: Array.from({ length: 40 }, (_, i) => ({
							at: ['values', `at${i}`],
							minimum: ['values', `lo${i}`],
							maximum: ['values', `hi${i}`],
							timestamps: [
								['timestamps', `at${i}`],
								['timestamps', `lo${i}`],
								['timestamps', `hi${i}`],
							],
						})),
					},
				},
			],
		});
		const forbidden = async (): Promise<never> => {
			io++;
			throw Error('unexpected_io');
		};
		const s = new SourceConnections(
			'adaptivehome.9',
			{
				readState: async id => raw[id.split('.').at(-1)!] ?? null,
				readFile: forbidden,
				getJSON: forbidden,
				readBackend: forbidden,
			},
			() => now,
		);
		return {
			s,
			c,
			raw,
			original,
			advance: (ms = 1000) => (now += ms),
			get now() {
				return now;
			},
			get io() {
				return io;
			},
			p: 'adaptivehome.9.connections.weather.median',
		};
	}
	it('ignores changes and invalid receipts outside the selected 24 of 40 points without locking the live projector', async () => {
		const f = fixture();
		await f.s.refresh([f.c]);
		assert.equal(f.s.read(f.p)?.val, 12.5);
		f.advance();
		f.raw.lo39 = { val: 40, ts: f.now, ack: true };
		f.raw.hi39 = { val: 42, ts: f.now, ack: true };
		for (let i = 0; i < 3; i++) {
			await f.s.refresh([f.c]);
			assert.equal(f.s.read(f.p)?.q, 0);
			f.advance();
		}
		f.raw.hi39.ts = f.now + 1000000;
		await f.s.refresh([f.c]);
		assert.equal(f.s.read(f.p)?.val, 12.5);
		assert.equal(f.s.read(`${f.p}.verifiedAt`)?.val, f.original);
		assert.equal(f.io, 0);
	});
	it('accepts staggered receipt-only refreshes without changing the oldest proof or evaluation event', async () => {
		const f = fixture();
		await f.s.refresh([f.c]);
		const event = f.s.read(f.p)?.ts;
		f.advance();
		f.raw.lo11.ts = f.now;
		await f.s.refresh([f.c]);
		assert.equal(f.s.read(f.p)?.q, 0);
		assert.equal(f.s.read(f.p)?.ts, event);
		assert.equal(f.s.read(`${f.p}.verifiedAt`)?.val, f.original);
	});
	it('accepts a selected field with its own new receipt even if another selected receipt remains oldest', async () => {
		const f = fixture();
		await f.s.refresh([f.c]);
		f.advance();
		f.raw.lo11 = { val: 13, ts: f.now, ack: true };
		await f.s.refresh([f.c]);
		assert.equal(f.s.read(f.p)?.val, 13);
		assert.equal(f.s.read(`${f.p}.verifiedAt`)?.val, f.original);
	});
	it('binds a two-receipt point to minimum and maximum separately', async () => {
		const f = fixture();
		for (const point of f.c.outputs[0].forecast!.points!) {
			point.timestamps = point.timestamps.slice(1);
		}
		await f.s.refresh([f.c]);
		f.advance();
		f.raw.lo11 = { val: 13, ts: f.now, ack: true };
		await f.s.refresh([f.c]);
		assert.equal(f.s.read(f.p)?.val, 13);
		f.advance();
		f.raw.hi11.val = 14;
		f.raw.lo11.ts = f.now;
		await f.s.refresh([f.c]);
		assert.equal(f.s.read(f.p)?.q, 1);
	});
	it('rejects silent selected changes even if the median stays unchanged or an unrelated receipt advances', async () => {
		for (const unrelated of [false, true]) {
			const f = fixture();
			await f.s.refresh([f.c]);
			f.advance();
			f.raw.lo0.val = 0.1;
			if (unrelated) {
				f.raw.hi0.ts = f.now;
			}
			await f.s.refresh([f.c]);
			assert.equal(f.s.read(f.p)?.val, null);
			f.advance();
			f.raw.lo0.ts = f.now;
			await f.s.refresh([f.c]);
			assert.equal(f.s.read(f.p)?.q, 0);
		}
	});
	it('rejects an individual receipt regression even when the oldest aggregate timestamp stays unchanged', async () => {
		const f = fixture();
		await f.s.refresh([f.c]);
		f.advance();
		f.raw.lo0.ts = f.now;
		await f.s.refresh([f.c]);
		f.advance();
		f.raw.lo0.ts = f.original;
		await f.s.refresh([f.c]);
		assert.equal(f.s.read(f.p)?.q, 1);
	});
	it('rejects a future selected receipt even when that point and the full window have an older valid minimum', async () => {
		const f = fixture();
		f.raw.hi0.ts = f.now + 1000;
		await f.s.refresh([f.c]);
		assert.equal(f.s.read(f.p)?.q, 1);
		f.advance();
		await f.s.refresh([f.c]);
		assert.equal(f.s.read(f.p)?.q, 0);
		assert.equal(f.s.read(`${f.p}.verifiedAt`)?.val, f.original);
	});
	it('does not launder a silently changed unused point when the clock later selects it', async () => {
		const f = fixture();
		await f.s.refresh([f.c]);
		f.advance();
		f.raw.lo24.val = 24.1;
		await f.s.refresh([f.c]);
		assert.equal(f.s.read(f.p)?.q, 0);
		f.advance(10800000);
		await f.s.refresh([f.c]);
		assert.equal(f.s.read(f.p)?.q, 1);
		f.advance();
		f.raw.lo24.ts = f.now;
		await f.s.refresh([f.c]);
		assert.equal(f.s.read(f.p)?.q, 0);
	});
	it('rolls the selected window without manufacturing a new source receipt and expires it without a fallback', async () => {
		const f = fixture();
		await f.s.refresh([f.c]);
		f.advance(10800000);
		await f.s.refresh([f.c]);
		assert.equal(f.s.read(f.p)?.val, 13.5);
		assert.equal(f.s.read(`${f.p}.verifiedAt`)?.val, f.original);
		f.advance(86400001);
		await f.s.refresh([f.c]);
		assert.equal(f.s.read(f.p)?.val, null);
		assert.equal(f.io, 0);
	});
});
