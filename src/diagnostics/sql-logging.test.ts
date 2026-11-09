import { strict as assert } from 'node:assert';
import { SqlLogging, sqlLoggingSchema, type SqlLogJournal } from './sql-logging';
describe('Generated data SQL logging', () => {
	const config = () =>
		sqlLoggingSchema.parse({ enabled: true, adapter: 'sql.7', flushIntervalMs: 1000, maxQueued: 10 });
	it('persists reservations, sends only own JSON data and accepts an explicit SQL batch acknowledgement', async () => {
		let saved: SqlLogJournal | undefined, sent: any;
		const logger = new SqlLogging(
			'adaptivehome.9',
			{
				persist: async r => {
					saved = r;
				},
				ready: async () => true,
				ensureOwnState: async id => {
					assert.ok(id.startsWith('adaptivehome.9.telemetry.'));
				},
				send: async (a, c, rows) => {
					assert.equal(a, 'sql.7');
					assert.equal(c, 'storeState');
					assert.equal(saved?.queue[0].phase, 'reserved');
					sent = rows;
					return { success: true, successCount: rows.length, connected: true };
				},
			},
			() => 10000,
		);
		logger.enqueue('event', { scope: 'anonymous', type: 'decision' }, config());
		await logger.flush(config());
		assert.equal(logger.snapshot().queue.length, 0);
		assert.equal(logger.status, 'accepted_by_sql');
		assert.equal(sent[0].state.ack, true);
		assert.equal(JSON.parse(sent[0].state.val).kind, 'event');
	});
	it('retains offline records, bounds data loss visibly and never reroutes a queued destination', async () => {
		let writes = 0,
			now = 10000;
		const logger = new SqlLogging(
				'adaptivehome.9',
				{
					persist: async () => undefined,
					ready: async () => false,
					ensureOwnState: async () => undefined,
					send: async () => {
						writes++;
					},
				},
				() => now,
			),
			c = config();
		for (let i = 0; i < 11; i++) {
			logger.enqueue('event', { scope: 'anonymous', type: 'decision' }, c);
		}
		assert.equal(logger.snapshot().dropped, 1);
		await logger.flush(c);
		assert.equal(writes, 0);
		assert.equal(logger.snapshot().queue.length, 10);
		now += 1000;
		await logger.flush({ ...c, adapter: 'sql.8' });
		assert.equal(logger.status, 'destination_changed');
		assert.equal(writes, 0);
	});
	it('latches partial/ambiguous sends across restart instead of silently resending or losing the batch', async () => {
		let sent = 0,
			saved: SqlLogJournal | undefined;
		const port = {
				persist: async (r: SqlLogJournal) => {
					saved = r;
				},
				ready: async () => true,
				ensureOwnState: async () => undefined,
				send: async () => {
					sent++;
					return { success: false, successCount: 0, connected: true };
				},
			},
			logger = new SqlLogging('adaptivehome.9', port, () => 10000);
		logger.enqueue('event', { scope: 'anonymous' }, config());
		await logger.flush(config());
		assert.equal(logger.snapshot().queue[0].phase, 'uncertain');
		const restored = new SqlLogging('adaptivehome.9', port, () => 20000);
		restored.restore(saved);
		await restored.flush(config());
		assert.equal(sent, 1);
		assert.equal(restored.status, 'reconciliation_required');
	});
	it('does not send after a failed reservation persistence or corrupt journal and remains off by default', async () => {
		let sent = 0;
		const logger = new SqlLogging(
			'adaptivehome.9',
			{
				persist: async () => {
					throw Error();
				},
				ready: async () => true,
				ensureOwnState: async () => undefined,
				send: async () => {
					sent++;
				},
			},
			() => 10000,
		);
		logger.enqueue('event', { scope: 'anonymous' }, sqlLoggingSchema.parse({}));
		assert.equal(logger.snapshot().queue.length, 0);
		logger.enqueue('event', { scope: 'anonymous' }, config());
		await logger.flush(config());
		assert.equal(sent, 0);
		logger.restore({});
		await logger.flush(config());
		assert.equal(sent, 0);
	});
});
