import { FunctionConfig } from '../model/contracts';
import { noAction, PolicyContext, PolicyDecision } from './policy';
export function equipmentDecision(fn:FunctionConfig,ctx:PolicyContext):PolicyDecision {
    if(fn.operatingMode === 'continuous')return {value:fn.limits.minimumValue ?? (fn.actuator.capability === 'switch' ? true : fn.parameters.onValue),reason:'continuous_service',text:'Configured continuous operation, independent of absence and optimization',priority:50};
    const interval = fn.parameters.intervalMs, on = fn.parameters.onMs, anchor = fn.parameters.anchorAt ?? 0;
    if(interval !== undefined && on !== undefined){
        if(interval <= 0 || on < 0 || on > interval)return noAction('invalid_interval','The configured interval is invalid');
        if(ctx.now < anchor)return noAction('interval_not_started','Waiting for the configured interval anchor');
        const active = (ctx.now-anchor)%interval < on;
        return {value:fn.actuator.capability === 'switch' ? active : active ? fn.parameters.onValue : fn.parameters.offValue,reason:active ? 'interval_on' : 'interval_off',text:'Configured interval with explicit anchor',priority:20};
    }
    return noAction('no_matching_rule','No equipment time or sensor rule currently applies; no absence shutdown is inferred');
}
