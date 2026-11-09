import { z } from 'zod';

const key = z
	.string()
	.regex(/^[a-zA-Z0-9_-]{1,64}$/)
	.refine(v => !['__proto__', 'prototype', 'constructor'].includes(v));
const selector = z.array(z.union([key, z.number().int().min(0).max(10000)])).max(16);
const value = z.union([z.boolean(), z.number().finite(), z.string().max(512)]);
const date = z.string().regex(/^\d{4}-\d\d-\d\d$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const calendarRules = z.strictObject({
	timezone: z
		.string()
		.max(128)
		.refine(v => {
			try {
				new Intl.DateTimeFormat('en', { timeZone: v });
				return true;
			} catch {
				return false;
			}
		}),
	maxAgeMs: z.number().int().min(1000).max(86400000),
	awayKind: key,
	school: z
		.strictObject({
			agKind: key,
			departure: time,
			return: time,
			agReturn: time,
			validFrom: date,
			validThrough: date,
			publicHolidays: z.array(date).max(1000),
			holidays: z.array(z.strictObject({ from: date, through: date })).max(200),
		})
		.optional(),
});
export const outputSchema = z.strictObject({
	key,
	type: z.enum(['boolean', 'number', 'string']),
	unit: z.string().max(32).default(''),
	path: selector,
	paths: z.array(selector).min(1).max(64).optional(),
	jsonPath: selector.optional(),
	// Source timestamps are mandatory for files/cache documents. File mtime is never evidence.
	timestampPath: selector.optional(),
	timestampPaths: z.array(selector).min(1).max(512).optional(),
	eventTimestampPath: selector.optional(),
	sessionPath: selector.optional(),
	requires: z
		.array(z.strictObject({ path: selector, equals: value }))
		.max(16)
		.default([]),
	map: z.record(z.string(), value).optional(),
	scale: z.number().finite().positive().default(1),
	offset: z.number().finite().default(0),
	min: z.number().finite().optional(),
	max: z.number().finite().optional(),
	transform: z
		.enum(['scalar', 'any', 'all', 'maximum', 'forecastMedian', 'cases', 'calendarAvailable'])
		.default('scalar'),
	calendar: calendarRules.optional(),
	defaultValue: value.optional(),
	cases: z
		.array(
			z.strictObject({
				requires: z.array(z.strictObject({ path: selector, equals: value })).max(16),
				window: z
					.strictObject({
						days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
						start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
						end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
					})
					.optional(),
				timezone: z
					.string()
					.refine(v => {
						try {
							new Intl.DateTimeFormat('en', { timeZone: v });
							return true;
						} catch {
							return false;
						}
					})
					.default('UTC'),
				value,
			}),
		)
		.max(32)
		.optional(),
	// Forecast input: [{at: epoch ms, temperature: degrees C}], complete equidistant coverage.
	forecast: z
		.strictObject({
			samples: z.number().int().min(2).max(200),
			cadenceMs: z.number().int().min(60000),
			horizonMs: z.number().int().min(60000),
			points: z
				.array(
					z.strictObject({
						at: selector,
						minimum: selector,
						maximum: selector,
						timestamps: z.array(selector).min(1).max(3),
					}),
				)
				.min(2)
				.max(200)
				.optional(),
		})
		.optional(),
});
const common = {
	id: key,
	enabled: z.boolean().default(false),
	intervalMs: z.number().int().min(1000).max(86400000).default(15000),
	maxAgeMs: z.number().int().min(1000).max(86400000).default(90000),
	outputs: z.array(outputSchema).min(1).max(128),
};
export const connectionSchema = z.discriminatedUnion('kind', [
	z.strictObject({
		...common,
		kind: z.literal('state-json'),
		stateId: z
			.string()
			.min(3)
			.max(512)
			.refine(v => !/[\s*?[\]]/.test(v)),
	}),
	z.strictObject({ ...common, kind: z.literal('json-file'), fileKey: key }),
	z.strictObject({ ...common, kind: z.literal('backend-json'), backend: z.string().regex(/^hmip\.\d+$/) }),
	z.strictObject({
		...common,
		kind: z.literal('state-map'),
		inputs: z
			.array(
				z.strictObject({
					key,
					stateId: z
						.string()
						.min(3)
						.max(512)
						.refine(v => !/[\s*?[\]]/.test(v)),
				}),
			)
			.min(1)
			.max(512),
	}),
	// A finite GET connector; endpoint and secret are separate native settings, never config exports.
	z.strictObject({ ...common, kind: z.literal('http-json'), endpointKey: key }),
]);
export const nativeTransportSchema = z.strictObject({
	strategy: z.enum(['weekly-profile', 'timed-lease']).default('weekly-profile'),
	profileMaxAgeMs: z.number().int().min(1000).max(3600000).default(300000),
	id: key,
	enabled: z.boolean().default(false),
	backend: z.string().regex(/^hmip\.\d+$/),
	groupId: z.string().min(1).max(128),
	physicalId: z.string().min(1).max(256),
	profileIndex: z.enum(['PROFILE_1', 'PROFILE_2', 'PROFILE_3']),
	memberIds: z.array(z.string().min(1).max(128)).min(1).max(64),
	min: z.number().finite(),
	max: z.number().finite(),
	maxAgeMs: z.number().int().min(1000).max(300000).default(30000),
});
export type SourceConnection = z.infer<typeof connectionSchema>;
export type SourceOutput = z.infer<typeof outputSchema>;
export type NativeTransportConfig = z.infer<typeof nativeTransportSchema>;
export const connectionPrefix = (namespace: string, id: string): string => `${namespace}.connections.${id}`;
export const nativePrefix = (namespace: string, id: string): string => `${namespace}.native.${id}`;
