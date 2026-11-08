import { strict as assert } from 'node:assert';
import { referenceConfiguration } from '../config/examples';
import { validateConfiguration } from '../config/configuration';
import type { PolicyContext } from './policy';
import { commonDecision } from './policy';
import { equipmentDecision } from './equipment';
const ctx: PolicyContext = {
	now: 1000,
	startedAt: 0,
	timezone: 'UTC',
	inputs: {},
	actual: null,
	owns: false,
	manual: false,
};
describe('AP-17 generic installations', () => {
	it('maintains essential circulation while allowing the independent daylight schedule', () => {
		const config = referenceConfiguration('aquarium'),
			pump = config.functions[1],
			light = config.functions[0];
		assert.equal(commonDecision(pump, ctx)?.value, true);
		assert.equal(commonDecision(light, { ...ctx, now: Date.parse('2026-11-08T22:00:00Z') })?.value, false);
		const interval = {
			...pump,
			limits: { ...pump.limits, essential: false },
			operatingMode: 'automatic' as const,
			parameters: { intervalMs: 10000, onMs: 2000 },
		};
		assert.equal(equipmentDecision(interval, ctx).value, true);
		assert.equal(equipmentDecision(interval, { ...ctx, now: 3000 }).value, false);
	});
	it('rejects cyclic resources and applies verified protection ahead of minimum service', () => {
		const config = referenceConfiguration('aquarium');
		config.functions[0].dependencies = [{ functionId: 'circulation', requiredValue: true, confirmation: 'device' }];
		config.functions[1].dependencies = [{ functionId: 'light', requiredValue: true, confirmation: 'device' }];
		assert.throws(() => validateConfiguration(config), /dependency_cycle/);
		const pump = referenceConfiguration('aquarium').functions[1];
		pump.limits.protection = [{ when: { input: 'fault', op: 'eq', value: true }, value: false }];
		assert.equal(
			commonDecision(pump, {
				...ctx,
				inputs: {
					fault: {
						entityId: 'sensor',
						capability: 'flow',
						value: true,
						unit: '',
						sourceId: 'test.0.fault',
						quality: 'valid',
						measuredAt: 1000,
						receivedAt: 1000,
					},
				},
			})?.value,
			false,
		);
	});
});
