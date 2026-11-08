import { createHash } from 'node:crypto';
import { bindingSchema, CapabilityMapping, DeviceBinding, mappingSchema } from '../model/contracts';
import { IntegrationManifest, IntegrationRegistry, StateMetadata } from './registry';
export interface DetectionRule {
    capability:string; suffix:RegExp; type:'boolean'|'number'|'string'; unit?:string;
    readOnly?:boolean; scale?:number; valueMap?:Record<string,boolean|number|string>; normalizedType?:'boolean'|'number'|'string';
    codec?:'identity'|'hueLightLevel';
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
export function createProfile(id:string,name:string,backends:string[],rules:DetectionRule[], channelOf = (path:string):string => path.slice(0,path.lastIndexOf('.'))):IntegrationManifest {
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
            if((meta.unit ?? '') !== unit && !rule.scale && !rule.valueMap && !rule.codec)continue;
            const valueMap = rule.valueMap && meta.states ? Object.fromEntries(Object.entries(rule.valueMap).filter(([key]) => Object.hasOwn(meta.states!,key))) : rule.valueMap;
            const writable = meta.write && !rule.readOnly && (!rule.valueMap || !!meta.states);
            const mapping = mappingSchema.parse({capability:rule.capability,readId:path,valueType:rule.normalizedType ?? rule.type,
                sourceType:rule.type,unit,sourceUnit:meta.unit ?? '',scale:rule.scale ?? 1,valueMap,codec:rule.codec,
                ...(writable ? {writeId:path,confirmId:path} : {}),min:rule.scale ? meta.min === undefined ? undefined : meta.min*rule.scale : meta.min,max:rule.scale ? meta.max === undefined ? undefined : meta.max*rule.scale : meta.max,
                values:valueMap ? [...new Set(Object.values(valueMap))] : undefined,confirmation:'backend'});
            const channel = channelOf(path);
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
export const homematicCcuProfile = createProfile('homematic-ccu','Homematic CCU',['hm-rpc'],[
    {capability:'switch',suffix:/\.STATE$/i,type:'boolean'},
    {capability:'dimmer',suffix:/\.LEVEL$/i,type:'number',unit:'%',scale:100},
    {capability:'windowContact',suffix:/\.(?:STATE|WINDOW_STATE)$/i,type:'boolean',readOnly:true},...standardRules,
]);
export const homematicCloudProfile = createProfile('homematic-cloud','Homematic IP Cloud',['hmip'],[
    {capability:'switch',suffix:/\.(?:on|state)$/i,type:'boolean'},
    {capability:'dimmer',suffix:/\.dimLevel$/i,type:'number',unit:'%',scale:100},
    {capability:'nativeProfile',suffix:/\.activeProfile$/i,type:'string'},
    {capability:'windowContact',suffix:/\.windowOpen$/i,type:'boolean',readOnly:true},...standardRules,
]);
export const hueProfile = createProfile('hue','Philips Hue bridge',['hue'],[
    {capability:'switch',suffix:/\.on$/i,type:'boolean'},
    {capability:'dimmer',suffix:/\.level$/i,type:'number',unit:'%'},
    {capability:'dimmer',suffix:/\.bri$/i,type:'number',unit:'%',scale:100/254},
    {capability:'color',suffix:/\.(?:hex|rgb)$/i,type:'string'},
    {capability:'illuminance',suffix:/\.lightlevel$/i,type:'number',unit:'lx',codec:'hueLightLevel',readOnly:true},...standardRules,
]);
export const philipsAirProfile = createProfile('philips-air','Philips Air model-selected backend',['philips-air'],[
    {capability:'switch',suffix:/\.control\.power$/i,type:'boolean'},
    // Values are ordinal operating levels, not percentages or universal raw Philips codes.
    {capability:'fan',suffix:/\.control\.fanSpeed$/i,type:'string',normalizedType:'number',unit:'',valueMap:{silent:0,'1':1,'2':2,'3':3,turbo:4,auto:5,allergenSleep:6}},
    {capability:'fan',suffix:/\.control\.mode$/i,type:'string',normalizedType:'number',unit:'',valueMap:{off:0,speed1:1,speed2:2,speed3:3,speed4:4,speed5:5,sleep:6,turbo:7,medium:8,auto:9}},
    {capability:'airQuality',suffix:/\.pm25$/i,type:'number',unit:'µg/m³',readOnly:true},
    {capability:'filterLife',suffix:/\.(?:hepaFilterReplaceInHours|preFilterCleanInHours)$/i,type:'number',unit:'hours',readOnly:true},
    ...standardRules.filter(rule => !['power','thermostatSetpoint'].includes(rule.capability)),
],path => path.split('.').slice(0,2).join('.'));
export const ikeaTradfriProfile = createProfile('ikea-tradfri','IKEA Tradfri gateway',['tradfri'],[
    {capability:'switch',suffix:/\.(?:on|state)$/i,type:'boolean'},
    {capability:'dimmer',suffix:/\.brightness$/i,type:'number',unit:'%'},...standardRules,
]);
export const ikeaMatterProfile = createProfile('ikea-matter','Explicit IKEA over Matter',['matter'],[
    {capability:'switch',suffix:/\.(?:on|power|state)$/i,type:'boolean'},
    {capability:'dimmer',suffix:/\.(?:level|brightness)$/i,type:'number',unit:'%'},...standardRules,
]);
export const ikeaZigbeeProfile = createProfile('ikea-zigbee','Explicit IKEA over Zigbee',['zigbee'],[
    {capability:'switch',suffix:/\.(?:state|on)$/i,type:'boolean'},
    {capability:'dimmer',suffix:/\.brightness$/i,type:'number',unit:'%'},...standardRules,
]);
export const genericProfile:IntegrationManifest = {apiVersion:1,id:'generic',name:'Explicit state mapping',backends:[],capabilities:['switch','dimmer','color','temperatureSensor','thermostatSetpoint','windowContact','motion','illuminance','power','energy','fan','airQuality','flow','filterLife','online','battery','nativeProfile'],discover:() => []};
export function builtInRegistry():IntegrationRegistry {const registry = new IntegrationRegistry();for(const profile of [genericProfile,shellyProfile,homematicCcuProfile,homematicCloudProfile,hueProfile,philipsAirProfile,ikeaTradfriProfile,ikeaMatterProfile,ikeaZigbeeProfile])registry.register(profile);return registry;}
export function discoverProfiles(objects:Record<string,StateMetadata>,registry = builtInRegistry()):DeviceBinding[]{return registry.list().flatMap(profile => profile.discover(objects));}
