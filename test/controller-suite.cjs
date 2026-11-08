const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { referenceConfiguration } = require('../build/config/examples');
let sequence = 0;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 12000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		const value = await check();
		if (value) {
			return value;
		}
		await delay(100);
	}
	throw new Error(`Timed out: ${label}`);
}
async function operator(harness) {
	const sender = 'system.adapter.admin.9';
	await harness.objects.setObjectAsync(sender, {
		type: 'instance',
		common: { name: 'admin', enabled: false },
		native: {},
	});
	await harness.states.subscribeMessage(sender);
	return (command, data = {}) =>
		new Promise((resolve, reject) => {
			const callbackId = ++sequence,
				timer = setTimeout(() => {
					harness.removeListener('stateChange', listener);
					reject(new Error(`No RPC response: ${command}`));
				}, 10000);
			const listener = (id, state) => {
				if (id !== `messagebox.${sender}` || state.callback?.id !== callbackId) {
					return;
				}
				clearTimeout(timer);
				harness.removeListener('stateChange', listener);
				resolve(state.message);
			};
			harness.on('stateChange', listener);
			harness.states.pushMessage(
				'system.adapter.adaptivehome.0',
				{
					command,
					message: data,
					from: sender,
					callback: { id: callbackId, ack: false, time: Date.now(), message: data },
				},
				error => {
					if (error) {
						clearTimeout(timer);
						harness.removeListener('stateChange', listener);
						reject(error);
					}
				},
			);
		});
}
function envelope(data, revision) {
	return {
		...data,
		requestId: `controller-${++sequence}`,
		expectedRevision: revision,
		expiresAt: Date.now() + 30000,
	};
}
async function seed(harness, config, overrides = {}) {
	for (const binding of config.bindings) {
		for (const mapping of binding.capabilities) {
			const value = Object.hasOwn(overrides, mapping.readId)
				? overrides[mapping.readId]
				: mapping.valueType === 'boolean'
					? false
					: mapping.capability === 'temperatureSensor'
						? 17
						: mapping.capability === 'airQuality'
							? 40
							: mapping.capability === 'illuminance'
								? 10
								: 0;
			for (const id of new Set([mapping.readId, mapping.writeId, mapping.confirmId].filter(Boolean))) {
				await harness.objects.setObjectAsync(id, {
					type: 'state',
					common: {
						name: 'Synthetic controller fixture',
						type: mapping.sourceType || mapping.valueType,
						unit: mapping.sourceUnit ?? mapping.unit,
						read: true,
						write: !!mapping.writeId,
						min: mapping.min,
						max: mapping.max,
					},
					native: { synthetic: true },
				});
				await harness.states.setStateAsync(id, {
					val: value,
					ack: true,
					ts: Date.now(),
					from: 'system.adapter.synthetic.0',
				});
			}
		}
	}
}
function emulator(harness, config) {
	const outputs = new Set(config.bindings.flatMap(b => b.capabilities.map(c => c.writeId).filter(Boolean))),
		writes = [];
	const listener = (id, state) => {
		if (!outputs.has(id) || !state || state.ack || !state.from?.startsWith('system.adapter.adaptivehome.')) {
			return;
		}
		writes.push({ id, value: state.val, at: Date.now() });
		void harness.states.setStateAsync(id, {
			val: state.val,
			ack: true,
			ts: Date.now(),
			from: 'system.adapter.synthetic.0',
		});
	};
	harness.on('stateChange', listener);
	return { writes, close: () => harness.removeListener('stateChange', listener) };
}
async function preconfigure(harness, config) {
	await harness.objects.setObjectAsync('adaptivehome.0.configuration.record', {
		type: 'state',
		common: { name: 'Configuration fixture', type: 'string', role: 'json', read: true, write: false },
		native: {},
	});
	await harness.states.setStateAsync('adaptivehome.0.configuration.record', {
		val: JSON.stringify({ active: config, previous: null, appliedRevision: config.revision }),
		ack: true,
	});
}
async function setJournal(harness, key, value) {
	await harness.objects.setObjectAsync(`adaptivehome.0.journal.${key}`, {
		type: 'state',
		common: { name: 'Private synthetic evidence', type: 'string', role: 'json', read: true, write: false },
		native: {},
	});
	await harness.states.setStateAsync(`adaptivehome.0.journal.${key}`, { val: JSON.stringify(value), ack: true });
}
function defineControllerTests({ suite }) {
	suite('S01–S20 actual controller capability execution', getHarness => {
		let harness, rpc;
		before(async () => {
			harness = getHarness();
			rpc = await operator(harness);
		});
		it('S02/S08/S11/S13: hot light-only setup, atomic rejection, future movement and confirmed quiet timeout', async function () {
			this.timeout(30000);
			const config = referenceConfiguration('apartment');
			config.functions = [config.functions[0]];
			config.functions[0].parameters.holdMs = 1000;
			config.bindings[0].capabilities[0].confirmation = 'device';
			await seed(harness, config);
			const device = emulator(harness, config);
			try {
				await harness.startAdapterAndWait(true);
				const applied = await rpc('applyConfiguration', envelope({ configuration: config }, 0));
				assert.equal(applied.ok, true, JSON.stringify(applied));
				const bad = structuredClone(applied.result);
				bad.functions[0].limits.min = 100;
				bad.functions[0].limits.max = 0;
				assert.equal((await rpc('applyConfiguration', envelope({ configuration: bad }, 1))).ok, false);
				await harness.states.setStateAsync('test.0.motion.motion', {
					val: true,
					ack: true,
					ts: Date.now() + 400,
					from: 'system.adapter.synthetic.0',
				});
				await until(
					() => device.writes.find(w => w.id === 'test.0.light.switch' && w.value === true),
					'future motion on',
				);
				await until(
					async () => (await rpc('status')).result.commands.some(c => c.deviceConfirmed),
					'device confirmation',
				);
				await harness.states.setStateAsync('test.0.motion.motion', {
					val: false,
					ack: true,
					ts: Date.now(),
					from: 'system.adapter.synthetic.0',
				});
				await until(() => device.writes.find(w => w.value === false), 'quiet off');
				const off = device.writes.find(w => w.value === false);
				assert.ok(off.at - device.writes[0].at >= 1000);
				assert.equal((await rpc('getConfiguration')).result.active.revision, 1);
			} catch (error) {
				fs.mkdirSync(path.join(__dirname, '../.local/evidence/AP-24'), { recursive: true });
				fs.writeFileSync(
					path.join(__dirname, '../.local/evidence/AP-24/light-failure.json'),
					JSON.stringify(
						{
							status: await rpc('status'),
							actual: await harness.states.getStateAsync('test.0.light.switch'),
							writes: device.writes,
						},
						null,
						2,
					),
				);
				throw error;
			} finally {
				device.close();
			}
		});
		it('S03/S18/S28: an independent essential output survives missing context while scheduled light turns off', async function () {
			this.timeout(20000);
			const config = referenceConfiguration('aquarium');
			config.functions[0].rules = [
				{
					id: 'night',
					enabled: true,
					block: 'minimum',
					value: false,
					priority: 1,
					conditions: [],
					windows: [],
					excludeDates: [],
				},
			];
			await seed(harness, config, { 'test.0.light.switch': true });
			const device = emulator(harness, config);
			try {
				const current = (await rpc('getConfiguration')).result.active.revision;
				assert.equal((await rpc('applyConfiguration', envelope({ configuration: config }, current))).ok, true);
				await rpc('resume', envelope({ functionId: 'light' }, current + 1));
				await until(
					() => device.writes.some(w => w.id === 'test.0.circulation.switch' && w.value === true),
					'essential circulation',
				);
				await until(
					() => device.writes.some(w => w.id === 'test.0.light.switch' && w.value === false),
					'night light off',
				);
				await new Promise((resolve, reject) =>
					harness.states.delState('test.0.motion.motion', error => (error ? reject(error) : resolve())),
				);
				await delay(1500);
				assert.equal((await harness.states.getStateAsync('test.0.circulation.switch')).val, true);
				const revision = (await rpc('getConfiguration')).result.active.revision;
				const rejected = await rpc('manual', envelope({ functionId: 'circulation', value: false }, revision));
				assert.equal(rejected.ok, false);
				assert.match(rejected.error, /minimum_service/);
			} finally {
				device.close();
			}
		});
		it('S04/S20: separate climate and air functions use actual state APIs and expose room-response evidence', async function () {
			this.timeout(20000);
			const config = referenceConfiguration('apartment'),
				air = referenceConfiguration('air');
			config.functions = [config.functions[1], ...air.functions];
			config.bindings.push(...air.bindings);
			await seed(harness, config);
			const device = emulator(harness, config);
			try {
				const revision = (await rpc('getConfiguration')).result.active.revision;
				assert.equal((await rpc('applyConfiguration', envelope({ configuration: config }, revision))).ok, true);
				await until(
					() => device.writes.some(w => w.id === 'test.0.thermostat.thermostatSetpoint' && w.value === 21),
					'climate setpoint',
				);
				await until(
					() => device.writes.some(w => w.id === 'test.0.purifier.fan' && w.value === 75),
					'air demand',
				);
				const status = (await rpc('status')).result;
				assert.equal(status.traces.climate.inputs.temperature.value, 17);
				assert.ok(status.traces.air);
			} finally {
				device.close();
			}
		});
		it('S10/S12/S19/S23/S36: manual priority, replay protection and restart never replay a device queue', async function () {
			this.timeout(25000);
			const config = referenceConfiguration('apartment');
			config.functions = [config.functions[0]];
			config.functions[0].limits.manualHoldMs = 10000;
			await seed(harness, config);
			const device = emulator(harness, config);
			try {
				const revision = (await rpc('getConfiguration')).result.active.revision;
				assert.equal((await rpc('applyConfiguration', envelope({ configuration: config }, revision))).ok, true);
				const payload = envelope({ functionId: 'light', value: true }, revision + 1);
				const first = await rpc('manual', payload);
				assert.equal(first.ok, true, JSON.stringify(first));
				assert.equal((await rpc('manual', payload)).ok, true);
				const count = device.writes.length;
				assert.equal(count, 1);
				await harness.stopAdapter();
				await harness.states.setStateAsync('system.adapter.adaptivehome.0.sigKill', { val: 0, ack: true });
				await harness.states.setStateAsync('system.adapter.adaptivehome.0.alive', { val: false, ack: true });
				await harness.states.setStateAsync('adaptivehome.0.info.connection', { val: false, ack: true });
				const restarted = new harness.constructor(harness.adapterDir, harness.testDir, harness.dbConnection);
				try {
					await restarted.startAdapterAndWait(true);
					await delay(1500);
					assert.equal(device.writes.length, count);
					const state = (await rpc('status')).result;
					assert.equal(state.commands.filter(c => c.intent.intentId === payload.requestId).length, 1);
				} finally {
					await restarted.stopAdapter();
				}
			} finally {
				device.close();
			}
		});
	});
	suite('S24–S32 full automation on js-controller with device emulator', getHarness => {
		it('trains in a worker, activates a new rule, confirms device feedback and rolls back degraded air quality', async function () {
			this.timeout(45000);
			const harness = getHarness(),
				config = referenceConfiguration('air'),
				fn = config.functions[0],
				now = Date.now(),
				day = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
			fn.autonomy = {
				...fn.autonomy,
				mode: 'full',
				granted: true,
				capabilities: ['fan'],
				blocks: ['schedule', 'sensor'],
				parameters: { threshold: { min: 25, max: 30 } },
				evaluateAfterMs: 5000,
				objectives: { comfort: 1, energy: 0, switching: 0 },
			};
			config.bindings[0].capabilities[0].confirmation = 'device';
			const observations = [];
			for (let d = 8; d >= 1; d--) {
				for (let slot = 0; slot < 48; slot++) {
					const at = day - d * 86400000 + slot * 1800000;
					observations.push({
						entityId: 'purifier',
						capability: 'airQuality',
						value: 40,
						unit: 'µg/m³',
						measuredAt: at,
						receivedAt: at,
						sourceId: 'test.0.purifier.airQuality',
						quality: 'valid',
					});
				}
			}
			for (let n = 3; n >= 1; n--) {
				const at = now - n * 1000;
				observations.push({
					entityId: 'purifier',
					capability: 'airQuality',
					value: 20,
					unit: 'µg/m³',
					measuredAt: at,
					receivedAt: at,
					sourceId: 'test.0.purifier.airQuality',
					quality: 'valid',
				});
			}
			await preconfigure(harness, config);
			await setJournal(harness, 'history', { version: 1, observations, events: [] });
			await seed(harness, config, { 'test.0.purifier.airQuality': 20 });
			const device = emulator(harness, config),
				rpc = await operator(harness);
			let airQuality = 20;
			const samples = setInterval(
				() =>
					void harness.states.setStateAsync('test.0.purifier.airQuality', {
						val: airQuality,
						ack: true,
						ts: Date.now(),
						from: 'system.adapter.synthetic.0',
					}),
				700,
			);
			try {
				await harness.startAdapterAndWait(true);
				const status = await until(
					async () => {
						const response = await rpc('status');
						const plan = response.result.learning.air?.plans.find(
							p => p.commandIds.length && p.deviceConfirmations,
						);
						return plan ? response.result : false;
					},
					'closed-loop device confirmation',
					20000,
				);
				assert.ok(status.learning.air.models.some(m => m.admitted));
				assert.ok(status.learning.air.plans[0].plan.rules.length);
				assert.ok(status.commands.some(c => c.intent.origin === 'learned_policy' && c.deviceConfirmed));
				airQuality = 45;
				const outcome = await until(
					async () => {
						const result = (await rpc('status')).result;
						return result.learning.air?.plans.find(p => p.rollbackReason === 'observed_outcome_degraded');
					},
					'measured quality rollback',
					15000,
				);
				assert.ok(outcome.effect.score > outcome.baseline.score);
				assert.equal(outcome.status, 'rolled_back');
			} catch (error) {
				fs.mkdirSync(path.join(__dirname, '../.local/evidence/AP-24'), { recursive: true });
				fs.writeFileSync(
					path.join(__dirname, '../.local/evidence/AP-24/adaptation-failure.json'),
					JSON.stringify(await rpc('status'), null, 2),
				);
				throw error;
			} finally {
				clearInterval(samples);
				device.close();
			}
		});
	});
	suite('S30 optional corruption isolation on js-controller', getHarness => {
		it('keeps classical control running while malformed optional clients/models/budgets are rejected', async function () {
			this.timeout(20000);
			const harness = getHarness(),
				config = referenceConfiguration('aquarium');
			await seed(harness, config);
			await preconfigure(harness, config);
			const instance = await harness.objects.getObjectAsync('system.adapter.adaptivehome.0');
			instance.native.controlClients = [{ invalid: true }];
			await harness.objects.setObjectAsync(instance._id, instance);
			await setJournal(harness, 'learning', { malformed: true });
			await setJournal(harness, 'providerBudgets', { malformed: true });
			await setJournal(harness, 'operations', { malformed: true });
			const device = emulator(harness, config),
				rpc = await operator(harness);
			try {
				await harness.startAdapterAndWait(true);
				await until(
					() => device.writes.some(w => w.id === 'test.0.circulation.switch' && w.value === true),
					'independent classical minimum',
				);
				assert.equal((await rpc('status')).ok, true);
				assert.equal(
					(await rpc('manual', envelope({ functionId: 'light', value: true }, 0))).error,
					'operation_journal_unavailable',
				);
			} finally {
				device.close();
			}
		});
	});
	if (process.env.ADAPTIVEHOME_SOAK === '1') {
		suite('S11 real five-minute quiet reference', getHarness => {
			it('waits five actual minutes before confirmed automatic switch-off', async function () {
				this.timeout(340000);
				const harness = getHarness(),
					config = referenceConfiguration('apartment');
				config.functions = [config.functions[0]];
				config.bindings[0].capabilities[0].confirmation = 'device';
				await seed(harness, config);
				await preconfigure(harness, config);
				const device = emulator(harness, config),
					rpc = await operator(harness);
				try {
					await harness.startAdapterAndWait(true);
					await harness.states.setStateAsync('test.0.motion.motion', {
						val: true,
						ack: true,
						ts: Date.now(),
						from: 'system.adapter.synthetic.0',
					});
					await until(() => device.writes.some(w => w.value === true), 'motion light on');
					const quietAt = Date.now();
					await harness.states.setStateAsync('test.0.motion.motion', {
						val: false,
						ack: true,
						ts: quietAt,
						from: 'system.adapter.synthetic.0',
					});
					await until(() => device.writes.some(w => w.value === false), 'five-minute quiet off', 315000);
					const off = device.writes.find(w => w.value === false);
					assert.ok(off.at - quietAt >= 300000);
					await until(
						async () =>
							(await rpc('status')).result.commands.some(
								c => c.intent.typedValue === false && c.deviceConfirmed,
							),
						'off device report',
					);
					fs.mkdirSync(path.join(__dirname, '../.local/evidence/AP-24'), { recursive: true });
					fs.writeFileSync(
						path.join(__dirname, '../.local/evidence/AP-24/quiet-soak.json'),
						JSON.stringify({
							quietAt,
							offAt: off.at,
							elapsedMs: off.at - quietAt,
							controller: '7.2.5',
							kind: 'synthetic device via actual controller',
						}),
					);
				} finally {
					device.close();
				}
			});
		});
	}
}
module.exports = { defineControllerTests, operator, seed, emulator, preconfigure, setJournal, until, envelope, delay };
