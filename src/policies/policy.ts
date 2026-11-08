import type { FunctionConfig, Observation, Scalar } from '../model/contracts';
import { ruleTimeMatches } from '../config/schedule';
import { conditionMatches } from '../execution/conditions';
export interface PolicyMemory {
	lastMotion?: number;
	quietSince?: number;
	consumedMotion?: number;
	commandId?: string;
	ownerManualAt?: number;
	airHigh?: boolean;
	demandSince?: number;
	demandTemperature?: number;
}
export interface PolicyContext {
	now: number;
	startedAt: number;
	timezone: string;
	inputs: Record<string, Observation | null>;
	actual: Observation | null;
	owns: boolean;
	manual: boolean;
}
export interface PolicyDecision {
	value?: Scalar;
	reason: string;
	text: string;
	priority: number;
	expiresAt?: number;
	nextAt?: number;
}
export const noAction = (reason: string, text: string): PolicyDecision => ({ reason, text, priority: 0 });
export function commonDecision(fn: FunctionConfig, ctx: PolicyContext): PolicyDecision | undefined {
	const protection = fn.limits.protection.filter(p => conditionMatches(p.when, ctx.inputs) === true);
	if (protection.length) {
		return {
			value: protection[0].value,
			reason: 'technical_protection',
			text: 'Configured technical protection is active',
			priority: 1000,
		};
	}
	if (fn.limits.protection.some(p => conditionMatches(p.when, ctx.inputs) === null)) {
		return noAction('protection_unknown', 'A required protection measurement is unavailable');
	}
	if (fn.limits.essential) {
		return {
			value: fn.limits.minimumValue,
			reason: 'minimum_service',
			text: 'Maintaining the configured essential service',
			priority: 900,
		};
	}
	if (!fn.enabled) {
		return noAction('disabled', 'Function is disabled');
	}
	if (ctx.manual) {
		return noAction('manual_priority', 'A newer manual request has priority');
	}
	if (fn.operatingMode === 'maintenance') {
		return noAction('maintenance', 'Function is in maintenance');
	}
	if (fn.inputs.inhibit && ctx.inputs.inhibit?.quality !== 'valid') {
		return noAction('inhibit_unknown', 'The configured inhibit source is unavailable');
	}
	if (ctx.inputs.inhibit?.value === true) {
		return noAction('inhibited', 'The configured inhibit source is active');
	}
	const matching = fn.rules
		.filter(
			rule =>
				ruleTimeMatches(rule, ctx.now, ctx.timezone) &&
				rule.conditions.every(c => conditionMatches(c, ctx.inputs) === true),
		)
		.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
	if (matching.length) {
		const rule = matching[0];
		return {
			value: rule.value,
			reason: `rule_${rule.block}`,
			text: `Configured rule ${rule.id}`,
			priority: rule.priority,
			expiresAt: rule.expiresAt,
		};
	}
	return undefined;
}
