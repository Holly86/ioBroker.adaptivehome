import * as utils from '@iobroker/adapter-core';
import { ConfigurationStore, ConfigRecord } from './config/configuration';
import { HomeRuntime } from './runtime/home';
import { ExecutionJournal } from './execution/executor';
import { StateMetadata, StateValue } from './integrations/registry';
import { builtInRegistry, discoverProfiles } from './integrations/profiles';
import { registerDefinitions } from './integrations/sdk';
import { IntegrationRegistry } from './integrations/registry';
import { clientSchema, ControlClient, MUTATIONS, OperationGuard, RequestRecord, verifyControl } from './runtime/control';
import { OptionalProvider, providerSchema } from './learning/provider';
class Adaptivehome extends utils.Adapter {
    private registry:IntegrationRegistry = builtInRegistry();
    private runtime!: HomeRuntime;
    private clients:ControlClient[] = [];
    private guard = new OperationGuard(records => this.persistJournal('operations',records));
    private provider = new OptionalProvider(budgets => this.persistJournal('providerBudgets',budgets));
    private timer?: ReturnType<typeof setInterval>;
    private configuration = new ConfigurationStore({
        read: async () => {
            const value = await this.getStateAsync('configuration.record');
            return typeof value?.val === 'string' ? JSON.parse(value.val) as ConfigRecord : null;
        },
        write: async record => { await this.setStateAsync('configuration.record', JSON.stringify(record), true); },
    },this.registry);
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'adaptivehome' });
        this.on('ready', () => void this.ready());
        this.on('stateChange', (id,state) => { if (state && this.runtime) void this.runtime.feedback(id,state as StateValue).catch(() => this.log.warn('Feedback could not be persisted')); });
        this.on('objectChange', () => this.runtime?.executor.invalidateAudit());
        this.on('message', obj => void this.message(obj));
        this.on('unload', callback => {
            if (this.timer) clearInterval(this.timer);
            this.runtime?.close();
            callback();
        });
    }
    private async ready(): Promise<void> {
        registerDefinitions(this.registry,this.config.integrationProfiles ?? []);
        this.clients = (this.config.controlClients ?? []).map(client => clientSchema.parse(client));
        await this.setObjectNotExistsAsync('configuration.record', {
            type: 'state', common: {name: 'Authoritative configuration record', type: 'string', role: 'json', read: true, write: false}, native: {},
        });
        await this.configuration.load();
        this.runtime = new HomeRuntime(() => this.configuration.record.active, {
            read: async id => await this.getForeignStateAsync(id) as StateValue | null,
            metadata: async id => { const obj = await this.getForeignObjectAsync(id);return obj?.type === 'state' ? obj.common as StateMetadata : null; },
            write: async (id,value) => { await this.setForeignStateAsync(id,value,false); },
            send: (adapter,command,payload) => new Promise(resolve => this.sendTo(adapter,command,payload,resolve)),
            persist: (key,value) => this.persistJournal(key,value),
        });
        const journal = await this.getStateAsync('journal.execution');
        await this.runtime.initialize(typeof journal?.val === 'string' ? JSON.parse(journal.val) as ExecutionJournal : undefined);
        const history = await this.getStateAsync('journal.history');
        if(typeof history?.val === 'string')try{this.runtime.history.restore(JSON.parse(history.val));}catch{this.runtime.history.dropped++;}
        const incidents = await this.getStateAsync('journal.incidents');
        if(typeof incidents?.val === 'string')try{this.runtime.incidents.restore(JSON.parse(incidents.val));}catch{this.log.warn('Incident journal could not be read');}
        const operations = await this.getStateAsync('journal.operations');
        if(typeof operations?.val === 'string')this.guard.records = JSON.parse(operations.val) as RequestRecord[];
        const learning = await this.getStateAsync('journal.learning');
        if(typeof learning?.val === 'string')try{this.runtime.learning.restore(JSON.parse(learning.val));}catch{this.log.warn('Learning journal unavailable; classical control continues');}
        const budgets = await this.getStateAsync('journal.providerBudgets');
        if(typeof budgets?.val === 'string')this.provider.budgets = JSON.parse(budgets.val);
        await this.subscriptions();
        await this.setObjectNotExistsAsync('info.connection', {
            type: 'state', common: {name: 'Runtime ready', type: 'boolean', role: 'indicator.connected', read: true, write: false}, native: {},
        });
        await this.setStateAsync('info.connection', true, true);
        this.timer = setInterval(() => void this.runtime.tick().catch(() => this.log.warn('A runtime round failed; no global device action was issued')), 1000);
    }
    private async persistJournal(key:string,value:unknown):Promise<void>{
        await this.setObjectNotExistsAsync(`journal.${key}`,{type:'state',common:{name:`Private ${key} journal`,type:'string',role:'json',read:true,write:false},native:{}});
        await this.setStateAsync(`journal.${key}`,JSON.stringify(value),true);
    }
    private async subscriptions(): Promise<void> {
        await this.unsubscribeForeignStatesAsync('*');await this.unsubscribeForeignObjectsAsync('*');
        for (const binding of this.configuration.record.active.bindings) for (const mapping of binding.capabilities) {
            for (const id of new Set([mapping.readId,mapping.writeId,mapping.confirmId].filter((v): v is string => !!v))) {
                await this.subscribeForeignStatesAsync(id);await this.subscribeForeignObjectsAsync(id);
            }
        }
        this.runtime.configure();
    }
    private async message(obj: ioBroker.Message): Promise<void> {
        if (!obj.callback) return;
        let result: unknown;
        let operationKey:string|undefined;
        const originalCommand = obj.command;
        let command = obj.command, data = obj.message,remoteScope:string|undefined;
        try {
            if(command === 'control'){
                const envelope = verifyControl(obj.from,data,this.clients,this.config.controlSecret ?? '');
                if(envelope.expiresAt <= Date.now() || envelope.expiresAt > Date.now()+300000)throw new Error('request_expired');
                if(envelope.expectedRevision !== this.configuration.record.active.revision)throw new Error('revision_conflict');
                remoteScope = envelope.functionId;data = envelope;
                command = ['pause','cancel','revert'].includes(envelope.action) ? 'adaptation' : envelope.action;
            }else if(!this.guard.isAdmin(obj.from) && command !== 'health')throw new Error('admin_transport_required');
            if(MUTATIONS.has(command)){
                const reservation = await this.guard.reserve(obj.from,data,this.configuration.record.active.revision,Date.now());
                if(reservation.duplicate){this.sendTo(obj.from,originalCommand,reservation.result,obj.callback);return;}
                operationKey = reservation.key;
            }
            switch (command) {
                case 'health': result = {ready: !!this.runtime, revision: this.configuration.record.active.revision}; break;
                case 'status': {
                    result = this.runtime.status();
                    if(remoteScope){const status = result as {functions:Record<string,unknown>;traces:Record<string,unknown>};result = {functions:{[remoteScope]:status.functions[remoteScope]},traces:{[remoteScope]:status.traces[remoteScope]}};}
                    break;
                }
                case 'getConfiguration': result = this.configuration.record; break;
                case 'discover': {
                    const objects:Record<string,StateMetadata> = {};
                    for(const profile of this.registry.list())for(const backend of profile.backends){
                        const view = await this.getObjectViewAsync('system','state',{startkey:backend + '.',endkey:backend + '.\u9999'});
                        for(const row of view.rows.slice(0,10000))if(row.value?.common)objects[row.id] = row.value.common as StateMetadata;
                    }
                    result = discoverProfiles(objects,this.registry);break;
                }
                case 'previewConfiguration': result = this.configuration.preview(data); break;
                case 'exportConfiguration': result = this.configuration.export(); break;
                case 'applyConfiguration':
                    result = await this.configuration.activate(data.configuration, data.expectedRevision);
                    await this.subscriptions();
                    await this.configuration.applied(this.configuration.record.active.revision);
                    break;
                case 'rollbackConfiguration':
                    result = await this.configuration.rollback(data.expectedRevision);
                    await this.subscriptions();
                    await this.configuration.applied(this.configuration.record.active.revision);
                    break;
                case 'manual': result = await this.runtime.manual(data.functionId,data.value,data.requestId,obj.from);break;
                case 'resume': result = await this.runtime.executor.resume(data.functionId);break;
                case 'reconcile': result = await this.runtime.executor.reconcile(data.functionId);break;
                case 'supportExport': result = this.runtime.history.supportExport();break;
                case 'clearHistory': this.runtime.history.clear();await this.setStateAsync('journal.history',JSON.stringify(this.runtime.history.record),true);result = true;break;
                case 'modelCandidate': {
                    const fn = this.configuration.record.active.functions.find(f => f.id === data.functionId);if(!fn)throw new Error('unknown_function');
                    const model = this.runtime.learning.record.models[fn.id]?.at(-1);
                    result = await this.provider.propose(providerSchema.parse(this.config.modelProvider),this.config.modelToken ?? '',fn,this.configuration.record.active.revision,Date.now(),model ? {type:model.modelType,coverage:model.coverage,baselineMAE:model.baselineMAE,candidateMAE:model.candidateMAE} : {});break;
                }
                default: throw new Error('unknown_command');
            }
            const response = {ok:true,result};if(operationKey)await this.guard.complete(operationKey,response);
            this.sendTo(obj.from, originalCommand, response, obj.callback);
        } catch (error) {
            const response = {ok:false,error:error instanceof Error ? error.message : 'request_failed'};
            if(operationKey)try{await this.guard.complete(operationKey,response);}catch{this.log.warn('Operation result could not be persisted');}
            this.sendTo(obj.from, originalCommand, response, obj.callback);
        }
    }
}
if (require.main !== module) module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Adaptivehome(options);
else new Adaptivehome();
