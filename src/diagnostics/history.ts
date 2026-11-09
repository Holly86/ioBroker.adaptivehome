import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Observation } from '../model/contracts';
import { observationSchema } from '../model/contracts';
export const historyEventSchema = z.strictObject({
	at: z.number().finite(),
	type: z.enum(['decision', 'command', 'feedback', 'incident', 'configuration', 'adaptation']),
	scope: z.string().max(128),
	code: z.string().max(128),
	revision: z.number().int().nonnegative(),
	commandId: z.string().optional(),
	modelVersion: z.string().optional(),
	planId: z.string().optional(),
});
export type HistoryEvent = z.infer<typeof historyEventSchema>;
export interface HistoryRecord {
	version: 1;
	observations: Observation[];
	events: HistoryEvent[];
}
export class History {
	onRecord?: (kind: 'observation' | 'event', row: Observation | HistoryEvent) => void;
	record: HistoryRecord = { version: 1, observations: [], events: [] };
	dropped = 0;
	storageError = false;
	private fingerprints = new Map<string, string>();
	constructor(
		private maxRows = 10000,
		private retentionMs = 604800000,
	) {}
	restore(raw: unknown): void {
		const parsed = z
			.strictObject({
				version: z.literal(1),
				observations: z.array(z.unknown()).max(20000),
				events: z.array(z.unknown()).max(20000),
			})
			.safeParse(raw);
		if (!parsed.success) {
			this.dropped++;
			return;
		}
		for (const row of parsed.data.observations) {
			const o = observationSchema.safeParse(row);
			if (o.success) {
				this.observation(o.data);
			} else {
				this.dropped++;
			}
		}
		for (const row of parsed.data.events) {
			const e = historyEventSchema.safeParse(row);
			if (e.success) {
				this.event(e.data);
			} else {
				this.dropped++;
			}
		}
	}
	observation(observation: Observation): void {
		const key = `${observation.entityId}:${observation.capability}`;
		const fingerprint = JSON.stringify([
			observation.measuredAt,
			observation.verifiedAt,
			observation.value,
			observation.quality,
		]);
		if (this.fingerprints.get(key) === fingerprint) {
			return;
		}
		this.fingerprints.set(key, fingerprint);
		this.record.observations.push(structuredClone(observation));
		this.onRecord?.('observation', observation);
		if (this.record.observations.length > this.maxRows) {
			this.record.observations.splice(0, this.record.observations.length - this.maxRows);
		}
	}
	event(event: HistoryEvent): void {
		const previous = this.record.events.at(-1);
		if (
			previous &&
			previous.type === event.type &&
			previous.scope === event.scope &&
			previous.code === event.code &&
			event.at - previous.at < 60000 &&
			!event.commandId
		) {
			return;
		}
		this.record.events.push(historyEventSchema.parse(event));
		this.onRecord?.('event', event);
		if (this.record.events.length > this.maxRows) {
			this.record.events.shift();
		}
	}
	rotate(now: number): void {
		this.record.observations = this.record.observations.filter(
			o => now - o.receivedAt <= this.retentionMs && o.receivedAt <= now + 1000,
		);
		this.record.events = this.record.events.filter(e => now - e.at <= this.retentionMs && e.at <= now + 1000);
	}
	clear(): void {
		this.record = { version: 1, observations: [], events: [] };
		this.fingerprints.clear();
	}
	supportExport(): unknown {
		// No observations, device paths, recipients, user names or free text leave through support export.
		const counts: Record<string, number> = {};
		for (const o of this.record.observations) {
			counts[o.quality] = (counts[o.quality] || 0) + 1;
		}
		return {
			schemaVersion: 1,
			rows: this.record.observations.length,
			quality: counts,
			dropped: this.dropped,
			storageError: this.storageError,
			events: this.record.events.map(e => ({
				type: e.type,
				scope: createHash('sha256').update(e.scope).digest('hex').slice(0, 12),
				code: e.code,
				revision: e.revision,
			})),
		};
	}
	learningExport(entityId: string, capability: string): Observation[] {
		return this.record.observations
			.filter(o => o.entityId === entityId && o.capability === capability)
			.map(o => ({ ...o, entityId: 'selected', sourceId: 'anonymous.0.source' }));
	}
}
