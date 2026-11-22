const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { emptyConfiguration, validateConfiguration } = require('../build/config/configuration');
const { seed, preconfigure } = require('./controller-suite.cjs');

function defineShutdownTests({ suite }) {
	for (const [fault, legacy] of [
		['subscriptions', true],
		['disconnected', true],
		['disconnected', false],
	]) {
		suite(`Bounded adapter shutdown: ${fault} (${legacy ? 'legacy' : 'declared'} budget)`, getHarness => {
			it('exits cleanly inside the controller budget without bulk unsubscriptions or device commands', async function () {
				this.timeout(30000);
				const h = getHarness(),
					c = emptyConfiguration();
				// Many read-only bindings, with no rules, write IDs, sources or cloud connections.
				c.bindings = Array.from({ length: 320 }, (_, i) => ({
					id: `sensor-${i}`,
					physicalId: `anonymous-${i}`,
					integrationId: 'generic',
					family: 'Anonymous',
					backendVersion: 'test',
					capabilities: [
						{
							capability: 'temperatureSensor',
							valueType: 'number',
							unit: '°C',
							readId: `synthetic.0.sensor${i}`,
						},
					],
				}));
				const config = validateConfiguration(c);
				await seed(h, config);
				await preconfigure(h, config);
				const instance = await h.objects.getObjectAsync('system.adapter.adaptivehome.0');
				if (legacy) {
					// Existing installations keep their old metadata.
					delete instance.common.stopTimeout;
				} else {
					assert.equal(instance.common.stopTimeout, 3000);
				}
				await h.objects.setObjectAsync(instance._id, instance);
				const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptivehome-shutdown-'));
				const trace = path.join(dir, 'trace.txt');
				const before = await h.states.getStateAsync('adaptivehome.0.configuration.record');
				let deviceCommands = 0;
				const listener = (id, state) => {
					if (id.startsWith('synthetic.') && state && !state.ack) {
						deviceCommands++;
					}
				};
				h.on('stateChange', listener);
				try {
					await h.startAdapterAndWait(true, {
						NODE_OPTIONS: `--require="${path.join(__dirname, 'fixtures/shutdown-delay.cjs').replace(/\\/g, '/')}"`,
						ADAPTIVEHOME_SHUTDOWN_TRACE: trace,
						ADAPTIVEHOME_SHUTDOWN_FAULT: fault,
					});
					const budget = instance.common.stopTimeout || 1000,
						start = Date.now();
					let killed = false;
					// The testing harness normally waits 5s; reproduce the real host's stop deadline instead.
					const watchdog = setTimeout(() => {
						killed = true;
						h.adapterProcess?.kill('SIGKILL');
					}, budget);
					try {
						await h.stopAdapter();
					} finally {
						clearTimeout(watchdog);
					}
					const elapsed = Date.now() - start;
					const events = fs.readFileSync(trace, 'utf8').trim().split(/\r?\n/);
					console.log(
						`Isolated stop: ${elapsed}ms / ${budget}ms, exit=${h.adapterExit}, ${events.join(', ')}`,
					);
					assert.ok(
						events.includes('unsubscribe-count:0'),
						`Shutdown performed bulk unsubscriptions: ${events.join(', ')}`,
					);
					assert.equal(killed, false, `Host deadline exhausted after ${elapsed}ms`);
					assert.equal(typeof h.adapterExit, 'number', `Unexpected signal: ${h.adapterExit}`);
					assert.ok([0, 11].includes(h.adapterExit), `Unexpected exit code: ${h.adapterExit}`);
					assert.equal(events.filter(x => x === 'unload').length, 1);
					if (fault === 'disconnected') {
						assert.ok(events.includes('disconnect-pending'));
					}
					assert.equal(deviceCommands, 0);
					assert.equal((await h.states.getStateAsync('adaptivehome.0.configuration.record')).val, before.val);
					console.log(`Clean isolated shutdown: ${fault}, ${elapsed}ms / ${budget}ms, no device commands`);
				} finally {
					h.removeListener('stateChange', listener);
					fs.rmSync(dir, { recursive: true, force: true });
				}
			});
		});
	}
}
module.exports = { defineShutdownTests };
