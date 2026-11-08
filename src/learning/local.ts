import path from 'node:path';
import { Worker } from 'node:worker_threads';
import type { Configuration, FunctionConfig } from '../model/contracts';
import type { History } from '../diagnostics/history';
import type { ModelVersion, TrainingRequest } from './model';
import { modelSchema } from './model';
import { z } from 'zod';
export class WorkerTrainer {
	private workers = new Set<Worker>();
	async train(request: TrainingRequest): Promise<ModelVersion> {
		if (this.workers.size >= 2) {
			throw new Error('training_busy');
		}
		return new Promise((resolve, reject) => {
			const worker = new Worker(path.join(__dirname, 'training-worker.js'), {
				resourceLimits: { maxOldGenerationSizeMb: 64, stackSizeMb: 4 },
			});
			this.workers.add(worker);
			const timer = setTimeout(() => {
				this.workers.delete(worker);
				void worker.terminate();
				reject(new Error('training_deadline'));
			}, 3000);
			const finish = (): void => {
				clearTimeout(timer);
				this.workers.delete(worker);
				void worker.terminate();
			};
			worker.once('message', (response: { ok: boolean; model: ModelVersion }) => {
				finish();
				response.ok ? resolve(response.model) : reject(new Error('training_failed'));
			});
			worker.once('error', () => {
				finish();
				reject(new Error('training_worker_failed'));
			});
			worker.once('exit', code => {
				if (this.workers.has(worker)) {
					finish();
					reject(new Error(`training_worker_exit_${code}`));
				}
			});
			worker.postMessage({ ...request, observations: request.observations.slice(-10000) });
		});
	}
	close(): void {
		for (const worker of this.workers) {
			void worker.terminate();
		}
		this.workers.clear();
	}
}
export interface LearningRecord {
	version: 1;
	models: Record<string, ModelVersion[]>;
	errors: Record<string, string>;
}
export class LocalLearning {
	record: LearningRecord = { version: 1, models: {}, errors: {} };
	private trainer = new WorkerTrainer();
	private busy = new Set<string>();
	private lastAttempt = new Map<string, number>();
	constructor(private persist: (record: LearningRecord) => Promise<void>) {}
	restore(raw: LearningRecord): void {
		this.record = z
			.strictObject({
				version: z.literal(1),
				models: z.record(z.string(), z.array(modelSchema).max(8)),
				errors: z.record(z.string(), z.string().max(128)),
			})
			.parse(raw);
	}
	observe(fn: FunctionConfig, config: Configuration, history: History, now: number): void {
		if (
			fn.autonomy.mode === 'classic' ||
			fn.autonomy.paused ||
			fn.autonomy.excluded ||
			this.busy.has(fn.id) ||
			now - (this.lastAttempt.get(fn.id) ?? -Infinity) < 60000
		) {
			return;
		}
		this.lastAttempt.set(fn.id, now);
		this.busy.add(fn.id);
		const source = fn.inputs.presence ?? fn.inputs.motion ?? fn.inputs.airQuality ?? fn.inputs.temperature;
		if (!source) {
			this.record.errors[fn.id] = 'learning_source_missing';
			this.busy.delete(fn.id);
			return;
		}
		const observations = history.record.observations.filter(
			o => o.entityId === source.entityId && o.capability === source.capability,
		);
		const kind =
			source.capability === 'temperatureSensor'
				? 'thermal'
				: source.capability === 'airQuality'
					? 'air-demand'
					: 'usage';
		const firstWindow = fn.rules.flatMap(r => r.windows)[0];
		const baselineStartMinute = firstWindow
			? Number(firstWindow.start.slice(0, 2)) * 60 + Number(firstWindow.start.slice(3))
			: undefined;
		void this.trainer
			.train({
				kind,
				timezone: config.timezone,
				now,
				observations,
				profile: fn.autonomy,
				baselineStartMinute,
				threshold: fn.parameters.threshold,
			})
			.then(async model => {
				this.record.models[fn.id] = [
					...(this.record.models[fn.id] || []).filter(m => m.version !== model.version),
					model,
				].slice(-8);
				await this.persist(this.record);
				delete this.record.errors[fn.id];
			})
			.catch(() => {
				this.record.errors[fn.id] = 'training_or_storage_unavailable';
				const latest = this.record.models[fn.id]?.at(-1);
				if (latest) {
					latest.admitted = false;
				}
			})
			.finally(() => this.busy.delete(fn.id));
	}
	close(): void {
		this.trainer.close();
	}
}
