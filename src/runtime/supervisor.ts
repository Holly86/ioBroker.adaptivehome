import { deadline } from './clock';
export interface TaskStatus { ready: boolean; busy: boolean; failures: number; error?: string }
/** One in-flight job per function, no accumulated tick queue. Failed jobs do not end sibling jobs. */
export class Supervisor {
    readonly status = new Map<string, TaskStatus>();
    private jobs = new Map<string, () => Promise<void>>();
    private closed = false;
    constructor(private timeoutMs = 2000) {}
    register(id: string, job: () => Promise<void>): void {
        if (this.jobs.size >= 256 && !this.jobs.has(id)) throw new Error('function_limit');
        this.jobs.set(id, job);
        this.status.set(id, {ready: false, busy: false, failures: 0});
    }
    async tick(): Promise<void> {
        if (this.closed) return;
        await Promise.all([...this.jobs].map(async ([id, job]) => {
            const state = this.status.get(id)!;
            if (state.busy) return;
            state.busy = true;
            // A timed-out promise keeps its slot until settled; never duplicate its work.
            const work = Promise.resolve().then(job);
            void work.finally(() => { state.busy = false; }).catch(() => undefined);
            try { await deadline(work, this.timeoutMs); state.ready = true; delete state.error; }
            catch (error) { state.ready = false; state.failures++; state.error = error instanceof Error ? error.message : 'function_failed'; }
        }));
    }
    close(): void { this.closed = true; this.jobs.clear(); }
}
