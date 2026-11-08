export interface Clock { now(): number }
export const systemClock: Clock = { now: () => Date.now() };
export class ManualClock implements Clock {
    constructor(public time = 0) {}
    now(): number { return this.time; }
    advance(ms: number): void { this.time += ms; }
}
export async function deadline<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([work, new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('deadline_exceeded')), timeoutMs);
        })]);
    } finally { if (timer) clearTimeout(timer); }
}
