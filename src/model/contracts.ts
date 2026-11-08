import { z } from 'zod';
import { FUNCTION_KINDS, LEARNING_MODES, OPERATING_MODES } from './product';
export const id = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
export const stateId = z.string().min(3).max(512).refine(v => !/[\s*?\[\]]/.test(v), 'An exact state ID is required');
export const scalar = z.union([z.boolean(), z.number().finite(), z.string().max(512)]);
export type Scalar = z.infer<typeof scalar>;
export const quality = z.enum(['valid', 'unknown', 'stale', 'invalid', 'unavailable']);
export const observationSchema = z.strictObject({
    entityId: id, capability: id, value: scalar.nullable(), unit: z.string().max(32),
    measuredAt: z.number().finite(), receivedAt: z.number().finite(), lastChange: z.number().finite().optional(),
    quality, sourceId: stateId, observationId: z.string().optional(),
});
export type Observation = z.infer<typeof observationSchema>;
export const mappingSchema = z.strictObject({
    capability: id, readId: stateId, writeId: stateId.optional(), confirmId: stateId.optional(),
    valueType: z.enum(['boolean', 'number', 'string']), unit: z.string().max(32).default(''),
    sourceType: z.enum(['boolean', 'number', 'string']).optional(), valueMap: z.record(z.string(), scalar).optional(),
    codec: z.enum(['identity','hueLightLevel']).default('identity'),
    sourceUnit: z.string().max(32).optional(), scale: z.number().finite().positive().default(1), offset: z.number().finite().default(0),
    min: z.number().finite().optional(), max: z.number().finite().optional(), values: z.array(scalar).max(64).optional(),
    maxAgeMs: z.number().int().min(1000).max(86400000).default(300000),
    tolerance: z.number().nonnegative().default(0), confirmation: z.enum(['device', 'backend', 'none']).default('backend'),
});
export type CapabilityMapping = z.infer<typeof mappingSchema>;
export const bindingSchema = z.strictObject({
    id, physicalId: z.string().min(1).max(256), integrationId: id,
    family: z.string().max(64), backendVersion: z.string().min(1).max(64), model: z.string().max(128).default('unverified'),
    confirmed: z.boolean().default(false), capabilities: z.array(mappingSchema).min(1).max(32),
    verification: z.enum(['implemented', 'contract', 'backend', 'hardware']).default('implemented'),
    memberPhysicalIds: z.array(z.string().min(1).max(256)).max(128).default([]),
});
export type DeviceBinding = z.infer<typeof bindingSchema>;
export const refSchema = z.strictObject({entityId: id, capability: id});
export type CapabilityRef = z.infer<typeof refSchema>;
export const conditionSchema = z.strictObject({
    input: id, op: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte']), value: scalar,
});
export type Condition = z.infer<typeof conditionSchema>;
export const windowSchema = z.strictObject({
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
export type ScheduleWindow = z.infer<typeof windowSchema>;
export const ruleSchema = z.strictObject({
    id, enabled: z.boolean().default(true), block: z.enum(['schedule', 'sensor', 'presence', 'minimum']),
    conditions: z.array(conditionSchema).max(16).default([]), windows: z.array(windowSchema).max(64).default([]),
    value: scalar, priority: z.number().int().min(0).max(100).default(40),
    validFrom: z.number().finite().optional(), expiresAt: z.number().finite().optional(),
    excludeDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(366).default([]),
});
export type Rule = z.infer<typeof ruleSchema>;
export const autonomySchema = z.strictObject({
    mode: z.enum(LEARNING_MODES).default('classic'), granted: z.boolean().default(false),
    parameters: z.record(id, z.strictObject({min: z.number().finite(), max: z.number().finite()})).default({}),
    blocks: z.array(z.enum(['schedule', 'sensor', 'presence'])).max(3).default([]),
    capabilities: z.array(id).max(32).default([]), excluded: z.boolean().default(false), paused: z.boolean().default(false),
    minSamples: z.number().int().min(12).max(5000).default(48), minCoverage: z.number().min(0.5).max(1).default(0.8),
    maxGapMs: z.number().int().min(1000).max(86400000).default(3600000),
    changesPerDay: z.number().int().min(0).max(24).default(2), evaluateAfterMs: z.number().int().min(1000).max(604800000).default(3600000),
    degradation: z.number().nonnegative().default(0.1), objectives: z.strictObject({
        comfort: z.number().nonnegative().default(1), energy: z.number().nonnegative().default(0), switching: z.number().nonnegative().default(1),
    }).default({comfort: 1, energy: 0, switching: 1}),
}).default({mode: 'classic', granted: false, parameters: {}, blocks: [], capabilities: [], excluded: false, paused: false, minSamples: 48, minCoverage: 0.8, maxGapMs: 3600000, changesPerDay: 2, evaluateAfterMs: 3600000, degradation: 0.1, objectives: {comfort: 1, energy: 0, switching: 1}});
export type AutonomyProfile = z.infer<typeof autonomySchema>;
export const functionSchema = z.strictObject({
    id, name: z.string().min(1).max(128), groupId: id, kind: z.enum(FUNCTION_KINDS),
    enabled: z.boolean().default(true), operatingMode: z.enum(OPERATING_MODES).default('automatic'),
    actuator: refSchema, inputs: z.record(id, refSchema).default({}),
    rules: z.array(ruleSchema).max(128).default([]),
    parameters: z.record(id, z.number().finite()).default({}),
    limits: z.strictObject({
        min: z.number().finite().optional(), max: z.number().finite().optional(), minimumValue: scalar.optional(),
        essential: z.boolean().default(false), minOnMs: z.number().int().nonnegative().default(0), minOffMs: z.number().int().nonnegative().default(0),
        commandsPerHour: z.number().int().min(1).max(360).default(30), manualHoldMs: z.number().int().min(1000).max(604800000).default(1800000),
        protection: z.array(z.strictObject({when: conditionSchema, value: scalar})).max(16).default([]),
    }).default({essential: false, minOnMs: 0, minOffMs: 0, commandsPerHour: 30, manualHoldMs: 1800000, protection: []}),
    autonomy: autonomySchema,
});
export type FunctionConfig = z.infer<typeof functionSchema>;
export const routeSchema = z.strictObject({
    id, adapter: z.string().regex(/^(telegram|pushover|email)\.\d+$/), recipient: z.string().min(1).max(256),
    minimumSeverity: z.enum(['info', 'warning', 'error']).default('warning'),
    topics: z.array(id).max(32).default([]), quiet: z.array(windowSchema).max(16).default([]),
});
export type NotificationRoute = z.infer<typeof routeSchema>;
export const configSchema = z.strictObject({
    schemaVersion: z.literal(1), revision: z.number().int().nonnegative(), parentRevision: z.number().int().nonnegative().nullable(),
    createdAt: z.number().finite(), actor: z.string().min(1).max(128), origin: z.enum(['operator', 'import', 'migration', 'learning']).default('operator'),
    timezone: z.string().refine(value => { try { new Intl.DateTimeFormat('en', {timeZone: value}); return true; } catch { return false; } }),
    groups: z.array(z.strictObject({id, name: z.string().min(1).max(128), kind: z.enum(['room', 'installation'])})).max(256),
    bindings: z.array(bindingSchema).max(512), functions: z.array(functionSchema).max(256),
    sources: z.array(z.strictObject({id, kind: z.enum(['weather', 'calendar', 'presence', 'usage', 'energy', 'generic']), ref: refSchema,
        absenceConfirmMs: z.number().int().nonnegative().max(86400000).default(300000), presenceConfirmations: z.number().int().min(1).max(100).default(1),
    })).max(128).default([]),
    notificationRoutes: z.array(routeSchema).max(32).default([]),
});
export type Configuration = z.infer<typeof configSchema>;
export type IntentOrigin = 'manual' | 'configured_rule' | 'learned_policy' | 'recovery';
export interface Intent extends CapabilityRef {
    intentId: string; functionId: string; typedValue: Scalar; origin: IntentOrigin; actor: string;
    reasonCode: string; reasonText: string; sourceSnapshotId: string; configRevision: number;
    priority: number; validFrom: number; expiresAt: number; planId?: string;
}
export type CommandPhase = 'requested' | 'validated' | 'accepted' | 'device_confirmed' | 'failed' | 'uncertain';
export interface Command {
    commandId: string; intent: Intent; generation: string; targetPath: string; physicalId: string;
    deadline: number; idempotencyKey: string; phase: CommandPhase; dispatchAccepted: boolean;
    feedbackMatched: boolean; deviceConfirmed: boolean; uncertainty?: string; sentAt: number;
}
export interface DecisionTrace {
    at: number; functionId: string; configRevision: number; reasonCode: string; reasonText: string;
    inputs: Record<string, Observation | null>; intent?: Intent; command?: Command; nextStep?: string;
}
