
import { Worker } from 'bullmq';
import { redisConnection } from './redisConnection';
import os from 'os';
import path from 'path';
import { AppDataSource } from '../database/data-source';
import { runMasterOptimization } from './masterJobProcessor'; // Import the new master

// The path to the sandboxed CONSUMER worker
const consumerProcessorPath = path.join(process.cwd(), 'dist', 'jobs', 'sandboxedProcessor.js');

const numConsumers = Math.max(1, os.cpus().length - 2); // Leave 1 for OS, 1 for Master

console.log(`--- Worker Farm Manager Started ---`);
console.log(`Spawning 1 Master Worker and ${numConsumers} Consumer Workers...`);

// Initialize DB connection for the master worker
AppDataSource.initialize().then(() => {
    // --- The Master Worker ---
    // This worker ONLY handles the 'master-run' job name.
    // It runs in the main process.
    new Worker('optimization-jobs', runMasterOptimization, {
        connection: redisConnection,
        concurrency: 1, // Only one master job at a time
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
        lockDuration: 300000,
    });
    console.log('Master worker initialized and listening.');
}).catch(console.error);


// --- The Consumer Worker Farm ---
// These workers ONLY handle the 'consume-combinations' job name.
for (let i = 0; i < numConsumers; i++) {
    new Worker('optimization-jobs', consumerProcessorPath, {
        connection: redisConnection,
        concurrency: 1, // Each sandboxed process handles one combination at a time
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
        lockDuration: 300000,
    });
    console.log(`Consumer worker #${i + 1} initialized.`);
}