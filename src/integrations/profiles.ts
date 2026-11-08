import { createHash } from 'node:crypto';
import { bindingSchema, CapabilityMapping, DeviceBinding, mappingSchema } from '../model/contracts';
import { IntegrationManifest, IntegrationRegistry, StateMetadata } from './registry';
export interface DetectionRule {
    capability:string; suffix:RegExp; type:'boolean'|'number'|'string'; unit?:string;
    readOnly?:boolean; scale?:number; valueMap?:Record<string,boolean|number|string>; normalizedType?:'boolean'|'number'|'string';
}
export const standardRules: DetectionRule[] = [
    {capability:'motion',suffix:/(?:motion|presence|PRESENCE_DETECTION_STATE)$/i,type:'boolean',readOnly:true},
    {capability:'illuminance',suffix:/(?:illuminance|lux|ILLUMINATION)$/i,type:'number',unit:'lx',readOnly:true},
    {capability:'temperatureSensor',suffix:/(?:temperature|actualTemperature|ACTUAL_TEMPERATURE)$/i,type:'number',unit:'°C',readOnly:true},
    {capability:'thermostatSetpoint',suffix:/(?:setPointTemperature|SET_POINT_TEMPERATURE|SET_TEMPERATURE)$/i,type:'number',unit:'°C'},
    {capability:'windowContact',suffix:/(?:windowOpen|WINDOW_OPEN|contact)$/i,type:'boolean',readOnly:true},
    {capability:'online',suffix:/(?:reachable|online|connected)$/i,type:'boolean',readOnly:true},
    {capability:'battery',suffix:/(?:lowBat|LOWBAT|LOW_BAT)$/i,type:'boolean',readOnly:true},
    {capability:'power',suffix:/(?:power|Power|act_power)$/i,type:'number',unit:'W',readOnly:true},
    {capability:'energy',suffix:/(?:energy|Energy|total)$/i,type:'number',unit:'kWh',readOnly:true},
];
export function createProfile(id:string,name:string,backends:string[],rules:DetectionRule[]):IntegrationManifest {
    return {apiVersion:1,id,name,backends,capabilities:[...new Set(rules.map(r => r.capability))],discover(objects) {
        const channels = new Map<string,CapabilityMapping[]>();
        for(const [path,meta] of Object.entries(objects)) {
            if(!backends.some(b => path.startsWith(b + '.')) || meta.read === false)continue;
            // Aggregate Hue groups/scenes require explicit member authorization through manual mapping.
            if(id === 'hue' && /\.(groups|scenes)\./i.test(path))continue;
            const rule = rules.find(r => r.suffix.test(path) && meta.type === r.type);
            if(!rule)continue;
            const unit = rule.unit ?? meta.unit ?? '';
            // Unknown units are not guessed, except explicit identity-unit profiles.
            if((meta.unit ?? '') !== unit && !rule.scale && !rule.valueMap)continue;
            const mapping = mappingSchema.parse({capability:rule.capability,readId:path,valueType:rule.normalizedType ?? rule.type,
                sourceType:rule.type,unit,sourceUnit:meta.unit ?? '',scale:rule.scale ?? 1,valueMap:rule.valueMap,
                ...(meta.write && !rule.readOnly ? {writeId:path,confirmId:path} : {}),min:rule.scale ? meta.min === undefined ? undefined : meta.min*rule.scale : meta.min,max:rule.scale ? meta.max === undefined ? undefined : meta.max*rule.scale : meta.max,
                values:rule.valueMap ? [...new Set(Object.values(rule.valueMap))] : undefined,confirmation:'backend'});
            const channel = path.slice(0,path.lastIndexOf('.'));
            const list = channels.get(channel) || [];
            if(!list.some(c => c.capability === mapping.capability))list.push(mapping);
            channels.set(channel,list);
        }
        return [...channels].map(([channel,capabilities]) => bindingSchema.parse({id:id + '_' + createHash('sha256').update(channel).digest('hex').slice(0,12),
            physicalId:'confirm:' + channel,integrationId:id,family:name,backendVersion:'unverified',confirmed:false,capabilities,verification:'contract'}));
    }};
}
export const shellyProfile = createProfile('shelly','Shelly via existing adapter',['shelly'],[
    {capability:'switch',suffix:/(?:Switch|state|on|output)$/i,type:'boolean'},
    {capability:'dimmer',suffix:/(?:brightness|dim|Brightness)$/i,type:'number',unit:'%'},
    {capability:'color',suffix:/(?:rgb|color)$/i,type:'string'},...standardRules,
]);
export const genericProfile:IntegrationManifest = {apiVersion:1,id:'generic',name:'Explicit state mapping',backends:[],capabilities:['switch','dimmer','color','temperatureSensor','thermostatSetpoint','windowContact','motion','illuminance','power','energy','fan','airQuality','flow','filterLife','online','battery','nativeProfile'],discover:() => []};
export function builtInRegistry():IntegrationRegistry {const registry = new IntegrationRegistry();for(const profile of [genericProfile,shellyProfile])registry.register(profile);return registry;}
export function discoverProfiles(objects:Record<string,StateMetadata>,registry = builtInRegistry()):DeviceBinding[]{return registry.list().flatMap(profile => profile.discover(objects));}
