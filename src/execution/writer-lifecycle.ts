import { request } from 'node:http';

export interface WriterLifecycle {
	running(): Promise<boolean>;
	start(): Promise<void>;
	stop(): Promise<void>;
}
/** Fixed container identity and endpoint; never accepts a command, URL or shell from a plan. */
export function dockerWriterLifecycle(options: {
	containerId: string;
	socketPath?: string;
	port?: number;
	host?: string;
	timeoutMs?: number;
}): WriterLifecycle {
	if (
		!/^[a-f0-9]{64}$/.test(options.containerId) ||
		!!options.socketPath === !!options.port ||
		(options.port && !['127.0.0.1', '::1'].includes(options.host ?? '127.0.0.1'))
	) {
		throw Error('maintenance_docker_endpoint_invalid');
	}
	const timeout = options.timeoutMs ?? 10000;
	if (!Number.isInteger(timeout) || timeout < 100 || timeout > 30000) {
		throw Error('maintenance_docker_timeout_invalid');
	}
	const call = (method: 'GET' | 'POST', suffix: string): Promise<any> =>
		new Promise((resolve, reject) => {
			const req = request(
				{
					...(options.socketPath
						? { socketPath: options.socketPath }
						: { host: options.host ?? '127.0.0.1', port: options.port }),
					path: `/containers/${options.containerId}/${suffix}`,
					method,
					timeout,
				},
				res => {
					let data = '';
					res.setEncoding('utf8');
					res.on('data', chunk => {
						data += chunk;
						if (data.length > 65536) {
							req.destroy(Error('maintenance_response_limit'));
						}
					});
					res.on('end', () => {
						if (![200, 204, 304].includes(res.statusCode ?? 0)) {
							reject(Error('maintenance_docker_rejected'));
							return;
						}
						try {
							resolve(data ? JSON.parse(data) : null);
						} catch {
							reject(Error('maintenance_docker_invalid'));
						}
					});
				},
			);
			req.on('timeout', () => req.destroy(Error('maintenance_lifecycle_timeout')));
			req.on('error', reject);
			req.end();
		});
	const running = async (): Promise<boolean> => {
		const r = await call('GET', 'json');
		if (r?.Id !== options.containerId || typeof r.State?.Running !== 'boolean' || r.State.Restarting) {
			throw Error('maintenance_docker_identity_or_restart');
		}
		return r.State.Running;
	};
	const change = async (start: boolean): Promise<void> => {
		await running();
		await call('POST', start ? 'start' : 'stop?t=5');
		const until = Date.now() + timeout;
		while (Date.now() < until) {
			if ((await running()) === start) {
				return;
			}
			await new Promise(r => setTimeout(r, 50));
		}
		throw Error('maintenance_lifecycle_unconfirmed');
	};
	return { running, start: () => change(true), stop: () => change(false) };
}

export interface IoBrokerLifecycleAPI {
	object(id: string): Promise<{ common: { enabled?: boolean }; native?: unknown } | null>;
	setEnabled(id: string, enabled: boolean): Promise<void>;
	alive(id: string): Promise<{ val: unknown; ack: boolean; q?: number; ts: number } | null>;
}
/** Explicit registered instance only; preserve native settings and verify actual liveness after enabled change. */
export function ioBrokerWriterLifecycle(
	instance: string,
	api: IoBrokerLifecycleAPI,
	timeoutMs = 10000,
): WriterLifecycle {
	if (!/^[a-z][a-z0-9-]*\.\d+$/.test(instance) || timeoutMs < 100 || timeoutMs > 30000) {
		throw Error('maintenance_instance_invalid');
	}
	const id = `system.adapter.${instance}`,
		running = async (): Promise<boolean> => {
			const [o, s] = await Promise.all([api.object(id), api.alive(`${id}.alive`)]);
			if (!o || !s?.ack || s.q || typeof s.val !== 'boolean' || s.ts > Date.now() || Date.now() - s.ts > 30000) {
				throw Error('maintenance_liveness_unverified');
			}
			return s.val;
		};
	const change = async (enabled: boolean): Promise<void> => {
		const before = await api.object(id);
		if (!before) {
			throw Error('maintenance_instance_missing');
		}
		await api.setEnabled(id, enabled);
		const until = Date.now() + timeoutMs;
		while (Date.now() < until) {
			const o = await api.object(id);
			if (JSON.stringify(o?.native) !== JSON.stringify(before.native)) {
				throw Error('maintenance_native_configuration_changed');
			}
			if (o?.common.enabled === enabled && (await running()) === enabled) {
				return;
			}
			await new Promise(r => setTimeout(r, 50));
		}
		throw Error('maintenance_lifecycle_unconfirmed');
	};
	return { running, start: () => change(true), stop: () => change(false) };
}
