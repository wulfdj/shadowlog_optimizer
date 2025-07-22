import { Router } from "express";
import { addOptimizationJob, lowPriorityQueue, highPriorityQueue } from "../jobs/optimizationQueue";
import { AppDataSource } from "../database/data-source"; // Import DataSource
import { Configuration } from "../entities/Configuration"; // Import Configuration entity
import { redisConnection } from "../jobs/redisConnection";
import IORedis from "ioredis";

const redisClient = new IORedis(redisConnection);
const router = Router();

/**
 * @route   GET /api/optimize/active
 * @desc    Get all jobs that are currently being processed, now with config names.
 */
router.get("/active", async (req, res) => {
    try {
        const activeJobs = await lowPriorityQueue.getActive();
        const waitingJobs = await lowPriorityQueue.getWaiting();
        //const highPriorityActiveJobs = await highPriorityQueue.getActive();
        //const activeJobs = [...lowPriorityActiveJobs, ...highPriorityActiveJobs];
        
        // The job data now contains the name and max combinations, so no extra DB call is needed here.
        // const jobsToDisplay = activeJobs.map(job => ({
        //     id: job.id,
        //     progress: job.progress,
        //     startedAt: job.timestamp, // The timestamp when the job was added to the queue
        //     // Retrieve the enriched data we added when the job was created
        //     configId: job.data.configId,
        //     name: job.data.configurationName,
        //     totalCombinations: job.data.totalCombinations
        // }));

        const jobsToDisplay = await Promise.all(
            activeJobs.map(async (job) => {
                // --- CORE CHANGE: Fetch progress from our custom Redis key ---
                const progressKey = `progress-for-job:${job.id!}`;
                const totalJobsKey = `total-jobs-for-job:${job.id!}`;
                const progress = await redisClient.get(progressKey);
                const totalJobs = await redisClient.get(totalJobsKey);
                
                return {
                    id: job.id,
                    // Parse the progress, defaulting to the job's own progress if not found
                    instrument: job.data.instrument,
                    progress: progress ? parseInt(progress, 10) : job.progress,
                    startedAt: job.timestamp,
                    configId: job.data.configId,
                    name: job.data.configurationName,
                    totalCombinations: totalJobs ? parseInt(totalJobs, 10) : job.data.totalCombinations,
                    highPriority: job.data.highPriority,
                };
            })
        );

         const waitingJobsToDisplay = waitingJobs.map(job => ({
            id: job.id,
            name: job.data.configurationName,
            instrument: job.data.instrument,
            highPriority: job.data.highPriority,
            queuedAt: job.timestamp,
        }));
        
        // Sort waiting jobs by queue time
        waitingJobsToDisplay.sort((a, b) => a.queuedAt - b.queuedAt);


        res.json({
            active: jobsToDisplay,
            queued: waitingJobs
        });
    } catch (error) {
        console.error("Failed to get active jobs:", error);
        res.status(500).json({ message: "Could not retrieve active jobs." });
    }
});
 
/**
 * @route   POST /api/optimize/stop/:jobId
 * @desc    Stops a running job and moves it to the 'failed' state.
 */
router.post("/stop/:jobId", async (req, res) => {
    const { jobId } = req.params;
    if (!jobId) {
        return res.status(400).json({ message: "Job ID is required." });
    }

    const pidKey = `pid-for-job:${jobId}`;
    const pidString = await redisClient.get(pidKey);

    if (pidString) {
        const pid = parseInt(pidString, 10);
        console.log(`Found PID ${pid} for job ${jobId}. Sending SIGTERM...`);
        try {
            // This sends the termination signal to the process.
            // 'SIGTERM' is a graceful shutdown signal.
            process.kill(pid, 'SIGHUP');
        } catch (e: any) {
            // This can happen if the process has already died but the Redis key hasn't expired.
            console.warn(`Could not kill PID ${pid}, it may have already exited:`, e.message);
        }
    } else {
        console.warn(`Could not find PID for job ${jobId}. The job may be starting up.`);
    }

    // We still set the stop flag as a reliable fallback mechanism.
    const stopFlagKey = `stop-job:${jobId}`;
    await redisClient.set(stopFlagKey, "1", "EX", 43200);

    res.status(202).json({ message: `Stop signal sent to job ${jobId}.` });
});


/**
 * @route   POST /api/optimize/:configId
 * @desc    Starts a new optimization job for a given configuration
 */
router.post("/:instrument/:configId", async (req, res) => {
    const configId = parseInt(req.params.configId, 10);
    const { instrument } = req.params;
    const { highPriority } = req.body;

    if (isNaN(configId)) {
        return res.status(400).json({ message: "Invalid Configuration ID." });
    }

    try {
        // --- CORE CHANGE: Fetch config before queuing ---
        const configRepo = AppDataSource.getRepository(Configuration);
        const config = await configRepo.findOneBy({ id: configId });

        if (!config) {
            return res.status(404).json({ message: "Configuration not found." });
        }

        // --- Create the enriched data payload ---
        const jobData = {
            configId: config.id,
            instrument: instrument,
            configurationName: config.name,
            maxCombinationsToTest: (config.settings as any)?.maxCombinationsToTest || 100000,
            highPriority: highPriority
        };


        
        // Pass the enriched data when adding the job
        addOptimizationJob(jobData);
        
        res.status(202).json({ message: "Optimization job has been queued." });
    } catch (error) {
        console.error("Failed to queue job:", error);
        res.status(500).json({ message: "Failed to queue job." });
    }
});

export default router;