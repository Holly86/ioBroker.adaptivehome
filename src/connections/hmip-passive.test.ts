import { strict as assert } from 'node:assert';
import { hmipPassiveConnection } from '../integrations/sdk';
import { SourceConnections } from './sources';
import type { StateValue } from '../integrations/registry';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateConfiguration } from '../config/configuration';

describe('Passive HmIP manufacturer states, without a cloud port', () => {
	it('ships an importable anonymous source-only example without backend connections or actuator permissions', () => {
		const c = validateConfiguration(
			JSON.parse(readFileSync(join(__dirname, '../../examples/hmip-passive.json'), 'utf8')),
		);
		assert.equal(c.functions.length, 0);
		assert.equal(c.nativeTransports.length, 0);
		assert(c.connections.every(connection => connection.kind === 'state-map'));
		assert(
			c.bindings.every(binding => !binding.confirmed && binding.capabilities.every(mapping => !mapping.writeId)),
		);
	});
	function fixture(backend = 'hmip.7') {
		let now = 200000,
			forbiddenCalls = 0;
		const temp = `${backend}.groups.example-group.actualTemperature`,
			online = `${backend}.info.connection`;
		const states: Record<string, StateValue> = {
			[temp]: { val: 21, ts: now, lc: 1000, ack: true, q: 0 },
			[online]: { val: true, ts: 1000, ack: true, q: 0 },
			[`${backend}.groups.example-group.info.type`]: { val: 'HEATING', ts: now, ack: true, q: 0 },
		};
		const input = {
			id: 'passive',
			backend,
			enabled: true,
			intervalMs: 1000,
			maxAgeMs: 30000,
			fields: [
				{
					key: 'temperature',
					stateId: temp,
					type: 'number' as const,
					unit: '°C',
					min: -20,
					max: 50,
					guards: [{ stateId: `${backend}.groups.example-group.info.type`, equals: 'HEATING' }],
				},
			],
		};
		const connection = hmipPassiveConnection(input);
		const forbidden = async (): Promise<never> => {
			forbiddenCalls++;
			throw Error('network_or_backend_forbidden');
		};
		const source = new SourceConnections(
			'adaptivehome.9',
			{
				readState: async id => {
					assert(id.startsWith(`${backend}.`));
					return states[id] ?? null;
				},
				readFile: forbidden,
				getJSON: forbidden,
				readBackend: forbidden,
			},
			() => now,
		);
		return {
			source,
			states,
			connection,
			input,
			temp,
			online,
			advance: (ms: number) => (now += ms),
			get now() {
				return now;
			},
			get forbiddenCalls() {
				return forbiddenCalls;
			},
			prefix: 'adaptivehome.9.connections.passive.temperature',
		};
	}
	it('uses real receipt and change times; repeated local reads and connection heartbeats never renew a measurement', async () => {
		const f = fixture();
		await f.source.refresh([f.connection]);
		assert.equal(f.source.read(f.prefix)?.val, 21);
		assert.equal(f.source.read(f.prefix)?.ts, 1000);
		assert.equal(f.source.read(`${f.prefix}.verifiedAt`)?.val, 200000);
		f.advance(31000);
		f.states[f.online].ts = f.now;
		await f.source.refresh([f.connection]);
		assert.equal(f.source.read(f.prefix)?.q, 1);
		assert.equal(f.source.read(f.prefix)?.val, null);
		assert.equal(f.forbiddenCalls, 0);
	});
	it('accepts an unchanged newly acknowledged manufacturer report while preserving its physical event', async () => {
		const f = fixture('hmip.23');
		await f.source.refresh([f.connection]);
		f.advance(31000);
		f.states[f.temp].ts = f.now;
		await f.source.refresh([f.connection]);
		assert.equal(f.source.read(f.prefix)?.q, 0);
		assert.equal(f.source.read(f.prefix)?.ts, 1000);
		assert.equal(f.source.read(`${f.prefix}.verifiedAt`)?.val, f.now);
		assert.equal(f.source.metadata(f.prefix)?.write, false);
		assert.equal(f.forbiddenCalls, 0);
	});
	it('leaves missing, unacknowledged, invalid, future and disconnected inputs unknown; never triggers a fallback', async () => {
		for (const change of [
			(f: ReturnType<typeof fixture>) => {
				delete f.states[f.temp];
			},
			(f: ReturnType<typeof fixture>) => {
				f.states[f.temp].ack = false;
			},
			(f: ReturnType<typeof fixture>) => {
				f.states[f.temp].q = 1;
			},
			(f: ReturnType<typeof fixture>) => {
				f.states[f.temp].ts = f.now + 1;
			},
			(f: ReturnType<typeof fixture>) => {
				f.states[f.online].val = false;
			},
			(f: ReturnType<typeof fixture>) => {
				f.states[`${f.input.backend}.groups.example-group.info.type`].val = 'SWITCHING';
			},
		]) {
			const f = fixture();
			change(f);
			await f.source.refresh([f.connection]);
			assert.equal(f.source.read(f.prefix)?.val, null);
			assert.equal(f.forbiddenCalls, 0);
		}
	});
	it('isolates a missing optional field from a healthy measurement', async () => {
		const f = fixture();
		const c = hmipPassiveConnection({
			...f.input,
			fields: [
				...f.input.fields,
				{ key: 'humidity', stateId: 'hmip.7.groups.example-group.humidity', type: 'number' },
			],
		});
		await f.source.refresh([c]);
		assert.equal(f.source.read(f.prefix)?.val, 21);
		assert.equal(f.source.read('adaptivehome.9.connections.passive.humidity')?.val, null);
		assert.equal(f.forbiddenCalls, 0);
	});
	it('rejects other instances, wildcard selectors, prototype paths and duplicate output keys', () => {
		const f = fixture();
		for (const id of [
			'hmip.8.groups.example.value',
			'hmip.7.groups.*.value',
			'hmip.7.groups.constructor.value',
			'hmip.7.info.connection',
		]) {
			assert.throws(() => hmipPassiveConnection({ ...f.input, fields: [{ ...f.input.fields[0], stateId: id }] }));
		}
		assert.throws(() => hmipPassiveConnection({ ...f.input, fields: [...f.input.fields, ...f.input.fields] }));
		assert.throws(() =>
			hmipPassiveConnection({
				...f.input,
				fields: [{ ...f.input.fields[0], guards: [{ stateId: 'hmip.8.info.connection', equals: true }] }],
			}),
		);
	});
	it('stays local during a full simulated day and never claims complete native heating profiles', async () => {
		const f = fixture();
		for (let i = 0; i < 24 * 60; i++) {
			await f.source.refresh([f.connection]);
			f.advance(60000);
		}
		assert.equal(f.forbiddenCalls, 0);
		assert.equal(f.source.read(f.prefix)?.val, null);
		assert.equal(f.source.read('adaptivehome.9.connections.passive.nativeProfile'), null);
	});
	it('aggregates only complete fresh members and keeps their oldest receipt', async () => {
		const f = fixture();
		const a = 'hmip.7.devices.example-a.channels.1.valvePosition',
			b = 'hmip.7.devices.example-b.channels.1.valvePosition';
		f.states[a] = { val: 20, ts: 195000, ack: true };
		f.states[b] = { val: 70, ts: 199000, ack: true };
		const c = hmipPassiveConnection({
			...f.input,
			fields: [
				{
					key: 'valve',
					stateIds: [a, b],
					aggregate: 'maximum',
					type: 'number',
					unit: 'fraction',
					scale: 0.01,
					min: 0,
					max: 1,
				},
			],
		});
		await f.source.refresh([c]);
		const prefix = 'adaptivehome.9.connections.passive.valve';
		assert.ok(Math.abs(Number(f.source.read(prefix)?.val) - 0.7) < 1e-12);
		assert.equal(f.source.read(`${prefix}.verifiedAt`)?.val, 195000);
		f.advance(1000);
		delete f.states[b];
		await f.source.refresh([c]);
		assert.equal(f.source.read(prefix)?.val, null);
		assert.equal(f.forbiddenCalls, 0);
		assert.throws(() =>
			hmipPassiveConnection({
				...f.input,
				fields: [{ key: 'valve', stateIds: [a, a], aggregate: 'maximum', type: 'number' }],
			}),
		);
	});
});
