import { open } from 'node:fs/promises';
import { z } from 'zod';
import type { SourceDocument } from './sources';

export const endpointSchema = z.strictObject({
	kind: z.enum([
		'hue-lights',
		'hue-sensors',
		'shelly-status',
		'shelly-rpc-status',
		'shelly-device',
		'shelly-rpc-info',
	]),
	origin: z
		.string()
		.url()
		.refine(v => {
			const u = new URL(v);
			return (
				['http:', 'https:'].includes(u.protocol) &&
				!u.username &&
				!u.password &&
				!u.search &&
				!u.hash &&
				u.pathname === '/'
			);
		}),
	user: z.string().max(256).optional(),
	secret: z.string().max(512).optional(),
	expectedDevice: z
		.strictObject({ mac: z.string().regex(/^[a-fA-F0-9]{12}$/), model: z.string().min(1).max(64) })
		.optional(),
});
const hueReference = z.strictObject({
	kind: z.enum(['hue-lights', 'hue-sensors']),
	backendRef: z.string().regex(/^hue\.\d+$/),
});
const field = z
	.string()
	.regex(/^[a-zA-Z0-9_-]{1,64}$/)
	.refine(v => !['__proto__', 'constructor', 'prototype'].includes(v));
const fileReference = endpointSchema.omit({ user: true, secret: true }).extend({
	credentialFile: z.strictObject({ key: field, userField: field.optional(), secretField: field }),
});
/** Reuse the configured bridge application key; pairing and new vendor sessions are never started. */
export async function resolveSourceEndpoint(
	input: unknown,
	readBackend: (id: string) => Promise<Record<string, unknown>>,
	decrypt: (value: string) => string,
	readCredentials?: (key: string) => Promise<unknown>,
): Promise<unknown> {
	if (input && typeof input === 'object' && Object.hasOwn(input, 'credentialFile')) {
		const ref = fileReference.parse(input);
		if (!readCredentials) {
			throw Error('source_credentials_unavailable');
		}
		const data = await readCredentials(ref.credentialFile.key);
		if (!data || typeof data !== 'object' || Array.isArray(data)) {
			throw Error('source_credentials_invalid');
		}
		const record = data as Record<string, unknown>,
			get = (key: string): string => {
				if (
					!Object.hasOwn(record, key) ||
					typeof record[key] !== 'string' ||
					!record[key] ||
					record[key].length > 512
				) {
					throw Error('source_credentials_invalid');
				}
				return record[key];
			};
		return endpointSchema.parse({
			kind: ref.kind,
			origin: ref.origin,
			expectedDevice: ref.expectedDevice,
			user: ref.credentialFile.userField ? get(ref.credentialFile.userField) : undefined,
			secret: get(ref.credentialFile.secretField),
		});
	}
	if (!input || typeof input !== 'object' || !Object.hasOwn(input, 'backendRef')) {
		return endpointSchema.parse(input);
	}
	const ref = hueReference.parse(input),
		native = await readBackend(ref.backendRef);
	if (typeof native.bridge !== 'string' || typeof native.user !== 'string' || !native.user) {
		throw Error('source_backend_config_invalid');
	}
	const host = new URL(`${native.ssl === true ? 'https' : 'http'}://${native.bridge}`);
	if (host.pathname !== '/' || host.search || host.hash || host.username || host.password) {
		throw Error('source_backend_config_invalid');
	}
	if (native.port !== undefined && native.port !== '' && native.port !== null) {
		const port = Number(native.port);
		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			throw Error('source_backend_config_invalid');
		}
		host.port = String(port);
	}
	const secret = native.user.startsWith('$/aes-') ? decrypt(native.user) : native.user;
	return endpointSchema.parse({ kind: ref.kind, origin: `${host.origin}/`, secret });
}
/** Fixed read routes only: a user-supplied Shelly GET action can never enter this connector. */
export async function getSourceJSON(
	input: unknown,
	fetcher: typeof fetch = fetch,
	now: () => number = Date.now,
): Promise<SourceDocument> {
	const endpoint = endpointSchema.parse(input),
		headers: Record<string, string> = {};
	if (endpoint.expectedDevice) {
		if (!['shelly-status', 'shelly-rpc-status'].includes(endpoint.kind)) {
			throw Error('source_identity_configuration_invalid');
		}
		const identity = await getSourceJSON(
			{
				...endpoint,
				expectedDevice: undefined,
				kind: endpoint.kind === 'shelly-status' ? 'shelly-device' : 'shelly-rpc-info',
			},
			fetcher,
			now,
		);
		const device = identity.document as { mac?: unknown; type?: unknown; model?: unknown };
		if (
			!device ||
			typeof device.mac !== 'string' ||
			device.mac.replace(/[:-]/g, '').toUpperCase() !== endpoint.expectedDevice.mac.toUpperCase() ||
			(device.type ?? device.model) !== endpoint.expectedDevice.model
		) {
			throw Error('source_device_identity_mismatch');
		}
	}
	let route: string;
	if (endpoint.kind.startsWith('hue-')) {
		if (!endpoint.secret) {
			throw Error('source_credentials_missing');
		}
		route = `/api/${encodeURIComponent(endpoint.secret)}/${endpoint.kind === 'hue-lights' ? 'lights' : 'sensors'}`;
	} else {
		route =
			endpoint.kind === 'shelly-status'
				? '/status'
				: endpoint.kind === 'shelly-device'
					? '/shelly'
					: endpoint.kind === 'shelly-rpc-info'
						? '/rpc/Shelly.GetDeviceInfo'
						: '/rpc/Shelly.GetStatus';
		if (endpoint.secret) {
			headers.Authorization = `Basic ${Buffer.from(`${endpoint.user ?? ''}:${endpoint.secret}`).toString('base64')}`;
		}
	}
	const response = await fetcher(new URL(route, endpoint.origin), {
		method: 'GET',
		headers,
		redirect: 'error',
		signal: AbortSignal.timeout(5000),
	});
	if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 1048576) {
		throw Error('source_read_failed');
	}
	const reader = response.body?.getReader();
	if (!reader) {
		throw Error('source_read_failed');
	}
	const chunks: Uint8Array[] = [];
	let length = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			length += value.length;
			if (length > 1048576) {
				throw Error('source_document_too_large');
			}
			chunks.push(value);
		}
	} finally {
		await reader.cancel().catch(() => undefined);
	}
	const document: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
	if (Array.isArray(document) && document.some(r => r?.error)) {
		throw Error('source_read_rejected');
	}
	return { document, fetchedAt: now() };
}
/** Only explicitly declared native file keys are resolved; config imports cannot choose disk paths. */
export async function readSourceFile(key: string, files: Record<string, string>): Promise<unknown> {
	if (!Object.hasOwn(files, key) || typeof files[key] !== 'string') {
		throw Error('source_file_not_declared');
	}
	const file = await open(files[key], 'r');
	try {
		const stat = await file.stat();
		if (!stat.isFile() || stat.size > 1048576) {
			throw Error('source_file_invalid');
		}
		const buffer = Buffer.alloc(1048577),
			{ bytesRead } = await file.read(buffer, 0, buffer.length, 0);
		if (bytesRead > 1048576) {
			throw Error('source_document_too_large');
		}
		return JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'));
	} finally {
		await file.close();
	}
}
