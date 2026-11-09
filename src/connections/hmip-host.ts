import { HmipSessionSource, type ExistingHmipSession } from './hmip-session';
import { HmipNativeEndpoint, type HeatingBackendPort, type HeatingTransportJournal } from './heating-backend';
import { nativeTransportSchema, type NativeTransportConfig } from './schema';

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
	const source = new HmipSessionSource(options.api, options.clientCharacteristics, now, options.cacheMs);
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
			if (!['adaptivehomeCapabilities', 'adaptivehomeRead', 'adaptivehomeNative'].includes(envelope.command)) {
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
			const message = envelope.message as { operation?: unknown };
			if (mode === 'read-only' && message?.operation !== 'inspect') {
				throw Error('backend_read_only');
			}
			return { handled: true, result: await native.handle(envelope.message, envelope.from) };
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
