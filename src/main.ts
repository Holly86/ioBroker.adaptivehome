import * as utils from '@iobroker/adapter-core';
class Adaptivehome extends utils.Adapter {
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'adaptivehome' });
        this.on('ready', () => void this.ready());
        this.on('unload', callback => callback());
    }
    private async ready(): Promise<void> {
        await this.setObjectNotExistsAsync('info.connection', {
            type: 'state', common: {name: 'Runtime ready', type: 'boolean', role: 'indicator.connected', read: true, write: false}, native: {},
        });
        await this.setStateAsync('info.connection', true, true);
    }
}
if (require.main !== module) module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Adaptivehome(options);
else new Adaptivehome();
