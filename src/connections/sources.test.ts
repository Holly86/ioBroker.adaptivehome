import { strict as assert } from 'node:assert';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SourceConnections, select } from './sources';
import { connectionSchema } from './schema';
import { getSourceJSON, readSourceFile, resolveSourceEndpoint } from './io';
import { normalize } from '../integrations/registry';
import { mappingSchema } from '../model/contracts';
import { referenceConfiguration } from '../config/examples';
import { validateConfiguration } from '../config/configuration';

describe('Anonymous source connections and device read evidence', () => {
	it('resolves a Hue read reference through its existing configuration without pairing or exporting credentials', async () => {
		const selected: string[] = [];
		const endpoint = (await resolveSourceEndpoint(
			{ kind: 'hue-lights', backendRef: 'hue.7' },
			async id => {
				selected.push(id);
				return { bridge: '127.0.0.1', port: 80, ssl: false, user: 'fixture-existing-key' };
			},
			() => {
				throw Error('Plain keys must not be decrypted');
			},
		)) as { origin: string; secret: string };
		assert.deepEqual(selected, ['hue.7']);
		assert.equal(endpoint.origin, 'http://127.0.0.1/');
		assert.equal(endpoint.secret, 'fixture-existing-key');
		await assert.rejects(
			resolveSourceEndpoint(
				{ kind: 'hue-lights', backendRef: 'hmip.0' },
				async () => ({}),
				v => v,
			),
		);
	});
	it('joins exact cached states without refreshing timestamps and decodes bounded JSON component feedback', async () => {
		const c = connectionSchema.parse({
			id: 'local',
			kind: 'state-map',
			enabled: true,
			inputs: [
				{ key: 'sample', stateId: 'fixture.0.value' },
				{ key: 'receipt', stateId: 'fixture.0.receipt' },
			],
			outputs: [
				{
					key: 'motion',
					type: 'number',
					path: ['values', 'sample'],
					jsonPath: [1],
					timestampPath: ['values', 'receipt'],
					requires: [
						{ path: ['valid', 'sample'], equals: true },
						{ path: ['valid', 'receipt'], equals: true },
					],
				},
			],
		});
		const s = new SourceConnections(
			'adaptivehome.7',
			{
				readFile: async () => null,
				getJSON: async () => {
					throw Error();
				},
				readState: async id => ({
					val: id.endsWith('receipt') ? 50000 : '[false,64]',
					ts: id.endsWith('receipt') ? 50000 : 1000,
					ack: true,
					q: 0,
				}),
			},
			() => 50000,
		);
		await s.refresh([c]);
		assert.equal(s.read('adaptivehome.7.connections.local.motion')?.val, 64);
		assert.equal(s.read('adaptivehome.7.connections.local.motion.verifiedAt')?.val, 50000);
	});
	it('applies finite optional-calendar gates only with complete fresh source evidence', async () => {
		const now = Date.UTC(2026, 0, 12, 10),
			c = connectionSchema.parse({
				id: 'local',
				kind: 'json-file',
				fileKey: 'report',
				enabled: true,
				outputs: [
					{
						key: 'motion',
						type: 'boolean',
						path: [],
						timestampPath: ['at'],
						requires: [{ path: ['complete'], equals: true }],
						transform: 'cases',
						defaultValue: true,
						cases: [
							{
								requires: [{ path: ['excluded'], equals: true }],
								value: false,
								window: { days: [1, 2, 3, 4, 5], start: '08:00', end: '16:00' },
								timezone: 'UTC',
							},
						],
					},
				],
			});
		const service = (complete: boolean) =>
			new SourceConnections(
				'adaptivehome.7',
				{
					readFile: async () => ({ at: now, complete, excluded: true }),
					readState: async () => null,
					getJSON: async () => {
						throw Error();
					},
				},
				() => now,
			);
		const valid = service(true);
		await valid.refresh([c]);
		assert.equal(valid.read('adaptivehome.7.connections.local.motion')?.val, false);
		const missing = service(false);
		await missing.refresh([c]);
		assert.equal(missing.read('adaptivehome.7.connections.local.motion')?.val, null);
	});
	const prefix = 'adaptivehome.7.connections.local.motion';
	const definition = () =>
		connectionSchema.parse({
			id: 'local',
			kind: 'json-file',
			fileKey: 'sample',
			enabled: true,
			intervalMs: 1000,
			maxAgeMs: 30000,
			outputs: [
				{
					key: 'motion',
					type: 'boolean',
					path: ['motion'],
					timestampPath: ['checkedAt'],
					eventTimestampPath: ['eventAt'],
					requires: [{ path: ['reachable'], equals: true }],
				},
			],
		});
	it('retains the old physical event and advances only real successful read evidence', async () => {
		let now = 2000000,
			doc = { motion: false, checkedAt: now, eventAt: 1000, reachable: true };
		const service = new SourceConnections(
				'adaptivehome.7',
				{
					readFile: async () => doc,
					readState: async () => null,
					getJSON: async () => {
						throw Error();
					},
				},
				() => now,
			),
			c = definition();
		await service.refresh([c]);
		const mapping = mappingSchema.parse({
			capability: 'motion',
			readId: prefix,
			valueType: 'boolean',
			maxAgeMs: 15000,
			eventTimestampId: `${prefix}.eventAt`,
			freshness: { verifiedAtId: `${prefix}.verifiedAt`, maxAgeMs: 30000 },
		});
		const observation = () =>
			normalize(referenceConfiguration('apartment').bindings[0], mapping, service.read(prefix), now, {
				verifiedAt: service.read(`${prefix}.verifiedAt`),
				event: service.read(`${prefix}.eventAt`),
			});
		assert.equal(observation().quality, 'valid');
		assert.equal(observation().measuredAt, 1000);
		now += 1000;
		doc = { ...doc, checkedAt: now };
		await service.refresh([c]);
		assert.equal(observation().quality, 'valid');
		assert.equal(observation().verifiedAt, now);
		assert.equal(observation().measuredAt, 1000);
		now += 31000;
		assert.equal(observation().quality, 'stale');
	});
	it('does not convert missing values, unreachable resources, future or regressed receipts into false', async () => {
		let now = 50000,
			document: unknown = { motion: false, checkedAt: now, eventAt: 1000, reachable: true };
		const s = new SourceConnections(
				'adaptivehome.7',
				{
					readFile: async () => document,
					readState: async () => null,
					getJSON: async () => {
						throw Error();
					},
				},
				() => now,
			),
			c = definition();
		await s.refresh([c]);
		assert.equal(s.read(prefix)?.val, false);
		for (const change of [
			() => ({ motion: null }),
			() => ({ reachable: false }),
			() => ({ eventAt: now + 1 }),
			() => ({ checkedAt: now + 1 }),
			() => ({ checkedAt: 49999 }),
		]) {
			now += 1000;
			document = { motion: false, checkedAt: 50000, eventAt: 1000, reachable: true, ...change() };
			await s.refresh([c]);
			assert.notEqual(s.read(prefix)?.q, 0);
		}
		assert.equal(select(JSON.parse('{"__proto__":{"x":1}}'), ['__proto__', 'x']), undefined);
	});
	it('invalidates independent outputs separately and clears evidence on read failure', async () => {
		let now = 50000,
			fail = false;
		const c = definition();
		c.outputs.push({ ...c.outputs[0], key: 'missing', path: ['missing'] });
		const s = new SourceConnections(
			'adaptivehome.7',
			{
				readFile: async () => {
					if (fail) {
						throw Error('sensitive path');
					}
					return { motion: true, checkedAt: now, eventAt: 49000, reachable: true };
				},
				readState: async () => null,
				getJSON: async () => {
					throw Error();
				},
			},
			() => now,
		);
		await s.refresh([c]);
		assert.equal(s.read(prefix)?.q, 0);
		assert.notEqual(s.read('adaptivehome.7.connections.local.missing')?.q, 0);
		fail = true;
		now += 1000;
		await s.refresh([c]);
		assert.equal(s.errors.local, 'source_unavailable');
		assert.equal(s.read(prefix)?.val, null);
	});
	it('breaks presence continuity on a source session change without replaying an edge', async () => {
		let now = 50000,
			session = 'first';
		const c = definition();
		c.outputs[0].sessionPath = ['session'];
		const s = new SourceConnections(
			'adaptivehome.7',
			{
				readFile: async () => ({ motion: true, checkedAt: now, eventAt: 1000, reachable: true, session }),
				readState: async () => null,
				getJSON: async () => {
					throw Error();
				},
			},
			() => now,
		);
		await s.refresh([c]);
		assert.equal(s.read(prefix)?.q, 0);
		now += 1000;
		session = 'second';
		await s.refresh([c]);
		assert.equal(s.read(prefix)?.val, null);
		now += 1000;
		await s.refresh([c]);
		assert.equal(s.read(prefix)?.q, 0);
	});
	it('rejects incomplete aggregate members and incomplete or duplicate forecast coverage', async () => {
		const now = 50000;
		let rows: unknown[] = [false, null];
		const c = connectionSchema.parse({
			id: 'local',
			kind: 'json-file',
			fileKey: 'sample',
			enabled: true,
			intervalMs: 1000,
			maxAgeMs: 30000,
			outputs: [{ key: 'motion', type: 'boolean', path: ['rows'], timestampPath: ['at'], transform: 'any' }],
		});
		const s = new SourceConnections(
			'adaptivehome.7',
			{
				readFile: async () => ({ rows, at: now }),
				readState: async () => null,
				getJSON: async () => {
					throw Error();
				},
			},
			() => now,
		);
		await s.refresh([c]);
		assert.equal(s.read(prefix)?.val, null);
		const f = structuredClone(c);
		f.outputs[0].type = 'number';
		f.outputs[0].transform = 'forecastMedian';
		f.outputs[0].forecast = { samples: 3, cadenceMs: 60000, horizonMs: 180000 };
		rows = [1, 2, 3].map(n => ({ at: now + n * 60000, temperature: n * 2 }));
		await s.refresh([f]);
		assert.equal(s.read(prefix)?.val, 4);
		for (const bad of [
			rows.slice(1),
			[rows[0], rows[0], rows[2]],
			[rows[0], rows[1], { at: now + 180000, temperature: 99 }],
		]) {
			const other = new SourceConnections(
				'adaptivehome.7',
				{
					readFile: async () => ({ rows: bad, at: now }),
					readState: async () => null,
					getJSON: async () => {
						throw Error();
					},
				},
				() => now,
			);
			await other.refresh([f]);
			assert.equal(other.read(prefix)?.val, null);
		}
	});
	it('discards an in-flight result from a replaced configuration', async () => {
		let resolve!: (v: unknown) => void;
		const s = new SourceConnections(
				'adaptivehome.7',
				{
					readFile: () =>
						new Promise(r => {
							resolve = r;
						}),
					readState: async () => null,
					getJSON: async () => {
						throw Error();
					},
				},
				() => 50000,
			),
			c = definition();
		const pending = s.refresh([c]);
		s.configure([]);
		resolve({ motion: true, checkedAt: 50000, eventAt: 1000, reachable: true });
		await pending;
		assert.equal(s.read(prefix), null);
		assert.equal(s.metadata(prefix), null);
	});
	it('reads only declared bounded files and never treats file modification time as evidence', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'adaptivehome-source-'));
		try {
			const file = join(dir, 'sample.json');
			await writeFile(file, '{"value":false}');
			assert.deepEqual(await readSourceFile('report', { report: file }), { value: false });
			await assert.rejects(readSourceFile('other', { report: file }), /not_declared/);
			const c = definition();
			c.outputs[0].timestampPath = undefined;
			const cfg = referenceConfiguration('apartment');
			cfg.connections = [c];
			assert.throws(() => validateConfiguration(cfg), /source_evidence_required/);
			await writeFile(file, Buffer.alloc(1048577));
			await assert.rejects(readSourceFile('report', { report: file }), /file_invalid/);
		} finally {
			await rm(dir, { recursive: true });
		}
	});
	it('uses only finite HTTP GET read routes and rejects vendor errors without reflecting secrets', async () => {
		const seen: { url: string; method: string; redirect: string }[] = [];
		const fetcher = (async (url: URL, options: RequestInit) => {
			seen.push({ url: url.toString(), method: String(options.method), redirect: String(options.redirect) });
			return new Response('{"relays":[{"ison":false}]}');
		}) as unknown as typeof fetch;
		const result = await getSourceJSON(
			{ kind: 'shelly-status', origin: 'http://127.0.0.1/', user: 'test', secret: 'fixture' },
			fetcher,
			() => 50000,
		);
		assert.equal(result.fetchedAt, 50000);
		assert.equal(seen[0].url, 'http://127.0.0.1/status');
		assert.equal(seen[0].method, 'GET');
		assert.equal(seen[0].redirect, 'error');
		await assert.rejects(
			getSourceJSON({ kind: 'shelly-status', origin: 'http://127.0.0.1/relay/0?turn=on' }, fetcher),
		);
		const error = (async () => new Response('[{"error":{"description":"secret"}}]')) as typeof fetch;
		await assert.rejects(
			getSourceJSON({ kind: 'hue-lights', origin: 'http://127.0.0.1/', secret: 'fixture' }, error),
			/source_read_rejected/,
		);
	});
});
