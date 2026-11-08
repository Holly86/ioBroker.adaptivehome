import { parentPort } from 'node:worker_threads';
import type { TrainingRequest } from './model';
import { trainLocal } from './model';
parentPort?.on('message', (request: TrainingRequest) => {
	try {
		parentPort?.postMessage({ ok: true, model: trainLocal(request) });
	} catch {
		parentPort?.postMessage({ ok: false, error: 'training_failed' });
	}
});
