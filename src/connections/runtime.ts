import { nativeHeatingProgramSchema, nativeHeatingReportSchema } from '../integrations/native-program';
import type { StateValue, StateMetadata } from '../integrations/registry';
import type { NativeTransportConfig } from './schema';
import { nativePrefix } from './schema';
import { deadline } from '../runtime/clock';

export interface BackendMessagePort {
	send(backend: string, command: string, message: Record<string, unknown>): Promise<unknown>;
}
/** Virtual command paths can only be reached through Executor's configured write port. */
export class NativeConnections {
	private states = new Map<string, StateValue>();
	private configuration: NativeTransportConfig[] = [];
	private signature = '';
	private attempts = new Map<string, number>();
	readonly errors: Record<string, string> = {};
	constructor(
		private namespace: string,
		private port: BackendMessagePort,
		private now: () => number = Date.now,
	) {}
	configure(transports: NativeTransportConfig[]): void {
		const signature = JSON.stringify(transports);
		if (signature !== this.signature) {
			this.signature = signature;
			this.states.clear();
			this.attempts.clear();
			this.configuration = transports;
		}
	}
	metadata(id: string): StateMetadata | null {
		for (const t of this.configuration) {
			const p = nativePrefix(this.namespace, t.id);
			if (id === `${p}.command`) {
				return { type: 'string', unit: '', read: false, write: true };
			}
			if (id === `${p}.report`) {
				return { type: 'string', unit: '', read: true, write: false };
			}
			if (id === `${p}.verifiedAt`) {
				return { type: 'number', unit: '', read: true, write: false };
			}
		}
		return null;
	}
	read(id: string): StateValue | null {
		return this.states.get(id) ?? null;
	}
	handles(id: string): boolean {
		return this.configuration.some(t => id === `${nativePrefix(this.namespace, t.id)}.command`);
	}
	async write(id: string, value: unknown, dispatchDeadline = this.now() + 10000): Promise<void> {
		if (!Number.isFinite(dispatchDeadline) || dispatchDeadline <= this.now()) {
			throw Error('native_dispatch_expired');
		}
		const t = this.configuration.find(t => id === `${nativePrefix(this.namespace, t.id)}.command`);
		if (!t?.enabled || typeof value !== 'string') {
			throw Error('native_transport_disabled');
		}
		const program = nativeHeatingProgramSchema.parse(JSON.parse(value));
		if (program.strategy !== t.strategy) {
			throw Error('native_transport_strategy_mismatch');
		}
		if (program.physicalId !== t.physicalId || program.profileId !== t.profileIndex) {
			throw Error('native_transport_scope');
		}
		await this.request(t, { operation: 'apply', program, deadline: dispatchDeadline });
	}
	async refresh(transports: NativeTransportConfig[]): Promise<void> {
		this.configure(transports);
		const signature = this.signature;
		await Promise.all(
			transports
				.filter(t => t.enabled)
				.map(async t => {
					const previous = this.attempts.get(t.id),
						now = this.now();
					if (
						previous !== undefined &&
						now >= previous &&
						now - previous < (this.errors[t.id] ? 60000 : 15000)
					) {
						return;
					}
					this.attempts.set(t.id, now);
					try {
						await this.request(t, { operation: 'inspect' });
					} catch (error) {
						if (signature === this.signature) {
							this.invalidate(t);
							this.errors[t.id] =
								error instanceof Error &&
								[
									'native_absolute_expiry_unsupported',
									'native_baseline_not_accepted',
									'native_previous_command_uncertain',
								].includes(error.message)
									? error.message
									: 'native_backend_unavailable';
						}
					}
				}),
		);
	}
	private invalidate(t: NativeTransportConfig): void {
		for (const suffix of ['report', 'verifiedAt']) {
			this.states.set(`${nativePrefix(this.namespace, t.id)}.${suffix}`, {
				val: null,
				ts: this.now(),
				ack: true,
				q: 1,
			});
		}
	}
	private async request(t: NativeTransportConfig, payload: Record<string, unknown>): Promise<void> {
		const signature = this.signature;
		const result = (await deadline(
			this.port.send(t.backend, 'adaptivehomeNative', {
				protocol: 'adaptivehome.hmip-native.v1',
				targetId: t.id,
				...payload,
			}),
			5000,
		)) as {
			protocol?: string;
			ready?: boolean;
			observedAt?: number;
			report?: unknown;
			reason?: string;
			capabilities?: { absoluteExpiry?: boolean };
		};
		if (signature !== this.signature) {
			throw Error('native_configuration_changed');
		}
		const at = result?.observedAt;
		if (result?.protocol === 'adaptivehome.hmip-native.v1' && !result.capabilities?.absoluteExpiry) {
			this.invalidate(t);
			throw Error('native_absolute_expiry_unsupported');
		}
		if (
			result?.protocol !== 'adaptivehome.hmip-native.v1' ||
			!result.ready ||
			!result.capabilities?.absoluteExpiry ||
			at === undefined ||
			!Number.isFinite(at) ||
			at > this.now() ||
			this.now() - at > t.maxAgeMs
		) {
			this.invalidate(t);
			throw Error('native_backend_not_ready');
		}
		const report = nativeHeatingReportSchema.parse(result.report);
		if (report.program.physicalId !== t.physicalId || report.program.profileId !== t.profileIndex) {
			throw Error('native_report_scope');
		}
		const p = nativePrefix(this.namespace, t.id);
		this.states.set(`${p}.report`, { val: JSON.stringify(report), ts: at, ack: true, q: 0 });
		this.states.set(`${p}.verifiedAt`, { val: at, ts: at, ack: true, q: 0 });
		delete this.errors[t.id];
	}
}
