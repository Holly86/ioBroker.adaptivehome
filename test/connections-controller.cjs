const assert = require('node:assert/strict');
const { referenceConfiguration } = require('../build/config/examples');
const { validateConfiguration } = require('../build/config/configuration');
const { seed, emulator, preconfigure, operator, until, delay } = require('./controller-suite.cjs');
function defineConnectionTests({ suite }) {
	suite('Read source connections through actual js-controller', getHarness => {
		it('projects a source document, uses independent read evidence and confirms a synthetic lighting command', async function () {
			this.timeout(30000);
			const harness = getHarness(),
				config = referenceConfiguration('apartment');
			config.functions = [config.functions[0]];
			config.bindings = config.bindings.filter(b => ['light', 'motion'].includes(b.id));
			config.connections = [
				{
					id: 'document',
					kind: 'state-json',
					stateId: 'fixture.0.readDocument',
					enabled: true,
					intervalMs: 1000,
					maxAgeMs: 30000,
					outputs: [
						{
							key: 'motion',
							type: 'boolean',
							path: ['motion'],
							timestampPath: ['checkedAt'],
							eventTimestampPath: ['motionAt'],
							requires: [{ path: ['reachable'], equals: true }],
						},
						{
							key: 'lux',
							type: 'number',
							unit: 'lx',
							path: ['lux'],
							timestampPath: ['checkedAt'],
							requires: [{ path: ['reachable'], equals: true }],
						},
					],
				},
			];
			for (const m of config.bindings.find(b => b.id === 'motion').capabilities) {
				const key = m.capability === 'motion' ? 'motion' : 'lux';
				m.readId = `adaptivehome.0.connections.document.${key}`;
				m.freshness = { verifiedAtId: `${m.readId}.verifiedAt`, maxAgeMs: 30000 };
				m.maxAgeMs = 1000;
				if (key === 'motion') {
					m.eventTimestampId = `${m.readId}.eventAt`;
				}
			}
			const checked = validateConfiguration(config);
			await seed(harness, checked);
			await preconfigure(harness, checked);
			await harness.objects.setObjectAsync('fixture.0.readDocument', {
				type: 'state',
				common: { name: 'Anonymous read document', type: 'string', read: true, write: false, role: 'json' },
				native: {},
			});
			const report = async (motion, motionAt) =>
				harness.states.setStateAsync('fixture.0.readDocument', {
					val: JSON.stringify({ motion, motionAt, lux: 2, checkedAt: Date.now(), reachable: true }),
					ts: Date.now(),
					ack: true,
					from: 'system.adapter.fixture.0',
				});
			await report(false, Date.now() - 600000);
			const device = emulator(harness, checked),
				rpc = await operator(harness);
			try {
				await harness.startAdapterAndWait(true);
				await until(
					async () =>
						(await rpc('status')).result.traces[checked.functions[0].id]?.inputs.motion?.quality ===
						'valid',
					'source projection',
				);
				const eventAt = Date.now();
				await report(true, eventAt);
				await until(() => device.writes.some(w => w.value === true), 'source-driven synthetic command');
				await until(
					async () => (await rpc('status')).result.commands.some(c => c.feedbackMatched),
					'source-driven declared backend feedback',
				);
				assert.equal((await rpc('status')).result.commands.at(-1).deviceConfirmed, false);
				await delay(1500);
				await report(true, eventAt);
				await until(async () => {
					const o = (await rpc('status')).result.traces[checked.functions[0].id]?.inputs.motion;
					return o?.quality === 'valid' && o.measuredAt === eventAt && o.verifiedAt > eventAt + 1000;
				}, 'unchanged event with actual refreshed proof');
				assert.equal(device.writes.filter(w => w.value === true).length, 1);
			} finally {
				device.close();
			}
		});
	});
}
module.exports = { defineConnectionTests };
