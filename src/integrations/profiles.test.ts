import { strict as assert } from 'node:assert';
import { builtInRegistry, shellyProfile, homematicCcuProfile, homematicCloudProfile } from './profiles';
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
describe('AP-10 separate Homematic transports', () => {
    it('maps CCU fractional levels and Cloud group temperatures without a private extension', () => {
        const ccu = homematicCcuProfile.discover({'hm-rpc.0.synthetic.1.LEVEL':{type:'number',unit:'',min:0,max:1,write:true}})[0];
        assert.equal(normalize(ccu,ccu.capabilities[0],{val:.5,ts:10},10).value,50);builtInRegistry().validate(ccu);
        const cloud = homematicCloudProfile.discover({'hmip.0.groups.synthetic.setPointTemperature':{type:'number',unit:'°C',write:true},'hmip.0.groups.synthetic.activeProfile':{type:'string',write:true}})[0];
        assert.equal(cloud.capabilities.length,2);assert.equal(cloud.confirmed,false);builtInRegistry().validate(cloud);
        assert.ok(!cloud.capabilities.some(c => c.capability === 'nativeDeadline'));
    });
});
