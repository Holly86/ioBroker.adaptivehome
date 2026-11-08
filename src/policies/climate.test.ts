import { strict as assert } from 'node:assert';
import { referenceConfiguration } from '../config/examples';
import { Observation } from '../model/contracts';
import { airDecision, climateDecision } from './climate';
import { PolicyContext, PolicyMemory } from './policy';
const point = (value:number|boolean,capability:string):Observation => ({entityId:'test',capability,value,unit:'',measuredAt:1000,receivedAt:1000,quality:'valid',sourceId:'test.0.input'});
const context = (inputs:Record<string,Observation|null>):PolicyContext => ({now:1000,startedAt:0,timezone:'UTC',inputs,actual:null,owns:false,manual:false});
describe('AP-16 independent climate and air', () => {
    it('keeps heating demand separate from measured heat supply and unavailable weather', () => {
        const fn = referenceConfiguration('apartment').functions[1],memory:PolicyMemory = {},ctx = context({temperature:point(17,'temperatureSensor')});
        assert.equal(climateDecision(fn,ctx,memory).value,21);
        assert.equal(climateDecision(fn,{...ctx,now:3601000},memory).reason,'heat_supply_unverified');
        assert.equal(climateDecision(fn,context({}),{}).value,21);
    });
    it('uses model-specific fan outputs and hysteresis without inventing missing measurements', () => {
        const fn = referenceConfiguration('air').functions[0],memory:PolicyMemory = {};
        assert.equal(airDecision(fn,context({airQuality:point(30,'airQuality')}),memory).value,75);
        assert.equal(airDecision(fn,context({airQuality:point(23,'airQuality')}),memory).value,75);
        assert.equal(airDecision(fn,context({airQuality:point(19,'airQuality')}),memory).value,25);
        assert.equal(airDecision(fn,context({}),memory).value,undefined);
    });
});
