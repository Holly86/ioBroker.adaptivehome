import { HmipSessionSource, type ExistingHmipSession } from './hmip-session';
import { HmipNativeEndpoint, type HeatingBackendPort, type HeatingTransportJournal } from './heating-backend';
import { nativeTransportSchema, type NativeTransportConfig } from './schema';
import { HmipTimedLeaseEndpoint, type TimedLeaseAcceptance, type TimedLeaseJournal } from './timed-lease';

export interface BackendEnvelope {
	command: string;
	from: string;
	message: unknown;
	callback?: unknown;
}
export interface HmipHostOptions {
	api: ExistingHmipSession;
	clientCharacteristics: Record<string, unknown>;
	allowedSenders: string[];
	targets: NativeTransportConfig[];
	mode?: 'read-only' | 'control';
	now?: () => number;
	cacheMs?: number;
	authorize?: HeatingBackendPort['authorize'];
	persist?: HeatingBackendPort['persist'];
	expiry?: HeatingBackendPort['expiry'];
	saved?: HeatingTransportJournal;
	timedAcceptance?: TimedLeaseAcceptance;
	persistTimed?: (journal: TimedLeaseJournal) => Promise<void>;
	savedTimed?: TimedLeaseJournal;
}
export interface HmipHostCapabilities {
	protocol: string;
	readProtocol: string;
	nativeProtocol: string;
	mode: 'read-only' | 'control';
	sharedExistingSession: boolean;
	fullProfileRead: boolean;
	controlEnabled: boolean;
	absoluteExpiryRegistered: boolean;
	physicalAcceptanceVerified: boolean;
}
export interface HmipBackendHost {
	source: HmipSessionSource;
	capabilities(): HmipHostCapabilities;
	invalidateProfile(groupId: string): void;
	handle(envelope: BackendEnvelope): Promise<{ handled: boolean; result?: unknown }>;
}
/** Register in a maintained backend using its existing API. Never loads another adapter or authenticates. */
export function createHmipBackendHost(options: HmipHostOptions): HmipBackendHost {
	const mode = options.mode ?? 'read-only',
		now = options.now ?? Date.now,
		targets = options.targets.map(t => nativeTransportSchema.parse(t));
	if (
		!options.allowedSenders.length ||
		options.allowedSenders.some(s => !/^system\.adapter\.adaptivehome\.\d+$/.test(s))
	) {
		throw Error('backend_sender_configuration_invalid');
	}
	if (mode === 'control' && (!options.authorize || !options.persist)) {
		throw Error('backend_control_ports_required');
	}
	if (mode === 'control' && targets.some(t => t.strategy === 'timed-lease') && !options.persistTimed) {
		throw Error('backend_timed_journal_required');
	}
	const source = new HmipSessionSource(options.api, options.clientCharacteristics, now, options.cacheMs);
	const timed = new HmipTimedLeaseEndpoint(
		targets,
		{
			snapshot: (t, fresh) => source.snapshot(t, fresh),
			authorize: async t => mode === 'control' && !!(await options.authorize?.(t)),
			activate: async (group, temperature, end) => {
				if (mode !== 'control') {
					throw Error('backend_read_only');
				}
				await source.activateTimedLease(group, temperature, end);
			},
			persist: async j => {
				if (mode !== 'control' || !options.persistTimed) {
					throw Error('backend_read_only');
				}
				await options.persistTimed(j);
			},
		},
		options.timedAcceptance,
		now,
		mode === 'control' ? options.savedTimed : undefined,
		options.allowedSenders,
	);
	const native = new HmipNativeEndpoint(
		targets,
		{
			snapshot: (target, fresh) => source.snapshot(target, fresh),
			callRestApi: (endpoint, body) => source.profileRequest(endpoint, body),
			authorize: async target => mode === 'control' && !!(await options.authorize?.(target)),
			persist: async record => {
				if (mode !== 'control' || !options.persist) {
					throw Error('backend_read_only');
				}
				await options.persist(record);
			},
			expiry: mode === 'control' ? options.expiry : undefined,
		},
		now,
		mode === 'control' ? options.saved : undefined,
		options.allowedSenders,
	);
	const capabilities = (): HmipHostCapabilities => ({
		protocol: 'adaptivehome.backend-capabilities.v1',
		readProtocol: 'adaptivehome.read.v1',
		nativeProtocol: 'adaptivehome.hmip-native.v1',
		mode,
		sharedExistingSession: true,
		fullProfileRead: true,
		controlEnabled: mode === 'control',
		absoluteExpiryRegistered: mode === 'control' && !!options.expiry,
		physicalAcceptanceVerified: false,
	});
	return {
		source,
		capabilities,
		invalidateProfile: (groupId: string) => source.invalidateProfile(groupId),
		async handle(envelope: BackendEnvelope): Promise<{ handled: boolean; result?: unknown }> {
			if (
				![
					'adaptivehomeCapabilities',
					'adaptivehomeRead',
					'adaptivehomeProfileRead',
					'adaptivehomeNative',
				].includes(envelope.command)
			) {
				return { handled: false };
			}
			if (!options.allowedSenders.includes(envelope.from)) {
				throw Error('backend_sender_denied');
			}
			if (envelope.command === 'adaptivehomeCapabilities') {
				return { handled: true, result: capabilities() };
			}
			if (envelope.command === 'adaptivehomeRead') {
				const message = envelope.message as { protocol?: unknown };
				if (!message || message.protocol !== 'adaptivehome.read.v1') {
					throw Error('backend_read_protocol_invalid');
				}
				return { handled: true, result: await source.handleRead(envelope.from, options.allowedSenders) };
			}
			if (envelope.command === 'adaptivehomeProfileRead') {
				const message = envelope.message as { protocol?: unknown; targetId?: unknown };
				const target = targets.find(t => t.enabled && t.id === message?.targetId);
				if (message?.protocol !== 'adaptivehome.profile-read.v1' || !target) {
					throw Error('backend_profile_read_invalid');
				}
				return { handled: true, result: await source.snapshot(target) };
			}
			const message = envelope.message as { operation?: unknown };
			if (mode === 'read-only' && message?.operation !== 'inspect') {
				throw Error('backend_read_only');
			}
			const strategy = targets.find(
				t => t.id === (envelope.message as { targetId?: unknown })?.targetId,
			)?.strategy;
			return {
				handled: true,
				result: await (strategy === 'timed-lease' ? timed : native).handle(envelope.message, envelope.from),
			};
		},
	};
}
/** Explicit event registration; cleanup removes only this host's listener. No startup REST or device writes. */
export function registerHmipBackendHost(
	adapter: {
		on(event: 'message', listener: (message: BackendEnvelope) => void): unknown;
		removeListener(event: 'message', listener: (message: BackendEnvelope) => void): unknown;
		sendTo(to: string, command: string, result: any, callback: any): unknown;
	},
	options: HmipHostOptions,
): HmipBackendHost & { close(): void } {
	const host = createHmipBackendHost(options);
	const listener = (message: BackendEnvelope): void => {
		void host
			.handle(message)
			.then(r => {
				if (r.handled && message.callback) {
					adapter.sendTo(message.from, message.command, r.result, message.callback);
				}
			})
			.catch(() => {
				if (message.callback) {
					adapter.sendTo(
						message.from,
						message.command,
						{ error: 'adaptivehome_backend_request_rejected' },
						message.callback,
					);
				}
			});
	};
	adapter.on('message', listener);
	return { ...host, close: () => adapter.removeListener('message', listener) };
}
