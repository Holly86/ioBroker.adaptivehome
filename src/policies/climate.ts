import type { FunctionConfig } from '../model/contracts';
import type { PolicyContext, PolicyDecision, PolicyMemory } from './policy';
import { noAction } from './policy';
import { windowMatches, preheatedWindow } from '../config/schedule';

export function configuredClimateDecision(
	fn: FunctionConfig,
	ctx: PolicyContext,
	memory: PolicyMemory,
): PolicyDecision {
	const policy = fn.climate!,
		comfort = fn.parameters.target,
		idle = fn.parameters.setback;
	if (comfort === undefined || idle === undefined) {
		return noAction('target_missing', 'Configure comfort and base targets');
	}
	if (fn.inputs.window && (ctx.inputs.window?.quality !== 'valid' || ctx.inputs.window.value !== false)) {
		return noAction('window_open_or_unknown', 'Preserve the native window program');
	}
	if (
		fn.inputs.presence &&
		(ctx.inputs.presence?.quality !== 'valid' || typeof ctx.inputs.presence.value !== 'boolean')
	) {
		return noAction('presence_unknown', 'Preserve the preceding bounded native target during uncertain presence');
	}
	const temperature = ctx.inputs.temperature,
		humidity = ctx.inputs.humidity;
	const continuous =
		memory.climateEvaluation !== undefined &&
		ctx.now >= memory.climateEvaluation &&
		ctx.now - memory.climateEvaluation <= 120000;
	memory.climateEvaluation = ctx.now;
	const usage = ctx.inputs.usage;
	if (!continuous) {
		delete memory.unusedSince;
		delete memory.usageUntil;
		delete memory.thermal;
	}
	if (usage?.quality !== 'valid') {
		delete memory.unusedSince;
		delete memory.usageUntil;
	}
	if (usage?.quality === 'valid' && usage.value === true) {
		memory.usageUntil = ctx.now + (policy.usageHoldMs ?? 0);
		delete memory.unusedSince;
	} else if (usage?.quality === 'valid' && usage.value === false && ctx.now >= (memory.usageUntil ?? 0)) {
		memory.unusedSince ??= ctx.now;
	}
	let base = idle;
	if (
		policy.deepIdle &&
		memory.unusedSince !== undefined &&
		ctx.now - memory.unusedSince >= policy.deepIdle.afterMs &&
		temperature?.quality === 'valid' &&
		typeof temperature.value === 'number' &&
		humidity?.quality === 'valid' &&
		typeof humidity.value === 'number' &&
		humidity.value > 0 &&
		humidity.value <= 100
	) {
		const predicted =
			humidity.value *
			Math.exp(
				(17.62 * temperature.value) / (243.12 + temperature.value) -
					(17.62 * policy.deepIdle.value) / (243.12 + policy.deepIdle.value),
			);
		if (predicted <= policy.deepIdle.maxHumidityAtTarget) {
			base = policy.deepIdle.value;
		}
	}
	const weather = ctx.inputs.weather;
	const weatherAllowed =
		policy.weatherBelow === undefined ||
		(weather?.quality === 'valid' && typeof weather.value === 'number' && weather.value < policy.weatherBelow);
	const personAllowed =
		!fn.inputs.personPresence ||
		(ctx.inputs.personPresence?.quality === 'valid' && ctx.inputs.personPresence.value === true);
	const calendarAllowed =
		!fn.inputs.calendarAllow ||
		ctx.inputs.calendarAllow?.quality !== 'valid' ||
		ctx.inputs.calendarAllow.value !== false;
	const home = !fn.inputs.presence || ctx.inputs.presence?.value === true;
	const scheduled = policy.comfortWindows.some(w =>
		windowMatches(preheatedWindow(w, policy.preheatMs), ctx.now, ctx.timezone),
	);
	const use =
		policy.usageHoldMs !== undefined
			? usage?.quality === 'valid' && (usage.value === true || ctx.now < (memory.usageUntil ?? 0))
			: scheduled;
	let target = base,
		reason = 'climate_base';
	const healthy = temperature?.quality === 'valid' && typeof temperature.value === 'number';
	if (home && use && personAllowed && calendarAllowed && weatherAllowed && healthy) {
		target = comfort;
		reason = 'climate_comfort';
	}
	const weekly = policy.weekly.find(w => windowMatches(w.window, ctx.now, ctx.timezone));
	if (weekly && weatherAllowed && healthy) {
		target = weekly.value;
		reason = 'climate_weekly';
	}
	if (!weatherAllowed) {
		reason = weather?.quality === 'valid' ? 'weather_warm' : 'weather_unavailable';
	}
	if (!healthy) {
		reason = 'room_data_unavailable';
	}
	const assist = policy.thermalAssist,
		valve = ctx.inputs.valve;
	if (
		assist &&
		fn.nativeProgram?.backendContractVerified &&
		reason === 'climate_comfort' &&
		healthy &&
		valve?.quality === 'valid' &&
		typeof valve.value === 'number' &&
		valve.value >= 0 &&
		valve.value <= 1 &&
		Number(temperature.value) <= target - assist.minDeficit &&
		ctx.actual?.quality === 'valid' &&
		typeof ctx.actual.value === 'number' &&
		ctx.actual.value >= target
	) {
		if (!memory.thermal || memory.thermal.goal !== target) {
			memory.thermal = { goal: target, since: ctx.now, baseline: Number(temperature.value), checkedAt: ctx.now };
		}
		const state = memory.thermal;
		state.checkedAt = ctx.now;
		if (Number(temperature.value) >= state.baseline + assist.minProgress) {
			state.since = ctx.now;
			state.baseline = Number(temperature.value);
			delete state.trialAt;
		}
		state.baseline = Math.min(state.baseline, Number(temperature.value));
		if (ctx.now - state.since >= assist.stalledMs && valve.value < assist.highValve) {
			state.trialAt ??= ctx.now;
		}
		if (
			state.trialAt !== undefined &&
			ctx.now - state.since < assist.maxTrialMs &&
			valve.value < assist.highValve
		) {
			target = Math.min(
				target + Math.min(assist.maxIncrease, 1 + Math.floor((ctx.now - state.trialAt) / assist.stepMs)),
				assist.maxSetpoint,
			);
			reason = 'bounded_thermal_trial';
		} else if (ctx.now - state.since >= assist.stalledMs) {
			reason = 'heat_supply_unverified';
		}
	} else {
		delete memory.thermal;
	}
	return {
		value: target,
		nativeFallback: fn.nativeProgram?.fallbackValues?.length ? base : undefined,
		reason,
		text: 'Configured room target; reported setpoint and physical warming are separate evidence',
		priority: 20,
	};
}
export function climateDecision(fn: FunctionConfig, ctx: PolicyContext, memory: PolicyMemory): PolicyDecision {
	if (fn.climate) {
		return configuredClimateDecision(fn, ctx, memory);
	}
	if (fn.actuator.capability !== 'thermostatSetpoint') {
		return noAction('native_profile_unchanged', 'Native profile control requires an explicit configured rule');
	}
	if (fn.parameters.target === undefined) {
		return noAction('target_missing', 'Configure the comfort target before enabling climate control');
	}
	const setback = fn.parameters.setback ?? fn.parameters.target;
	let target = fn.parameters.target,
		reason = 'climate_target',
		text = 'Configured comfort target; physical heat supply is assessed separately';
	if (fn.inputs.window) {
		if (ctx.inputs.window?.quality !== 'valid') {
			return noAction('window_unknown', 'Window state is unavailable; the current device program is preserved');
		}
		if (ctx.inputs.window.value === true) {
			target = setback;
			reason = 'window_setback';
			text = 'Configured window setback';
		}
	}
	if (ctx.inputs.presence?.quality === 'valid' && ctx.inputs.presence.value === false) {
		target = setback;
		reason = 'presence_setback';
		text = 'Confirmed absence applies this function’s configured base target';
	}
	const temperature = ctx.inputs.temperature;
	if (temperature?.quality === 'valid' && typeof temperature.value === 'number') {
		if (temperature.value < target - (fn.parameters.demandHysteresis ?? 0.5)) {
			memory.demandSince ??= ctx.now;
			memory.demandTemperature ??= temperature.value;
			if (
				ctx.now - memory.demandSince >= (fn.parameters.responseMs ?? 3600000) &&
				temperature.value - memory.demandTemperature < (fn.parameters.minimumRise ?? 0.2)
			) {
				reason = 'heat_supply_unverified';
				text =
					'Heat is requested, but sufficient room warming has not been measured; inspect supply and measurement separately';
			}
		} else {
			delete memory.demandSince;
			delete memory.demandTemperature;
		}
	} else {
		text += '; room response is unmeasured';
	}
	return { value: target, reason, text, priority: 20 };
}
export function airDecision(fn: FunctionConfig, ctx: PolicyContext, memory: PolicyMemory): PolicyDecision {
	const air = ctx.inputs.airQuality;
	if (air?.quality !== 'valid' || typeof air.value !== 'number') {
		return fn.limits.minimumValue === undefined
			? noAction('air_quality_unknown', 'Air measurement is unavailable; preserve the device state')
			: {
					value: fn.limits.minimumValue,
					reason: 'air_minimum',
					text: 'Configured minimum air service while measurement is unavailable',
					priority: 20,
				};
	}
	const { threshold, high, low } = fn.parameters;
	if (threshold === undefined || high === undefined || low === undefined) {
		return noAction(
			'air_parameters_missing',
			'Configure the model-supported fan outputs and measurement threshold',
		);
	}
	if (air.value >= threshold) {
		memory.airHigh = true;
	} else if (air.value <= threshold - (fn.parameters.hysteresis ?? 5)) {
		memory.airHigh = false;
	}
	return {
		value: memory.airHigh ? high : low,
		reason: memory.airHigh ? 'air_demand_high' : 'air_demand_low',
		text: 'Configured air-quality threshold and hysteresis',
		priority: 20,
	};
}
