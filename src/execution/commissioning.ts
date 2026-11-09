import { z } from 'zod';
import {
	HmipTimedLeaseEndpoint,
	heatingFingerprint,
	type TimedLeaseJournal,
	type TimedLeasePort,
} from '../connections/timed-lease';
import type { NativeTransportConfig } from '../connections/schema';
import type { HmipSnapshot } from '../connections/heating-backend';
import { nativeHeatingProgramSchema, type NativeHeatingProgram } from '../integrations/native-program';
import { deadline as bounded } from '../runtime/clock';

const hash = z.string().regex(/^[a-f0-9]{64}$/),
	ref = z.string().min(1).max(128);
export const commissioningGrantSchema = z.strictObject({
	id: ref,
	operator: ref,
	createdAt: z.number().finite(),
	expiresAt: z.number().finite(),
	configurationHash: hash,
	packageHash: hash,
	homeId: ref,
	timezone: ref,
	maxCommands: z.number().int().min(1).max(16),
	maxLeaseMs: z.number().int().min(300000).max(900000),
	steps: z.array(ref).min(1).max(16),
	targets: z
		.array(
			z.strictObject({
				targetId: ref,
				physicalId: ref,
				profileHash: hash,
				memberIds: z.array(ref).min(1).max(64),
				values: z
					.array(
						z
							.number()
							.finite()
							.refine(v => (v * 2) % 1 === 0),
					)
					.min(1)
					.max(8),
			}),
		)
		.min(1)
		.max(8),
});
export type CommissioningGrant = z.infer<typeof commissioningGrantSchema>;
export interface CommissioningAuthority {
	at: number;
	operator: string;
	present: boolean;
	exclusive: boolean;
	configurationHash: string;
	packageHash: string;
	grantId: string;
	revoked: boolean;
}
export interface CommissioningJournal {
	grantHash: string;
	steps: Record<string, { requestHash: string; phase: 'reserved' | 'accepted' | 'uncertain' }>;
	leases: TimedLeaseJournal;
}
const requestSchema = z.strictObject({
	protocol: z.literal('adaptivehome.commission.v1'),
	operation: z.enum(['step', 'inspect']),
	grantId: ref,
	operator: ref,
	targetId: ref,
	stepId: ref.optional(),
	program: nativeHeatingProgramSchema.optional(),
	deadline: z.number().finite().optional(),
});
export interface CommissioningPort extends Omit<TimedLeasePort, 'persist'> {
	authority(): Promise<CommissioningAuthority>;
	persist(journal: CommissioningJournal): Promise<void>;
}
/** An explicit manual executor, independent of normal automation and physical certificates. */
export class CommissioningExecutor {
	private journal: CommissioningJournal;
	private engine: HmipTimedLeaseEndpoint;
	private busy = false;
	private poisoned = false;
	private restored = false;
	readonly grant: CommissioningGrant;
	constructor(
		raw: unknown,
		targets: NativeTransportConfig[],
		private port: CommissioningPort,
		private now: () => number = Date.now,
		saved?: CommissioningJournal,
		private senders: string[] = [],
		private timeoutMs = 15000,
	) {
		if (!Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 15000)
			throw Error('commission_timeout_invalid');
		this.grant = commissioningGrantSchema.parse(raw);
		const g = this.grant;
		if (
			g.expiresAt <= g.createdAt ||
			g.expiresAt > g.createdAt + 3600000 ||
			new Set(g.steps).size !== g.steps.length ||
			new Set(g.targets.map(t => t.physicalId)).size !== g.targets.length ||
			new Set(g.targets.map(t => t.targetId)).size !== g.targets.length ||
			g.maxCommands > g.steps.length ||
			g.targets.some(
				t =>
					!t.values.length ||
					new Set(t.memberIds).size !== t.memberIds.length ||
					!targets.some(
						x =>
							x.id === t.targetId &&
							x.physicalId === t.physicalId &&
							x.enabled &&
							x.strategy === 'timed-lease' &&
							heatingFingerprint([...x.memberIds].sort()) ===
								heatingFingerprint([...t.memberIds].sort()) &&
							t.values.every(v => v >= x.min && v <= x.max),
					),
			)
		) {
			throw Error('commission_grant_invalid');
		}
		this.journal = structuredClone(
			saved ?? { grantHash: heatingFingerprint(g), steps: {}, leases: { commands: {} } },
		);
		if (this.journal.grantHash !== heatingFingerprint(g) || Object.keys(this.journal.steps).length > g.maxCommands)
			throw Error('commission_journal_scope');
		if (saved) {
			this.restored = true;
			for (const step of Object.values(this.journal.steps))
				if (step.phase === 'reserved') step.phase = 'uncertain';
		}
		this.engine = new HmipTimedLeaseEndpoint(
			targets,
			{
				...port,
				persist: async leases => {
					this.journal.leases = structuredClone(leases);
					await this.persist();
				},
			},
			undefined,
			now,
			this.journal.leases,
			senders,
			{ check: (t, s, p) => this.check(t, s, p) },
		);
	}
	private async persist(): Promise<void> {
		try {
			await bounded(this.port.persist(structuredClone(this.journal)), this.timeoutMs);
		} catch {
			this.poisoned = true;
			throw Error('commission_persistence_failed');
		}
	}
	private async check(t: NativeTransportConfig, s: HmipSnapshot, p: NativeHeatingProgram): Promise<void> {
		const a = await bounded(this.port.authority(), this.timeoutMs),
			g = this.grant,
			selected = g.targets.find(x => x.targetId === t.id);
		if (
			heatingFingerprint(g) !== this.journal.grantHash ||
			selected?.physicalId !== t.physicalId ||
			this.poisoned ||
			this.restored ||
			g.createdAt > this.now() ||
			g.expiresAt <= this.now() ||
			p.expiresAt > g.expiresAt ||
			p.expiresAt > p.createdAt + g.maxLeaseMs ||
			!selected ||
			!selected.values.includes(p.target) ||
			selected.profileHash !== heatingFingerprint(s.group.profile) ||
			s.group.homeId !== g.homeId ||
			s.group.windowState !== 'CLOSED' ||
			p.timezone !== g.timezone ||
			!a.present ||
			!a.exclusive ||
			a.revoked ||
			a.operator !== g.operator ||
			a.grantId !== g.id ||
			a.configurationHash !== g.configurationHash ||
			a.packageHash !== g.packageHash ||
			!Number.isFinite(a.at) ||
			a.at > this.now() ||
			this.now() - a.at > 30000
		)
			throw Error('commission_authority_denied');
	}
	async handle(input: unknown, sender: string): Promise<unknown> {
		if (!this.senders.includes(sender) || !/^system\.adapter\.adaptivehome\.\d+$/.test(sender))
			throw Error('commission_sender_denied');
		const r = requestSchema.parse(input),
			g = this.grant;
		if (r.grantId !== g.id || r.operator !== g.operator || !g.targets.some(t => t.targetId === r.targetId))
			throw Error('commission_scope_denied');
		if (this.busy) throw Error('commission_busy');
		this.busy = true;
		try {
			if (r.operation === 'step') {
				if (
					this.poisoned ||
					this.restored ||
					!r.stepId ||
					!g.steps.includes(r.stepId) ||
					!r.program ||
					r.deadline === undefined
				)
					throw Error('commission_step_denied');
				const requestHash = heatingFingerprint(r),
					previous = this.journal.steps[r.stepId];
				if (previous) {
					if (previous.requestHash !== requestHash || previous.phase !== 'accepted')
						throw Error('commission_replay_denied');
				} else {
					if (
						Object.values(this.journal.steps).some(s => s.phase !== 'accepted') ||
						Object.keys(this.journal.steps).length >= g.maxCommands
					)
						throw Error('commission_budget_or_uncertainty');
					this.journal.steps[r.stepId] = { requestHash, phase: 'reserved' };
					await this.persist();
					try {
						await bounded(
							this.engine.handle(
								{
									protocol: 'adaptivehome.hmip-native.v1',
									operation: 'apply',
									targetId: r.targetId,
									program: r.program,
									deadline: r.deadline,
								},
								sender,
							),
							this.timeoutMs,
						);
						this.journal.steps[r.stepId].phase = 'accepted';
						await this.persist();
					} catch (e) {
						this.poisoned = true;
						this.journal.steps[r.stepId].phase = 'uncertain';
						await this.persist();
						throw e;
					}
				}
			}
			const observation = await bounded(
				this.engine.handle(
					{ protocol: 'adaptivehome.hmip-native.v1', operation: 'inspect', targetId: r.targetId },
					sender,
				),
				this.timeoutMs,
			);
			return {
				protocol: 'adaptivehome.commission.v1',
				routineControlReady: false,
				physicalAcceptanceGranted: false,
				restarted: this.restored,
				observation,
			};
		} finally {
			this.busy = false;
		}
	}
}
