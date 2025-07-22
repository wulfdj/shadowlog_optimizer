import { Worker } from 'bullmq';
import { redisConnection } from './redisConnection';
import { stopJob } from './stoppingProcessor';
import path from 'path';

// The path to the COMPILED JavaScript file that will execute the Go binary.
const processorPath = path.join(process.cwd(), 'dist', 'jobs', 'masterJobProcessor.js');


console.log(`--- Worker Process Started (PID: ${process.pid}) ---`);
console.log(`Master Orchestrator Processor: ${processorPath}`);

// We only need one master orchestrator, as the parallelism is now handled inside Go.
const highPriorityWorker = new Worker('stopping-jobs', stopJob, {
    connection: redisConnection,
    concurrency: 1, // Process one big optimization (which spawns Go) at a time.
    lockDuration: 7200000, // 2 hour lock for a potentially very long job
});

const lowPriorityWorker = new Worker('low-priority-jobs', processorPath, {
    connection: redisConnection,
    concurrency: 1, // Process one big optimization (which spawns Go) at a time.
    lockDuration: 7200000, // 2 hour lock for a potentially very long job
});

lowPriorityWorker.on('completed', (job, result) => {
  console.info(`Job ${job?.id} (${job.name}) completed. Result:`, result);
});

lowPriorityWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} (${job.name}) failed with error: ${err.message}`);
});

lowPriorityWorker.on('error', err => {
    console.error(`Worker encountered an error:`, err);
});


highPriorityWorker.on('completed', (job, result) => {
  console.info(`Stop Job ${job?.id} (${job.name}) completed. Result:`, result);
});

highPriorityWorker.on('failed', (job, err) => {
  console.error(`Stop Job ${job?.id} (${job.name}) failed with error: ${err.message}`);
});

highPriorityWorker.on('error', err => {
    console.error(`Worker encountered an error:`, err);
});

console.log('Worker is up and listening for jobs on queue: optimization-jobs');