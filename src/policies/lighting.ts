import type { FunctionConfig } from '../model/contracts';
import type { PolicyContext, PolicyDecision, PolicyMemory } from './policy';
import { noAction } from './policy';
export function lightingDecision(fn: FunctionConfig, ctx: PolicyContext, memory: PolicyMemory): PolicyDecision {
	if (fn.operatingMode !== 'demand') {
		return noAction('no_matching_rule', 'No configured lighting rule currently applies');
	}
	const motion = ctx.inputs.motion;
	if (ctx.owns && ctx.actual?.quality !== 'valid') {
		delete memory.commandId;
		delete memory.quietSince;
		delete memory.lastMotion;
		memory.baselineAt = ctx.now;
		return noAction('actuator_unavailable', 'Automatic ownership discarded after loss of actuator evidence');
	}
	const illuminance = ctx.inputs.lux;
	if (illuminance?.quality === 'valid' && typeof illuminance.value === 'number') {
		if (illuminance.value < (fn.parameters.luxThreshold ?? 100)) {
			memory.luxArmed = true;
		} else if (illuminance.value >= (fn.parameters.luxRearmAbove ?? fn.parameters.luxThreshold ?? 100)) {
			memory.luxArmed = false;
		}
	}
	const gap =
		memory.lastEvaluation !== undefined &&
		(ctx.now < memory.lastEvaluation || ctx.now - memory.lastEvaluation > (fn.behavior?.continuityMs ?? 30000));
	memory.lastEvaluation = ctx.now;
	if (gap || !motion || motion.quality !== 'valid' || typeof motion.value !== 'boolean') {
		delete memory.quietSince;
		delete memory.lastMotion;
		delete memory.commandId;
		memory.baselineAt = ctx.now;
	}
	if (!motion || motion.quality !== 'valid' || typeof motion.value !== 'boolean') {
		return noAction('motion_unavailable', 'A fresh movement measurement is required');
	}
	// Do not consume slightly future samples: normalization admits them when their time arrives.
	const fresh =
		motion.value &&
		ctx.now - motion.measuredAt <= (fn.parameters.motionEventMaxAgeMs ?? 20000) &&
		motion.measuredAt > ctx.startedAt &&
		motion.measuredAt > (memory.baselineAt ?? ctx.startedAt) &&
		motion.measuredAt > (memory.consumedMotion ?? ctx.startedAt);
	if (fresh) {
		memory.consumedMotion = motion.measuredAt;
		memory.lastMotion = motion.measuredAt;
		delete memory.quietSince;
	}
	if (!gap && ctx.owns && memory.lastMotion !== undefined) {
		if (motion.value) {
			delete memory.quietSince;
			return noAction('motion_active', 'Movement remains active');
		}
		memory.quietSince ??= ctx.now;
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
		if (memory.luxArmed !== true || lux.value >= (fn.parameters.luxThreshold ?? 100)) {
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
