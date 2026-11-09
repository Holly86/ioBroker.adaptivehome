/** Pure projections for an independently hosted read-only context producer. No I/O or command port. */
export interface ReadEvidence<T> {
	value: T | null;
	verifiedAt: number;
	eventAt?: number;
}
export function manualRequest(store: unknown, room: string): boolean | null {
	const rooms = (store as { rooms?: Record<string, { mode?: unknown }> } | null)?.rooms;
	if (!rooms || typeof rooms !== 'object' || Array.isArray(rooms)) {
		return null;
	}
	const request = rooms[room];
	if (request === undefined) {
		return false;
	}
	return request?.mode === 'manual' ? true : request?.mode === 'auto' ? false : null;
}
export function rgbHue(rgb: unknown): number | null {
	if (!Array.isArray(rgb) || rgb.length !== 3 || !rgb.every(v => Number.isInteger(v) && v >= 0 && v <= 255)) {
		return null;
	}
	const [r, g, b] = rgb as number[],
		max = Math.max(r, g, b),
		min = Math.min(r, g, b),
		delta = max - min;
	if (!delta) {
		return 0;
	}
	const h = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
	return (((h * 60) % 360) + 360) % 360;
}
export function roomUsage(
	primary: (boolean | null)[],
	manual: (boolean | null)[],
	motion: boolean | null,
): boolean | null {
	const light = [...primary, ...manual].includes(true)
		? true
		: primary.length && primary.every(v => v === false)
			? false
			: null;
	// Preserve the strict two-input contract: a missing motion value is not absence.
	return light === null || motion === null ? null : light || motion;
}
export interface CalendarRules {
	timezone: string;
	maxAgeMs: number;
	awayKind: string;
	school?: {
		agKind: string;
		departure: string;
		return: string;
		agReturn: string;
		validFrom: string;
		validThrough: string;
		publicHolidays: string[];
		holidays: { from: string; through: string }[];
	};
}
export interface CalendarRead {
	fetchedAt: number;
	complete: boolean;
	from: number;
	through: number;
	events: { kind: string; allDay?: boolean; start: string | number; end: string | number }[];
}
export function calendarAvailable(data: CalendarRead, rules: CalendarRules, now: number): boolean | null {
	if (
		!data ||
		!Number.isFinite(data.fetchedAt) ||
		data.fetchedAt > now ||
		now - data.fetchedAt > rules.maxAgeMs ||
		data.complete !== true ||
		!(data.from <= now && data.through > now) ||
		!Array.isArray(data.events) ||
		data.events.length > 10000
	) {
		return null;
	}
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-CA', {
			timeZone: rules.timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23',
		})
			.formatToParts(now)
			.map(p => [p.type, p.value]),
	);
	const date = `${parts.year}-${parts.month}-${parts.day}`,
		time = `${parts.hour}:${parts.minute}`;
	const at = (v: string | number): number => (typeof v === 'number' ? v : Date.parse(v));
	const localDay = (v: number): string =>
		new Intl.DateTimeFormat('en-CA', {
			timeZone: rules.timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(v);
	if (
		data.events.some(
			e =>
				!e ||
				typeof e.kind !== 'string' ||
				(e.allDay
					? !/^\d{4}-\d\d-\d\d$/.test(String(e.start)) ||
						!/^\d{4}-\d\d-\d\d$/.test(String(e.end)) ||
						e.start >= e.end
					: !Number.isFinite(at(e.start)) || !Number.isFinite(at(e.end)) || at(e.start) >= at(e.end)),
		)
	) {
		return null;
	}
	const active = (e: CalendarRead['events'][number]): boolean =>
		e.allDay ? String(e.start) <= date && date < String(e.end) : at(e.start) <= now && now < at(e.end);
	if (data.events.some(e => e.kind === rules.awayKind && active(e))) {
		return false;
	}
	const s = rules.school;
	if (!s) {
		return true;
	}
	if (!(s.validFrom <= date && date <= s.validThrough)) {
		return null;
	}
	const weekday = new Date(`${date}T12:00:00Z`).getUTCDay(),
		schoolDay =
			weekday >= 1 &&
			weekday <= 5 &&
			!s.publicHolidays.includes(date) &&
			!s.holidays.some(h => h.from <= date && date <= h.through);
	const ag = data.events.some(
		e =>
			e.kind === s.agKind &&
			(e.allDay
				? String(e.start) <= date && date < String(e.end)
				: localDay(at(e.start)) <= date && date <= localDay(at(e.end) - 1)),
	);
	return !(schoolDay && time >= s.departure && time < (ag ? s.agReturn : s.return));
}

/** Confirmed negative evidence expires too. Heartbeats and file mtimes are never scan receipts. */
export class ReadPresence {
	private absentSince?: number;
	private last?: number;
	private session?: string;
	private corroboration = new Map<string, { at: number; accepted: boolean }>();
	evaluate(
		people: ReadEvidence<boolean>[],
		positive: {
			key: string;
			active: boolean;
			at: number;
			verifiedAt: number;
			maxAgeMs: number;
			corroborate: boolean;
		}[],
		session: string,
		now: number,
		absenceMs: number,
	): boolean | null {
		if (this.session !== session || (this.last !== undefined && (now < this.last || now - this.last > 120000))) {
			this.absentSince = undefined;
			this.corroboration.clear();
		}
		this.session = session;
		this.last = now;
		const fresh = (at: number, age: number): boolean => Number.isFinite(at) && at <= now && now - at <= age;
		const home = people.some(p => p.value === true && fresh(p.verifiedAt, 60000));
		const activity = positive
			.map(p => {
				if (!p.active || !fresh(p.verifiedAt, 30000) || !fresh(p.at, p.maxAgeMs)) {
					return false;
				}
				if (!p.corroborate) {
					return true;
				}
				let evidence = this.corroboration.get(p.key);
				if (evidence?.at !== p.at) {
					evidence = {
						at: p.at,
						accepted: people.some(
							person =>
								person.value === true &&
								fresh(person.verifiedAt, 60000) &&
								person.eventAt !== undefined &&
								Math.abs(person.eventAt - p.at) <= 90000,
						),
					};
					this.corroboration.set(p.key, evidence);
				}
				return evidence.accepted;
			})
			.some(Boolean);
		if (home || activity) {
			this.absentSince = undefined;
			return true;
		}
		if (!people.length || !people.every(p => p.value === false && fresh(p.verifiedAt, 60000))) {
			this.absentSince = undefined;
			return null;
		}
		this.absentSince ??= now;
		return now - this.absentSince >= absenceMs ? false : null;
	}
}
