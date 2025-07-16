import { Worker } from 'bullmq';
import { redisConnection } from './redisConnection';
import os from 'os';
import path from 'path';

// --- Configuration for the Worker Farm ---
const numWorkers = Math.max(1, os.cpus().length - 1);

// --- THE CORE FIX ---
// Construct the path from the project root (/app) to the compiled file in the 'dist' directory.
// This is unambiguous and works in both development (with ts-node mapping) and production.
const processorPath = path.join(process.cwd(), 'dist', 'jobs', 'sandboxedProcessor.js');

console.log(`--- Master Worker Manager Started (PID: ${process.pid}) ---`);
console.log(`Spawning ${numWorkers} sandboxed worker processes...`);
console.log(`Resolved processor file path for workers: ${processorPath}`);

for (let i = 0; i < numWorkers; i++) {
    console.log(`Initializing Worker #${i + 1}...`);
    
    const worker = new Worker('optimization-jobs', processorPath, {
        connection: redisConnection,
        concurrency: 1, 
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
        lockDuration: 300000,
    });

    worker.on('completed', (job, result) => {
      console.info(`Job ${job?.id} completed by a worker process. Result:`, result);
    });
    
    worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} handled by a worker process failed with error: ${err.message}`);
    });

    worker.on('error', err => {
        console.error(`A worker encountered an error:`, err);
    });
}

console.log('Worker farm is up and running.');