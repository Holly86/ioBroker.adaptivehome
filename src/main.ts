import * as utils from '@iobroker/adapter-core';
import { Supervisor } from './runtime/supervisor';
import { ConfigurationStore, ConfigRecord } from './config/configuration';
class Adaptivehome extends utils.Adapter {
    private runtime = new Supervisor();
    private timer?: ReturnType<typeof setInterval>;
    private configuration = new ConfigurationStore({
        read: async () => {
            const value = await this.getStateAsync('configuration.record');
            return typeof value?.val === 'string' ? JSON.parse(value.val) as ConfigRecord : null;
        },
        write: async record => { await this.setStateAsync('configuration.record', JSON.stringify(record), true); },
    });
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'adaptivehome' });
        this.on('ready', () => void this.ready());
        this.on('stateChange', () => { /* Specific subscriptions are installed with validated bindings. */ });
        this.on('objectChange', () => { /* Bindings are audited when configuration is activated. */ });
        this.on('message', obj => void this.message(obj));
        this.on('unload', callback => {
            if (this.timer) clearInterval(this.timer);
            this.runtime.close();
            callback();
        });
    }
    private async ready(): Promise<void> {
        await this.setObjectNotExistsAsync('configuration.record', {
            type: 'state', common: {name: 'Authoritative configuration record', type: 'string', role: 'json', read: true, write: false}, native: {},
        });
        await this.configuration.load();
        await this.setObjectNotExistsAsync('info.connection', {
            type: 'state', common: {name: 'Runtime ready', type: 'boolean', role: 'indicator.connected', read: true, write: false}, native: {},
        });
        await this.setStateAsync('info.connection', true, true);
        this.timer = setInterval(() => void this.runtime.tick(), 1000);
    }
    private async message(obj: ioBroker.Message): Promise<void> {
        if (!obj.callback) return;
        let result: unknown;
        try {
            switch (obj.command) {
                case 'health': result = {ready: true, functions: Object.fromEntries(this.runtime.status), revision: this.configuration.record.active.revision}; break;
                case 'status': result = {functions: Object.fromEntries(this.runtime.status), revision: this.configuration.record.active.revision}; break;
                case 'getConfiguration': result = this.configuration.record; break;
                case 'previewConfiguration': result = this.configuration.preview(obj.message); break;
                case 'exportConfiguration': result = this.configuration.export(); break;
                case 'applyConfiguration':
                    result = await this.configuration.activate(obj.message.configuration, obj.message.expectedRevision);
                    await this.configuration.applied(this.configuration.record.active.revision);
                    break;
                case 'rollbackConfiguration':
                    result = await this.configuration.rollback(obj.message.expectedRevision);
                    await this.configuration.applied(this.configuration.record.active.revision);
                    break;
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
