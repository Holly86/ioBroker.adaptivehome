import { strict as assert } from 'node:assert';
import { History } from './history';
describe('AP-08 bounded history', () => {
    it('deduplicates readings, rotates, recovers valid rows and strips support data', () => {
        const history = new History(2,1000), row = {entityId:'private_name',capability:'motion',value:true,unit:'',measuredAt:100,receivedAt:100,sourceId:'secret.0.motion',quality:'valid' as const};
        history.observation(row);history.observation(row);assert.equal(history.record.observations.length,1);
        history.restore({version:1,observations:[{broken:true},{...row,measuredAt:200,receivedAt:200}],events:[]});assert.equal(history.dropped,1);
        history.event({type:'decision',scope:'private_name',code:'motion',revision:1,at:200});
        const exported = JSON.stringify(history.supportExport());assert.ok(!exported.includes('private_name'));assert.ok(!exported.includes('secret.0.motion'));
        history.rotate(2000);assert.equal(history.record.observations.length,0);history.clear();assert.equal(history.record.events.length,0);
    });
});
