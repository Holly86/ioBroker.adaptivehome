import type { Rule, ScheduleWindow } from '../model/contracts';
export interface LocalTime {
	day: number;
	minute: number;
	date: string;
}
export function localTime(at: number, timezone: string): LocalTime {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-CA', {
			timeZone: timezone,
			weekday: 'short',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23',
		})
			.formatToParts(at)
			.map(p => [p.type, p.value]),
	);
	return {
		day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday),
		minute: Number(parts.hour) * 60 + Number(parts.minute),
		date: `${parts.year}-${parts.month}-${parts.day}`,
	};
}
const minutes = (value: string): number => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
export function windowMatches(window: ScheduleWindow, at: number, timezone: string): boolean {
	const local = localTime(at, timezone),
		start = minutes(window.start),
		end = minutes(window.end);
	if (start === end) {
		return window.days.includes(local.day);
	} // All-day window.
	if (start < end) {
		return window.days.includes(local.day) && local.minute >= start && local.minute < end;
	}
	return local.minute >= start
		? window.days.includes(local.day)
		: local.minute < end && window.days.includes((local.day + 6) % 7);
}
export function ruleTimeMatches(rule: Rule, at: number, timezone: string): boolean {
	return (
		rule.enabled &&
		(rule.validFrom === undefined || at >= rule.validFrom) &&
		(rule.expiresAt === undefined || at < rule.expiresAt) &&
		!rule.excludeDates.includes(localTime(at, timezone).date) &&
		(!rule.windows.length || rule.windows.some(window => windowMatches(window, at, timezone)))
	);
}
export function weeklyWindowMatches(window: ScheduleWindow, day: number, minute: number): boolean {
	const start = minutes(window.start),
		end = minutes(window.end);
	if (start === end) {
		return window.days.includes(day);
	}
	if (start < end) {
		return window.days.includes(day) && minute >= start && minute < end;
	}
	return minute >= start ? window.days.includes(day) : minute < end && window.days.includes((day + 6) % 7);
}
export function intersectWindows(proposed: ScheduleWindow[], allowed: ScheduleWindow[]): ScheduleWindow[] {
	if (!allowed.length) {
		return proposed;
	}
	const result: ScheduleWindow[] = [];
	for (let day = 0; day < 7; day++) {
		let start: number | undefined;
		for (let minute = 0; minute <= 1440; minute++) {
			const matches =
				minute < 1440 &&
				(!proposed.length || proposed.some(w => weeklyWindowMatches(w, day, minute))) &&
				allowed.some(w => weeklyWindowMatches(w, day, minute));
			if (matches && start === undefined) {
				start = minute;
			}
			if (!matches && start !== undefined) {
				const format = (m: number): string =>
					`${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
				result.push({ days: [day], start: format(start), end: format(minute) });
				start = undefined;
			}
		}
	}
	return result;
}
