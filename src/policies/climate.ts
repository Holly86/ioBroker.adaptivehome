import { FunctionConfig } from '../model/contracts';
import { noAction, PolicyContext, PolicyDecision, PolicyMemory } from './policy';
export function climateDecision(fn:FunctionConfig,ctx:PolicyContext,memory:PolicyMemory):PolicyDecision {
    if(fn.actuator.capability !== 'thermostatSetpoint')return noAction('native_profile_unchanged','Native profile control requires an explicit configured rule');
    if(fn.parameters.target === undefined)return noAction('target_missing','Configure the comfort target before enabling climate control');
    const setback = fn.parameters.setback ?? fn.parameters.target;
    let target = fn.parameters.target, reason = 'climate_target', text = 'Configured comfort target; physical heat supply is assessed separately';
    if(fn.inputs.window){
        if(ctx.inputs.window?.quality !== 'valid')return noAction('window_unknown','Window state is unavailable; the current device program is preserved');
        if(ctx.inputs.window.value === true){target = setback;reason = 'window_setback';text = 'Configured window setback';}
    }
    if(ctx.inputs.presence?.quality === 'valid' && ctx.inputs.presence.value === false){target = setback;reason = 'presence_setback';text = 'Confirmed absence applies this function’s configured base target';}
    const temperature = ctx.inputs.temperature;
    if(temperature?.quality === 'valid' && typeof temperature.value === 'number'){
        if(temperature.value < target-(fn.parameters.demandHysteresis ?? .5)){
            memory.demandSince ??= ctx.now;memory.demandTemperature ??= temperature.value;
            if(ctx.now-memory.demandSince >= (fn.parameters.responseMs ?? 3600000) && temperature.value-memory.demandTemperature < (fn.parameters.minimumRise ?? .2)){
                reason = 'heat_supply_unverified';text = 'Heat is requested, but sufficient room warming has not been measured; inspect supply and measurement separately';
            }
        }else{delete memory.demandSince;delete memory.demandTemperature;}
    }else{text += '; room response is unmeasured';}
    return {value:target,reason,text,priority:20};
}
export function airDecision(fn:FunctionConfig,ctx:PolicyContext,memory:PolicyMemory):PolicyDecision {
    const air = ctx.inputs.airQuality;
    if(air?.quality !== 'valid' || typeof air.value !== 'number')return fn.limits.minimumValue === undefined ? noAction('air_quality_unknown','Air measurement is unavailable; preserve the device state') : {value:fn.limits.minimumValue,reason:'air_minimum',text:'Configured minimum air service while measurement is unavailable',priority:20};
    const {threshold,high,low} = fn.parameters;
    if(threshold === undefined || high === undefined || low === undefined)return noAction('air_parameters_missing','Configure the model-supported fan outputs and measurement threshold');
    if(air.value >= threshold)memory.airHigh = true;
    else if(air.value <= threshold-(fn.parameters.hysteresis ?? 5))memory.airHigh = false;
    return {value:memory.airHigh ? high : low,reason:memory.airHigh ? 'air_demand_high' : 'air_demand_low',text:'Configured air-quality threshold and hysteresis',priority:20};
}
