const assert = require('node:assert/strict');
const { EventEmitter, once } = require('node:events');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const sdk = require('../build/integrations/sdk');
const { nativeTransportSchema } = require('../build/connections/schema');
const { emptyConfiguration } = require('../build/config/configuration');
const { operator, seed, preconfigure, envelope } = require('./controller-suite.cjs');

function defineMaintenanceTests({ suite }) {
	suite('Isolated manual commissioning through real controller messages', getHarness => {
		it('executes only a granted step through Admin, adapter gateway and maintained backend', async function () {
			this.timeout(40000);
			const h = getHarness(),
				cfg = emptyConfiguration(),
				at = Date.now(),
				backend = 'system.adapter.hmip.8';
			const target = nativeTransportSchema.parse({
				id: 'test',
				enabled: true,
				strategy: 'timed-lease',
				backend: 'hmip.8',
				groupId: 'group-fixture',
				physicalId: 'physical-fixture',
				profileIndex: 'PROFILE_3',
				memberIds: ['member-fixture'],
				min: 15,
				max: 23,
			});
			const profile = {
				id: 'profile-fixture',
				groupId: target.groupId,
				homeId: 'home-fixture',
				index: 'PROFILE_3',
				name: 'Fallback',
				type: 'HEATING_COOLING',
				profileDays: Object.fromEntries(
					['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map(d => [
						d,
						{ baseValue: 17, periods: [] },
					]),
				),
			};
			const group = {
				id: target.groupId,
				homeId: profile.homeId,
				type: 'HEATING',
				channels: [{ deviceId: 'member-fixture' }],
				profiles: {
					PROFILE_3: { profileId: profile.id, name: profile.name, enabled: true, index: 'PROFILE_3' },
				},
				activeProfile: 'PROFILE_3',
				controlMode: 'AUTOMATIC',
				unreach: false,
				boostMode: false,
				partyMode: false,
				windowState: 'CLOSED',
				setPointTemperature: 17,
				lastStatusUpdate: at,
			};
			const member = {
				id: 'member-fixture',
				type: 'HEATING_THERMOSTAT',
				modelType: 'synthetic-valve',
				lastStatusUpdate: at,
				functionalChannels: [
					{ configPending: false, unreach: false, lowBat: false },
					{ setPointTemperature: 17 },
				],
			};
			const climate = { absenceType: 'NOT_ABSENT' },
				calls = [];
			const grant = {
				id: 'controller-grant',
				operator: 'system.adapter.admin.9',
				createdAt: at,
				expiresAt: at + 1800000,
				configurationHash: sdk.heatingFingerprint(cfg),
				packageHash: 'b'.repeat(64),
				homeId: profile.homeId,
				timezone: 'UTC',
				maxCommands: 1,
				maxLeaseMs: 900000,
				steps: ['one'],
				targets: [
					{
						targetId: target.id,
						physicalId: target.physicalId,
						profileHash: sdk.heatingFingerprint(profile),
						memberIds: target.memberIds,
						values: [19],
					},
				],
			};
			const store = await sdk.MaintenanceStore.open(
				fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-commission-controller-')),
			);
			const events = new EventEmitter(),
				host = sdk.registerHmipBackendHost(
					Object.assign(events, {
						sendTo: (to, command, message, callback) =>
							h.states.pushMessage(to, {
								command,
								message,
								from: backend,
								callback: { ...callback, ack: true },
							}),
					}),
					{
						mode: 'commission',
						targets: [target],
						allowedSenders: ['system.adapter.adaptivehome.0'],
						clientCharacteristics: {},
						authorize: async () => true,
						commissioning: {
							grant,
							authority: async () => ({
								at: Date.now(),
								operator: grant.operator,
								grantId: grant.id,
								present: true,
								exclusive: true,
								revoked: false,
								configurationHash: grant.configurationHash,
								packageHash: grant.packageHash,
							}),
							persist: j => store.save(j),
						},
						api: {
							callRestApi: async (endpoint, body) => {
								calls.push(endpoint);
								if (endpoint === 'home/getCurrentState') {
									return {
										home: {
											id: profile.homeId,
											connected: true,
											functionalHomes: { INDOOR_CLIMATE: climate },
										},
										groups: { [group.id]: group },
										devices: { [member.id]: member },
									};
								}
								if (endpoint === 'group/heating/getProfile') {
									return profile;
								}
								if (endpoint === 'group/heating/activatePartyMode') {
									group.partyMode = true;
									group.setPointTemperature = body.temperature;
									group.lastStatusUpdate = Date.now();
									member.functionalChannels[1].setPointTemperature = body.temperature;
									member.lastStatusUpdate = Date.now();
									climate.absenceType = 'PARTY';
									climate.absenceEndTime = body.endTime;
									return {};
								}
								throw Error('unexpected API');
							},
						},
					},
				);
			await h.objects.setObjectAsync(backend, {
				type: 'instance',
				common: { name: 'hmip', enabled: false, messagebox: true },
				native: { synthetic: true },
			});
			await h.states.subscribeMessage(backend);
			const listener = (id, msg) => {
				if (id === `messagebox.${backend}` && msg) {
					events.emit('message', msg);
				}
			};
			h.on('stateChange', listener);
			await seed(h, cfg);
			await preconfigure(h, cfg);
			const object = await h.objects.getObjectAsync('system.adapter.adaptivehome.0');
			object.native.commissioningEnabled = true;
			object.native.commissioningBackend = 'hmip.8';
			await h.objects.setObjectAsync(object._id, object);
			try {
				await h.startAdapterAndWait(true);
				const rpc = await operator(h),
					now = Date.now(),
					end = Math.floor((now + 900000) / 300000) * 300000;
				const program = {
					protocol: 'adaptivehome.native-heating.v1',
					strategy: 'timed-lease',
					commandId: 'controller-one',
					physicalId: target.physicalId,
					profileId: 'PROFILE_3',
					createdAt: now,
					activateAt: Math.floor(now / 60000) * 60000,
					expiresAt: end,
					timezone: 'UTC',
					target: 19,
					fallback: 17,
					days: Array.from({ length: 7 }, (_, day) => ({ day, base: 17, periods: [] })),
				};
				const request = {
					protocol: 'adaptivehome.commission.v1',
					operation: 'step',
					operator: 'forged operator overwritten by gateway',
					grantId: grant.id,
					targetId: target.id,
					stepId: 'one',
					program,
					deadline: now + 25000,
				};
				const payload = envelope({ request }, cfg.revision),
					response = await rpc('commission', payload);
				assert.equal(response.ok, true, JSON.stringify(response));
				assert.equal(response.result.physicalAcceptanceGranted, false);
				assert.equal(response.result.observation.report.absoluteExpiryVerified, false);
				assert.equal(calls.filter(x => x === 'group/heating/activatePartyMode').length, 1);
				await rpc('commission', payload);
				assert.equal(calls.filter(x => x === 'group/heating/activatePartyMode').length, 1);
				const persisted = await store.read();
				assert.equal(persisted.steps.one.phase, 'accepted');
				assert.equal(host.capabilities().controlEnabled, false);
				fs.writeFileSync(
					path.join(
						__dirname,
						'../.local/evidence/AP-26/manual-coordinator-20261110/controller-commission-proof.json',
					),
					JSON.stringify({
						realController: true,
						adminGateway: true,
						persistedBeforeSend: true,
						syntheticNativeMutations: 1,
						physicalAcceptanceGranted: false,
						productionAccess: false,
					}),
				);
			} finally {
				host.close();
				h.removeListener('stateChange', listener);
				await h.states.unsubscribeMessage(backend);
				await store.close();
			}
		});
	});
	suite('Isolated executable lifecycle handoff with real child processes', getHarness => {
		it('stops old process, transfers real state-store wishes, starts new, then reverses without overlap', async function () {
			this.timeout(40000);
			const h = getHarness(),
				ids = { old: '1'.repeat(64), next: '2'.repeat(64) },
				children = {},
				calls = [],
				imported = { old: { p: null }, next: { p: null } };
			const start = id => {
				const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
					windowsHide: true,
					stdio: 'ignore',
				});
				children[id] = child;
				return child;
			};
			const isRunning = id =>
				!!children[id] && children[id].exitCode === null && children[id].signalCode === null;
			start(ids.old);
			const server = createServer(async (req, res) => {
				try {
					const m = req.url.match(/^\/containers\/([a-f0-9]{64})\/(json|start|stop\?t=5)$/);
					assert.ok(m);
					const id = m[1];
					assert.ok(Object.values(ids).includes(id));
					calls.push({ method: req.method, path: req.url });
					if (m[2] === 'json') {
						res.end(JSON.stringify({ Id: id, State: { Running: isRunning(id), Restarting: false } }));
						return;
					}
					if (m[2] === 'start') {
						assert.ok(!Object.values(ids).some(x => x !== id && isRunning(x)));
						start(id);
					} else if (isRunning(id)) {
						const child = children[id];
						const exited = once(child, 'exit');
						child.kill();
						await exited;
					}
					res.statusCode = 204;
					res.end();
				} catch (e) {
					res.statusCode = 500;
					res.end(JSON.stringify({ error: e.message }));
				}
			});
			await new Promise(r => server.listen(0, '127.0.0.1', r));
			const lifecycle = Object.fromEntries(
				Object.entries(ids).map(([name, containerId]) => [
					name,
					sdk.dockerWriterLifecycle({ containerId, port: server.address().port, timeoutMs: 5000 }),
				]),
			);
			const at = Date.now(),
				wish = { at: at - 1000, until: at + 3600000, actor: 'human-fixture', value: false };
			let profile = 'c'.repeat(64);
			const plan = {
				protocol: 'adaptivehome.handoff.v1',
				id: 'controller-handoff',
				createdAt: at,
				expiresAt: at + 300000,
				configurationHash: 'a'.repeat(64),
				packageHash: 'b'.repeat(64),
				targets: [
					{
						physicalId: 'p',
						oldWriter: 'old',
						newWriter: 'next',
						baselineHash: profile,
						rollbackProfileHash: 'd'.repeat(64),
						manualRevision: sdk.manualWishRevision(wish),
						requiresNativeExpiry: true,
					},
				],
			};
			const wishId = 'adaptivehome.0.maintenanceFixture.wishes';
			await h.objects.setObjectAsync(wishId, {
				type: 'state',
				common: {
					name: 'Synthetic maintenance wishes',
					type: 'string',
					role: 'json',
					read: true,
					write: false,
				},
				native: {},
			});
			await h.states.setStateAsync(wishId, { val: JSON.stringify(wish), ack: true });
			const observe = async () => {
				const current = JSON.parse((await h.states.getStateAsync(wishId)).val);
				return {
					at: Date.now(),
					configurationHash: plan.configurationHash,
					packageHash: plan.packageHash,
					writers: await Promise.all(
						['old', 'next'].map(async id => ({
							id,
							running: await lifecycle[id].running(),
							physicalIds: ['p'],
						})),
					),
					targets: [
						{
							physicalId: 'p',
							profileHash: profile,
							manualRevision: sdk.manualWishRevision(current),
							nativeExpiryVerified: true,
							fallbackVerified: true,
							feedbackVerified: true,
							nativeLeaseActive: false,
						},
					],
					manualWishes: { p: current },
				};
			};
			const writers = ['old', 'next'].map(id => ({
				id,
				physicalIds: ['p'],
				...lifecycle[id],
				importManualWishes: async wishes => {
					imported[id] = wishes;
					await h.states.setStateAsync(`adaptivehome.0.maintenanceFixture.${id}`, {
						val: JSON.stringify(wishes),
						ack: true,
					});
				},
				readManualWishes: async () => {
					const s = await h.states.getStateAsync(`adaptivehome.0.maintenanceFixture.${id}`);
					return s ? JSON.parse(s.val) : { p: null };
				},
			}));
			const store = await sdk.MaintenanceStore.open(
					fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-handoff-controller-')),
				),
				executor = new sdk.RegisteredHandoffExecutor(
					writers,
					[
						{
							physicalId: 'p',
							profileHash: 'd'.repeat(64),
							validUntil: at + 300000,
							apply: async () => {
								assert.ok(!isRunning(ids.old) && !isRunning(ids.next));
								profile = 'd'.repeat(64);
							},
						},
					],
					observe,
				),
				coordinator = new sdk.HandoffCoordinator(plan, {
					observe,
					authorize: async () => {
						await store.fence();
						return true;
					},
					persist: j => store.save(j),
					executor,
				});
			try {
				await coordinator.activate();
				assert.ok(!isRunning(ids.old) && isRunning(ids.next));
				assert.equal(imported.next.p.value, false);
				assert.equal((await store.read()).transition.phase, 'new-active');
				await coordinator.rollback();
				assert.ok(isRunning(ids.old) && !isRunning(ids.next));
				assert.equal(imported.old.p.value, false);
				assert.equal((await store.read()).transition.phase, 'rolled-back');
				assert.equal(calls.filter(x => x.method === 'POST' && x.path.endsWith('/start')).length, 2);
				fs.writeFileSync(
					path.join(
						__dirname,
						'../.local/evidence/AP-26/manual-coordinator-20261110/controller-handoff-proof.json',
					),
					JSON.stringify({
						realChildProcesses: true,
						realControllerStateStore: true,
						durableJournal: true,
						syntheticContainerAPI: true,
						dualRunningObserved: false,
						manualFalsePreserved: true,
						rollbackConfirmed: true,
						productionAccess: false,
					}),
				);
			} finally {
				await store.close();
				for (const child of Object.values(children)) {
					if (child.exitCode === null && child.signalCode === null) {
						const exit = once(child, 'exit');
						child.kill();
						await exit;
					}
				}
				await new Promise(r => server.close(r));
			}
		});
	});
}
module.exports = { defineMaintenanceTests };
