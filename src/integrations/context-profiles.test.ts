import { strict as assert } from 'node:assert';
import { contextProfiles } from './context-profiles';
import { builtInRegistry } from './profiles';
import { normalize } from './registry';
import { emptyConfiguration, validateConfiguration } from '../config/configuration';
import { HomeRuntime } from '../runtime/home';
import { ManualClock } from '../runtime/clock';

describe('Seven optional read-only backend connectors', () => {
	const cases: [string, string, string, string, string | undefined][] = [
		['mihome-vacuum', 'info.battery', 'batteryLevel', 'number', '%'],
		['radar2', 'selected_device._here', 'devicePresence', 'boolean', ''],
		['solarmanpv', 'inverter.APo_t1', 'power', 'number', 'W'],
		['openweathermap', 'forecast.period1.temperatureMin', 'temperatureSensor', 'number', '°C'],
		['nina', 'region.numberOfWarn', 'warningCount', 'number', ''],
		['harmony', 'hub.currentActivity', 'currentActivity', 'string', ''],
		['alexa2', 'Echo-Devices.synthetic.Player.currentState', 'mediaPlaying', 'boolean', ''],
	];
	for (const [id, suffix, capability, type, unit] of cases) {
		it(`normalizes ${id} data without granting a command path`, () => {
			const profile = contextProfiles().find(p => p.id === id)!,
				readId = `${id}.7.${suffix}`,
				objects = {
					[readId]: { type, unit, read: true, write: true, role: 'value' },
					[`${id}.7.Commands.start`]: { type: 'boolean', read: false, write: true, role: 'button' },
				};
			const bindings = profile.discover(objects);
			assert.equal(bindings.length, 1);
			const b = bindings[0],
				m = b.capabilities[0];
			assert.equal(m.capability, capability);
			assert.equal(m.writeId, undefined);
			assert.equal(b.confirmed, false);
			assert.equal(profile.readOnly, true);
			const val = type === 'boolean' ? false : type === 'number' ? 24 : 'Current activity';
			const o = normalize(b, m, { val, ts: 10000, ack: true }, 11000);
			assert.equal(o.quality, 'valid');
			assert.equal(o.value, val);
			assert.equal(normalize(b, m, { val, ts: 10000, ack: false }, 11000).quality, 'unknown');
			assert.equal(normalize(b, m, null, 11000).quality, 'unavailable');
			m.writeId = readId;
			m.confirmId = readId;
			m.confirmation = 'backend';
			assert.throws(() => builtInRegistry().validate(b), /read_only/);
		});
	}
	it('rejects wrong units and secret/control fields, converts only declared PV units and preserves stale radar false', () => {
		const p = contextProfiles(),
			pv = p.find(p => p.id === 'solarmanpv')!,
			solar = pv.discover({ 'solarmanpv.23.device.power': { type: 'number', unit: 'kW', read: true } })[0];
		assert.equal(normalize(solar, solar.capabilities[0], { val: 1.2, ts: 10000, ack: true }, 11000).value, 1200);
		assert.equal(
			pv.discover({ 'solarmanpv.23.device.power': { type: 'number', unit: 'A', read: true } }).length,
			0,
		);
		assert.equal(
			p
				.find(p => p.id === 'mihome-vacuum')!
				.discover({
					'mihome-vacuum.2.auth.loginUrl': { type: 'string', read: true },
					'mihome-vacuum.2.control.start': { type: 'boolean', read: true, write: true, role: 'button' },
				}).length,
			0,
		);
		const r = p
			.find(p => p.id === 'radar2')!
			.discover({ 'radar2.4.member._here': { type: 'boolean', read: true } })[0];
		assert.equal(normalize(r, r.capabilities[0], { val: false, ts: 1000, ack: true }, 1000000).quality, 'stale');
		assert.equal(r.capabilities[0].capability, 'devicePresence');
	});
	it('processes selected source-only installations through the real runtime without a device writer', async () => {
		const clock = new ManualClock(10000),
			cfg = emptyConfiguration(),
			profile = contextProfiles().find(p => p.id === 'radar2')!,
			b = profile.discover({ 'radar2.7.device._here': { type: 'boolean', read: true } })[0];
		cfg.bindings = [b];
		cfg.sources = [
			{
				id: 'deviceObservation',
				enabled: true,
				kind: 'generic',
				ref: { entityId: b.id, capability: 'devicePresence' },
				absenceConfirmMs: 300000,
				presenceConfirmations: 1,
			},
		];
		validateConfiguration(cfg, builtInRegistry());
		let writes = 0;
		const runtime = new HomeRuntime(
			() => cfg,
			{
				read: async () => ({ val: false, ts: 9000, ack: true }),
				metadata: async () => ({ type: 'boolean', read: true }),
				write: async () => {
					writes++;
				},
				persist: async () => undefined,
			},
			clock,
		);
		await runtime.initialize();
		await runtime.tick();
		assert.equal(runtime.sourceObservations.deviceObservation.value, false);
		assert.equal(runtime.history.record.observations.length, 1);
		assert.equal(writes, 0);
		runtime.close();
	});
});
