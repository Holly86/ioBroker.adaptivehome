import type { StateMetadata, StateValue } from '../integrations/registry';
import type { SourceConnection, SourceOutput } from './schema';
import { connectionPrefix } from './schema';
import { deadline } from '../runtime/clock';
import { windowMatches } from '../config/schedule';
import { createHash } from 'node:crypto';
import { calendarAvailable, type CalendarRead } from '../context/read-observer';

export function select(document: unknown, path: (string | number)[]): unknown {
	let current = document;
	for (const part of path) {
		if (
			!current ||
			typeof current !== 'object' ||
			!Object.hasOwn(current, part) ||
			['__proto__', 'constructor', 'prototype'].includes(String(part))
		) {
			return undefined;
		}
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}
export function sourceTimestamp(value: unknown): number {
	return typeof value === 'number'
		? value
		: typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?$/.test(value)
			? Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`)
			: NaN;
}
function stateForecast(
	output: SourceOutput,
	document: unknown,
	now: number,
): { at: number; temperature: number; checkedAt: number }[] | undefined {
	if (!output.forecast?.points) {
		return undefined;
	}
	return output.forecast.points
		.map(p => {
			const at = select(document, p.at),
				lo = select(document, p.minimum),
				hi = select(document, p.maximum),
				times = p.timestamps.map(path => sourceTimestamp(select(document, path)));
			return {
				at: typeof at === 'number' ? at : NaN,
				temperature: typeof lo === 'number' && typeof hi === 'number' && lo <= hi ? (lo + hi) / 2 : NaN,
				checkedAt: times.every(Number.isFinite) ? Math.min(...times) : NaN,
			};
		})
		.filter(p => !Number.isFinite(p.at) || p.at > now)
		.sort((a, b) => a.at - b.at)
		.slice(0, output.forecast.samples);
}
function decoded(output: SourceOutput, document: unknown, now: number): unknown {
	let raw = output.paths ? output.paths.map(path => select(document, path)) : select(document, output.path);
	if (output.transform === 'forecastMedian' && output.forecast?.points) {
		raw = stateForecast(output, document, now);
	}
	if (output.jsonPath) {
		if (typeof raw !== 'string' || raw.length > 16384) {
			return undefined;
		}
		try {
			raw = select(JSON.parse(raw), output.jsonPath);
		} catch {
			return undefined;
		}
	}
	if (output.transform === 'calendarAvailable') {
		raw = output.calendar ? calendarAvailable(raw as CalendarRead, output.calendar, now) : undefined;
	} else if (output.transform === 'cases') {
		const match = output.cases?.find(
			c =>
				c.requires.every(r => select(document, r.path) === r.equals) &&
				(!c.window || windowMatches(c.window, now, c.timezone)),
		);
		raw = match ? match.value : output.defaultValue;
	} else if (output.transform !== 'scalar') {
		if (!Array.isArray(raw) || !raw.length || raw.length > 10000) {
			return undefined;
		}
		if (output.transform === 'forecastMedian') {
			const f = output.forecast;
			if (!f || raw.length !== f.samples) {
				return undefined;
			}
			const rows = raw as { at: number; temperature: number }[];
			if (
				rows.some(
					(r, i) =>
						!r ||
						!Number.isFinite(r.at) ||
						!Number.isFinite(r.temperature) ||
						r.temperature < -50 ||
						r.temperature > 55 ||
						r.at < now ||
						(i > 0 && r.at - rows[i - 1].at !== f.cadenceMs),
				) ||
				rows[0].at - now > f.cadenceMs ||
				rows.at(-1)!.at - now < f.horizonMs
			) {
				return undefined;
			}
			const sorted = rows.map(r => r.temperature).sort((a, b) => a - b),
				half = Math.floor(sorted.length / 2);
			raw = sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
		} else if (output.transform === 'maximum') {
			if (!raw.every(v => typeof v === 'number' && Number.isFinite(v))) {
				return undefined;
			}
			raw = Math.max(...raw);
		} else {
			// Missing members may not be converted into absence/closed windows.
			if (!raw.every(v => typeof v === 'boolean')) {
				return undefined;
			}
			raw = output.transform === 'any' ? raw.some(Boolean) : raw.every(Boolean);
		}
	}
	if (output.map) {
		raw = output.map[String(raw)];
	}
	if (typeof raw !== output.type || (typeof raw === 'string' && raw.length > 512)) {
		return undefined;
	}
	if (typeof raw === 'number') {
		raw = raw * output.scale + output.offset;
		if (
			!Number.isFinite(raw) ||
			Number(raw) < (output.min ?? -Infinity) ||
			Number(raw) > (output.max ?? Infinity)
		) {
			return undefined;
		}
	}
	return raw;
}
export interface SourceDocument {
	document: unknown;
	fetchedAt?: number;
}
export interface SourcePort {
	readState(id: string): Promise<StateValue | null>;
	readFile(key: string): Promise<unknown>;
	getJSON(key: string): Promise<SourceDocument>;
	readBackend?(backend: string): Promise<SourceDocument>;
}
/** In-memory derived states only. No foreign/device writer exists on this port. */
export class SourceConnections {
	private values = new Map<string, StateValue>();
	private definitions = new Map<string, StateMetadata>();
	private attempted = new Map<string, number>();
	private accepted = new Map<
		string,
		{
			checkedAt: number;
			eventAt?: number;
			value: unknown;
			ts: number;
			lc?: number;
			evaluatedAt: number;
			basis?: string;
			phase?: string;
		}
	>();
	private sessions = new Map<string, string>();
	private signature = '';
	readonly errors: Record<string, string> = {};
	constructor(
		private namespace: string,
		private port: SourcePort,
		private now: () => number = Date.now,
	) {}
	configure(connections: SourceConnection[]): void {
		const signature = JSON.stringify(connections);
		if (signature === this.signature) {
			return;
		}
		this.signature = signature;
		this.values.clear();
		this.definitions.clear();
		this.attempted.clear();
		this.accepted.clear();
		this.sessions.clear();
		for (const c of connections) {
			for (const o of c.outputs) {
				const p = `${connectionPrefix(this.namespace, c.id)}.${o.key}`;
				for (const [suffix, type, unit] of [
					['', o.type, o.unit],
					['.verifiedAt', 'number', ''],
					['.eventAt', 'number', ''],
				] as const) {
					this.definitions.set(p + suffix, { type, unit, read: true, write: false });
				}
			}
		}
	}
	metadata(id: string): StateMetadata | null {
		return this.definitions.get(id) ?? null;
	}
	read(id: string): StateValue | null {
		return this.values.get(id) ?? null;
	}
	async refresh(connections: SourceConnection[]): Promise<void> {
		this.configure(connections);
		const signature = this.signature;
		await Promise.all(
			connections.map(async c => {
				if (!c.enabled) {
					return;
				}
				const at = this.now(),
					previous = this.attempted.get(c.id);
				if (previous !== undefined && at >= previous && at - previous < c.intervalMs) {
					return;
				}
				this.attempted.set(c.id, at);
				try {
					let data: SourceDocument;
					if (c.kind === 'json-file') {
						data = { document: await deadline(this.port.readFile(c.fileKey), 5000) };
					} else if (c.kind === 'http-json') {
						data = await deadline(this.port.getJSON(c.endpointKey), 5000);
					} else if (c.kind === 'backend-json') {
						if (!this.port.readBackend) {
							throw Error('source_backend_unavailable');
						}
						data = await deadline(this.port.readBackend(c.backend), 5000);
					} else if (c.kind === 'state-map') {
						const document: Record<string, Record<string, unknown>> = {
							values: {},
							timestamps: {},
							changedAt: {},
							valid: {},
						};
						await Promise.all(
							c.inputs.map(async input => {
								const state = await deadline(this.port.readState(input.stateId), 5000);
								const valid =
									!!state?.ack &&
									!state.q &&
									Number.isFinite(state.ts) &&
									state.ts >= 0 &&
									state.ts <= this.now();
								document.valid[input.key] = valid;
								document.values[input.key] = valid ? state.val : null;
								document.timestamps[input.key] = valid ? state.ts : null;
								document.changedAt[input.key] = valid ? (state.lc ?? state.ts) : null;
							}),
						);
						data = { document };
					} else {
						const s = await deadline(this.port.readState(c.stateId), 5000);
						if (
							!s?.ack ||
							s.q ||
							!Number.isFinite(s.ts) ||
							s.ts > this.now() ||
							this.now() - s.ts > c.maxAgeMs ||
							typeof s.val !== 'string' ||
							s.val.length > 1048576
						) {
							throw Error('source_state_invalid');
						}
						data = { document: JSON.parse(s.val) };
					}
					if (JSON.stringify(data.document).length > 1048576) {
						throw Error('source_document_too_large');
					}
					if (signature !== this.signature) {
						return;
					}
					for (const output of c.outputs) {
						this.project(c, output, data);
					}
					delete this.errors[c.id];
				} catch {
					if (signature !== this.signature) {
						return;
					}
					this.errors[c.id] = 'source_unavailable';
					for (const output of c.outputs) {
						this.invalidate(`${connectionPrefix(this.namespace, c.id)}.${output.key}`);
					}
				}
			}),
		);
	}
	private invalidate(p: string): void {
		for (const suffix of ['', '.verifiedAt', '.eventAt']) {
			this.values.set(p + suffix, { val: null, ts: this.now(), ack: true, q: 0x01 });
		}
	}
	private project(c: SourceConnection, o: SourceOutput, data: SourceDocument): void {
		const p = `${connectionPrefix(this.namespace, c.id)}.${o.key}`,
			now = this.now();
		const forecastRows = o.forecast?.points ? stateForecast(o, data.document, now) : undefined;
		const stamps = o.timestampPaths?.map(path => sourceTimestamp(select(data.document, path)));
		const evidenceTimes = forecastRows?.map(p => p.checkedAt) ?? stamps ?? [];
		const checkedAt = forecastRows
			? Math.min(...forecastRows.map(p => p.checkedAt))
			: stamps
				? Math.min(...stamps)
				: o.timestampPath
					? sourceTimestamp(select(data.document, o.timestampPath))
					: c.kind === 'http-json'
						? data.fetchedAt
						: undefined;
		const eventAt = o.eventTimestampPath ? sourceTimestamp(select(data.document, o.eventTimestampPath)) : undefined;
		const value = decoded(o, data.document, now);
		if (
			evidenceTimes.some(t => !Number.isFinite(t) || t < 0 || t > now || now - t > c.maxAgeMs) ||
			checkedAt === undefined ||
			!Number.isFinite(checkedAt) ||
			checkedAt > now ||
			checkedAt < 0 ||
			now - checkedAt > c.maxAgeMs ||
			(eventAt !== undefined && (!Number.isFinite(eventAt) || eventAt > now || eventAt < 0)) ||
			value === undefined ||
			!o.requires.every(r => select(data.document, r.path) === r.equals)
		) {
			this.invalidate(p);
			return;
		}
		const previous = this.accepted.get(p);
		const timed = o.transform === 'cases' || o.transform === 'calendarAvailable' || !!o.forecast?.points;
		const basis = timed
			? createHash('sha256')
					.update(
						JSON.stringify(
							o.transform === 'calendarAvailable'
								? select(data.document, o.path)
								: o.transform === 'cases'
									? o.cases?.map(c => c.requires.map(r => select(data.document, r.path)))
									: o.forecast!.points!.map(point => [
											select(data.document, point.at),
											select(data.document, point.minimum),
											select(data.document, point.maximum),
											...point.timestamps.map(path => select(data.document, path)),
										]),
						),
					)
					.digest('hex')
			: undefined;
		const phase = forecastRows
			? JSON.stringify(forecastRows.map(row => row.at))
			: o.transform === 'calendarAvailable'
				? value === true
					? 'available'
					: value === false
						? 'unavailable'
						: 'unknown'
				: o.transform === 'cases'
					? String(
							o.cases?.findIndex(
								c =>
									c.requires.every(r => select(data.document, r.path) === r.equals) &&
									(!c.window || windowMatches(c.window, now, c.timezone)),
							),
						)
					: undefined;
		const timedTransition = timed && !!previous && previous.basis === basis && previous.phase !== phase;
		if (
			previous &&
			(now < previous.evaluatedAt ||
				checkedAt < previous.checkedAt ||
				(timed && checkedAt === previous.checkedAt && basis !== previous.basis) ||
				(checkedAt === previous.checkedAt && value !== previous.value && !timedTransition) ||
				(eventAt !== undefined && previous.eventAt !== undefined && eventAt < previous.eventAt))
		) {
			this.invalidate(p);
			return;
		}
		if (o.sessionPath) {
			const session = select(data.document, o.sessionPath),
				previous = this.sessions.get(p);
			if (typeof session !== 'string' || !session || session.length > 256) {
				this.invalidate(p);
				return;
			}
			this.sessions.set(p, session);
			if (previous !== undefined && previous !== session) {
				this.accepted.delete(p);
				this.invalidate(p);
				return;
			}
		}
		const changed = previous?.value !== value;
		// A repeat read advances proof only. It cannot manufacture a new physical event.
		const ts = eventAt ?? (changed ? (timed ? now : checkedAt) : previous.ts),
			lc = changed ? ts : previous?.lc;
		this.accepted.set(p, { checkedAt, eventAt, value, ts, lc, evaluatedAt: now, basis, phase });
		this.values.set(p, { val: value, ts, lc, ack: true, q: 0 });
		this.values.set(`${p}.verifiedAt`, { val: checkedAt, ts: checkedAt, ack: true, q: 0 });
		if (eventAt !== undefined) {
			this.values.set(`${p}.eventAt`, { val: eventAt, ts: checkedAt, ack: true, q: 0 });
		}
	}
}
