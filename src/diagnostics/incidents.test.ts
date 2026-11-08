import { strict as assert } from 'node:assert';
import { referenceConfiguration } from '../config/examples';
import { routeSchema } from '../model/contracts';
import { IncidentService } from './incidents';
describe('AP-18 optional incident routing', () => {
	it('deduplicates across restart, sends only configured recipients and never claims delivery', async () => {
		const sent: unknown[] = [],
			config = referenceConfiguration('air');
		const service = new IncidentService(
			async () => undefined,
			async (...args) => {
				sent.push(args);
				return { accepted: true };
			},
		);
		service.upsert('air', 'measurement_lost', 'warning', 1000);
		service.upsert('air', 'measurement_lost', 'warning', 1001);
		await service.tick(config, 1001);
		assert.equal(sent.length, 0);
		config.notificationRoutes = [
			routeSchema.parse({ id: 'own', adapter: 'telegram.0', recipient: 'synthetic-recipient' }),
		];
		await service.tick(config, 1002);
		assert.equal(sent.length, 1);
		assert.equal(service.record.deliveries[0].delivered, false);
		const restarted = new IncidentService(
			async () => undefined,
			async (...args) => {
				sent.push(args);
				return true;
			},
		);
		restarted.restore(structuredClone(service.record));
		await restarted.tick(config, 1003);
		assert.equal(sent.length, 1);
		restarted.resolveScope('air', 1004);
		await restarted.tick(config, 1004);
		assert.equal(sent.length, 2);
	});
});
