import { strict as assert } from 'node:assert';
import { resolveSourceEndpoint, getSourceJSON } from './io';
describe('Protected source credential references', () => {
	it('resolves only a declared private file key and sends credentials only to the fixed status route', async () => {
		const input = {
			kind: 'shelly-status',
			origin: 'http://127.0.0.1/',
			credentialFile: { key: 'deviceAccess', userField: 'user', secretField: 'pass' },
		};
		const endpoint = await resolveSourceEndpoint(
			input,
			async () => {
				throw Error('No backend read');
			},
			v => v,
			async key => {
				assert.equal(key, 'deviceAccess');
				return { user: 'fixture', pass: 'test-secret' };
			},
		);
		const r = await getSourceJSON(endpoint, (async (url: any, options: any) => {
			assert.equal(url.pathname, '/status');
			assert.equal(options.method, 'GET');
			assert.equal(
				options.headers.Authorization,
				`Basic ${Buffer.from('fixture:test-secret').toString('base64')}`,
			);
			return new Response('{"relays":[{"ison":false}]}');
		}) as any);
		assert.ok(!JSON.stringify(input).includes('test-secret'));
		assert.ok(!JSON.stringify(r).includes('test-secret'));
	});
	it('rejects absent fields, prototype selectors, arbitrary paths and mixed direct/reference secrets', async () => {
		const base = {
			kind: 'shelly-status',
			origin: 'http://127.0.0.1/',
			credentialFile: { key: 'access', secretField: 'pass' },
		};
		for (const input of [
			base,
			{ ...base, secret: 'hidden' },
			{ ...base, origin: 'http://127.0.0.1/relay/0?turn=on' },
			{ ...base, credentialFile: { key: 'access', secretField: '__proto__' } },
		]) {
			await assert.rejects(
				resolveSourceEndpoint(
					input,
					async () => ({}),
					v => v,
					async () => ({}),
				),
			);
		}
	});
});
