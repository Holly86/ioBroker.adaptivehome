import { createHash, randomUUID } from 'node:crypto';
import { Configuration, NotificationRoute } from '../model/contracts';
import { windowMatches } from '../config/schedule';
import { deadline } from '../runtime/clock';
export interface Incident {
    incidentId:string;dedupKey:string;scope:string;cause:string;severity:'info'|'warning'|'error';
    status:'active'|'resolved';firstSeen:number;lastSeen:number;impacts:string[];
}
export interface Delivery {key:string;incidentId:string;at:number;attempts:number;status:'requested'|'channel_accepted'|'uncertain'|'failed';delivered:false}
export interface IncidentRecord {version:1;incidents:Incident[];deliveries:Delivery[]}
export class IncidentService {
    record:IncidentRecord = {version:1,incidents:[],deliveries:[]};
    private sending = false;
    private dirty = false;
    constructor(private persist:(record:IncidentRecord) => Promise<void>,private send:(adapter:string,command:string,payload:Record<string,unknown>) => Promise<unknown>){}
    restore(record:IncidentRecord):void{if(record?.version === 1 && Array.isArray(record.incidents) && Array.isArray(record.deliveries)){this.record = {version:1,incidents:record.incidents.slice(-256),deliveries:record.deliveries.slice(-1024)};}}
    upsert(scope:string,cause:string,severity:Incident['severity'],now:number):Incident {
        const dedupKey = scope + ':' + cause;let incident = this.record.incidents.find(i => i.dedupKey === dedupKey && i.status === 'active');
        if(!incident){incident = {incidentId:randomUUID(),dedupKey,scope,cause,severity,status:'active',firstSeen:now,lastSeen:now,impacts:[scope]};this.record.incidents.push(incident);this.record.incidents = this.record.incidents.slice(-256);this.dirty = true;}
        incident.lastSeen = now;return incident;
    }
    resolveScope(scope:string,now:number):void {for(const i of this.record.incidents)if(i.scope === scope && i.status === 'active'){i.status = 'resolved';i.lastSeen = now;this.dirty = true;}}
    private payload(route:NotificationRoute,incident:Incident):Record<string,unknown>{
        const text = `Adaptive Home: ${incident.scope}: ${incident.cause} (${incident.status})`;
        if(route.adapter.startsWith('telegram.'))return {user:route.recipient,text};
        if(route.adapter.startsWith('pushover.'))return {user:route.recipient,message:text};
        return {to:route.recipient,subject:'Adaptive Home: ' + incident.severity,text};
    }
    async tick(config:Configuration,now:number):Promise<void>{
        if(this.sending)return;this.sending = true;
        try{
            if(this.dirty){await this.persist(this.record);this.dirty = false;}
            for(const incident of this.record.incidents)for(const route of config.notificationRoutes){
                if(route.scopes.length && !route.scopes.includes(incident.scope))continue;
                if(route.topics.length && !route.topics.includes(incident.cause))continue;
                if(['info','warning','error'].indexOf(incident.severity) < ['info','warning','error'].indexOf(route.minimumSeverity))continue;
                if(incident.status === 'resolved' && !route.recovery)continue;
                if(route.quiet.some(window => windowMatches(window,now,config.timezone)))continue;
                const recipientHash = createHash('sha256').update(route.adapter + ':' + route.recipient).digest('hex').slice(0,16);
                const key = `${incident.incidentId}:${incident.status}:${route.id}:${recipientHash}`;
                let delivery = this.record.deliveries.find(d => d.key === key);
                if(delivery && (delivery.status === 'channel_accepted' || delivery.attempts >= route.maxAttempts || now-delivery.at < route.repeatMs))continue;
                if(!delivery){delivery = {key,incidentId:incident.incidentId,at:now,attempts:0,status:'requested',delivered:false};this.record.deliveries.push(delivery);this.record.deliveries = this.record.deliveries.slice(-1024);}
                delivery.at = now;delivery.attempts++;delivery.status = 'requested';await this.persist(this.record);
                try{const response = await deadline(this.send(route.adapter,'send',this.payload(route,incident)),1500);delivery.status = response && !(response as {error?:unknown}).error ? 'channel_accepted' : 'uncertain';}
                catch{delivery.status = 'uncertain';}
                await this.persist(this.record);
            }
        }finally{this.sending = false;}
    }
}
