const { referenceConfiguration } = require('../build/config/examples');
function variant(name, index) {
	const config = referenceConfiguration(name);
	config.timezone = ['America/New_York', 'Asia/Tokyo', 'Australia/Perth'][index];
	config.groups[0].name = ['Studio north', 'Botanical circulation', 'Workshop air'][index];
	for (const binding of config.bindings) {
		const integration =
			binding.id === 'motion'
				? 'hue'
				: binding.id === 'thermostat'
					? 'homematic-ccu'
					: binding.id === 'purifier'
						? 'philips-air'
						: 'shelly';
		const prefix =
			integration === 'homematic-ccu'
				? 'hm-rpc.17'
				: integration === 'philips-air'
					? 'philips-air.26'
					: integration === 'hue'
						? 'hue.33'
						: 'shelly.42';
		binding.integrationId = integration;
		binding.physicalId = `variant-${index}-${binding.id}`;
		binding.family = 'Synthetic generalization fixture';
		for (const mapping of binding.capabilities) {
			for (const key of ['readId', 'writeId', 'confirmId']) {
				if (mapping[key]) {
					mapping[key] = mapping[key].replace('test.0', prefix);
				}
			}
		}
	}
	const extra = structuredClone(config.bindings[0]);
	extra.id = 'additional';
	extra.physicalId += '-extra';
	for (const mapping of extra.capabilities) {
		for (const key of ['readId', 'writeId', 'confirmId']) {
			if (mapping[key]) {
				mapping[key] += '_extra';
			}
		}
	}
	config.bindings.push(extra);
	const fn = structuredClone(config.functions[0]);
	fn.id = 'additional';
	fn.name = 'Additional independent output';
	fn.actuator.entityId = extra.id;
	if (index === 1) {
		fn.kind = 'equipment';
		fn.operatingMode = 'continuous';
		fn.inputs = {};
		fn.rules = [];
	}
	if (index === 2) {
		fn.inputs.airQuality.entityId = extra.id;
	}
	config.functions.push(fn);
	for (const fn of config.functions) {
		fn.name = `${config.groups[0].name}: ${fn.name}`;
	}
	return config;
}
module.exports = { variant };
