import { z } from 'zod';
import type { SourceDocument } from './sources';

const diagnosticSchema = z.strictObject({
	code: z.enum([
		'source_unavailable',
		'source_rate_limited',
		'source_authentication_failed',
		'source_timeout',
		'source_offline',
		'source_request_denied',
	]),
	status: z.number().int().min(400).max(599).optional(),
	retryAfterMs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
});
export type ReadDiagnostic = z.infer<typeof diagnosticSchema>;

/** Only finite, non-secret facts cross the backend boundary. Never forward an exception or response body. */
export class ReadFailure extends Error {
	constructor(readonly diagnostic: ReadDiagnostic) {
		super(diagnosticSchema.parse(diagnostic).code);
	}
}

export function readFailure(error: unknown, now: number): ReadFailure {
	if (error instanceof ReadFailure) {
		return error;
	}
	const e = (error && typeof error === 'object' ? error : {}) as {
		status?: unknown;
		statusCode?: unknown;
		retryAfterMs?: unknown;
		retryAt?: unknown;
		code?: unknown;
		name?: unknown;
		message?: unknown;
		response?: { status?: unknown };
	};
	const rawStatus = e.status ?? e.statusCode ?? e.response?.status;
	const status =
		typeof rawStatus === 'number' && Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599
			? rawStatus
			: undefined;
	const rawWait = e.retryAfterMs ?? (typeof e.retryAt === 'number' ? Math.max(0, e.retryAt - now) : undefined);
	const retryAfterMs =
		typeof rawWait === 'number' && Number.isSafeInteger(rawWait) && rawWait >= 0 ? rawWait : undefined;
	const errorCode = typeof e.code === 'string' ? e.code : typeof e.name === 'string' ? e.name : '';
	const message = typeof e.message === 'string' ? e.message : '';
	const code: ReadDiagnostic['code'] =
		status === 429 || e.code === 'HMIP_REST_COOLDOWN'
			? 'source_rate_limited'
			: status === 401 || status === 403
				? 'source_authentication_failed'
				: ['ETIMEDOUT', 'ECONNABORTED', 'TimeoutError', 'AbortError'].includes(errorCode) ||
					  e.message === 'deadline_exceeded'
					? 'source_timeout'
					: e.message === 'hmip_home_offline'
						? 'source_offline'
						: ['backend_sender_denied', 'source_sender_denied', 'backend_read_protocol_invalid'].includes(
									message,
							  )
							? 'source_request_denied'
							: 'source_unavailable';
	return new ReadFailure({
		code,
		...(status === undefined ? {} : { status }),
		...(retryAfterMs === undefined ? {} : { retryAfterMs }),
	});
}

export function backendReadDocument(reply: unknown): SourceDocument {
	if (!reply || typeof reply !== 'object' || Array.isArray(reply)) {
		throw new ReadFailure({ code: 'source_unavailable' });
	}
	const r = reply as { error?: unknown; diagnostic?: unknown; document?: unknown; fetchedAt?: number };
	if (r.error !== undefined) {
		const parsed = diagnosticSchema.safeParse(r.diagnostic);
		throw new ReadFailure(parsed.success ? parsed.data : { code: 'source_unavailable' });
	}
	if (r.document === undefined) {
		throw new ReadFailure({ code: 'source_unavailable' });
	}
	return { document: r.document, fetchedAt: r.fetchedAt };
}

/** Local read pacing; a positive provider wait is a minimum and is never shortened. No retry timer or writes. */
export class ReadBackoff {
	version = 0;
	private failures = 0;
	private until = 0;
	private diagnostic?: ReadDiagnostic;
	blocked(now: number): ReadFailure | undefined {
		return this.diagnostic && now < this.until
			? new ReadFailure({
					...this.diagnostic,
					retryAfterMs: Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(this.until - now)),
				})
			: undefined;
	}

	failure(error: unknown, now: number, intervalMs: number): ReadFailure {
		const failure = readFailure(error, now);
		this.version++;
		this.failures = Math.min(this.failures + 1, 16);
		const wait = Math.max(
			intervalMs,
			Math.min(300000, intervalMs * 2 ** (this.failures - 1)),
			failure.diagnostic.retryAfterMs ?? 0,
		);
		this.until = Math.max(this.until, Math.min(Number.MAX_SAFE_INTEGER, now + wait));
		this.diagnostic = failure.diagnostic;
		return new ReadFailure({ ...failure.diagnostic, retryAfterMs: Math.ceil(this.until - now) });
	}

	success(version: number): void {
		// An older concurrent success cannot erase a newer failure/wait.
		if (this.version === version) {
			this.failures = 0;
			this.until = 0;
			this.diagnostic = undefined;
		}
	}
}
