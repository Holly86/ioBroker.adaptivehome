import { z } from 'zod';
import { heatingFingerprint } from '../connections/timed-lease';
import type { HandoffCoordinator } from './handoff-coordinator';
const request = z.strictObject({
	protocol: z.literal('adaptivehome.handoff-control.v1'),
	operator: z.string().min(1).max(128),
	planHash: z.string().regex(/^[a-f0-9]{64}$/),
	deadline: z.number().finite(),
	operation: z.enum(['activate', 'rollback', 'reconcile', 'inspect']),
	reviewHash: z
		.string()
		.regex(/^[a-f0-9]{64}$/)
		.optional(),
	actionId: z
		.string()
		.regex(/^[a-f0-9]{64}$/)
		.optional(),
});
export async function handleHandoffControl(
	coordinator: HandoffCoordinator,
	operator: string,
	raw: unknown,
	now = Date.now(),
): Promise<unknown> {
	const r = request.parse(raw);
	if (
		r.operator !== operator ||
		r.planHash !== heatingFingerprint(coordinator.plan) ||
		r.deadline <= now ||
		r.deadline > now + 30000
	) {
		throw Error('handoff_request_denied');
	}
	if (r.operation === 'activate') {
		return coordinator.activate(r.deadline);
	}
	if (r.operation === 'inspect') {
		return coordinator.inspect();
	}
	if (r.operation === 'rollback') {
		return coordinator.rollback(r.reviewHash, r.deadline);
	}
	if (!r.actionId || !r.reviewHash) {
		throw Error('handoff_reconcile_denied');
	}
	await coordinator.reconcileLifecycle(r.actionId, r.reviewHash);
	return coordinator.state();
}
