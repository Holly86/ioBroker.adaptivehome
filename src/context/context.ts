import { Observation } from '../model/contracts';
export class PresenceContext {
    private states = new Map<string, {source: string; lastTs: number; positive: number; absentSince?: number; confirmed?: boolean}>();
    evaluate(key: string, observation: Observation, now: number, absenceConfirmMs: number, confirmations: number): Observation {
        let state = this.states.get(key);
        if (!state || state.source !== observation.sourceId) {
            state = {source:observation.sourceId,lastTs:-Infinity,positive:0};this.states.set(key,state);
        }
        if (observation.quality !== 'valid' || typeof observation.value !== 'boolean') return {...observation,value:null,quality:observation.quality === 'valid' ? 'invalid' : observation.quality};
        if (observation.measuredAt > state.lastTs) {
            state.lastTs = observation.measuredAt;
            if (observation.value) { state.positive++;delete state.absentSince;if(state.positive >= confirmations)state.confirmed = true; }
            else {state.positive = 0;state.absentSince ??= observation.measuredAt;}
        }
        if (!observation.value && state.absentSince !== undefined && now - state.absentSince >= absenceConfirmMs) state.confirmed = false;
        return {...observation,value:state.confirmed ?? null,quality:state.confirmed === undefined ? 'unknown' : 'valid'};
    }
    clear(): void { this.states.clear(); }
}
export interface EnergyResult { kind: 'metered' | 'integrated' | 'estimated'; kWh: number | null; coverage: number; gaps: number }
export function summarizeEnergy(observations: Observation[], from: number, until: number, maxGapMs = 300000): EnergyResult {
    const points = observations.filter(o => o.quality === 'valid' && typeof o.value === 'number' && o.measuredAt >= from && o.measuredAt <= until).sort((a,b) => a.measuredAt - b.measuredAt);
    const metered = points.filter(p => p.unit === 'kWh');
    if (metered.length >= 2) {
        const delta = Number(metered.at(-1)!.value) - Number(metered[0].value);
        return {kind:'metered',kWh:delta >= 0 ? delta : null,coverage:(metered.at(-1)!.measuredAt - metered[0].measuredAt)/Math.max(1,until-from),gaps:delta < 0 ? 1 : 0};
    }
    let kWh = 0, covered = 0, gaps = 0;
    const power = points.filter(p => p.unit === 'W');
    for (let i=1;i<power.length;i++) {
        const ms = power[i].measuredAt-power[i-1].measuredAt;
        if (ms <= 0 || ms > maxGapMs) {gaps++;continue;}
        kWh += (Number(power[i].value)+Number(power[i-1].value))/2 * ms / 3600000000;covered += ms;
    }
    return {kind:'integrated',kWh:covered ? kWh : null,coverage:covered/Math.max(1,until-from),gaps};
}
