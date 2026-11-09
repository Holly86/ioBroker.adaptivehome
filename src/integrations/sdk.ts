import { z } from 'zod';
import { id } from '../model/contracts';
import type { DetectionRule } from './profiles';
import { createProfile } from './profiles';
import type { IntegrationManifest, StateMetadata, StateValue } from './registry';
import { IntegrationRegistry, normalize } from './registry';
export {
	nativeHeatingProgramSchema,
	nativeHeatingReportSchema,
	parseNativeHeatingReport,
	compileNativeHeatingProgram,
} from './native-program';
export type { NativeHeatingProgram } from './native-program';
export const integrationDefinitionSchema = z.strictObject({
	apiVersion: z.literal(1),
	id,
	name: z.string().min(1).max(128),
	backends: z
		.array(z.string().regex(/^[a-z][a-z0-9-]{0,63}$/))
		.min(1)
		.max(16),
	supportedVersions: z.array(z.string().max(64)).min(1).max(16),
	rules: z
		.array(
			z.strictObject({
				capability: id,
				suffix: z.string().regex(/^[a-zA-Z0-9_.-]{1,96}$/),
				type: z.enum(['boolean', 'number', 'string']),
				unit: z.string().max(32).optional(),
				sourceUnit: z.string().max(32).optional(),
				readOnly: z.boolean().default(false),
				scale: z.number().finite().positive().optional(),
			}),
		)
		.min(1)
		.max(64),
});
export type IntegrationDefinition = z.infer<typeof integrationDefinitionSchema>;
export function profileFromDefinition(raw: unknown): IntegrationManifest {
	const definition = integrationDefinitionSchema.parse(raw);
	const rules: DetectionRule[] = definition.rules.map(rule => ({
		...rule,
		suffix: new RegExp(`${rule.suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
	}));
	return createProfile(definition.id, definition.name, definition.backends, rules);
}
export function registerDefinitions(registry: IntegrationRegistry, definitions: unknown[]): void {
	if (definitions.length > 32) {
		throw new Error('integration_limit');
	}
	for (const definition of definitions) {
		registry.register(profileFromDefinition(definition));
	}
}
export function runIntegrationContract(
	definition: unknown,
	fixtures: {
		objects: Record<string, StateMetadata>;
		states: Record<string, StateValue>;
		now: number;
	},
): {
	bindings: number;
	observations: number;
} {
	const registry = new IntegrationRegistry(),
		profile = profileFromDefinition(definition);
	registry.register(profile);
	const bindings = profile.discover(fixtures.objects);
	let observations = 0;
	for (const binding of bindings) {
		registry.validate(binding);
		for (const mapping of binding.capabilities) {
			normalize(binding, mapping, fixtures.states[mapping.readId] ?? null, fixtures.now);
			observations++;
			if (binding.confirmed) {
				throw new Error('discovery_must_not_authorize');
			}
		}
	}
	return { bindings: bindings.length, observations };
}
export { HmipNativeEndpoint, hmipProfile } from '../connections/heating-backend';
export { HmipSessionSource } from '../connections/hmip-session';
export type {
	HeatingBackendPort,
	HeatingTransportJournal,
	HmipSnapshot,
	ExpiryProof,
} from '../connections/heating-backend';
export { SourceConnections } from '../connections/sources';
export { getSourceJSON, readSourceFile, resolveSourceEndpoint } from '../connections/io';
export { createHmipBackendHost, registerHmipBackendHost } from '../connections/hmip-host';
export type { HmipHostOptions, BackendEnvelope } from '../connections/hmip-host';
export { readOnlyHmipPort } from '../connections/read-only-port';
export { manualRequest, rgbHue, roomUsage, calendarAvailable, ReadPresence } from '../context/read-observer';
export {
	HmipTimedLeaseEndpoint,
	timedLeaseEndTime,
	heatingFingerprint,
	constantHeatingFallback,
} from '../connections/timed-lease';
export type { TimedLeaseAcceptance, TimedLeaseJournal, TimedLeasePort } from '../connections/timed-lease';
export { handoffPlanSchema, inspectHandoff, handoffTransition } from '../execution/handoff';
export type { HandoffPlan, HandoffObservation, HandoffJournal, HandoffAction } from '../execution/handoff';
