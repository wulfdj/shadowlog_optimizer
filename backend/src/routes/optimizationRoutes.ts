import { Router } from "express";
import { addOptimizationJob, lowPriorityQueue, stoppingJobsQueue, addStoppingJob } from "../jobs/optimizationQueue";
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
        console.log(`Found PID ${pid} for job ${jobId}.`);

         // We still set the stop flag as a reliable fallback mechanism.
        const stopFlagKey = `stop-job:${jobId}`;
        await redisClient.set(stopFlagKey, "1", "EX", 43200);

        const jobData = {
            jobId: jobId,
            pid: pid
        };

        addStoppingJob(jobData)
        
    } else {
        console.warn(`Could not find PID for job ${jobId}. The job may be starting up.`);
    }

    res.status(202).json({ message: `Stop signal sent to job ${jobId}.` });
});


/**
 * @route   POST /api/optimize/:configId
 * @desc    Starts a new optimization job for a given configuration
 */
router.post("/:configId", async (req, res) => {
    const configId = parseInt(req.params.configId, 10);
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
            instrument: config.instrument,
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

/**
 * @route   POST /api/optimize/remove/:jobId
 * @desc    Removes a job from the queue if it is in a 'waiting' or 'delayed' state.
 */
router.post("/remove/:jobId", async (req, res) => {
    const { jobId } = req.params;
    if (!jobId) {
        return res.status(400).json({ message: "Job ID is required." });
    }

    try {
        // We need to check both queues to find the job.
        const job = await lowPriorityQueue.getJob(jobId);

        if (!job) {
            return res.status(404).json({ message: "Job not found." });
        }

        // Check if the job is in a removable state (waiting, delayed)
        const isWaiting = await job.isWaiting();
        const isDelayed = await job.isDelayed();

        if (isWaiting || isDelayed) {
            // This is the dedicated BullMQ method to remove a job from a queue.
            await job.remove();
            console.log(`Job ${jobId} removed from the queue by user.`);
            return res.status(200).json({ message: `Job ${jobId} has been removed.` });
        } else {
            // If the job is active, completed, or failed, we can't "remove" it this way.
            return res.status(409).json({ message: "Job is not in a queued state and cannot be removed." });
        }
    } catch (error) {
        console.error(`Failed to remove job ${jobId}:`, error);
        res.status(500).json({ message: `Could not remove job ${jobId}.` });
    }
});


export default router;