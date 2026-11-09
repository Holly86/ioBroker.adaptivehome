import type { Configuration, FunctionConfig, Scalar } from '../model/contracts';
import { configSchema } from '../model/contracts';
import type { IntegrationRegistry } from '../integrations/registry';

export function validateConfiguration(input: unknown, registry?: IntegrationRegistry): Configuration {
	const config = configSchema.parse(input);
	for (const entries of [
		config.groups,
		config.bindings,
		config.functions,
		config.sources,
		config.notificationRoutes,
		config.scenes,
		config.connections,
		config.nativeTransports,
	]) {
		if (new Set(entries.map(item => item.id)).size !== entries.length) {
			throw new Error('duplicate_id');
		}
	}
	const outputs = new Set<string>();
	for (const source of config.sources) {
		if (
			!config.bindings.some(
				b => b.id === source.ref.entityId && b.capabilities.some(m => m.capability === source.ref.capability),
			)
		) {
			throw Error('source_reference_missing');
		}
	}
	for (const c of config.connections) {
		if (c.outputs.some(o => o.transform === 'cases' && (!o.cases || o.defaultValue === undefined))) {
			throw Error('source_cases_incomplete');
		}
		if (new Set(c.outputs.map(o => o.key)).size !== c.outputs.length) {
			throw Error('duplicate_source_output');
		}
		if (
			c.outputs.some(
				o =>
					(c.kind !== 'http-json' && !o.timestampPath && !o.timestampPaths && !o.forecast?.points) ||
					(o.transform === 'forecastMedian' && !o.forecast) ||
					!!(o.timestampPath && o.timestampPaths) ||
					(!!o.forecast?.points && o.transform !== 'forecastMedian'),
			)
		) {
			throw Error('source_evidence_required');
		}
		if (c.kind === 'state-json' && /^adaptivehome\./.test(c.stateId)) {
			throw Error('source_cycle');
		}
		if (
			c.kind === 'state-map' &&
			(new Set(c.inputs.map(i => i.key)).size !== c.inputs.length ||
				c.inputs.some(i => /^adaptivehome\./.test(i.stateId)))
		) {
			throw Error('source_cycle_or_duplicate_input');
		}
	}
	for (const t of config.nativeTransports) {
		if (t.min > t.max || new Set(t.memberIds).size !== t.memberIds.length) {
			throw Error('native_transport_invalid');
		}
	}
	if (
		new Set(config.nativeTransports.map(t => t.physicalId)).size !== config.nativeTransports.length ||
		new Set(config.nativeTransports.map(t => `${t.backend}:${t.groupId}`)).size !== config.nativeTransports.length
	) {
		throw Error('duplicate_native_transport');
	}
	for (const b of config.bindings) {
		for (const mapping of b.capabilities) {
			if (/^adaptivehome\./.test(mapping.writeId ?? '')) {
				const match = /^adaptivehome\.(\d+)\.native\.([a-zA-Z0-9_-]+)\.command$/.exec(mapping.writeId!);
				const t = config.nativeTransports.find(t => t.id === match?.[2]);
				const prefix = match ? `adaptivehome.${match[1]}.native.${match[2]}` : '';
				if (
					!t ||
					mapping.codec !== 'nativeHeatingProgram' ||
					t.physicalId !== b.physicalId ||
					mapping.readId !== `${prefix}.report` ||
					mapping.confirmId !== `${prefix}.report` ||
					mapping.freshness?.verifiedAtId !== `${prefix}.verifiedAt`
				) {
					throw Error('native_transport_mapping');
				}
			}
		}
	}
	const physical = new Set<string>();
	for (const binding of config.bindings) {
		registry?.validate(binding);
		if (binding.confirmed && binding.capabilities.some(item => item.writeId)) {
			for (const identity of [binding.physicalId, ...binding.memberPhysicalIds]) {
				if (physical.has(identity)) {
					throw new Error('duplicate_physical_writer');
				}
				physical.add(identity);
			}
			for (const mapping of binding.capabilities) {
				if (mapping.writeId) {
					if (outputs.has(mapping.writeId)) {
						throw new Error('duplicate_state_writer');
					}
					outputs.add(mapping.writeId);
				}
			}
		}
	}
	const functionOwners = new Set<string>();
	for (const fn of config.functions) {
		for (const dependency of fn.dependencies) {
			if (!config.functions.some(other => other.id === dependency.functionId)) {
				throw new Error('unknown_dependency');
			}
		}
		if (!config.groups.some(group => group.id === fn.groupId)) {
			throw new Error('unknown_group');
		}
		const binding = config.bindings.find(item => item.id === fn.actuator.entityId);
		const mapping = binding?.capabilities.find(item => item.capability === fn.actuator.capability);
		if (!binding?.confirmed || !mapping?.writeId || !mapping.confirmId) {
			throw new Error('unconfirmed_actuator');
		}
		if (functionOwners.has(binding.physicalId)) {
			throw new Error('duplicate_function_owner');
		}
		functionOwners.add(binding.physicalId);
		if (fn.behavior) {
			if (!['lighting', 'equipment'].includes(fn.kind)) {
				throw new Error('behavior_kind');
			}
			if ((fn.behavior.awayOff || fn.behavior.welcomeHoldMs) && !fn.inputs.presence) {
				throw new Error('behavior_presence_required');
			}
			if (fn.behavior.welcomeHoldMs && !fn.inputs.lux) {
				throw new Error('behavior_lux_required');
			}
			if (fn.behavior.manualOffQuietMs && !fn.inputs.motion) {
				throw new Error('behavior_motion_required');
			}
			if ((fn.behavior.awayOff || fn.behavior.sessionOffMs) && fn.limits.essential) {
				throw new Error('behavior_essential_conflict');
			}
			for (const name of [...fn.behavior.manualSignatureInputs, ...fn.behavior.manualSignals.map(s => s.input)]) {
				if (!fn.inputs[name]) {
					throw new Error('manual_input_missing');
				}
			}
		}
		const activationCapabilities = new Set<string>([fn.actuator.capability]);
		for (const effect of fn.activation ?? []) {
			const component = binding.capabilities.find(m => m.capability === effect.capability);
			if (
				!component?.writeId ||
				!component.confirmId ||
				component.confirmation === 'none' ||
				activationCapabilities.has(effect.capability)
			) {
				throw new Error('activation_mapping_invalid');
			}
			activationCapabilities.add(effect.capability);
			validateValue(
				{ ...fn, limits: { ...fn.limits, min: undefined, max: undefined } },
				effect.value,
				component.valueType,
				component.min,
				component.max,
				component.writeValues ?? component.values,
			);
		}
		if (
			fn.parameters.luxRearmAbove !== undefined &&
			fn.parameters.luxRearmAbove < (fn.parameters.luxThreshold ?? 100)
		) {
			throw new Error('lux_hysteresis_range');
		}
		if (fn.climate) {
			if (fn.kind !== 'climate' || fn.actuator.capability !== 'thermostatSetpoint') {
				throw new Error('climate_kind');
			}
			if (fn.climate.weatherBelow !== undefined && !fn.inputs.weather) {
				throw new Error('weather_input_missing');
			}
			if (fn.climate.deepIdle && (!fn.inputs.humidity || !fn.inputs.temperature || !fn.inputs.usage)) {
				throw new Error('deep_idle_inputs_missing');
			}
			if (fn.climate.thermalAssist && (!fn.inputs.valve || !fn.inputs.temperature || !fn.nativeProgram)) {
				throw new Error('thermal_assist_native_inputs_missing');
			}
			for (const value of [
				fn.climate.deepIdle?.value,
				fn.climate.thermalAssist?.maxSetpoint,
				...fn.climate.weekly.map(w => w.value),
			].filter((v): v is number => v !== undefined)) {
				validateValue(
					fn,
					value,
					mapping.valueType,
					mapping.min,
					mapping.max,
					mapping.writeValues ?? mapping.values,
				);
			}
		}
		if (fn.nativeProgram) {
			if (
				fn.kind !== 'climate' ||
				mapping.codec !== 'nativeHeatingProgram' ||
				mapping.sourceType !== 'string' ||
				mapping.valueType !== 'number' ||
				fn.nativeProgram.activationDelayMs >= fn.nativeProgram.maxHorizonMs
			) {
				throw new Error('native_program_mapping');
			}
			validateValue(
				fn,
				fn.nativeProgram.fallback,
				mapping.valueType,
				mapping.min,
				mapping.max,
				mapping.writeValues ?? mapping.values,
			);
			for (const fallback of fn.nativeProgram.fallbackValues ?? []) {
				validateValue(
					fn,
					fallback,
					mapping.valueType,
					mapping.min,
					mapping.max,
					mapping.writeValues ?? mapping.values,
				);
			}
			if (fn.enabled && !fn.nativeProgram.backendContractVerified) {
				throw new Error('native_backend_unverified');
			}
		} else if (mapping.codec === 'nativeHeatingProgram') {
			throw new Error('native_program_required');
		}
		if (fn.limits.essential && fn.limits.minimumValue === undefined) {
			throw new Error('minimum_service_required');
		}
		if (fn.limits.min !== undefined && fn.limits.max !== undefined && fn.limits.min > fn.limits.max) {
			throw new Error('contradictory_limits');
		}
		for (const value of [fn.limits.minimumValue, ...fn.rules.map(r => r.value)].filter(
			(v): v is Scalar => v !== undefined,
		)) {
			validateValue(
				fn,
				value,
				mapping.valueType,
				mapping.min,
				mapping.max,
				mapping.writeValues ?? mapping.values,
			);
		}
		for (const parameter of fn.kind === 'climate'
			? ['target', 'setback']
			: fn.kind === 'air'
				? ['high', 'low']
				: fn.kind === 'lighting'
					? ['onValue', 'offValue']
					: []) {
			if (fn.parameters[parameter] !== undefined) {
				validateValue(
					fn,
					fn.parameters[parameter],
					mapping.valueType,
					mapping.min,
					mapping.max,
					mapping.writeValues ?? mapping.values,
				);
			}
		}
		for (const parameter of ['holdMs', 'luxThreshold', 'hysteresis', 'absenceConfirmMs', 'presenceConfirmations']) {
			if (fn.parameters[parameter] !== undefined && fn.parameters[parameter] < 0) {
				throw new Error('parameter_range');
			}
		}
		for (const ref of Object.values(fn.inputs)) {
			if (
				!config.bindings.some(
					item => item.id === ref.entityId && item.capabilities.some(m => m.capability === ref.capability),
				)
			) {
				throw new Error('missing_input');
			}
		}
		for (const [name, range] of Object.entries(fn.autonomy.parameters)) {
			if (!(name in fn.parameters) || range.min > range.max) {
				throw new Error('autonomy_parameter_range');
			}
		}
		if (fn.autonomy.granted && !fn.autonomy.capabilities.includes(fn.actuator.capability)) {
			throw new Error('autonomy_capability_scope');
		}
		if (new Set(fn.rules.map(rule => rule.id)).size !== fn.rules.length) {
			throw new Error('duplicate_rule');
		}
		for (const rule of fn.rules) {
			if (rule.validFrom !== undefined && rule.expiresAt !== undefined && rule.validFrom >= rule.expiresAt) {
				throw new Error('invalid_rule_deadline');
			}
			for (const condition of rule.conditions) {
				if (!(condition.input in fn.inputs)) {
					throw new Error('unknown_rule_input');
				}
			}
		}
	}
	const visited = new Set<string>(),
		scenePhysical = new Set<string>(),
		visiting = new Set<string>();
	for (const scene of config.scenes) {
		scenePhysical.clear();
		for (const action of scene.actions) {
			const fn = config.functions.find(f => f.id === action.functionId);
			if (!fn) {
				throw new Error('scene_function_unknown');
			}
			const binding = config.bindings.find(b => b.id === fn.actuator.entityId)!;
			const mapping = binding.capabilities.find(m => m.capability === fn.actuator.capability)!;
			if (scenePhysical.has(binding.physicalId)) {
				throw new Error('scene_duplicate_output');
			}
			scenePhysical.add(binding.physicalId);
			validateValue(
				fn,
				action.value,
				mapping.valueType,
				mapping.min,
				mapping.max,
				mapping.writeValues ?? mapping.values,
			);
			if (fn.limits.essential && action.value !== fn.limits.minimumValue) {
				throw new Error('scene_minimum_service');
			}
		}
	}
	const visit = (key: string): void => {
		if (visiting.has(key)) {
			throw new Error('dependency_cycle');
		}
		if (visited.has(key)) {
			return;
		}
		visiting.add(key);
		for (const dependency of config.functions.find(fn => fn.id === key)!.dependencies) {
			visit(dependency.functionId);
		}
		visiting.delete(key);
		visited.add(key);
	};
	for (const fn of config.functions) {
		visit(fn.id);
	}
	return config;
}
export function validateValue(
	fn: FunctionConfig,
	value: Scalar,
	type: string,
	min?: number,
	max?: number,
	values?: Scalar[],
): void {
	if (typeof value !== type || (typeof value === 'number' && !Number.isFinite(value))) {
		throw new Error('value_type');
	}
	if (
		typeof value === 'number' &&
		(value < Math.max(min ?? -Infinity, fn.limits.min ?? -Infinity) ||
			value > Math.min(max ?? Infinity, fn.limits.max ?? Infinity))
	) {
		throw new Error('hard_limit');
	}
	if (values && !values.includes(value)) {
		throw new Error('unsupported_value');
	}
}
export function emptyConfiguration(timezone = 'UTC'): Configuration {
	return validateConfiguration({
		schemaVersion: 1,
		revision: 0,
		parentRevision: null,
		createdAt: Date.now(),
		actor: 'setup',
		timezone,
		groups: [],
		bindings: [],
		functions: [],
	});
}
export function migrateConfiguration(input: unknown): Configuration {
	// Version 1 is the first public schema. Future versions must add an explicit migration.
	return validateConfiguration(input);
}
export interface ConfigRecord {
	active: Configuration;
	previous: Configuration | null;
	appliedRevision: number;
}
export interface ConfigurationStorage {
	read(): Promise<ConfigRecord | null>;
	write(record: ConfigRecord): Promise<void>;
}
export class ConfigurationStore {
	record: ConfigRecord = { active: emptyConfiguration(), previous: null, appliedRevision: 0 };
	private tail: Promise<unknown> = Promise.resolve();
	constructor(
		private storage: ConfigurationStorage,
		private registry?: IntegrationRegistry,
	) {}
	async load(): Promise<Configuration> {
		const saved = await this.storage.read();
		if (saved) {
			this.record = {
				active: validateConfiguration(saved.active),
				previous: saved.previous ? validateConfiguration(saved.previous) : null,
				appliedRevision: saved.appliedRevision,
			};
		}
		return this.record.active;
	}
	preview(input: unknown): Configuration {
		return validateConfiguration(input, this.registry);
	}
	activate(input: unknown, expectedRevision: number): Promise<Configuration> {
		const work = this.tail.then(async () => {
			if (this.record.active.revision !== expectedRevision) {
				throw new Error('revision_conflict');
			}
			const next = this.preview(input);
			next.revision = expectedRevision + 1;
			next.parentRevision = expectedRevision;
			const record = { active: next, previous: this.record.active, appliedRevision: this.record.appliedRevision };
			await this.storage.write(record); // Atomic object write before changing in-memory truth.
			this.record = record;
			return structuredClone(next);
		});
		this.tail = work.catch(() => undefined);
		return work;
	}
	async applied(revision: number): Promise<void> {
		if (this.record.active.revision !== revision) {
			throw new Error('revision_conflict');
		}
		const next = { ...this.record, appliedRevision: revision };
		await this.storage.write(next);
		this.record = next;
	}
	rollback(expectedRevision: number): Promise<Configuration> {
		if (!this.record.previous) {
			return Promise.reject(new Error('no_previous_revision'));
		}
		return this.activate(
			{ ...this.record.previous, actor: 'operator-rollback', createdAt: Date.now() },
			expectedRevision,
		);
	}
	export(): Configuration {
		const copy = structuredClone(this.record.active);
		copy.notificationRoutes = []; // Explicit recipients are never exported by default.
		return copy;
	}
}
