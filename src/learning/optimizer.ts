import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Configuration, FunctionConfig, id, ruleSchema } from '../model/contracts';
import { validateConfiguration } from '../config/configuration';
import { ModelVersion } from './model';
export const planSchema = z.strictObject({
    schemaVersion:z.literal(1),planId:z.string().uuid(),functionId:id,baseRevision:z.number().int().nonnegative(),
    modelVersion:z.string().min(1),dataHash:z.string().min(1),createdAt:z.number().finite(),reviewAt:z.number().finite(),expiresAt:z.number().finite(),
    parameters:z.record(id,z.number().finite()),rules:z.array(ruleSchema).max(16),
    expected:z.strictObject({kind:z.literal('estimated'),baselineScore:z.number().finite(),candidateScore:z.number().finite(),description:z.string().max(2000)}),
    hardChecks:z.array(z.string()).max(16),
});
export type AdaptationPlan = z.infer<typeof planSchema>;
const timeString = (minute:number):string => `${String(Math.floor(((minute%1440)+1440)%1440/60)).padStart(2,'0')}:${String(((minute%60)+60)%60).padStart(2,'0')}`;
const clamp = (value:number,min:number,max:number):number => Math.max(min,Math.min(max,value));
export function validatePlan(raw:unknown,fn:FunctionConfig,config:Configuration,model:ModelVersion,now:number):AdaptationPlan {
    const plan = planSchema.parse(raw),a = fn.autonomy;
    if(plan.functionId !== fn.id || plan.baseRevision !== config.revision || plan.expiresAt <= now || plan.createdAt > now)throw new Error('plan_stale_or_scope');
    if(!model.admitted || plan.modelVersion !== model.version || plan.dataHash !== model.dataHash || model.coverage<a.minCoverage || now-model.trainedAt>604800000)throw new Error('model_not_admitted');
    if(!a.granted || a.excluded || a.paused || !a.capabilities.includes(fn.actuator.capability) || fn.limits.essential)throw new Error('adaptation_not_authorized');
    for(const [key,value] of Object.entries(plan.parameters)){const range = a.parameters[key];if(!range || !(key in fn.parameters) || value<range.min || value>range.max)throw new Error('adaptation_parameter_scope');}
    for(const rule of plan.rules){
        if(!a.blocks.includes(rule.block as 'schedule'|'sensor'|'presence') || rule.block === 'minimum')throw new Error('adaptation_rule_scope');
        if(rule.conditions.length && !a.blocks.includes('sensor'))throw new Error('adaptation_condition_scope');
        if(rule.conditions.some(c => c.input === 'presence') && !a.blocks.includes('presence'))throw new Error('adaptation_presence_scope');
        if(rule.priority>50)throw new Error('adaptation_priority');
    }
    validateConfiguration({...config,functions:config.functions.map(f => f.id === fn.id ? {...f,parameters:{...f.parameters,...plan.parameters},rules:[...f.rules,...plan.rules]} : f)});
    return plan;
}
export function optimize(fn:FunctionConfig,config:Configuration,model:ModelVersion,now:number):AdaptationPlan|null {
    if(!model.admitted || !fn.autonomy.granted || fn.autonomy.excluded || fn.autonomy.paused || fn.limits.essential)return null;
    const a = fn.autonomy,parameters:Record<string,number> = {},rules = [];
    let baselineScore = 0,candidateScore = 0;
    const inferred:Record<string,number|undefined> = {
        holdMs:model.typicalGapMs ?? undefined,
        threshold:model.modelType === 'air-demand' ? model.medianValue ?? undefined : undefined,
        onMs:model.startMinute !== null && model.endMinute !== null ? Math.max(60000,(model.endMinute-model.startMinute)*60000) : undefined,
        preheatMinutes:model.responseCPerHour && fn.parameters.target !== undefined && fn.parameters.setback !== undefined ? Math.max(0,(fn.parameters.target-fn.parameters.setback)/model.responseCPerHour*60) : undefined,
    };
    // Candidate grid is finite and restricted to explicitly granted, implemented parameters.
    for(const [key,range] of Object.entries(a.parameters)){
        const target = inferred[key],baseline = fn.parameters[key];if(target === undefined || baseline === undefined)continue;
        const candidates = [baseline,range.min,range.max,clamp(target,range.min,range.max)].filter(v => v>=range.min && v<=range.max);
        const scale = Math.max(1,range.max-range.min),weights = a.objectives;
        const loss = (value:number):number => Math.abs(value-target)/scale*(weights.comfort+weights.switching+1) + ((key === 'holdMs' || key === 'onMs') ? value/scale*weights.energy : 0);
        const best = candidates.sort((x,y) => loss(x)-loss(y))[0];baselineScore += loss(baseline);candidateScore += loss(best);
        if(best !== baseline)parameters[key] = best;
    }
    if(a.mode === 'full' && a.blocks.includes('schedule') && model.startMinute !== null && model.endMinute !== null){
        const binding = config.bindings.find(b => b.id === fn.actuator.entityId)!,mapping = binding.capabilities.find(c => c.capability === fn.actuator.capability)!;
        const value = mapping.valueType === 'boolean' ? true : fn.kind === 'climate' ? fn.parameters.target : fn.kind === 'air' ? fn.parameters.high : fn.parameters.onValue;
        const conditions = [];
        const usageInput = fn.inputs.presence ? 'presence' : fn.inputs.motion ? 'motion' : undefined;
        if(usageInput && a.blocks.includes('sensor') && (usageInput !== 'presence' || a.blocks.includes('presence')))conditions.push({input:usageInput,op:'eq' as const,value:true});
        if(fn.kind === 'lighting' && fn.inputs.lux && a.blocks.includes('sensor'))conditions.push({input:'lux',op:'lte' as const,value:fn.parameters.luxThreshold ?? 100});
        // Motion lights never get an unconditioned learned switch-on window.
        if(value !== undefined && (fn.kind !== 'lighting' || conditions.some(c => c.input === 'motion' || c.input === 'presence'))){
            const lead = Math.round(parameters.preheatMinutes ?? fn.parameters.preheatMinutes ?? 0);
            rules.push(ruleSchema.parse({id:'learned_' + model.version.slice(0,12),block:'schedule',conditions,windows:[{days:[0,1,2,3,4,5,6],start:timeString(model.startMinute-lead),end:timeString(Math.min(1439,model.endMinute+1))}],value,priority:50}));
            baselineScore += model.baselineMAE ?? 0;candidateScore += model.candidateMAE ?? 0;
        }
    }
    if(!Object.keys(parameters).length && !rules.length)return null;
    const plan:AdaptationPlan = {schemaVersion:1,planId:randomUUID(),functionId:fn.id,baseRevision:config.revision,modelVersion:model.version,dataHash:model.dataHash,createdAt:now,
        reviewAt:now+a.evaluateAfterMs,expiresAt:now+604800000,parameters,rules,expected:{kind:'estimated',baselineScore,candidateScore,description:'Chronological model fit and configured objective proxies. This is not measured energy saving.'},hardChecks:['scope','hard_limits','minimum_service','device_capability','model_quality','manual_priority'],};
    return validatePlan(plan,fn,config,model,now);
}
