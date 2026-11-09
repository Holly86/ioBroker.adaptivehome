import type { ManualWish, ExecutionJournal } from './executor';
import { manualWishRevision, mergeManualWishes } from './handoff-coordinator';
import { heatingFingerprint } from '../connections/timed-lease';
import type { MaintenanceStore } from './maintenance-store';

/** Explicit destination journal, held under its exclusive maintenance-store lock while its writer is stopped. */
export class ManualWishBridge {
	constructor(
		private store: MaintenanceStore<ExecutionJournal>,
		private physicalIds: string[],
	) {
		if (!physicalIds.length || new Set(physicalIds).size !== physicalIds.length)
			throw Error('handoff_manual_scope_invalid');
	}
	async read(): Promise<Record<string, ManualWish | null>> {
		const record = await this.store.read();
		if (!record?.manual) throw Error('handoff_manual_journal_missing');
		return Object.fromEntries(this.physicalIds.map(p => [p, record.manual[p] ?? null]));
	}
	async import(
		wishes: Record<string, ManualWish | null>,
		_actionId: string,
		expectedDestinationHash: string,
	): Promise<void> {
		await this.store.update(record => {
			if (!record?.manual) throw Error('handoff_manual_journal_missing');
			const before = Object.fromEntries(this.physicalIds.map(p => [p, record.manual[p] ?? null]));
			if (
				heatingFingerprint(before) !== expectedDestinationHash ||
				Object.keys(wishes).length !== this.physicalIds.length ||
				Object.keys(wishes).some(p => !this.physicalIds.includes(p))
			)
				throw Error('handoff_manual_cas_conflict');
			for (const p of this.physicalIds) {
				const latest = mergeManualWishes(wishes[p], before[p]);
				if (manualWishRevision(latest) !== manualWishRevision(wishes[p]))
					throw Error('handoff_destination_has_newer_wish');
				if (latest) {
					const copy = structuredClone(latest);
					delete copy.quietSince;
					record.manual[p] = copy;
				} else delete record.manual[p];
			}
			// Own journal, not an actuator write. Unrelated command/budget/uncertainty entries are preserved.
			return record;
		});
	}
}
