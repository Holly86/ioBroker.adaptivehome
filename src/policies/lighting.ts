import type { FunctionConfig } from '../model/contracts';
import type { PolicyContext, PolicyDecision, PolicyMemory } from './policy';
import { noAction } from './policy';
export function lightingDecision(fn: FunctionConfig, ctx: PolicyContext, memory: PolicyMemory): PolicyDecision {
	if (fn.operatingMode !== 'demand') {
		return noAction('no_matching_rule', 'No configured lighting rule currently applies');
	}
	const motion = ctx.inputs.motion;
	if (!motion || motion.quality !== 'valid' || typeof motion.value !== 'boolean') {
		return noAction('motion_unavailable', 'A fresh movement measurement is required');
	}
	// Do not consume slightly future samples: normalization admits them when their time arrives.
	const fresh =
		motion.value &&
		motion.measuredAt > ctx.startedAt &&
		motion.measuredAt > (memory.consumedMotion ?? ctx.startedAt);
	if (fresh) {
		memory.consumedMotion = motion.measuredAt;
		memory.lastMotion = motion.measuredAt;
		delete memory.quietSince;
	}
	if (ctx.owns && memory.lastMotion !== undefined) {
		if (motion.value) {
			delete memory.quietSince;
			return noAction('motion_active', 'Movement remains active');
		}
		memory.quietSince ??= Math.max(motion.measuredAt, memory.lastMotion);
		const deadline = memory.quietSince + (fn.parameters.holdMs ?? 300000);
		if (ctx.now >= deadline) {
			return {
				value: fn.actuator.capability === 'switch' ? false : (fn.parameters.offValue ?? 0),
				reason: 'motion_quiet_expired',
				text: 'Continuous quiet period completed for an automatically owned light',
				priority: 30,
				expiresAt: ctx.now + 10000,
			};
		}
		return {
			reason: 'motion_hold',
			text: 'Waiting for the configured quiet period',
			priority: 0,
			nextAt: deadline,
		};
	}
	if (!fresh) {
		return noAction('no_new_motion', 'No new movement since this runtime started');
	}
	if (ctx.actual?.quality !== 'valid') {
		return noAction('actuator_unavailable', 'The actuator state is not confirmed fresh');
	}
	if (ctx.actual.value !== false && ctx.actual.value !== 0) {
		return noAction('externally_on', 'The light was already on; automatic switch-off ownership was not acquired');
	}
	if (fn.inputs.lux) {
		const lux = ctx.inputs.lux;
		if (lux?.quality !== 'valid' || typeof lux.value !== 'number') {
			return noAction('lux_unavailable', 'A valid illuminance measurement is required');
		}
		if (lux.value > (fn.parameters.luxThreshold ?? 100)) {
			return noAction('too_bright', 'The measured illuminance exceeds the configured threshold');
		}
	}
	if (fn.inputs.presence && ctx.inputs.presence?.value !== true) {
		return noAction('presence_unconfirmed', 'The configured presence confirmation is missing');
	}
	return {
		value: fn.actuator.capability === 'switch' ? true : (fn.parameters.onValue ?? 100),
		reason: 'motion_on',
		text: 'New movement under the configured light threshold',
		priority: 30,
		expiresAt: ctx.now + 10000,
	};
}
