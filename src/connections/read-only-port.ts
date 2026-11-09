import type { ExistingHmipSession } from './hmip-session';

/** A second, unconditional read boundary, separate from native endpoint authorization. */
export function readOnlyHmipPort(api: {
	callRestApi(
		endpoint: string,
		body: Record<string, unknown>,
		options: { heatingStrict: true; timeout: number },
	): Promise<unknown>;
}): ExistingHmipSession {
	return Object.freeze({
		async callRestApi(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
			if (!['home/getCurrentState', 'group/heating/getProfile'].includes(endpoint)) {
				throw Error('backend_read_only');
			}
			return api.callRestApi(endpoint, body, { heatingStrict: true, timeout: 15000 });
		},
	});
}
