import { z } from 'zod';
import type { DeviceBinding, FunctionConfig } from '../model/contracts';
import { localTime, preheatedWindow, windowMatches } from '../config/schedule';

const period = z.strictObject({
	start: z.number().int().min(0).max(1439),
	end: z.number().int().min(1).max(1440),
	value: z.number().finite(),
});
export const nativeHeatingProgramSchema = z.strictObject({
	protocol: z.literal('adaptivehome.native-heating.v1'),
	strategy: z.enum(['weekly-profile', 'timed-lease']).default('weekly-profile'),
	commandId: z.string().min(1).max(64),
	physicalId: z.string().min(1).max(256),
	profileId: z.string().min(1).max(64),
	createdAt: z.number().finite(),
	activateAt: z.number().finite(),
	expiresAt: z.number().finite(),
	timezone: z.string().max(64),
	target: z.number().finite(),
	fallback: z.number().finite(),
	days: z
		.array(
			z.strictObject({
				day: z.number().int().min(0).max(6),
				base: z.number().finite(),
				periods: z.array(period).max(2),
			}),
		)
		.length(7),
});
export type NativeHeatingProgram = z.infer<typeof nativeHeatingProgramSchema>;
export const nativeHeatingReportSchema = z.strictObject({
	program: nativeHeatingProgramSchema,
	sharedDeadlineAt: z.number().finite().optional(),
	status: z.enum(['applied', 'pending', 'rejected']),
	automatic: z.boolean(),
	fallbackVerified: z.boolean(),
	absoluteExpiryVerified: z.boolean(),
	appOverride: z.boolean(),
	devicePending: z.boolean(),
	effectiveTarget: z.number().finite(),
});
export function parseNativeHeatingReport(value: unknown): z.infer<typeof nativeHeatingReportSchema> | null {
	if (typeof value !== 'string' || value.length > 16384) {
		return null;
	}
	try {
		return nativeHeatingReportSchema.parse(JSON.parse(value));
	} catch {
		return null;
	}
}
/** Finite backend contract, not a second vendor client. Absolute expiry MUST be enforced by the backend/device. */
export function compileNativeHeatingProgram(
	fn: FunctionConfig,
	binding: DeviceBinding,
	target: number,
	now: number,
	timezone: string,
	commandId: string,
	fallbackValue?: number,
): NativeHeatingProgram {
	const settings = fn.nativeProgram;
	if (!settings?.backendContractVerified) {
		throw new Error('native_backend_unverified');
	}
	const fallback = fallbackValue ?? settings.fallback;
	if (
		!Number.isFinite(fallback) ||
		![settings.fallback, ...(settings.fallbackValues ?? [])].includes(fallback) ||
		fallback < (fn.limits.min ?? -Infinity) ||
		fallback > (fn.limits.max ?? Infinity)
	) {
		throw new Error('native_fallback_not_authorized');
	}
	let expiresAt = Math.floor((now + settings.maxHorizonMs) / 60000) * 60000;
	const windows = [
		...(fn.climate?.comfortWindows ?? []).map(w => preheatedWindow(w, fn.climate?.preheatMs ?? 0)),
		...(fn.climate?.weekly ?? []).map(w => w.window),
	];
	const signature = (at: number): string => windows.map(w => (windowMatches(w, at, timezone) ? '1' : '0')).join('');
	const current = signature(now);
	for (let at = Math.floor(now / 60000) * 60000 + 60000; at < expiresAt; at += 60000) {
		if (signature(at) !== current) {
			expiresAt = at;
			break;
		}
	}
	const timed = settings.strategy === 'timed-lease';
	if (timed) {
		expiresAt = Math.floor(Math.min(expiresAt, now + 900000) / 300000) * 300000;
		if (expiresAt <= now + 60000) {
			throw Error('native_timed_horizon_too_short');
		}
	}
	const activateAt = timed
		? Math.floor(now / 60000) * 60000
		: Math.ceil((now + settings.activationDelayMs) / 60000) * 60000;
	if (activateAt >= expiresAt) {
		throw new Error('native_horizon_too_short');
	}
	const days = Array.from({ length: 7 }, (_, day) => ({
		day,
		base: fallback,
		periods: [] as z.infer<typeof period>[],
	}));
	// Iterate absolute minutes: DST gaps/folds must not silently create a different target.
	for (let at = activateAt; !timed && at < expiresAt; at += 60000) {
		const local = localTime(at, timezone),
			periods = days[local.day].periods;
		const previous = periods.at(-1);
		if (previous && previous.end === local.minute) {
			previous.end++;
		} else if (!periods.some(p => p.start <= local.minute && local.minute < p.end)) {
			periods.push({ start: local.minute, end: local.minute + 1, value: target });
		} else {
			throw new Error('native_dst_fold_requires_backend_resolution');
		}
	}
	if (days.some(d => d.periods.length > 2)) {
		throw new Error('native_program_period_limit');
	}
	return nativeHeatingProgramSchema.parse({
		protocol: 'adaptivehome.native-heating.v1',
		strategy: settings.strategy,
		commandId,
		physicalId: binding.physicalId,
		profileId: settings.profileId,
		createdAt: now,
		activateAt,
		expiresAt,
		timezone,
		target,
		fallback,
		days,
	});
}
