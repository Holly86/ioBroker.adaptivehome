import { z } from 'zod';
import { id } from '../model/contracts';
import { createProfile, DetectionRule } from './profiles';
import { IntegrationManifest, IntegrationRegistry, normalize, StateMetadata, StateValue } from './registry';
export const integrationDefinitionSchema = z.strictObject({
    apiVersion:z.literal(1),id,name:z.string().min(1).max(128),
    backends:z.array(z.string().regex(/^[a-z][a-z0-9-]{0,63}$/)).min(1).max(16),
    supportedVersions:z.array(z.string().max(64)).min(1).max(16),
    rules:z.array(z.strictObject({capability:id,suffix:z.string().regex(/^[a-zA-Z0-9_.-]{1,96}$/),
        type:z.enum(['boolean','number','string']),unit:z.string().max(32).optional(),
        readOnly:z.boolean().default(false),scale:z.number().finite().positive().optional(),
    })).min(1).max(64),
});
export type IntegrationDefinition = z.infer<typeof integrationDefinitionSchema>;
export function profileFromDefinition(raw:unknown):IntegrationManifest {
    const definition = integrationDefinitionSchema.parse(raw);
    const rules:DetectionRule[] = definition.rules.map(rule => ({...rule,suffix:new RegExp(rule.suffix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '$')}));
    return createProfile(definition.id,definition.name,definition.backends,rules);
}
export function registerDefinitions(registry:IntegrationRegistry, definitions:unknown[]):void {
    if(definitions.length > 32)throw new Error('integration_limit');
    for(const definition of definitions)registry.register(profileFromDefinition(definition));
}
export function runIntegrationContract(definition:unknown, fixtures:{objects:Record<string,StateMetadata>;states:Record<string,StateValue>;now:number}):{bindings:number;observations:number} {
    const registry = new IntegrationRegistry(), profile = profileFromDefinition(definition);registry.register(profile);
    const bindings = profile.discover(fixtures.objects);let observations = 0;
    for(const binding of bindings){registry.validate(binding);for(const mapping of binding.capabilities){
        normalize(binding,mapping,fixtures.states[mapping.readId] ?? null,fixtures.now);observations++;
        if(binding.confirmed)throw new Error('discovery_must_not_authorize');
    }}
    return {bindings:bindings.length,observations};
}
