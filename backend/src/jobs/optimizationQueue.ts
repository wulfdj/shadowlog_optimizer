import { Queue } from 'bullmq';
import { redisConnection } from './redisConnection'; // Import the shared connection

// Explicitly provide the connection details to the Queue constructor
// One queue for high-priority, multi-core jobs
export const highPriorityQueue = new Queue('high-priority-jobs', {
    connection: redisConnection,
    defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 60000 } }
});

// A separate queue for low-priority, single-core jobs
export const lowPriorityQueue = new Queue('low-priority-jobs', {
    connection: redisConnection,
    defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 60000 } }
});

// The function now accepts the full job data object
export const addOptimizationJob = (jobData: object) => {
    // The second argument to .add() is the data payload for the job
    highPriorityQueue.add('run-go-optimization-normal', jobData);
    console.log(`Added optimization job with data:`, jobData);
};

export const addHighPriorityOptimizationJob = (jobData: object) => {
    // The second argument to .add() is the data payload for the job
    highPriorityQueue.add('run-go-optimization-high', jobData);
    console.log(`Added high priority optimization job with data:`, jobData);
};

