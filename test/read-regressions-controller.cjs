const assert = require('node:assert/strict');
const { emptyConfiguration, validateConfiguration } = require('../build/config/configuration');
const { contextProfiles } = require('../build/integrations/context-profiles');
const { seed, preconfigure, operator, until, delay } = require('./controller-suite.cjs');

function defineReadRegressionTests({ suite }) {
	suite('Source-only regression through actual controller', getHarness => {
		it('processes derived proof, textual warning severity and a missing state without actuator commands', async function () {
			this.timeout(30000);
			const h = getHarness(),
				c = emptyConfiguration();
			c.connections = [
				{
					id: 'gate',
					enabled: true,
					kind: 'state-json',
					stateId: 'fixture.9.document',
					intervalMs: 1000,
					maxAgeMs: 60000,
					outputs: [
						{
							key: 'allowed',
							type: 'boolean',
							path: [],
							timestampPath: ['at'],
							transform: 'cases',
							defaultValue: false,
							cases: [{ requires: [{ path: ['enabled'], equals: true }], value: true }],
						},
					],
				},
			];
			c.bindings = [
				{
					id: 'gate',
					physicalId: 'anonymous-gate',
					integrationId: 'generic',
					family: 'Anonymous',
					backendVersion: 'test',
					capabilities: [
						{
							capability: 'context',
							valueType: 'boolean',
							readId: 'adaptivehome.0.connections.gate.allowed',
							freshness: {
								verifiedAtId: 'adaptivehome.0.connections.gate.allowed.verifiedAt',
								maxAgeMs: 60000,
							},
						},
					],
				},
			];
			const profiles = contextProfiles();
			const vacuum = profiles
				.find(p => p.id === 'mihome-vacuum')
				.discover({ 'mihome-vacuum.9.info.is_charging': { type: 'boolean', read: true } })[0];
			const warning = profiles
				.find(p => p.id === 'nina')
				.discover({ 'nina.9.region.warning.severity': { type: 'string', read: true } })[0];
			c.bindings.push(vacuum, warning);
			c.sources = [
				{ id: 'gate', kind: 'generic', ref: { entityId: 'gate', capability: 'context' } },
				{ id: 'charging', kind: 'generic', ref: { entityId: vacuum.id, capability: 'charging' } },
				{ id: 'warning', kind: 'generic', ref: { entityId: warning.id, capability: 'alertSeverity' } },
			];
			const cfg = validateConfiguration(c),
				receipt = Date.now() - 10000;
			await seed(h, cfg, { 'nina.9.region.warning.severity': 'Severe' });
			await new Promise((resolve, reject) =>
				h.states.delState('mihome-vacuum.9.info.is_charging', e => (e ? reject(e) : resolve())),
			);
			await h.objects.setObjectAsync('fixture.9.document', {
				type: 'state',
				common: { name: 'Anonymous document', type: 'string', read: true, write: false, role: 'json' },
				native: {},
			});
			await h.states.setStateAsync('fixture.9.document', {
				val: JSON.stringify({ at: receipt, enabled: true }),
				ack: true,
				ts: Date.now(),
			});
			await preconfigure(h, cfg);
			await h.startAdapterAndWait(true);
			const rpc = await operator(h);
			const status = await until(async () => {
				const r = (await rpc('status')).result;
				return r.sources.gate?.quality === 'valid' &&
					r.sources.warning?.value === 'Severe' &&
					r.sources.charging?.quality === 'unavailable'
					? r
					: null;
			}, 'three source-only observations');
			assert.equal(status.sources.gate.verifiedAt, receipt);
			assert.ok(status.sources.gate.measuredAt > receipt);
			assert.equal(status.commands.length, 0);
			await delay(2500);
			const history = JSON.parse((await h.states.getStateAsync('adaptivehome.0.journal.history')).val);
			assert.equal(history.observations.filter(o => o.sourceId === 'mihome-vacuum.9.info.is_charging').length, 1);
			assert.equal((await rpc('status')).result.commands.length, 0);
		});
	});
}
module.exports = { defineReadRegressionTests };
