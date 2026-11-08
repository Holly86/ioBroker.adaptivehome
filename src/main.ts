import * as utils from '@iobroker/adapter-core';
import { Supervisor } from './runtime/supervisor';
class Adaptivehome extends utils.Adapter {
    private runtime = new Supervisor();
    private timer?: ReturnType<typeof setInterval>;
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'adaptivehome' });
        this.on('ready', () => void this.ready());
        this.on('stateChange', () => { /* Specific subscriptions are installed with validated bindings. */ });
        this.on('objectChange', () => { /* Bindings are audited when configuration is activated. */ });
        this.on('message', obj => {
            if (obj.command === 'health' && obj.callback) this.sendTo(obj.from, obj.command, {ready: true, functions: Object.fromEntries(this.runtime.status)}, obj.callback);
        });
        this.on('unload', callback => {
            if (this.timer) clearInterval(this.timer);
            this.runtime.close();
            callback();
        });
    }
    private async ready(): Promise<void> {
        await this.setObjectNotExistsAsync('info.connection', {
            type: 'state', common: {name: 'Runtime ready', type: 'boolean', role: 'indicator.connected', read: true, write: false}, native: {},
        });
        await this.setStateAsync('info.connection', true, true);
        this.timer = setInterval(() => void this.runtime.tick(), 1000);
    }
}
if (require.main !== module) module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Adaptivehome(options);
else new Adaptivehome();
