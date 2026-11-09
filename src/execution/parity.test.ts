import { strict as assert } from 'node:assert';
import { referenceConfiguration } from '../config/examples';
import { functionSchema, mappingSchema } from '../model/contracts';
import type { Intent, Scalar } from '../model/contracts';
import { ManualClock } from '../runtime/clock';
import { Executor } from './executor';
import { compileNativeHeatingProgram } from '../integrations/native-program';
import { validateConfiguration } from '../config/configuration';
import type { StateValue } from '../integrations/registry';
import { normalize } from '../integrations/registry';

function setup() {
	const config = referenceConfiguration('apartment'),
		clock = new ManualClock(Date.parse('2026-01-05T12:00:00Z'));
	config.functions = [config.functions[0]];
	const fn = config.functions[0],
		binding = config.bindings.find(b => b.id === fn.actuator.entityId)!;
	const writes: { id: string; value: Scalar }[] = [];
	const port = {
		read: async (_id: string): Promise<StateValue | null> => null,
		metadata: async (id: string) => ({ type: id.endsWith('switch') ? 'boolean' : 'number', write: true, unit: '' }),
		write: async (id: string, value: Scalar) => {
			writes.push({ id, value });
		},
		persist: async () => undefined,
		inputs: async () => ({}),
	};
	const executor = new Executor(() => config, port, clock);
	const intent = (value: Scalar = true): Intent => ({
		...fn.actuator,
		intentId: `fixture-${clock.now()}`,
		functionId: fn.id,
		typedValue: value,
		origin: 'configured_rule',
		actor: 'fixture',
		reasonCode: 'fixture',
		reasonText: 'synthetic',
		sourceSnapshotId: 'snapshot',
		configRevision: 0,
		priority: 40,
		validFrom: clock.now(),
		expiresAt: clock.now() + 10000,
	});
	return { config, clock, fn, binding, port, writes, executor, intent };
}

describe('Anonymized final execution parity', () => {
	it('uses the actual OFF state for a physical input edge and therefore requires quiet rearm', async () => {
		const s = setup();
		s.fn.behavior = {
			continuityMs: 30000,
			manualOffQuietMs: 300000,
			awayOff: false,
			manualSignals: [{ input: 'physical', offValues: [], useActuatorValue: true }],
			manualSignatureInputs: [],
		};
		s.fn.inputs.physical = s.fn.inputs.motion;
		s.port.read = async () => ({ val: false, ts: s.clock.now(), ack: true });
		const sample = (value: boolean) => ({
			entityId: 'fixture',
			capability: 'manualEvent',
			value,
			measuredAt: s.clock.now(),
			receivedAt: s.clock.now(),
			sourceId: 'fixture.0.input',
			quality: 'valid' as const,
			unit: '',
		});
		await s.executor.observeManualInputs(s.fn, { physical: sample(false) });
		s.clock.advance(1000);
		await s.executor.observeManualInputs(s.fn, { physical: sample(true) });
		assert.equal(s.executor.journal.manual[s.binding.physicalId].value, false);
		assert.equal(s.executor.journal.manual[s.binding.physicalId].quietRequiredMs, 300000);
		assert.equal(s.writes.length, 0);
	});
	it('keeps an ON observation valid for an output authorized for OFF commands only', async () => {
		const s = setup(),
			mapping = s.binding.capabilities[0];
		mapping.writeValues = [false];
		assert.equal(
			normalize(s.binding, mapping, { val: true, ts: s.clock.now(), ack: true }, s.clock.now()).quality,
			'valid',
		);
		assert.equal((await s.executor.execute(s.intent(false))).dispatchAccepted, true);
		s.clock.advance(1);
		await assert.rejects(s.executor.execute(s.intent(true)), /unsupported_value/);
		assert.deepEqual(
			s.writes.map(w => w.value),
			[false],
		);
	});
	it('baselines replacement input sources after configuration invalidation without replaying a hand event', async () => {
		const s = setup();
		s.fn.behavior = {
			continuityMs: 30000,
			awayOff: false,
			manualSignals: [{ input: 'button', offValues: [4002] }],
			manualSignatureInputs: [],
		};
		s.fn.inputs.button = s.fn.inputs.motion;
		const sample = (value: number) => ({
			entityId: 'fixture',
			capability: 'manualEvent',
			value,
			measuredAt: s.clock.now(),
			receivedAt: s.clock.now(),
			sourceId: 'fixture.0.button',
			quality: 'valid' as const,
			unit: '',
		});
		await s.executor.observeManualInputs(s.fn, { button: sample(1002) });
		s.clock.advance(1000);
		s.executor.invalidateAudit();
		await s.executor.observeManualInputs(s.fn, { button: sample(4002) });
		assert.equal(Object.keys(s.executor.journal.manual).length, 0);
	});
	it('permits allowlisted departure after an earlier hand action but cancels for a new hand action during preflight', async () => {
		for (const race of [false, true]) {
			const s = setup();
			s.fn.behavior = { continuityMs: 30000, awayOff: true, manualSignals: [], manualSignatureInputs: [] };
			s.fn.inputs.presence = s.fn.inputs.motion;
			await s.executor.recordManual(s.fn, true, 'earlier-human');
			const at = s.clock.now();
			s.clock.advance(1000);
			const presence = {
				entityId: 'fixture',
				capability: 'context',
				value: false,
				measuredAt: s.clock.now(),
				receivedAt: s.clock.now(),
				sourceId: 'fixture.0.presence',
				unit: '',
				quality: 'valid' as const,
			};
			s.port.inputs = async () => {
				if (race) {
					await s.executor.recordManual(s.fn, true, 'new-human');
				}
				return { presence };
			};
			const intent = {
				...s.intent(false),
				reasonCode: 'house_away_off',
				manualLeaseAt: at,
				guardInputs: { presence: { measuredAt: presence.measuredAt, value: false } },
			};
			if (race) {
				await assert.rejects(s.executor.execute(intent), /manual_priority/);
			} else {
				assert.equal((await s.executor.execute(intent)).dispatchAccepted, true);
			}
			assert.equal(s.writes.length, race ? 0 : 1);
		}
	});
	it('writes only declared appearance components before power and requires all feedback before acquiring ownership', async () => {
		const s = setup();
		for (const capability of ['red', 'green', 'blue', 'white']) {
			s.binding.capabilities.push(
				mappingSchema.parse({
					capability,
					readId: `fixture.0.${capability}`,
					writeId: `fixture.0.${capability}`,
					confirmId: `fixture.0.${capability}`,
					valueType: 'number',
					min: 0,
					max: 255,
				}),
			);
		}
		s.fn.activation = [
			{ capability: 'red', value: 0 },
			{ capability: 'green', value: 0 },
			{ capability: 'blue', value: 0 },
			{ capability: 'white', value: 64 },
		];
		validateConfiguration(s.config);
		await s.executor.execute(s.intent());
		assert.deepEqual(
			s.writes.map(w => w.value),
			[0, 0, 0, 64, true],
		);
		assert.equal(s.executor.journal.budgets[s.binding.physicalId].length, 5);
		await s.executor.feedback(s.binding.capabilities[0].confirmId!, { val: true, ts: s.clock.now(), ack: true });
		assert.equal(s.executor.journal.commands[0].feedbackMatched, false);
		for (const effect of s.fn.activation) {
			await s.executor.feedback(`fixture.0.${effect.capability}`, {
				val: effect.value,
				ts: s.clock.now(),
				ack: true,
			});
		}
		assert.equal(s.executor.journal.commands[0].feedbackMatched, true);
		assert.equal(s.executor.journal.commands[0].deviceConfirmed, false);
		assert.equal(Object.keys(s.executor.journal.manual).length, 0);
	});
	it('locks partial activation after a new manual request and never automatically continues the remaining power command', async () => {
		const s = setup();
		s.binding.capabilities.push(
			mappingSchema.parse({
				capability: 'white',
				readId: 'fixture.0.white',
				writeId: 'fixture.0.white',
				confirmId: 'fixture.0.white',
				valueType: 'number',
				min: 0,
				max: 255,
			}),
		);
		s.fn.activation = [{ capability: 'white', value: 64 }];
		s.port.write = async (id, value) => {
			s.writes.push({ id, value });
			await s.executor.recordManual(s.fn, false, 'human-during-activation');
		};
		const command = await s.executor.execute(s.intent());
		assert.equal(command.phase, 'uncertain');
		assert.equal(s.writes.length, 1);
		assert.ok(s.executor.journal.blocked[s.binding.physicalId]);
		s.clock.advance(1);
		await assert.rejects(s.executor.execute(s.intent()), /uncertain/);
		assert.equal(await s.executor.reconcile(s.fn.id), false);
	});
	it('rejects a stale observation proof at the final boundary and never turns it into device confirmation', async () => {
		const s = setup(),
			mapping = s.binding.capabilities[0];
		mapping.freshness = { verifiedAtId: 'fixture.0.checked', maxAgeMs: 1000 };
		s.port.read = async id =>
			id === mapping.readId
				? { val: false, ts: s.clock.now() - 5000, ack: true }
				: { val: s.clock.now() - 5000, ts: s.clock.now() - 5000, ack: true };
		const command = await s.executor.execute(s.intent());
		assert.equal(command.dispatchAccepted, false);
		assert.equal(s.writes.length, 0);
		assert.equal(command.deviceConfirmed, false);
	});
	it('does not use a thirty-minute session lease after a newer manual request', async () => {
		const s = setup();
		s.fn.behavior = {
			continuityMs: 30000,
			awayOff: false,
			sessionOffMs: 1800000,
			manualSignals: [],
			manualSignatureInputs: [],
		};
		await s.executor.recordManual(s.fn, true, 'first-session');
		const at = s.clock.now();
		s.clock.advance(1800000);
		await s.executor.recordManual(s.fn, true, 'new-session');
		await assert.rejects(
			s.executor.execute({ ...s.intent(false), reasonCode: 'house_session_expired', manualLeaseAt: at }),
			/manual_priority/,
		);
		assert.equal(s.writes.length, 0);
	});
	it('verifies the entire native profile, preserves delayed activation, refuses app override and leaves unsupported backends disabled', async () => {
		const s = setup();
		s.fn.kind = 'climate';
		s.fn.operatingMode = 'automatic';
		s.fn.actuator.capability = 'thermostatSetpoint';
		s.fn.nativeProgram = {
			profileId: 'PROFILE_2',
			fallback: 17,
			maxHorizonMs: 86400000,
			activationDelayMs: 120000,
			backendContractVerified: true,
		};
		s.fn.parameters = { target: 21, setback: 17 };
		s.fn.inputs = {};
		const mapping = mappingSchema.parse({
			capability: 'thermostatSetpoint',
			readId: 'fixture.0.profileReported',
			writeId: 'fixture.0.profileRequest',
			confirmId: 'fixture.0.profileReported',
			valueType: 'number',
			sourceType: 'string',
			unit: '°C',
			sourceUnit: '',
			min: 5,
			max: 25,
			codec: 'nativeHeatingProgram',
		});
		s.binding.capabilities = [mapping];
		const initial = compileNativeHeatingProgram(s.fn, s.binding, 17, s.clock.now() - 600000, 'UTC', 'old-command');
		const report = {
			program: initial,
			status: 'applied',
			automatic: true,
			fallbackVerified: true,
			absoluteExpiryVerified: true,
			appOverride: false,
			devicePending: false,
			effectiveTarget: 17,
		};
		s.port.read = async () => ({ val: JSON.stringify(report), ts: s.clock.now(), ack: true });
		s.port.metadata = async () => ({ type: 'string', write: true, unit: '' });
		validateConfiguration(s.config);
		s.fn.nativeProgram.fallbackValues = [13];
		const command = await s.executor.execute({ ...s.intent(21), nativeFallback: 13 });
		assert.equal(command.dispatchAccepted, true);
		assert.equal(s.writes.length, 1);
		const requested = JSON.parse(String(s.writes[0].value));
		assert.equal(requested.fallback, 13);
		await s.executor.feedback(mapping.confirmId!, {
			val: JSON.stringify({ ...report, program: { ...requested, fallback: 10 } }),
			ts: s.clock.now(),
			ack: true,
		});
		assert.equal(s.executor.journal.commands[0].feedbackMatched, false);
		await s.executor.feedback(mapping.confirmId!, {
			val: JSON.stringify({ ...report, program: requested, effectiveTarget: 13 }),
			ts: s.clock.now(),
			ack: true,
		});
		assert.equal(s.executor.journal.commands[0].feedbackMatched, true);
		assert.equal(s.executor.journal.commands[0].deviceConfirmed, false);
		report.program = requested;
		report.effectiveTarget = 13;
		const observe = async () => {
			const raw = { val: JSON.stringify(report), ts: s.clock.now(), ack: true };
			await s.executor.observeActuator(s.fn, normalize(s.binding, mapping, raw, s.clock.now()));
			await s.executor.feedback(mapping.confirmId!, raw);
		};
		await observe();
		s.clock.advance(180000);
		report.effectiveTarget = 21;
		await observe();
		s.clock.advance(requested.expiresAt - s.clock.now() + 1000);
		report.effectiveTarget = 13;
		await observe();
		assert.equal(Object.keys(s.executor.journal.manual).length, 0);
		report.appOverride = true;
		s.clock.advance(1000);
		const blocked = await s.executor.execute(s.intent(22));
		assert.equal(blocked.dispatchAccepted, false);
		assert.equal(s.writes.length, 1);
		s.fn.nativeProgram.backendContractVerified = false;
		assert.throws(() => validateConfiguration(s.config), /native_backend_unverified/);
		s.fn.enabled = false;
		assert.doesNotThrow(() => validateConfiguration(s.config));
	});
	it('rejects undeclared activation effects and unsafe climate configuration before activation', () => {
		const s = setup();
		s.fn.activation = [{ capability: 'unmapped', value: 1 }];
		assert.throws(() => validateConfiguration(s.config), /activation_mapping_invalid/);
		s.fn.activation = [];
		s.fn.behavior = functionSchema.parse({ ...s.fn, behavior: { awayOff: true } }).behavior;
		assert.throws(() => validateConfiguration(s.config), /presence_required/);
	});
});
