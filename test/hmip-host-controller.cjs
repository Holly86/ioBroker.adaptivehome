const assert = require('node:assert/strict'),
	{ EventEmitter } = require('node:events');
const { registerHmipBackendHost } = require('../build/connections/hmip-host');
const { emptyConfiguration, validateConfiguration } = require('../build/config/configuration');
const { seed, preconfigure, operator, until } = require('./controller-suite.cjs');
function defineHmipHostTests({ suite }) {
	suite('Read-only HmIP backend host through actual controller messages', getHarness => {
		it('registers read commands, processes the returned source and sends no actuator mutation', async function () {
			this.timeout(30000);
			const h = getHarness(),
				sender = 'system.adapter.hmip.9',
				events = new EventEmitter(),
				calls = [];
			const host = registerHmipBackendHost(
				Object.assign(events, {
					sendTo: (to, command, result, callback) =>
						h.states.pushMessage(to, {
							command,
							message: result,
							from: sender,
							callback: { ...callback, ack: true },
						}),
				}),
				{
					api: {
						callRestApi: async endpoint => {
							calls.push(endpoint);
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
				const status = await until(async () => {
					const r = await rpc('status');
					return r.result.sources.temperature?.value === 20 ? r.result : null;
				}, 'registered backend observation');
				assert.equal(status.commands.length, 0);
				assert.equal(host.capabilities().controlEnabled, false);
				assert.ok(calls.length && calls.every(e => e === 'home/getCurrentState'));
			} finally {
				host.close();
				h.removeListener('stateChange', listener);
				await h.states.unsubscribeMessage(sender);
			}
		});
	});
}
module.exports = { defineHmipHostTests };
