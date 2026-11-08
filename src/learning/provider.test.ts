import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { referenceConfiguration } from '../config/examples';
import { OptionalProvider, providerSchema } from './provider';
describe('AP-21 optional provider contracts', () => {
    it('uses a real local HTTP JSON path, reserves quota and rejects executable responses', async () => {
        const fn = referenceConfiguration('apartment').functions[0];fn.autonomy.parameters = {holdMs:{min:60000,max:600000}};
        let malicious = false;
        const server = createServer((req,res) => {req.resume();res.setHeader('Content-Type','application/json');res.end(JSON.stringify({candidate:malicious ? {script:'untrusted'} : {functionId:fn.id,baseRevision:0,parameters:{holdMs:240000},rules:[],explanation:'Deterministic local HTTP contract fixture'}}));});
        await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
        try{
            const address = server.address() as {port:number},config = providerSchema.parse({enabled:true,id:'local',kind:'http-json',endpoint:`http://127.0.0.1:${address.port}`,scopes:[fn.id],shareSummary:true,maxRequestsPerDay:2,maxCostPerDay:0,reservedCostPerRequest:0});
            const provider = new OptionalProvider(async () => undefined);assert.equal((await provider.propose(config,'',fn,0,1000,{})).parameters.holdMs,240000);
            malicious = true;await assert.rejects(provider.propose(config,'',fn,0,1001,{}));await assert.rejects(provider.propose(config,'',fn,0,1002,{}),/budget/);
            assert.equal(provider.budgets.local.requests,2);
        }finally{await new Promise<void>(resolve => server.close(() => resolve()));}
    });
});
