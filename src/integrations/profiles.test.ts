import { strict as assert } from 'node:assert';
import { builtInRegistry, shellyProfile, homematicCcuProfile, homematicCloudProfile, hueProfile, philipsAirProfile, ikeaTradfriProfile, ikeaMatterProfile, ikeaZigbeeProfile } from './profiles';
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
describe('AP-13 optional IKEA backend paths', () => {
    it('keeps Tradfri, Matter and Zigbee profiles distinct and does not require any backend', () => {
        assert.deepEqual(ikeaTradfriProfile.discover({}),[]);
        for(const [profile,prefix] of [[ikeaTradfriProfile,'tradfri'],[ikeaMatterProfile,'matter'],[ikeaZigbeeProfile,'zigbee']] as const){
            const binding = profile.discover({[prefix + '.0.synthetic.state']:{type:'boolean',write:true}})[0];
            assert.equal(binding.integrationId,profile.id);assert.equal(binding.confirmed,false);builtInRegistry().validate(binding);
        }
    });
});
describe('AP-12 model-selected Philips Air backend', () => {
    it('maps exposed named levels and rejects unknown status codes and timer writes', () => {
        const binding = philipsAirProfile.discover({'philips-air.0.control.fanSpeed':{type:'string',write:true},'philips-air.0.sensor.pm25':{type:'number',unit:'µg/m³'},'philips-air.0.control.timerCode':{type:'string',write:true}})[0];
        builtInRegistry().validate(binding);const fan = binding.capabilities.find(c => c.capability === 'fan')!;
        assert.equal(normalize(binding,fan,{val:'turbo',ts:1},1).value,4);
        assert.equal(normalize(binding,fan,{val:'unknown-device-code',ts:1},1).quality,'invalid');
        assert.ok(!binding.capabilities.some(c => c.writeId?.endsWith('timerCode')));
        assert.ok(!binding.capabilities.some(c => c.capability === 'thermostatSetpoint'));
    });
});
describe('AP-11 Hue normalization', () => {
    it('converts logarithmic light level to lux and excludes unapproved groups', () => {
        const fixtures = {'hue.0.synthetic.lightlevel':{type:'number',unit:'',write:false},'hue.0.synthetic.presence':{type:'boolean',write:false},'hue.0.groups.excluded.on':{type:'boolean',write:true}};
        const bindings = hueProfile.discover(fixtures);assert.equal(bindings.length,1);assert.equal(bindings[0].capabilities.length,2);
        const light = bindings[0].capabilities.find(c => c.capability === 'illuminance')!;
        assert.equal(normalize(bindings[0],light,{val:20001,ts:1},1).value,100);builtInRegistry().validate(bindings[0]);
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
