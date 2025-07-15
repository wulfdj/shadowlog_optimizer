import { Queue } from 'bullmq';
import { redisConnection } from './redisConnection'; // Import the shared connection

// Explicitly provide the connection details to the Queue constructor
const optimizationQueue = new Queue('optimization-jobs', {
    connection: redisConnection
});

// The function now accepts the full job data object
export const addOptimizationJob = (jobData: object) => {
    // The second argument to .add() is the data payload for the job
    optimizationQueue.add('run-optimization', jobData);
    console.log(`Added optimization job with data:`, jobData);
};

export default optimizationQueue;