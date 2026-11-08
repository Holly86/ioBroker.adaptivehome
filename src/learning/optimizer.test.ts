import { strict as assert } from 'node:assert';
import { referenceConfiguration } from '../config/examples';
import { optimize, validatePlan } from './optimizer';
import { trainLocal } from './model';
import { usageDataset } from './model.test';
describe('AP-22 finite local planning', () => {
    function setup(){const config = referenceConfiguration('apartment'),fn = config.functions[0],rows = usageDataset(),now = rows.at(-1)!.measuredAt;fn.autonomy = {...fn.autonomy,mode:'full',granted:true,capabilities:['switch'],blocks:['schedule','sensor'],parameters:{holdMs:{min:60000,max:600000}}};const model = trainLocal({kind:'usage',timezone:'UTC',now,observations:rows,profile:fn.autonomy,baselineStartMinute:600});return {config,fn,model,now};}
    it('creates executable granted parameter and schedule/sensor combinations without a language model', () => {
        const s = setup(),plan = optimize(s.fn,s.config,s.model,s.now)!;assert.ok(plan);assert.equal(plan.parameters.holdMs,600000);assert.equal(plan.rules[0].windows[0].start,'08:00');assert.ok(plan.rules[0].conditions.some(c => c.input === 'motion'));assert.ok(plan.expected.candidateScore<=plan.expected.baselineScore);
    });
    it('rejects excluded/essential scope and attempts to widen hard limits', () => {
        const s = setup(),plan = optimize(s.fn,s.config,s.model,s.now)!;
        assert.throws(() => validatePlan({...plan,parameters:{holdMs:99999999}},s.fn,s.config,s.model,s.now),/scope/);
        assert.equal(optimize({...s.fn,limits:{...s.fn.limits,essential:true,minimumValue:true}},s.config,s.model,s.now),null);
        assert.throws(() => validatePlan({...plan,script:'untrusted'},s.fn,s.config,s.model,s.now));
    });
});
