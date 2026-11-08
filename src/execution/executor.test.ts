import { strict as assert } from 'node:assert';
import { referenceConfiguration } from '../config/examples';
import { Intent } from '../model/contracts';
import { ManualClock } from '../runtime/clock';
import { Executor, ExecutionPort } from './executor';
describe('AP-06 execution safety', () => {
    function setup() {
        const clock = new ManualClock(10000), config = referenceConfiguration('aquarium'), writes: unknown[] = [];
        const port: ExecutionPort = {read:async () => null,metadata:async () => ({type:'boolean',write:true}),write:async (id,value) => {writes.push({id,value});},persist:async () => undefined,inputs:async () => ({})};
        const executor = new Executor(() => config,port,clock);
        const intent = (intentId: string,value = true): Intent => ({intentId,functionId:'light',entityId:'light',capability:'switch',typedValue:value,origin:'configured_rule',actor:'policy',reasonCode:'schedule',reasonText:'scheduled',sourceSnapshotId:'s',configRevision:0,priority:40,validFrom:clock.now(),expiresAt:clock.now()+60000});
        return {clock,config,writes,port,executor,intent};
    }
    it('deduplicates dispatch and distinguishes backend feedback from physical proof', async () => {
        const s = setup();await s.executor.execute(s.intent('one'));await s.executor.execute(s.intent('one'));assert.equal(s.writes.length,1);
        await s.executor.feedback('test.0.light.switch',{val:true,ts:s.clock.now(),ack:true});
        assert.equal(s.executor.journal.commands[0].feedbackMatched,true);assert.equal(s.executor.journal.commands[0].deviceConfirmed,false);
    });
    it('rechecks new manual priority after an asynchronous preflight', async () => {
        const s = setup();s.port.inputs = async () => {await s.executor.feedback('test.0.light.switch',{val:false,ts:s.clock.now(),ack:false,from:'system.adapter.other.0'});return {};};
        await assert.rejects(s.executor.execute(s.intent('race')),/manual_priority/);assert.equal(s.writes.length,0);
    });
    it('preserves budgets and uncertain locks over restart, without replay', async () => {
        const s = setup();await s.executor.execute(s.intent('one'));
        const restarted = new Executor(() => s.config,s.port,s.clock);await restarted.restore(structuredClone(s.executor.journal));
        await assert.rejects(restarted.execute(s.intent('two')),/uncertain/);assert.equal(s.writes.length,1);assert.equal(restarted.journal.budgets['synthetic-light'].length,1);
    });
    it('rejects minimum-service violations and retries a temporary audit locally', async () => {
        const s = setup();await assert.rejects(s.executor.execute({...s.intent('essential',false),functionId:'circulation',entityId:'circulation'}),/minimum_service/);
        let attempts = 0;s.port.metadata = async () => {if(attempts++ === 0)throw new Error('temporary_audit');return {type:'boolean',write:true};};
        await assert.rejects(s.executor.execute(s.intent('audit1')),/temporary/);s.clock.advance(1001);await s.executor.execute(s.intent('audit2'));assert.equal(s.writes.length,1);
    });
});
