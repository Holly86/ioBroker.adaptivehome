import type { FunctionConfig } from '../model/contracts';
import type { PolicyContext, PolicyDecision, PolicyMemory } from './policy';
import { noAction } from './policy';

/** Edge-triggered house behavior. No startup, reconnect or persisted timer replay. */
export function houseDecision(
	fn: FunctionConfig,
	ctx: PolicyContext,
	memory: PolicyMemory,
): PolicyDecision | undefined {
	const behavior = fn.behavior;
	if (!behavior) {
		return undefined;
	}
	const on = fn.actuator.capability === 'switch' ? true : (fn.parameters.onValue ?? 100);
	const off = fn.actuator.capability === 'switch' ? false : (fn.parameters.offValue ?? 0);
	const decision = (value: typeof on | typeof off, reason: string): PolicyDecision => ({
		value,
		reason,
		text: reason,
		priority: 45,
		expiresAt: ctx.now + 10000,
	});
	const gap =
		memory.houseEvaluation !== undefined &&
		(ctx.now < memory.houseEvaluation || ctx.now - memory.houseEvaluation > behavior.continuityMs);
	memory.houseEvaluation = ctx.now;
	const presence = ctx.inputs.presence;
	if (
		gap ||
		((behavior.awayOff || behavior.welcomeHoldMs) &&
			(!presence || presence.quality !== 'valid' || typeof presence.value !== 'boolean'))
	) {
		delete memory.presence;
		delete memory.welcomeUntil;
		delete memory.sessionUntil;
		delete memory.commandId;
		memory.sessionAt = ctx.manualAt;
		return noAction('house_continuity_lost', 'House event baseline reset after unavailable observations');
	}
	const previous = memory.presence;
	if (presence?.quality === 'valid' && typeof presence.value === 'boolean') {
		memory.presence = presence.value;
	}
	if (ctx.manualAt !== undefined && ctx.manualAt > ctx.startedAt && ctx.manualAt !== memory.sessionAt) {
		memory.sessionAt = ctx.manualAt;
		delete memory.welcomeUntil;
		memory.sessionUntil =
			behavior.sessionOffMs && ctx.manualValue !== false && ctx.manualValue !== 0
				? ctx.manualAt + behavior.sessionOffMs
				: undefined;
	}
	if (previous === true && memory.presence === false && behavior.awayOff) {
		delete memory.welcomeUntil;
		delete memory.sessionUntil;
		return { ...decision(off, 'house_away_off'), manualLeaseAt: ctx.manualAt };
	}
	if (previous === false && memory.presence === true && behavior.welcomeHoldMs && !ctx.manual) {
		const lux = ctx.inputs.lux;
		if (ctx.actual?.quality !== 'valid' || (ctx.actual.value !== false && ctx.actual.value !== 0)) {
			return noAction('welcome_externally_on', 'Welcome does not acquire an existing manual light');
		}
		if (
			lux?.quality !== 'valid' ||
			typeof lux.value !== 'number' ||
			lux.value >= (fn.parameters.luxThreshold ?? 100)
		) {
			return noAction('welcome_lux_unavailable_or_bright', 'Welcome requires confirmed darkness');
		}
		memory.welcomeUntil = ctx.now + behavior.welcomeHoldMs;
		return decision(on, 'house_welcome_on');
	}
	if (memory.welcomeUntil !== undefined) {
		if (ctx.manual) {
			delete memory.welcomeUntil;
			return undefined;
		}
		if (fn.inputs.motion && ctx.inputs.motion?.quality !== 'valid') {
			delete memory.welcomeUntil;
			delete memory.commandId;
			return noAction('welcome_motion_unavailable', 'Welcome ownership discarded after sensor loss');
		}
		if (ctx.inputs.motion?.value === true) {
			memory.welcomeUntil = ctx.now + behavior.welcomeHoldMs!;
		}
		if (ctx.owns && ctx.now >= memory.welcomeUntil) {
			return decision(off, 'house_welcome_expired');
		}
	}
	if (memory.sessionUntil !== undefined && ctx.now >= memory.sessionUntil && ctx.manualAt === memory.sessionAt) {
		return { ...decision(off, 'house_session_expired'), manualLeaseAt: ctx.manualAt };
	}
	return undefined;
}
