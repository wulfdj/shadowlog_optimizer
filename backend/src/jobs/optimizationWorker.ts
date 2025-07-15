import { Worker } from 'bullmq';
import { runOptimization } from './optimizationProcessor';
import { redisConnection } from './redisConnection'; // Import the shared connection
import { AppDataSource } from '../database/data-source'; 

// Initialize the TypeORM data source
AppDataSource.initialize()
    .then(() => {
        console.log("Data Source has been initialized for the worker!");

        // Now that the connection is established, create the worker.
        // The worker will not start listening for jobs until this code runs.
        const worker = new Worker('optimization-jobs', runOptimization, {
            connection: redisConnection,
            concurrency: 5,
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 500 },
            //Lock duration of 5 Minutes
            lockDuration: 300000
        });

        console.log("Optimization worker started and is listening for jobs.");

        worker.on('completed', job => {
          console.info(`Job ${job?.id} has completed successfully.`);
        });

        worker.on('failed', (job, err) => {
          console.error(`Job ${job?.id} has failed with ${err.message}`);
        });

    })
    .catch((err) => {
        console.error("Error during Data Source initialization for the worker:", err);
        // Exit the process with an error code if the database connection fails.
        // This prevents the worker from running in a broken state.
        process.exit(1);
    });