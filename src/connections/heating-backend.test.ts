import { strict as assert } from 'node:assert';
import {
	HmipNativeEndpoint,
	type HeatingBackendPort,
	type HeatingTransportJournal,
	type HmipProfile,
	type HmipSnapshot,
	type ExpiryProof,
} from './heating-backend';
import { nativeTransportSchema, nativePrefix } from './schema';
import { NativeConnections } from './runtime';
import {
	compileNativeHeatingProgram,
	parseNativeHeatingReport,
	type NativeHeatingProgram,
} from '../integrations/native-program';
import { referenceConfiguration } from '../config/examples';
import { mappingSchema } from '../model/contracts';
import { normalize } from '../integrations/registry';
import { validateConfiguration } from '../config/configuration';
import { builtInRegistry } from '../integrations/profiles';

function fixture(expirySupported = true) {
	let now = Date.UTC(2026, 0, 12, 10),
		authorized = true,
		failUpdate = false,
		journal: HeatingTransportJournal = { commands: {} },
		proof: ExpiryProof | null = null;
	let independentDeviceProgram: NativeHeatingProgram | undefined;
	const cfg = referenceConfiguration('apartment'),
		fn = cfg.functions.find(f => f.kind === 'climate')!,
		binding = cfg.bindings.find(b => b.id === fn.actuator.entityId)!;
	fn.nativeProgram = {
		profileId: 'PROFILE_3',
		fallback: 17,
		maxHorizonMs: 3600000,
		activationDelayMs: 120000,
		backendContractVerified: true,
	};
	const target = nativeTransportSchema.parse({
		id: 'north',
		enabled: true,
		backend: 'hmip.12',
		groupId: 'synthetic-group',
		physicalId: binding.physicalId,
		profileIndex: 'PROFILE_3',
		memberIds: ['valve-a', 'valve-b'],
		min: 5,
		max: 30,
	});
	let profile: HmipProfile = {
		id: 'synthetic-profile',
		homeId: 'synthetic-home',
		groupId: target.groupId,
		index: 'PROFILE_3',
		name: 'Chosen native profile',
		type: 'HEATING_PROFILE',
		profileDays: Object.fromEntries(
			['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map(day => [
				day,
				{ baseValue: 17, periods: [] },
			]),
		),
	};
	const state: HmipSnapshot = {
		at: now,
		group: {
			id: target.groupId,
			homeId: profile.homeId,
			activeProfile: 'PROFILE_3',
			controlMode: 'AUTOMATIC',
			partyMode: false,
			boostMode: false,
			unreach: false,
			setPointTemperature: 17,
			profile,
			profileCheckedAt: now,
		},
		members: target.memberIds.map(id => ({
			id,
			checkedAt: now,
			configPending: false,
			unreach: false,
			lowBat: false,
			setPointTemperature: 17,
		})),
	};
	const calls: { endpoint: string; body: Record<string, unknown> }[] = [];
	const port: HeatingBackendPort = {
		callRestApi: async (endpoint, body) => {
			calls.push({ endpoint, body: structuredClone(body) });
			if (endpoint.endsWith('updateProfile')) {
				if (failUpdate) {
					throw Error('ambiguous');
				}
				profile = structuredClone(body.profile) as HmipProfile;
				state.group.profile = profile;
				state.members.forEach(m => (m.configPending = true));
			}
			return structuredClone(profile);
		},
		snapshot: async () => structuredClone(state),
		authorize: async () => authorized,
		persist: async r => {
			journal = structuredClone(r);
		},
		...(expirySupported
			? {
					expiry: {
						install: async p => {
							independentDeviceProgram = structuredClone(p);
							proof = {
								commandId: p.commandId,
								expiresAt: p.expiresAt,
								physicalId: p.physicalId,
								deviceEnforced: true,
							};
							return proof;
						},
						read: async () => proof,
					},
				}
			: {}),
	};
	const endpoint = new HmipNativeEndpoint([target], port, () => now, undefined, ['system.adapter.adaptivehome.7']);
	const backend = { handle: (input: unknown) => endpoint.handle(input, 'system.adapter.adaptivehome.7') };
	const program = () => compileNativeHeatingProgram(fn, binding, 21, now, 'UTC', 'anonymous-command');
	const request = (operation: string, p?: unknown) => ({
		protocol: 'adaptivehome.hmip-native.v1',
		targetId: target.id,
		operation,
		...(operation === 'apply' ? { deadline: now + 10000 } : {}),
		...(p ? { program: p } : {}),
	});
	return {
		cfg,
		fn,
		binding,
		target,
		calls,
		state,
		port,
		backend,
		endpoint,
		program,
		request,
		journal: () => journal,
		time: () => now,
		advance: (ms: number) => {
			now += ms;
			state.at = now;
			state.group.profileCheckedAt = now;
			state.members.forEach(m => (m.checkedAt = now));
			// Independent simulated native expiry, even while the adapter endpoint is absent.
			if (
				independentDeviceProgram &&
				now >= independentDeviceProgram.expiresAt &&
				state.group.controlMode === 'AUTOMATIC' &&
				!state.group.partyMode &&
				!state.group.boostMode
			) {
				state.group.setPointTemperature = independentDeviceProgram.fallback;
				state.members.forEach(m => (m.setPointTemperature = independentDeviceProgram!.fallback));
			}
		},
		authorize: (v: boolean) => {
			authorized = v;
		},
		fail: () => {
			failUpdate = true;
		},
	};
}
describe('Anonymous native heating transport through an existing backend session', () => {
	it('does not dispatch after the actual Executor deadline expires during backend work', async () => {
		const f = fixture(),
			original = f.port.persist;
		f.port.persist = async record => {
			await original(record);
			f.advance(10001);
		};
		await assert.rejects(f.backend.handle(f.request('apply', f.program())), /write_uncertain/);
		assert.equal(f.calls.filter(c => c.endpoint.endsWith('updateProfile')).length, 0);
		assert.equal(f.journal().commands['anonymous-command'].phase, 'uncertain');
	});
	it('rejects a repeating weekly profile without actual autonomous absolute expiry before any vendor request', async () => {
		const f = fixture(false);
		await assert.rejects(f.backend.handle(f.request('apply', f.program())), /absolute_expiry_unsupported/);
		assert.equal(f.calls.length, 0);
	});
	it('transfers complete native profile content, preserves identity and label, and separates server acceptance from each valve', async () => {
		const f = fixture(),
			p = f.program();
		const accepted = (await f.backend.handle(f.request('apply', p))) as {
			report: { devicePending: boolean; absoluteExpiryVerified: boolean };
		};
		assert.equal(accepted.report.devicePending, true);
		assert.equal(accepted.report.absoluteExpiryVerified, true);
		assert.deepEqual(
			f.calls.map(c => c.endpoint),
			['group/heating/getProfile', 'group/heating/updateProfile', 'group/heating/getProfile'],
		);
		const sent = f.calls[1].body.profile as HmipProfile;
		assert.equal(sent.id, 'synthetic-profile');
		assert.equal(sent.name, 'Chosen native profile');
		assert.equal(Object.keys(sent.profileDays).length, 7);
		f.advance(p.activateAt - f.time());
		f.state.group.setPointTemperature = 21;
		f.state.members[0].configPending = false;
		f.state.members[0].setPointTemperature = 21;
		assert.equal(((await f.backend.handle(f.request('inspect'))) as typeof accepted).report.devicePending, true);
		f.state.members[1].configPending = false;
		f.state.members[1].setPointTemperature = 21;
		assert.equal(((await f.backend.handle(f.request('inspect'))) as typeof accepted).report.devicePending, false);
		// Cached inspections do not open vendor polling or a new cloud session.
		assert.equal(f.calls.length, 3);
		f.advance(p.expiresAt - f.time());
		assert.equal(f.state.group.setPointTemperature, 17);
		const expired = (await f.backend.handle(f.request('inspect'))) as { report: unknown };
		const parsed = parseNativeHeatingReport(JSON.stringify(expired.report));
		assert.equal(parsed?.effectiveTarget, 17);
		assert.equal(parsed?.absoluteExpiryVerified, true);
		f.advance(7 * 86400000);
		assert.equal(f.state.group.setPointTemperature, 17);
		assert.equal(f.calls.filter(c => c.endpoint.endsWith('updateProfile')).length, 1);
		f.state.group.profile.id = 'unrelated-profile';
		const replaced = (await f.backend.handle(f.request('inspect'))) as { report: { status: string } };
		assert.equal(replaced.report.status, 'rejected');
	});
	it('blocks foreign targets, altered periods, old commands, app overrides and a non-exclusive writer', async () => {
		for (const change of [
			(f: ReturnType<typeof fixture>) => {
				f.authorize(false);
			},
			(f: ReturnType<typeof fixture>) => {
				f.state.group.partyMode = true;
			},
			(f: ReturnType<typeof fixture>) => {
				f.state.group.boostMode = true;
			},
			(f: ReturnType<typeof fixture>) => {
				f.state.members.pop();
			},
		]) {
			const f = fixture();
			change(f);
			await assert.rejects(f.backend.handle(f.request('apply', f.program())));
			assert.equal(f.calls.length, 0);
		}
		const f = fixture(),
			p = f.program();
		p.days[0].base = 5;
		await assert.rejects(f.backend.handle(f.request('apply', p)), /period_mismatch/);
		assert.equal(f.calls.length, 0);
		await assert.rejects(f.backend.handle({ ...f.request('inspect'), targetId: 'foreign' }), /not_authorized/);
		await assert.rejects(f.endpoint.handle(f.request('inspect'), 'system.adapter.foreign.0'), /sender_denied/);
	});
	it('persists uncertainty, rejects blind retries after restart and does not replay successful commands', async () => {
		const f = fixture();
		f.fail();
		const p = f.program();
		await assert.rejects(f.backend.handle(f.request('apply', p)), /write_uncertain/);
		assert.equal(f.journal().commands[p.commandId].phase, 'uncertain');
		const restarted = new HmipNativeEndpoint([f.target], f.port, f.time, f.journal(), [
			'system.adapter.adaptivehome.7',
		]);
		await assert.rejects(
			restarted.handle(
				f.request('apply', { ...p, commandId: 'another-command' }),
				'system.adapter.adaptivehome.7',
			),
			/previous_command_uncertain/,
		);
		assert.equal(f.calls.filter(c => c.endpoint.endsWith('updateProfile')).length, 1);
		const ok = fixture();
		await ok.backend.handle(ok.request('apply', ok.program()));
		await ok.backend.handle(ok.request('apply', ok.program()));
		assert.equal(ok.calls.filter(c => c.endpoint.endsWith('updateProfile')).length, 1);
		const changed = ok.program();
		changed.target = 22;
		await assert.rejects(ok.backend.handle(ok.request('apply', changed)), /replay_conflict/);
	});
	it('connects Executor-compatible virtual paths to backend reports and rejects undeclared protected writers', async () => {
		const f = fixture(),
			prefix = nativePrefix('adaptivehome.7', f.target.id),
			messages: string[] = [];
		f.cfg.nativeTransports = [f.target];
		const mapping = mappingSchema.parse({
			capability: 'thermostatSetpoint',
			readId: `${prefix}.report`,
			confirmId: `${prefix}.report`,
			writeId: `${prefix}.command`,
			sourceType: 'string',
			sourceUnit: '',
			valueType: 'number',
			unit: '°C',
			codec: 'nativeHeatingProgram',
			min: 5,
			max: 30,
			confirmation: 'device',
			freshness: { verifiedAtId: `${prefix}.verifiedAt`, maxAgeMs: 30000 },
		});
		f.binding.capabilities = f.binding.capabilities.filter(m => m.capability !== 'thermostatSetpoint');
		f.binding.capabilities.push(mapping);
		validateConfiguration(f.cfg, builtInRegistry());
		const client = new NativeConnections(
			'adaptivehome.7',
			{
				send: async (backend, command, payload) => {
					messages.push(`${backend}:${command}`);
					return f.backend.handle(payload);
				},
			},
			f.time,
		);
		await client.refresh([f.target]);
		assert.equal(
			normalize(f.binding, mapping, client.read(`${prefix}.report`), f.time(), {
				verifiedAt: client.read(`${prefix}.verifiedAt`),
			}).quality,
			'valid',
		);
		await client.write(`${prefix}.command`, JSON.stringify(f.program()));
		assert.equal(messages.at(-1), 'hmip.12:adaptivehomeNative');
		assert.equal(parseNativeHeatingReport(String(client.read(`${prefix}.report`)?.val))?.devicePending, true);
		const wrong = structuredClone(f.cfg);
		wrong.nativeTransports = [];
		assert.throws(() => validateConfiguration(wrong, builtInRegistry()), /native_transport_mapping/);
		f.advance(31000);
		f.state.group.partyMode = true;
		await client.refresh([f.target]);
		assert.equal(client.read(`${prefix}.report`)?.val, null);
	});
});
