const { referenceConfiguration } = require('../build/config/examples');
const definition = require('../examples/integrations/lumenlab.json');
const { seed, emulator, preconfigure, operator, until } = require('./controller-suite.cjs');
function defineSdkTests({ suite }) {
	suite('S06 independent manufacturer extension on js-controller', getHarness => {
		it('loads an explicit SDK profile and executes the unchanged lighting policy on new state structures', async function () {
			this.timeout(20000);
			const harness = getHarness(),
				config = referenceConfiguration('apartment');
			config.functions = [config.functions[0]];
			config.bindings = config.bindings.filter(b => ['light', 'motion'].includes(b.id));
			const paths = {
				switch: 'lumenlab.0.lamp.actuation.output',
				motion: 'lumenlab.0.sensor.sensing.occupied',
				illuminance: 'lumenlab.0.sensor.sensing.daylight',
			};
			for (const binding of config.bindings) {
				binding.integrationId = 'lumenlab';
				binding.family = 'Synthetic SDK fixture';
				for (const mapping of binding.capabilities) {
					mapping.readId = paths[mapping.capability];
					if (mapping.writeId) {
						mapping.writeId = paths[mapping.capability];
						mapping.confirmId = paths[mapping.capability];
					}
				}
			}
			const instance = await harness.objects.getObjectAsync('system.adapter.adaptivehome.0');
			instance.native.integrationProfiles = [definition];
			await harness.objects.setObjectAsync(instance._id, instance);
			await seed(harness, config);
			await preconfigure(harness, config);
			const device = emulator(harness, config),
				rpc = await operator(harness);
			try {
				await harness.startAdapterAndWait(true);
				await harness.states.setStateAsync(paths.motion, {
					val: true,
					ack: true,
					ts: Date.now(),
					from: 'system.adapter.synthetic.0',
				});
				await until(
					() => device.writes.some(w => w.id === paths.switch && w.value === true),
					'SDK light activation',
				);
				await until(
					async () => (await rpc('status')).result.commands.some(c => c.feedbackMatched),
					'SDK feedback',
				);
			} finally {
				device.close();
			}
		});
	});
}
module.exports = { defineSdkTests };
