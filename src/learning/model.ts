import { createHash } from 'node:crypto';
import type { Observation, AutonomyProfile } from '../model/contracts';
import { localTime } from '../config/schedule';
import { z } from 'zod';
export const modelSchema = z.strictObject({
	version: z.string().min(1),
	modelType: z.enum(['usage', 'thermal', 'air-demand']),
	featureSchema: z.literal(1),
	datasetSchema: z.literal(1),
	trainedAt: z.number().finite(),
	trainFrom: z.number().finite(),
	trainUntil: z.number().finite(),
	evaluationFrom: z.number().finite(),
	evaluationUntil: z.number().finite(),
	coverage: z.number().min(0).max(1),
	validSamples: z.number().int().nonnegative(),
	rejectedSamples: z.number().int().nonnegative(),
	gaps: z.number().int().nonnegative(),
	comparableDays: z.number().int().nonnegative(),
	baselineMAE: z.number().finite().nullable(),
	candidateMAE: z.number().finite().nullable(),
	admitted: z.boolean(),
	reason: z.string().max(128),
	startMinute: z.number().finite().nullable(),
	endMinute: z.number().finite().nullable(),
	responseCPerHour: z.number().finite().nullable(),
	typicalGapMs: z.number().finite().nullable(),
	medianValue: z.number().finite().nullable(),
	uncertainty: z.string().max(512),
	dataHash: z.string().min(1),
});
export interface TrainingRequest {
	kind: 'usage' | 'thermal' | 'air-demand';
	timezone: string;
	now: number;
	observations: Observation[];
	profile: AutonomyProfile;
	baselineStartMinute?: number;
	threshold?: number;
}
export interface ModelVersion {
	version: string;
	modelType: TrainingRequest['kind'];
	featureSchema: 1;
	datasetSchema: 1;
	trainedAt: number;
	trainFrom: number;
	trainUntil: number;
	evaluationFrom: number;
	evaluationUntil: number;
	coverage: number;
	validSamples: number;
	rejectedSamples: number;
	gaps: number;
	comparableDays: number;
	baselineMAE: number | null;
	candidateMAE: number | null;
	admitted: boolean;
	reason: string;
	startMinute: number | null;
	endMinute: number | null;
	responseCPerHour: number | null;
	uncertainty: string;
	dataHash: string;
	typicalGapMs: number | null;
	medianValue: number | null;
}
const median = (values: number[]): number => {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)];
};
export function trainLocal(request: TrainingRequest): ModelVersion {
	const accepted = request.observations
		.filter(
			o =>
				o.quality === 'valid' && o.value !== null && o.measuredAt <= request.now && o.receivedAt <= request.now,
		)
		.sort((a, b) => a.measuredAt - b.measuredAt);
	const unique = [...new Map(accepted.map(o => [`${o.entityId}:${o.capability}:${o.measuredAt}`, o])).values()];
	const dataHash = createHash('sha256')
		.update(JSON.stringify(unique.map(o => [o.capability, o.measuredAt, o.value])))
		.digest('hex');
	let covered = 0,
		gaps = 0;
	for (let i = 1; i < unique.length; i++) {
		const delta = unique[i].measuredAt - unique[i - 1].measuredAt;
		if (delta > request.profile.maxGapMs) {
			gaps++;
		} else if (delta > 0) {
			covered += delta;
		}
	}
	const duration = unique.length > 1 ? unique.at(-1)!.measuredAt - unique[0].measuredAt : 0;
	const days = new Map<string, Observation[]>();
	for (const o of unique) {
		const date = localTime(o.measuredAt, request.timezone).date;
		if (date === localTime(request.now, request.timezone).date) {
			continue;
		}
		const day = days.get(date) || [];
		day.push(o);
		days.set(date, day);
	}
	const ordered = [...days.values()],
		holdoutDays = Math.max(1, Math.floor(ordered.length * 0.25)),
		training = ordered.slice(0, -holdoutDays).flat(),
		evaluation = ordered.slice(-holdoutDays).flat();
	const model: ModelVersion = {
		version: dataHash.slice(0, 16),
		modelType: request.kind,
		featureSchema: 1,
		datasetSchema: 1,
		trainedAt: request.now,
		trainFrom: training[0]?.measuredAt ?? 0,
		trainUntil: training.at(-1)?.measuredAt ?? 0,
		evaluationFrom: evaluation[0]?.measuredAt ?? 0,
		evaluationUntil: evaluation.at(-1)?.measuredAt ?? 0,
		coverage: duration ? covered / duration : 0,
		validSamples: unique.length,
		rejectedSamples: request.observations.length - unique.length,
		gaps,
		comparableDays: days.size,
		baselineMAE: null,
		candidateMAE: null,
		admitted: false,
		reason: 'insufficient_data',
		startMinute: null,
		endMinute: null,
		responseCPerHour: null,
		typicalGapMs: null,
		medianValue: null,
		uncertainty: 'No probability estimate; quality and chronological holdout errors are reported.',
		dataHash,
	};
	if (unique.length < request.profile.minSamples || days.size < 4 || training.length < 3 || !evaluation.length) {
		return model;
	}
	if (model.coverage < request.profile.minCoverage) {
		model.reason = 'insufficient_coverage';
		return model;
	}
	if (request.kind === 'thermal') {
		const pairs = (
			rows: Observation[],
		): {
			before: number;
			after: number;
			hours: number;
		}[] => {
			const values = rows.filter(o => o.capability === 'temperatureSensor' && typeof o.value === 'number');
			const result = [];
			for (let i = 1; i < values.length; i++) {
				const hours = (values[i].measuredAt - values[i - 1].measuredAt) / 3600000;
				if (hours > 0 && hours * 3600000 <= request.profile.maxGapMs) {
					result.push({ before: Number(values[i - 1].value), after: Number(values[i].value), hours });
				}
			}
			return result;
		};
		const trainPairs = pairs(training),
			evalPairs = pairs(evaluation);
		if (trainPairs.length < 6 || !evalPairs.length) {
			return model;
		}
		const rate = median(trainPairs.map(p => (p.after - p.before) / p.hours));
		model.responseCPerHour = rate;
		model.baselineMAE = evalPairs.reduce((s, p) => s + Math.abs(p.after - p.before), 0) / evalPairs.length;
		model.candidateMAE =
			evalPairs.reduce((s, p) => s + Math.abs(p.after - (p.before + rate * p.hours)), 0) / evalPairs.length;
		model.admitted = rate > 0 && rate <= 10 && model.candidateMAE <= model.baselineMAE;
		model.reason = model.admitted ? 'chronological_thermal_fit' : 'thermal_response_unreliable';
		return model;
	}
	const positive = (o: Observation): boolean =>
		request.kind === 'air-demand'
			? typeof o.value === 'number' && o.value >= (request.threshold ?? Infinity)
			: o.value === true;
	const positiveTimes = training.filter(positive).map(o => o.measuredAt),
		positiveGaps = positiveTimes
			.slice(1)
			.map((at, i) => at - positiveTimes[i])
			.filter(ms => ms <= request.profile.maxGapMs);
	model.typicalGapMs = positiveGaps.length ? median(positiveGaps) : null;
	const numeric = training.filter(o => typeof o.value === 'number').map(o => Number(o.value));
	model.medianValue = numeric.length ? median(numeric) : null;
	const windows = ordered.map(rows => {
		const points = rows.filter(positive);
		return points.length
			? {
					start: localTime(points[0].measuredAt, request.timezone).minute,
					end: localTime(points.at(-1)!.measuredAt, request.timezone).minute,
				}
			: null;
	});
	const trainWindows = windows.slice(0, -holdoutDays).filter(
			(
				w,
			): w is {
				start: number;
				end: number;
			} => !!w,
		),
		testWindows = windows.slice(-holdoutDays).filter(
			(
				w,
			): w is {
				start: number;
				end: number;
			} => !!w,
		);
	if (trainWindows.length < 3 || !testWindows.length) {
		model.reason = 'insufficient_positive_days';
		return model;
	}
	model.startMinute = median(trainWindows.map(w => w.start));
	model.endMinute = median(trainWindows.map(w => w.end));
	const baseline = request.baselineStartMinute ?? trainWindows.at(-1)!.start;
	model.baselineMAE = testWindows.reduce((s, w) => s + Math.abs(w.start - baseline), 0) / testWindows.length;
	model.candidateMAE =
		testWindows.reduce((s, w) => s + Math.abs(w.start - model.startMinute!), 0) / testWindows.length;
	const drift = Math.abs(median(testWindows.map(w => w.start)) - model.startMinute);
	model.admitted = drift <= 60 && model.candidateMAE <= model.baselineMAE;
	model.reason = model.admitted ? 'chronological_positive_usage_fit' : 'usage_drift_or_baseline_better';
	return model;
}
