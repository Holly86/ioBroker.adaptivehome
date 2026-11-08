import { strict as assert } from 'node:assert';
import { Supervisor } from './supervisor';
describe('AP-02 failure boundaries', () => {
    it('continues healthy functions after failure and a hung optional job', async () => {
        const runtime = new Supervisor(10);
        let count = 0;
        runtime.register('healthy', async () => { count++; });
        runtime.register('broken', async () => { throw new Error('local_fault'); });
        runtime.register('hung', () => new Promise(() => undefined));
        await runtime.tick(); await runtime.tick();
        assert.equal(count, 2);
        assert.equal(runtime.status.get('healthy')?.ready, true);
        assert.equal(runtime.status.get('broken')?.failures, 2);
        assert.equal(runtime.status.get('hung')?.failures, 1);
        runtime.close(); await runtime.tick(); assert.equal(count, 2);
    });
});
