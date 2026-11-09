import { strict as assert } from 'node:assert';
import { getSourceJSON } from './io';
describe('Read-only Shelly identity preflight', () => {
	const endpoint = {
		kind: 'shelly-status',
		origin: 'http://127.0.0.1/',
		expectedDevice: { mac: 'AABBCCDDEEFF', model: 'synthetic-relay' },
	};
	it('requires the exact device before accepting a status read', async () => {
		const paths: string[] = [];
		const f = (async (u: URL, o: any) => {
			paths.push(u.pathname);
			assert.equal(o.method, 'GET');
			return new Response(
				JSON.stringify(
					u.pathname === '/shelly'
						? { mac: 'AA:BB:CC:DD:EE:FF', type: 'synthetic-relay' }
						: { relays: [{ ison: false }] },
				),
			);
		}) as any;
		await getSourceJSON(endpoint, f);
		assert.deepEqual(paths, ['/shelly', '/status']);
	});
	it('never queries status when physical identity differs', async () => {
		let calls = 0;
		await assert.rejects(
			getSourceJSON(endpoint, async () => {
				calls++;
				return new Response('{"mac":"001122334455","type":"synthetic-relay"}');
			}),
			/identity_mismatch/,
		);
		assert.equal(calls, 1);
	});
});
