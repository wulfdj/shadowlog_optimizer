import { Router } from "express";
import optimizationQueue, { addOptimizationJob } from "../jobs/optimizationQueue";
import { AppDataSource } from "../database/data-source"; // Import DataSource
import { Configuration } from "../entities/Configuration"; // Import Configuration entity

const router = Router();

/**
 * @route   GET /api/optimize/active
 * @desc    Get all jobs that are currently being processed, now with config names.
 */
router.get("/active", async (req, res) => {
    try {
        const activeJobs = await optimizationQueue.getActive();
        
        // The job data now contains the name and max combinations, so no extra DB call is needed here.
        const jobsToDisplay = activeJobs.map(job => ({
            id: job.id,
            progress: job.progress,
            startedAt: job.timestamp, // The timestamp when the job was added to the queue
            // Retrieve the enriched data we added when the job was created
            configId: job.data.configId,
            name: job.data.configurationName,
            totalCombinations: job.data.totalCombinations
        }));

        res.json(jobsToDisplay);
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

    try {
        const job = await optimizationQueue.getJob(jobId);
        if (!job) {
            return res.status(404).json({ message: "Job not found." });
        }

        // Check if the job is actually active before trying to stop it
        if (await job.isActive()) {
            // Moving to failed is the standard way to "stop" a job in BullMQ.
            // It triggers the 'failed' event on the worker.
            await job.moveToFailed({ message: "Job stopped by user." }, 'LIFO');
            console.log(`Job ${jobId} stopped by user.`);
            return res.status(200).json({ message: `Job ${jobId} has been stopped.` });
        } else {
            return res.status(409).json({ message: "Job is not currently active and cannot be stopped." });
        }
    } catch (error) {
        console.error(`Failed to stop job ${jobId}:`, error);
        res.status(500).json({ message: `Could not stop job ${jobId}.` });
    }
});


/**
 * @route   POST /api/optimize/:configId
 * @desc    Starts a new optimization job for a given configuration
 */
router.post("/:configId", async (req, res) => {
    const configId = parseInt(req.params.configId, 10);
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
            configurationName: config.name,
            maxCombinationsToTest: (config.settings as any)?.maxCombinationsToTest || 100000,
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