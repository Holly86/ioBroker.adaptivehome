import { strict as assert } from 'node:assert';
import { builtInRegistry, shellyProfile } from './profiles';
import { normalize } from './registry';
describe('AP-09 Shelly contract fixtures', () => {
    it('keeps channels distinct, requires confirmation and preserves false feedback', () => {
        const discovered = shellyProfile.discover({'shelly.0.synthetic.Relay0.Switch':{type:'boolean',write:true},'shelly.0.synthetic.Relay1.Switch':{type:'boolean',write:true}});
        assert.equal(discovered.length,2);assert.notEqual(discovered[0].physicalId,discovered[1].physicalId);
        for(const binding of discovered){assert.equal(binding.confirmed,false);builtInRegistry().validate(binding);assert.equal(normalize(binding,binding.capabilities[0],{val:false,ts:1},1).value,false);}
    });
    it('does not invent controls or units for unknown raw values', () => {
        assert.deepEqual(shellyProfile.discover({'shelly.0.device.brightness':{type:'number',unit:'unknown',write:true}}),[]);
    });
});
