import { createHash } from 'node:crypto';
import { z } from 'zod';
import { deadline } from '../runtime/clock';

export const sqlLoggingSchema = z
	.strictObject({
		enabled: z.boolean().default(false),
		adapter: z
			.string()
			.regex(/^sql\.\d+$/)
			.default('sql.0'),
		observations: z.boolean().default(true),
		events: z.boolean().default(true),
		maxQueued: z.number().int().min(10).max(10000).default(1000),
		batchSize: z.number().int().min(1).max(100).default(25),
		flushIntervalMs: z.number().int().min(1000).max(60000).default(5000),
	})
	.default({
		enabled: false,
		adapter: 'sql.0',
		observations: true,
		events: true,
		maxQueued: 1000,
		batchSize: 25,
		flushIntervalMs: 5000,
	});
export type SqlLoggingConfig = z.infer<typeof sqlLoggingSchema>;
const entry = z.strictObject({
	id: z.string().max(256),
	ts: z.number().finite(),
	val: z.string().max(32768),
	adapter: z.string().regex(/^sql\.\d+$/),
	phase: z.enum(['queued', 'reserved', 'uncertain']),
});
const journalSchema = z.strictObject({
	version: z.literal(1),
	queue: z.array(entry).max(10000),
	lastTs: z.number().finite(),
	dropped: z.number().int().nonnegative(),
});
export type SqlLogJournal = z.infer<typeof journalSchema>;
export interface SqlLogPort {
	persist(record: SqlLogJournal): Promise<void>;
	ready(adapter: string): Promise<boolean>;
	ensureOwnState(id: string): Promise<void>;
	send(
		adapter: string,
		command: 'storeState',
		rows: { id: string; state: { val: string; ts: number; ack: true; from: string } }[],
	): Promise<unknown>;
}
/** Optional database export only: no SQL text, enableHistory, foreign state writes or device commands. */
export class SqlLogging {
	private journal: SqlLogJournal = { version: 1, queue: [], lastTs: 0, dropped: 0 };
	private busy = false;
	private lastFlush = -Infinity;
	private available = true;
	status = 'disabled';
	constructor(
		private namespace: string,
		private port: SqlLogPort,
		private now: () => number = Date.now,
	) {}
	restore(raw: unknown): void {
		const p = journalSchema.safeParse(raw);
		if (!p.success) {
			this.available = false;
			this.status = 'journal_invalid';
			return;
		}
		if (p.data.queue.some(e => !e.id.startsWith(`${this.namespace}.telemetry.`))) {
			this.available = false;
			this.status = 'journal_scope_invalid';
			return;
		}
		this.journal = p.data;
		for (const e of this.journal.queue) {
			if (e.phase === 'reserved') {
				e.phase = 'uncertain';
			}
		}
	}
	enqueue(
		kind: 'observation' | 'event',
		row: { entityId?: string; capability?: string; scope?: string; type?: string },
		config: SqlLoggingConfig,
	): void {
		if (!config.enabled || !this.available || !(kind === 'observation' ? config.observations : config.events)) {
			return;
		}
		if (this.journal.queue.length >= config.maxQueued) {
			this.journal.dropped++;
			this.status = 'queue_full';
			return;
		}
		const val = JSON.stringify({ schemaVersion: 1, kind, record: row });
		if (val.length > 32768) {
			this.journal.dropped++;
			this.status = 'record_too_large';
			return;
		}
		const key = createHash('sha256')
			.update(JSON.stringify([kind, row.entityId ?? row.scope, row.capability ?? row.type]))
			.digest('hex')
			.slice(0, 24);
		const ts = Math.max(this.now(), this.journal.lastTs + 1);
		this.journal.lastTs = ts;
		this.journal.queue.push({
			id: `${this.namespace}.telemetry.${kind}.${key}`,
			ts,
			val,
			adapter: config.adapter,
			phase: 'queued',
		});
	}
	snapshot(): SqlLogJournal {
		return structuredClone(this.journal);
	}
	state(): unknown {
		return {
			status: this.status,
			queued: this.journal.queue.filter(e => e.phase === 'queued').length,
			uncertain: this.journal.queue.filter(e => e.phase !== 'queued').length,
			dropped: this.journal.dropped,
		};
	}
	async flush(config: SqlLoggingConfig): Promise<void> {
		if (this.busy || !this.available) {
			return;
		}
		if (!config.enabled) {
			this.status = 'disabled';
			return;
		}
		const now = this.now();
		if (now >= this.lastFlush && now - this.lastFlush < config.flushIntervalMs) {
			return;
		}
		this.lastFlush = now;
		this.busy = true;
		let selected: z.infer<typeof entry>[] = [];
		try {
			// Persist even while disconnected; retain the original destination and timestamp.
			await this.port.persist(this.snapshot());
			if (this.journal.queue.some(e => e.phase !== 'queued')) {
				this.status = 'reconciliation_required';
				return;
			}
			if (this.journal.queue.some(e => e.adapter !== config.adapter)) {
				this.status = 'destination_changed';
				return;
			}
			if (!this.journal.queue.length) {
				this.status = 'idle';
				return;
			}
			if (!(await deadline(this.port.ready(config.adapter), 2000))) {
				this.status = 'backend_offline';
				return;
			}
			selected = this.journal.queue.slice(0, config.batchSize);
			for (const e of selected) {
				await this.port.ensureOwnState(e.id);
			}
			for (const e of selected) {
				e.phase = 'reserved';
			}
			await this.port.persist(this.snapshot());
			const result = (await deadline(
				this.port.send(
					config.adapter,
					'storeState',
					selected.map(e => ({
						id: e.id,
						state: { val: e.val, ts: e.ts, ack: true, from: `system.adapter.${this.namespace}` },
					})),
				),
				5000,
			)) as {
				success?: boolean;
				successCount?: number;
				connected?: boolean;
				error?: unknown;
				errors?: unknown[];
			};
			if (
				result?.success !== true ||
				result.connected !== true ||
				result.successCount !== selected.length ||
				result.error ||
				result.errors?.length
			) {
				throw Error('sql_acknowledgement_uncertain');
			}
			const remaining = this.snapshot();
			remaining.queue.splice(0, selected.length);
			await this.port.persist(remaining);
			this.journal.queue.splice(0, selected.length);
			this.status = 'accepted_by_sql';
		} catch {
			for (const e of selected) {
				e.phase = 'uncertain';
			}
			this.status = selected.length ? 'reconciliation_required' : 'storage_unavailable';
			try {
				await this.port.persist(this.snapshot());
			} catch {
				this.available = false;
				this.status = 'journal_unavailable';
			}
		} finally {
			this.busy = false;
		}
	}
}
