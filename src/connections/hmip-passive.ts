import { z } from 'zod';
import { connectionSchema, type SourceConnection } from './schema';

const scalar = z.union([z.boolean(), z.number().finite(), z.string().max(512)]);
const stateId = z
	.string()
	.min(3)
	.max(512)
	.refine(
		value =>
			!/[\s*?[\]]/.test(value) &&
			!value.split('.').some(part => ['__proto__', 'prototype', 'constructor'].includes(part)),
	);
export const hmipPassiveSchema = z.strictObject({
	id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
	backend: z.string().regex(/^hmip\.\d+$/),
	enabled: z.boolean().default(false),
	intervalMs: z.number().int().min(1000).max(86400000).default(15000),
	maxAgeMs: z.number().int().min(1000).max(86400000).default(180000),
	fields: z
		.array(
			z
				.strictObject({
					key: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
					stateId: stateId.optional(),
					stateIds: z.array(stateId).min(1).max(64).optional(),
					aggregate: z.enum(['maximum', 'any', 'all']).optional(),
					type: z.enum(['boolean', 'number', 'string']),
					unit: z.string().max(32).default(''),
					scale: z.number().finite().positive().default(1),
					offset: z.number().finite().default(0),
					min: z.number().finite().optional(),
					max: z.number().finite().optional(),
					map: z.record(z.string(), scalar).optional(),
					guards: z
						.array(z.strictObject({ stateId, equals: scalar }))
						.max(6)
						.default([]),
				})
				.superRefine((field, context) => {
					if (field.stateId ? field.stateIds || field.aggregate : !field.stateIds || !field.aggregate) {
						context.addIssue({
							code: 'custom',
							message: 'one scalar state or an explicit aggregate is required',
						});
					}
					if (field.stateIds && new Set(field.stateIds).size !== field.stateIds.length) {
						context.addIssue({ code: 'custom', message: 'duplicate aggregate input' });
					}
				}),
		)
		.min(1)
		.max(128),
});
export type HmipPassiveConfig = z.input<typeof hmipPassiveSchema>;

/**
 * Compile selected existing manufacturer states to the ordinary local-only source path.
 * No backend message, API, socket, session, writer or fallback is part of this connection.
 */
export function hmipPassiveConnection(input: HmipPassiveConfig): SourceConnection {
	const config = hmipPassiveSchema.parse(input);
	const inputs: { key: string; stateId: string }[] = [],
		keys = new Map<string, string>();
	const add = (id: string): string => {
		if (!id.startsWith(`${config.backend}.`)) {
			throw Error('hmip_passive_foreign_state');
		}
		let key = keys.get(id);
		if (!key) {
			key = `input${keys.size}`;
			keys.set(id, key);
			inputs.push({ key, stateId: id });
		}
		return key;
	};
	if (new Set(config.fields.map(field => field.key)).size !== config.fields.length) {
		throw Error('duplicate_source_output');
	}
	const online = add(`${config.backend}.info.connection`);
	const outputs = config.fields.map(field => {
		const ids = field.stateIds ?? [field.stateId!];
		for (const id of ids) {
			const suffix = id.slice(config.backend.length + 1);
			if (!/^(?:devices|groups|homes)\.[^.]+\..+/.test(suffix)) {
				throw Error('hmip_passive_measurement_required');
			}
		}
		if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
			throw Error('hmip_passive_range');
		}
		const members = ids.map(add),
			value = members[0];
		const guards = field.guards.map(guard => ({ key: add(guard.stateId), equals: guard.equals }));
		return {
			key: field.key,
			type: field.type,
			unit: field.unit,
			scale: field.scale,
			offset: field.offset,
			min: field.min,
			max: field.max,
			map: field.map,
			path: field.aggregate ? [] : ['values', value],
			paths: field.aggregate ? members.map(key => ['values', key]) : undefined,
			transform: field.aggregate ?? 'scalar',
			timestampPath: field.aggregate ? undefined : ['timestamps', value],
			timestampPaths: field.aggregate ? members.map(key => ['timestamps', key]) : undefined,
			eventTimestampPath: field.aggregate ? undefined : ['changedAt', value],
			requires: [
				{ path: ['valid', value], equals: true },
				{ path: ['valid', online], equals: true },
				{ path: ['values', online], equals: true },
				...guards.flatMap(guard => [
					{ path: ['valid', guard.key], equals: true },
					{ path: ['values', guard.key], equals: guard.equals },
				]),
			],
		};
	});
	return connectionSchema.parse({
		id: config.id,
		enabled: config.enabled,
		intervalMs: config.intervalMs,
		maxAgeMs: config.maxAgeMs,
		kind: 'state-map',
		inputs,
		outputs,
	});
}
