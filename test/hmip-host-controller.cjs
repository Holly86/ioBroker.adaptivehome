const assert = require('node:assert/strict'),
	{ EventEmitter } = require('node:events');
const { registerHmipBackendHost } = require('../build/connections/hmip-host');
const { emptyConfiguration, validateConfiguration } = require('../build/config/configuration');
const { seed, preconfigure, operator, until, delay } = require('./controller-suite.cjs');
function defineHmipHostScenario(
	{ suite },
	{ apiReadDelayMs = 0, replyDelayMs = 0, recoveryTimeoutMs = 25000, label = '' } = {},
) {
	assert.ok(Number.isInteger(apiReadDelayMs) && apiReadDelayMs >= 0 && apiReadDelayMs <= 15000);
	assert.ok(Number.isInteger(replyDelayMs) && replyDelayMs >= 0 && replyDelayMs <= 4500);
	suite(`Read-only HmIP backend host through actual controller messages${label}`, getHarness => {
		it('registers read commands, processes the returned source and sends no actuator mutation', async function () {
			this.timeout(60000);
			const h = getHarness(),
				sender = 'system.adapter.hmip.9',
				events = new EventEmitter(),
				calls = [],
				callTimes = [],
				timeline = [],
				pendingDelays = new Map();
			let fail = true,
				closing = false;
			const trace = (kind, fields = {}) => {
				if (timeline.length < 256) {
					timeline.push({ at: Date.now(), kind, ...fields });
				}
			};
			const wait = ms =>
				new Promise(resolve => {
					const timer = setTimeout(() => {
						pendingDelays.delete(timer);
						resolve();
					}, ms);
					pendingDelays.set(timer, resolve);
				});
			const host = registerHmipBackendHost(
				Object.assign(events, {
					sendTo: async (to, command, result, callback) => {
						if (replyDelayMs) {
							await wait(replyDelayMs);
						}
						if (closing) {
							return;
						}
						trace('reply', {
							callbackId: callback.id,
							hasDocument: !!result.document,
							diagnostic: result.diagnostic,
						});
						h.states.pushMessage(to, {
							command,
							message: result,
							from: sender,
							callback: { ...callback, ack: true },
						});
					},
				}),
				{
					api: {
						callRestApi: async endpoint => {
							calls.push(endpoint);
							callTimes.push(Date.now());
							trace('api', { fail });
							if (fail) {
								throw Object.assign(Error('anonymous-provider-secret'), {
									status: 429,
									retryAfterMs: 3000,
								});
							}
							if (apiReadDelayMs) {
								await wait(apiReadDelayMs);
							}
							return {
								home: { id: 'synthetic-home', connected: true },
								groups: { room: { id: 'room', homeId: 'synthetic-home', actualTemperature: 20 } },
								devices: {},
							};
						},
					},
					clientCharacteristics: {},
					allowedSenders: ['system.adapter.adaptivehome.0'],
					targets: [],
					cacheMs: 1000,
				},
			);
			await h.objects.setObjectAsync(sender, {
				type: 'instance',
				common: { name: 'hmip', enabled: false, messagebox: true },
				native: { synthetic: true },
			});
			await h.states.subscribeMessage(sender);
			const listener = (id, msg) => {
				if (id === `messagebox.${sender}` && msg) {
					trace('request', { callbackId: msg.callback?.id });
					events.emit('message', msg);
				}
			};
			h.on('stateChange', listener);
			const c = emptyConfiguration();
			c.connections = [
				{
					id: 'backend',
					kind: 'backend-json',
					backend: 'hmip.9',
					enabled: true,
					intervalMs: 1000,
					maxAgeMs: 30000,
					outputs: [
						{
							key: 'temperature',
							type: 'number',
							unit: '°C',
							path: ['groups', 'room', 'actualTemperature'],
							timestampPath: ['at'],
						},
					],
				},
			];
			c.bindings = [
				{
					id: 'source',
					physicalId: 'synthetic-room-temperature',
					integrationId: 'generic',
					family: 'Synthetic backend',
					backendVersion: 'test',
					confirmed: false,
					verification: 'contract',
					capabilities: [
						{
							capability: 'temperatureSensor',
							readId: 'adaptivehome.0.connections.backend.temperature',
							valueType: 'number',
							unit: '°C',
							confirmation: 'none',
							freshness: {
								verifiedAtId: 'adaptivehome.0.connections.backend.temperature.verifiedAt',
								maxAgeMs: 30000,
							},
						},
					],
				},
			];
			c.sources = [
				{ id: 'temperature', kind: 'generic', ref: { entityId: 'source', capability: 'temperatureSensor' } },
			];
			const cfg = validateConfiguration(c);
			await seed(h, cfg);
			await preconfigure(h, cfg);
			try {
				await h.startAdapterAndWait(true);
				const rpc = await operator(h);
				const failed = await until(async () => {
					const r = await rpc('status');
					return r.result.sourceDiagnostics?.backend?.status === 429 ? r.result : null;
				}, 'safe source read diagnostic');
				assert.equal(failed.connections.sources.backend, 'source_rate_limited');
				assert.ok(!JSON.stringify(failed).includes('anonymous-provider-secret'));
				assert.equal(calls.length, 1);
				await delay(1000);
				assert.equal(calls.length, 1);
				fail = false;
				trace('recovery-enabled');
				let previous;
				const status = await until(
					async () => {
						const r = await rpc('status');
						const o = r.result.sources.temperature;
						const fingerprint = JSON.stringify([o?.quality, o?.value, r.result.sourceDiagnostics]);
						if (fingerprint !== previous) {
							trace('status', {
								quality: o?.quality,
								value: o?.value,
								diagnostics: r.result.sourceDiagnostics,
							});
							previous = fingerprint;
						}
						return o?.value === 20 && o.quality === 'valid' ? r.result : null;
					},
					'registered backend observation',
					recoveryTimeoutMs,
				).catch(async error => {
					const result = (await rpc('status')).result;
					console.error(
						'Synthetic read recovery diagnostic',
						JSON.stringify({
							calls,
							connections: result.connections,
							diagnostics: result.sourceDiagnostics,
							observation: result.sources.temperature,
							timeline,
						}),
					);
					throw error;
				});
				assert.equal(status.commands.length, 0);
				assert.equal(status.sourceDiagnostics.backend, undefined);
				assert.ok(callTimes[1] - callTimes[0] >= 3000);
				assert.equal(host.capabilities().controlEnabled, false);
				assert.ok(calls.length && calls.every(e => e === 'home/getCurrentState'));
				trace('verified', { apiCalls: calls.length, apiReadDelayMs, replyDelayMs });
				if (process.env.ADAPTIVEHOME_READ_DIAGNOSTICS === '1') {
					console.log('Read recovery timing', JSON.stringify(timeline));
				}
			} finally {
				closing = true;
				host.close();
				for (const [timer, resolve] of pendingDelays) {
					clearTimeout(timer);
					resolve();
				}
				pendingDelays.clear();
				h.removeListener('stateChange', listener);
				await h.states.unsubscribeMessage(sender);
			}
		});
	});
}
function defineHmipHostTests(context) {
	defineHmipHostScenario(context);
	// A supported backend read may take 15s; the former 12s recovery assertion was too short.
	defineHmipHostScenario(context, { apiReadDelayMs: 14000, label: ' with a slow existing API' });
}
module.exports = { defineHmipHostTests, defineHmipHostScenario };
