const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');

// Exercise the real compiled entry point with an anonymous ioBroker port, without a controller/network.
function adapter() {
	const entry = path.join(__dirname, '../build/main.js'),
		load = createRequire(entry);
	const writes = [],
		sent = [];
	class Port extends EventEmitter {
		constructor() {
			super();
			this.namespace = 'adaptivehome.0';
			this.config = {};
			this.log = { warn() {} };
		}
		async getStateAsync() {
			return null;
		}
		async setObjectNotExistsAsync() {}
		async setStateAsync(...args) {
			writes.push(args);
		}
		async setForeignStateAsync(...args) {
			writes.push(args);
		}
		sendTo(...args) {
			sent.push(args);
		}
	}
	let runtimePort;
	class Runtime {
		constructor(config, port) {
			runtimePort = port;
			this.executor = { invalidateAudit() {} };
			this.history = {};
		}
		async initialize() {}
		configure() {}
		close() {}
	}
	const module = { exports: {} };
	vm.runInNewContext(
		fs.readFileSync(entry, 'utf8'),
		{
			module,
			exports: module.exports,
			require: id =>
				id === '@iobroker/adapter-core'
					? { Adapter: Port }
					: id === './runtime/home'
						? { HomeRuntime: Runtime }
						: load(id),
			setInterval,
			clearInterval,
		},
		{ filename: entry },
	);
	const instance = module.exports();
	return { instance, writes, sent, port: () => runtimePort };
}
const stop = instance => new Promise(resolve => instance.emit('unload', resolve));

describe('Entry-point shutdown boundaries', function () {
	this.timeout(10000); // Includes loading the complete compiled adapter dependency tree.
	it('blocks new ticks, feedback and operator mutations after unload', async () => {
		const { instance, sent } = adapter();
		let work = 0;
		instance.runtime = { close() {}, tick: async () => work++, feedback: async () => work++ };
		await stop(instance);
		await instance.connectedTick();
		instance.emit('stateChange', 'synthetic.0.sensor', { val: 20, ack: true });
		await instance.message({ from: 'system.adapter.admin.9', command: 'manual', message: {}, callback: {} });
		await assert.rejects(instance.activateConfiguration({}), /adapter_stopping/);
		assert.equal(work, 0);
		assert.equal(sent.length, 0);
	});
	it('does not dispatch an operator request whose durable reservation finishes after unload', async () => {
		const { instance, sent } = adapter();
		let reserve,
			calls = 0;
		instance.guard = {
			isAdmin: () => true,
			reserve: () =>
				new Promise(resolve => {
					reserve = resolve;
				}),
			complete: async () => undefined,
		};
		instance.runtime = { close() {}, manual: async () => calls++ };
		const request = instance.message({
			from: 'system.adapter.admin.9',
			command: 'manual',
			message: {},
			callback: {},
		});
		await stop(instance);
		reserve({ key: 'anonymous-reservation' });
		await request;
		assert.equal(calls, 0);
		assert.equal(sent[0][2].error, 'adapter_stopping');
	});
	it('prevents late startup from creating a runtime or periodic work', async () => {
		const { instance } = adapter();
		let resume;
		instance.configuration.load = () =>
			new Promise(resolve => {
				resume = resolve;
			});
		const ready = instance.ready();
		await new Promise(resolve => setImmediate(resolve));
		await stop(instance);
		resume();
		await ready;
		assert.equal(instance.runtime, undefined);
		assert.equal(instance.timer, undefined);
	});
	it('rejects late device and native transport dispatch from an already running round', async () => {
		const { instance, writes, sent, port } = adapter();
		await instance.ready();
		await stop(instance);
		const count = writes.length;
		await assert.rejects(port().write('synthetic.0.output', true), /adapter_stopping/);
		await assert.rejects(port().writeNative('synthetic.0.profile', {}, Date.now() + 1000), /adapter_stopping/);
		assert.throws(() => instance.nativeConnections.port.send('synthetic.0', 'write', {}), /adapter_stopping/);
		assert.throws(() => instance.sourceConnections.port.readBackend('synthetic.0'), /adapter_stopping/);
		await assert.rejects(instance.sourceConnections.port.getJSON('unused-endpoint'), /adapter_stopping/);
		assert.throws(() => port().send('synthetic.0', 'notify', {}), /adapter_stopping/);
		assert.equal(writes.length, count);
		assert.equal(sent.length, 0);
	});
});
