import { strict as assert } from 'node:assert';
import { EventEmitter } from 'node:events';
import { bindingSchema, mappingSchema } from '../model/contracts';
import { readObservation, normalize } from '../integrations/registry';
import { SourceConnections } from './sources';
import { connectionSchema } from './schema';
import { registerHmipBackendHost } from './hmip-host';
import { HmipSessionSource } from './hmip-session';
import { backendReadDocument, ReadBackoff, ReadFailure, readFailure } from './read-errors';
import { getSourceJSON } from './io';

describe('Anonymous read/shadow regressions', () => {
	it('waits once for a one-millisecond backend receipt without accepting a still-future or larger receipt', async () => {
		const c = connectionSchema.parse({
			id: 'receipt',
			kind: 'backend-json',
			backend: 'hmip.9',
			enabled: true,
			intervalMs: 1000,
			maxAgeMs: 30000,
			outputs: [{ key: 'value', type: 'number', path: ['value'], timestampPath: ['at'] }],
		});
		for (const [offset, advance, valid] of [
			[1, true, true],
			[1, false, false],
			[1000, true, false],
		] as const) {
			let now = 1000;
			const source = new SourceConnections(
				'adaptivehome.9',
				{
					readState: async () => null,
					readFile: async () => null,
					getJSON: async () => {
						throw Error('network_forbidden');
					},
					readBackend: async () => {
						if (advance)
							setTimeout(() => {
								now = 1002;
							}, 0);
						return { fetchedAt: 1000 + offset, document: { at: 1000 + offset, value: 20 } };
					},
				},
				() => now,
			);
			await source.refresh([c]);
			const value = source.read('adaptivehome.9.connections.receipt.value');
			assert.equal(value?.q === 0, valid);
			if (valid) {
				assert.equal(value?.val, 20);
				assert.equal(value?.ts, 1001);
				assert.equal(source.read('adaptivehome.9.connections.receipt.value.verifiedAt')?.val, 1001);
			}
		}
	});
	const mapping = (id: string) =>
		mappingSchema.parse({
			capability: 'context',
			readId: id,
			valueType: 'boolean',
			freshness: { verifiedAtId: `${id}.verifiedAt`, maxAgeMs: 60000 },
		});
	const binding = (id: string) =>
		bindingSchema.parse({
			id: 'anonymous',
			physicalId: 'anonymous',
			integrationId: 'generic',
			family: 'fixture',
			backendVersion: 'fixture',
			capabilities: [mapping(id)],
		});
	it('normalizes a fresh time-derived value against original evidence, including changes and expiry', async () => {
		let now = Date.UTC(2026, 0, 12, 9, 59);
		const receipt = now - 10000;
		const c = connectionSchema.parse({
			id: 'window',
			kind: 'json-file',
			fileKey: 'fixture',
			enabled: true,
			intervalMs: 1000,
			maxAgeMs: 180000,
			outputs: [
				{
					key: 'allowed',
					type: 'boolean',
					path: [],
					timestampPath: ['at'],
					transform: 'cases',
					defaultValue: false,
					cases: [
						{
							requires: [{ path: ['enabled'], equals: true }],
							value: true,
							window: { days: [1], start: '10:00', end: '11:00' },
							timezone: 'UTC',
						},
					],
				},
			],
		});
		const source = new SourceConnections(
			'adaptivehome.7',
			{
				readState: async () => null,
				readFile: async () => ({ at: receipt, enabled: true }),
				getJSON: async () => {
					throw Error('network_forbidden');
				},
			},
			() => now,
		);
		const id = 'adaptivehome.7.connections.window.allowed',
			b = binding(id),
			m = b.capabilities[0];
		m.freshness!.maxAgeMs = 180000;
		await source.refresh([c]);
		let o = await readObservation(
			b,
			m,
			async id => source.read(id),
			() => now,
		);
		assert.equal(o.quality, 'valid');
		assert.equal(o.value, false);
		assert.equal(o.verifiedAt, receipt);
		assert.equal(o.measuredAt, now);
		now += 60000;
		await source.refresh([c]);
		o = await readObservation(
			b,
			m,
			async id => source.read(id),
			() => now,
		);
		assert.equal(o.quality, 'valid');
		assert.equal(o.value, true);
		assert.equal(o.measuredAt, now);
		assert.equal(o.verifiedAt, receipt);
		// Plain foreign JSON cannot opt out of the timestamp ordering contract.
		assert.equal(
			normalize(b, m, { val: true, ts: now }, now, {
				verifiedAt: { val: receipt, ts: receipt, ack: true },
			}).quality,
			'unknown',
		);
		now += 180001;
		await source.refresh([c]);
		o = await readObservation(
			b,
			m,
			async id => source.read(id),
			() => now,
		);
		assert.notEqual(o.quality, 'valid');
	});

	it('never uses derived provenance to bypass the evidence ordering of an explicitly declared physical event', async () => {
		let now = 100000,
			receipt = 80000;
		const c = connectionSchema.parse({
			id: 'event',
			kind: 'json-file',
			fileKey: 'fixture',
			enabled: true,
			intervalMs: 1000,
			maxAgeMs: 60000,
			outputs: [
				{
					key: 'value',
					type: 'boolean',
					path: [],
					timestampPath: ['at'],
					eventTimestampPath: ['eventAt'],
					transform: 'cases',
					defaultValue: false,
					cases: [{ requires: [{ path: ['enabled'], equals: true }], value: true }],
				},
			],
		});
		const source = new SourceConnections(
			'adaptivehome.7',
			{
				readState: async () => null,
				readFile: async () => ({ at: receipt, eventAt: 90000, enabled: true }),
				getJSON: async () => {
					throw Error();
				},
			},
			() => now,
		);
		const id = 'adaptivehome.7.connections.event.value',
			b = binding(id),
			m = b.capabilities[0];
		m.eventTimestampId = `${id}.eventAt`;
		await source.refresh([c]);
		assert.equal(
			(
				await readObservation(
					b,
					m,
					async id => source.read(id),
					() => now,
				)
			).quality,
			'unknown',
		);
		now += 1000;
		receipt = 95000;
		await source.refresh([c]);
		const result = await readObservation(
			b,
			m,
			async id => source.read(id),
			() => now,
		);
		assert.equal(result.quality, 'valid');
		assert.equal(result.measuredAt, 90000);
		assert.equal(result.verifiedAt, 95000);
	});
	it('carries only sanitized backend status and wait facts through the real registered listener', async () => {
		let now = 100000,
			calls = 0;
		const events = new EventEmitter(),
			replies: any[] = [];
		const host = registerHmipBackendHost(
			Object.assign(events, { sendTo: (...args: any[]) => replies.push(args[2]) }),
			{
				api: {
					callRestApi: async endpoint => {
						assert.equal(endpoint, 'home/getCurrentState');
						calls++;
						throw Object.assign(Error('https://secret.invalid/token'), {
							status: 429,
							retryAfterMs: 60000,
							body: { token: 'never_expose' },
						});
					},
				},
				clientCharacteristics: {},
				allowedSenders: ['system.adapter.adaptivehome.7'],
				targets: [],
				now: () => now,
				cacheMs: 1000,
			},
		);
		const request = () =>
			events.emit('message', {
				from: 'system.adapter.adaptivehome.7',
				command: 'adaptivehomeRead',
				message: { protocol: 'adaptivehome.read.v1' },
				callback: { id: 1 },
			});
		request();
		await new Promise(r => setImmediate(r));
		assert.deepEqual(replies[0], {
			error: 'adaptivehome_backend_request_rejected',
			diagnostic: { code: 'source_rate_limited', status: 429, retryAfterMs: 60000 },
		});
		now += 1000;
		request();
		await new Promise(r => setImmediate(r));
		assert.equal(calls, 1);
		assert.equal(replies[1].diagnostic.retryAfterMs, 59000);
		assert.ok(!JSON.stringify(replies).includes('secret.invalid'));
		assert.ok(!JSON.stringify(replies).includes('never_expose'));
		host.close();
	});

	it('paces the producer and consumer, recovers without restart, and never returns cached success for a failed read', async () => {
		let now = 100000,
			calls = 0,
			fail = true;
		const session = new HmipSessionSource(
			{
				callRestApi: async () => {
					calls++;
					if (fail) {
						throw Object.assign(Error('provider_failure'), {
							code: 'HMIP_REST_COOLDOWN',
							retryAt: now + 60000,
						});
					}
					return { home: { id: 'fixture-home', connected: true }, groups: {}, devices: {} };
				},
			},
			{},
			() => now,
			1000,
		);
		const c = connectionSchema.parse({
			id: 'heat',
			kind: 'backend-json',
			backend: 'hmip.7',
			enabled: true,
			intervalMs: 1000,
			maxAgeMs: 60000,
			outputs: [{ key: 'online', type: 'boolean', path: ['home', 'connected'], timestampPath: ['at'] }],
		});
		let requests = 0;
		const source = new SourceConnections(
			'adaptivehome.7',
			{
				readState: async () => null,
				readFile: async () => {
					throw Error();
				},
				getJSON: async () => {
					throw Error();
				},
				readBackend: async () => {
					requests++;
					try {
						return await session.read();
					} catch (e) {
						return {
							error: 'adaptivehome_backend_request_rejected',
							diagnostic: readFailure(e, now).diagnostic,
						};
					}
				},
			},
			() => now,
		);
		await Promise.all([source.refresh([c]), source.refresh([c])]);
		assert.equal(calls, 1);
		assert.equal(requests, 1);
		assert.equal(source.read('adaptivehome.7.connections.heat.online')?.val, null);
		assert.equal(source.diagnostics.heat.code, 'source_rate_limited');
		for (let n = 0; n < 59; n++) {
			now += 1000;
			await source.refresh([c]);
		}
		assert.equal(requests, 1);
		await assert.rejects(session.read(), ReadFailure);
		assert.equal(calls, 1);
		now += 1000;
		fail = false;
		await source.refresh([c]);
		assert.equal(calls, 2);
		assert.equal(requests, 2);
		assert.equal(source.read('adaptivehome.7.connections.heat.online')?.val, true);
		assert.equal(source.errors.heat, undefined);
		assert.equal(source.diagnostics.heat, undefined);
	});

	it('does not shorten long server waits or let an older success erase a newer failure', () => {
		const backoff = new ReadBackoff(),
			version = backoff.version;
		backoff.failure(Object.assign(Error('fixture'), { retryAfterMs: 172800000 }), 10000, 1000);
		backoff.success(version);
		assert.equal(backoff.blocked(86410000)?.diagnostic.retryAfterMs, 86400000);
		assert.ok(backoff.blocked(9000));
		assert.equal(backoff.blocked(172810000), undefined);
	});

	it('rejects malformed and legacy backend errors without reflecting arbitrary metadata', () => {
		for (const reply of [
			{ error: 'private_text' },
			{ error: 'private_text', diagnostic: { code: 'secret', retryAfterMs: -1 } },
			null,
		]) {
			assert.throws(
				() => backendReadDocument(reply),
				(e: unknown) =>
					e instanceof ReadFailure &&
					e.diagnostic.code === 'source_unavailable' &&
					!JSON.stringify(e).includes('private_text'),
			);
		}
	});

	it('honors HTTP Retry-After seconds and dates without exposing URLs or response bodies', async () => {
		const now = Date.UTC(2026, 0, 12);
		for (const retry of ['60', new Date(now + 60000).toUTCString()]) {
			const fetcher = (async () =>
				new Response('private response body', {
					status: 429,
					headers: { 'retry-after': retry },
				})) as typeof fetch;
			await assert.rejects(
				getSourceJSON({ kind: 'shelly-status', origin: 'http://127.0.0.1/' }, fetcher, () => now),
				(e: unknown) =>
					e instanceof ReadFailure &&
					e.diagnostic.status === 429 &&
					e.diagnostic.retryAfterMs === 60000 &&
					!String(e).includes('private response body'),
			);
		}
	});
});
