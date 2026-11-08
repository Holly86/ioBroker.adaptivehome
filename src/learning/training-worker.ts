import { parentPort } from 'node:worker_threads';
import { trainLocal, TrainingRequest } from './model';
parentPort?.on('message',(request:TrainingRequest) => {
    try{parentPort?.postMessage({ok:true,model:trainLocal(request)});}catch{parentPort?.postMessage({ok:false,error:'training_failed'});}
});
