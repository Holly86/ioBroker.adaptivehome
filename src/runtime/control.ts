import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { id, scalar } from '../model/contracts';
export const clientSchema = z.strictObject({id,sender:z.string().regex(/^system\.adapter\.[a-z][a-z0-9-]*\.\d+$/),userId:z.string().min(1),chatId:z.string().min(1),functions:z.array(id).max(256),actions:z.array(z.enum(['manual','resume','pause','cancel','revert','status'])).max(6)});
export type ControlClient = z.infer<typeof clientSchema>;
export const controlSchema = z.strictObject({clientId:id,requestId:z.string().min(1).max(128),expectedRevision:z.number().int().nonnegative(),expiresAt:z.number().finite(),functionId:id,
    action:z.enum(['manual','resume','pause','cancel','revert','status']),value:scalar.optional(),userId:z.string().min(1),chatId:z.string().min(1),forwarded:z.literal(false),signature:z.string().regex(/^[a-f0-9]{64}$/)});
export type ControlEnvelope = z.infer<typeof controlSchema>;
export const MUTATIONS = new Set(['applyConfiguration','rollbackConfiguration','manual','resume','reconcile','clearHistory','adaptation']);
export function signedContent(input:Omit<ControlEnvelope,'signature'>):string {
    return JSON.stringify([input.clientId,input.requestId,input.expectedRevision,input.expiresAt,input.functionId,input.action,input.value ?? null,input.userId,input.chatId,input.forwarded]);
}
export function verifyControl(sender:string,raw:unknown,clients:ControlClient[],secret:string):ControlEnvelope {
    const envelope = controlSchema.parse(raw),client = clients.find(c => c.id === envelope.clientId);
    if(!client || client.sender !== sender || client.userId !== envelope.userId || client.chatId !== envelope.chatId || !client.functions.includes(envelope.functionId) || !client.actions.includes(envelope.action))throw new Error('control_scope_denied');
    if(secret.length < 32)throw new Error('control_secret_not_configured');
    const expected = createHmac('sha256',secret).update(signedContent(envelope)).digest();
    if(!timingSafeEqual(expected,Buffer.from(envelope.signature,'hex')))throw new Error('control_signature_invalid');
    return envelope;
}
export interface RequestRecord {key:string;expiresAt:number;state:'reserved'|'completed';result?:unknown}
export class OperationGuard {
    records:RequestRecord[] = [];
    constructor(private persist:(records:RequestRecord[]) => Promise<void>){}
    isAdmin(sender:string):boolean {return /^system\.adapter\.admin\.\d+$/.test(sender);}
    async reserve(sender:string,payload:{requestId?:unknown;expiresAt?:unknown;expectedRevision?:unknown},revision:number,now:number):Promise<{key:string;duplicate:boolean;result?:unknown}>{
        if(typeof payload.requestId !== 'string' || payload.requestId.length > 128 || !payload.requestId.length || typeof payload.expiresAt !== 'number')throw new Error('request_envelope_required');
        const key = sender + ':' + payload.requestId,existing = this.records.find(r => r.key === key);
        if(existing){if(existing.state !== 'completed')throw new Error('request_in_progress_or_uncertain');return {key,duplicate:true,result:existing.result};}
        if(payload.expiresAt <= now || payload.expiresAt > now+300000)throw new Error('request_expired');
        if(payload.expectedRevision !== revision)throw new Error('revision_conflict');
        this.records = this.records.filter(r => r.expiresAt > now-86400000).slice(-2047);
        this.records.push({key,expiresAt:payload.expiresAt,state:'reserved'});await this.persist(this.records);return {key,duplicate:false};
    }
    async complete(key:string,result:unknown):Promise<void>{const record = this.records.find(r => r.key === key)!;record.state = 'completed';record.result = result;await this.persist(this.records);}
}
