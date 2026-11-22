// Child-process-only fault injection. No network endpoints or real device data.
const fs = require('node:fs');
const { Adapter } = require(require.resolve('@iobroker/adapter-core', { paths: [process.cwd()] }));
const emit = Adapter.prototype.emit;
Adapter.prototype.emit = function (event, ...args) {
	if (event === 'unload') {
		const record = kind => fs.appendFileSync(process.env.ADAPTIVEHOME_SHUTDOWN_TRACE, `${kind}\n`);
		let unsubscriptions = 0;
		for (const method of ['unsubscribeForeignStatesAsync', 'unsubscribeForeignObjectsAsync']) {
			this[method] = () => {
				unsubscriptions++;
				return new Promise(() => {});
			};
		}
		if (process.env.ADAPTIVEHOME_SHUTDOWN_FAULT === 'disconnected') {
			const setState = this.setStateAsync.bind(this);
			this.setStateAsync = (id, ...params) => {
				if (id === 'info.connection') {
					record('disconnect-pending');
					return new Promise(() => {});
				}
				return setState(id, ...params);
			};
		}
		record('unload');
		const result = emit.call(this, event, ...args);
		record(`unsubscribe-count:${unsubscriptions}`);
		return result;
	}
	return emit.call(this, event, ...args);
};
