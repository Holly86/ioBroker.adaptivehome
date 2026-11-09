import { strict as assert } from 'node:assert';
import { EventEmitter } from 'node:events';
import { createHmipBackendHost, registerHmipBackendHost } from './hmip-host';
describe('Maintained HmIP backend registration', () => {
	const options = () => ({
		api: {
			callRestApi: async (endpoint: string) => {
				assert.equal(endpoint, 'home/getCurrentState');
				return { home: { id: 'home-a', connected: true }, groups: {}, devices: {} };
			},
		},
		clientCharacteristics: {},
		allowedSenders: ['system.adapter.adaptivehome.7'],
		targets: [],
	});
	it('registers finite reads without startup I/O, rejects writes and never implies hardware or expiry proof', async () => {
		let reads = 0;
		const o = options(),
			old = o.api.callRestApi;
		o.api.callRestApi = async e => {
			reads++;
			return old(e);
		};
		const h = createHmipBackendHost(o);
		assert.equal(reads, 0);
		const env = { from: o.allowedSenders[0], command: 'adaptivehomeCapabilities', message: {} };
		const c: any = (await h.handle(env)).result;
		assert.equal(c.mode, 'read-only');
		assert.equal(c.physicalAcceptanceVerified, false);
		assert.equal(c.absoluteExpiryRegistered, false);
		const r: any = (
			await h.handle({ ...env, command: 'adaptivehomeRead', message: { protocol: 'adaptivehome.read.v1' } })
		).result;
		assert.equal(r.document.home.id, 'home-a');
		assert.equal(reads, 1);
		await assert.rejects(
			h.handle({
				...env,
				command: 'adaptivehomeProfileRead',
				message: { protocol: 'adaptivehome.profile-read.v1', targetId: 'unconfigured' },
			}),
			/profile_read_invalid/,
		);
		await assert.rejects(
			h.handle({ ...env, command: 'adaptivehomeProfileRead', from: 'system.adapter.other.0', message: {} }),
			/sender/,
		);
		await h.handle({ ...env, command: 'adaptivehomeRead', message: { protocol: 'adaptivehome.read.v1' } });
		assert.equal(reads, 1);
		await assert.rejects(
			h.handle({ ...env, command: 'adaptivehomeNative', message: { operation: 'apply' } }),
			/read_only/,
		);
		await assert.rejects(h.handle({ ...env, from: 'system.adapter.other.0' }), /sender/);
		assert.equal((await h.handle({ ...env, command: 'other' })).handled, false);
		assert.throws(() => createHmipBackendHost({ ...o, mode: 'control' }), /ports_required/);
	});
	it('keeps unrelated backend messages intact and removes only its own handler', async () => {
		const events = new EventEmitter(),
			replies: any[] = [];
		const backend = Object.assign(events, { sendTo: (...args: any[]) => replies.push(args) });
		const original = () => {};
		events.on('message', original);
		const h = registerHmipBackendHost(backend, options());
		assert.equal(events.listenerCount('message'), 2);
		events.emit('message', {
			from: 'system.adapter.adaptivehome.7',
			command: 'adaptivehomeCapabilities',
			message: {},
			callback: { id: 1 },
		});
		await new Promise(r => setImmediate(r));
		assert.equal(replies.length, 1);
		assert.equal(replies[0][2].mode, 'read-only');
		h.close();
		assert.equal(events.listenerCount('message'), 1);
		assert.equal(events.listeners('message')[0], original);
	});
});
