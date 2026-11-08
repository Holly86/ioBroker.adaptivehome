import * as utils from '@iobroker/adapter-core';
import { ConfigurationStore, ConfigRecord } from './config/configuration';
import { HomeRuntime } from './runtime/home';
import { ExecutionJournal } from './execution/executor';
import { StateMetadata, StateValue } from './integrations/registry';
import { builtInRegistry, discoverProfiles } from './integrations/profiles';
import { registerDefinitions } from './integrations/sdk';
import { IntegrationRegistry } from './integrations/registry';
class Adaptivehome extends utils.Adapter {
    private registry:IntegrationRegistry = builtInRegistry();
    private runtime!: HomeRuntime;
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
        await this.setObjectNotExistsAsync('configuration.record', {
            type: 'state', common: {name: 'Authoritative configuration record', type: 'string', role: 'json', read: true, write: false}, native: {},
        });
        await this.configuration.load();
        this.runtime = new HomeRuntime(() => this.configuration.record.active, {
            read: async id => await this.getForeignStateAsync(id) as StateValue | null,
            metadata: async id => { const obj = await this.getForeignObjectAsync(id);return obj?.type === 'state' ? obj.common as StateMetadata : null; },
            write: async (id,value) => { await this.setForeignStateAsync(id,value,false); },
            persist: async (key,value) => {
                await this.setObjectNotExistsAsync(`journal.${key}`,{type:'state',common:{name:`Private ${key} journal`,type:'string',role:'json',read:true,write:false},native:{}});
                await this.setStateAsync(`journal.${key}`,JSON.stringify(value),true);
            },
        });
        const journal = await this.getStateAsync('journal.execution');
        await this.runtime.initialize(typeof journal?.val === 'string' ? JSON.parse(journal.val) as ExecutionJournal : undefined);
        const history = await this.getStateAsync('journal.history');
        if(typeof history?.val === 'string')try{this.runtime.history.restore(JSON.parse(history.val));}catch{this.runtime.history.dropped++;}
        await this.subscriptions();
        await this.setObjectNotExistsAsync('info.connection', {
            type: 'state', common: {name: 'Runtime ready', type: 'boolean', role: 'indicator.connected', read: true, write: false}, native: {},
        });
        await this.setStateAsync('info.connection', true, true);
        this.timer = setInterval(() => void this.runtime.tick().catch(() => this.log.warn('A runtime round failed; no global device action was issued')), 1000);
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
        try {
            switch (obj.command) {
                case 'health': result = {ready: !!this.runtime, revision: this.configuration.record.active.revision}; break;
                case 'status': result = this.runtime.status(); break;
                case 'getConfiguration': result = this.configuration.record; break;
                case 'discover': {
                    const objects:Record<string,StateMetadata> = {};
                    for(const profile of this.registry.list())for(const backend of profile.backends){
                        const view = await this.getObjectViewAsync('system','state',{startkey:backend + '.',endkey:backend + '.\u9999'});
                        for(const row of view.rows.slice(0,10000))if(row.value?.common)objects[row.id] = row.value.common as StateMetadata;
                    }
                    result = discoverProfiles(objects,this.registry);break;
                }
                case 'previewConfiguration': result = this.configuration.preview(obj.message); break;
                case 'exportConfiguration': result = this.configuration.export(); break;
                case 'applyConfiguration':
                    result = await this.configuration.activate(obj.message.configuration, obj.message.expectedRevision);
                    await this.subscriptions();
                    await this.configuration.applied(this.configuration.record.active.revision);
                    break;
                case 'rollbackConfiguration':
                    result = await this.configuration.rollback(obj.message.expectedRevision);
                    await this.subscriptions();
                    await this.configuration.applied(this.configuration.record.active.revision);
                    break;
                case 'manual': result = await this.runtime.manual(obj.message.functionId,obj.message.value,obj.message.requestId,obj.from);break;
                case 'resume': result = await this.runtime.executor.resume(obj.message.functionId);break;
                case 'reconcile': result = await this.runtime.executor.reconcile(obj.message.functionId);break;
                case 'supportExport': result = this.runtime.history.supportExport();break;
                case 'clearHistory': this.runtime.history.clear();await this.setStateAsync('journal.history',JSON.stringify(this.runtime.history.record),true);result = true;break;
                default: throw new Error('unknown_command');
            }
            this.sendTo(obj.from, obj.command, {ok: true, result}, obj.callback);
        } catch (error) {
            this.sendTo(obj.from, obj.command, {ok: false, error: error instanceof Error ? error.message : 'request_failed'}, obj.callback);
        }
    }
}
if (require.main !== module) module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Adaptivehome(options);
else new Adaptivehome();
