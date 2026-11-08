import { strict as assert } from 'node:assert';
import { Observation } from '../model/contracts';
import { PresenceContext, summarizeEnergy } from './context';
const point = (value: boolean | number, at: number, unit = ''): Observation => ({entityId:'test',capability:'presence',value,unit,measuredAt:at,receivedAt:at,sourceId:'test.0.input',quality:'valid'});
describe('AP-07 optional context quality', () => {
    it('debounces absence, requires configurable independent confirmations and forgets changed sources', () => {
        const context = new PresenceContext();
        assert.equal(context.evaluate('room',point(true,100),100,300,2).value,null);
        assert.equal(context.evaluate('room',point(true,100),100,300,2).value,null);
        assert.equal(context.evaluate('room',point(true,101),101,300,2).value,true);
        assert.equal(context.evaluate('room',point(false,102),200,300,2).value,true);
        assert.equal(context.evaluate('room',point(false,102),402,300,2).value,false);
        assert.equal(context.evaluate('room',{...point(false,403),sourceId:'other.0.input'},403,300,2).value,null);
        assert.equal(context.evaluate('room',{...point(false,404),quality:'unavailable'},404,300,2).value,null);
    });
    it('reports coverage and separates power integration from meter readings', () => {
        assert.deepEqual(summarizeEnergy([point(1000,0,'W'),point(1000,3600000,'W')],0,3600000,3600000),{kind:'integrated',kWh:1,coverage:1,gaps:0});
        assert.equal(summarizeEnergy([point(1000,0,'W'),point(1000,3600000,'W')],0,3600000).kWh,null);
        assert.equal(summarizeEnergy([point(5,0,'kWh'),point(6,3600000,'kWh')],0,3600000).kind,'metered');
    });
});
