import { Router } from "express";
import { AppDataSource } from "../database/data-source";
import { Configuration } from "../entities/Configuration";

const router = Router();

/**
 * @route   POST /api/configurations
 * @desc    Save a new optimization configuration
 */
router.post("/", async (req, res) => {
    const { name, settings } = req.body;

    if (!name || !settings) {
        return res.status(400).json({ message: "Configuration name and settings are required." });
    }

    const configRepository = AppDataSource.getRepository(Configuration);
    const newConfig = configRepository.create({ name, settings });

    try {
        await configRepository.save(newConfig);
        res.status(201).json(newConfig);
    } catch (error) {
        console.error("Error saving configuration:", error);
        res.status(500).json({ message: "Failed to save configuration." });
    }
});

/**
 * @route   GET /api/configurations
 * @desc    Get all saved configurations
 */
router.get("/", async (req, res) => {
    const configRepository = AppDataSource.getRepository(Configuration);
    try {
        const configurations = await configRepository.find({
            order: { createdAt: "DESC" }
        });
        res.json(configurations);
    } catch (error) {
        console.error("Error fetching configurations:", error);
        res.status(500).json({ message: "Error fetching configurations." });
    }
});

/**
 * @route   PUT /api/configurations/:id
 * @desc    Update an existing optimization configuration.
 */
router.put("/:id", async (req, res) => {
    const configId = parseInt(req.params.id, 10);
    const { name, settings } = req.body;

    if (isNaN(configId)) {
        return res.status(400).json({ message: "Invalid Configuration ID." });
    }
    if (!name || !settings) {
        return res.status(400).json({ message: "Configuration name and settings are required." });
    }

    const configRepo = AppDataSource.getRepository(Configuration);
    try {
        const configToUpdate = await configRepo.findOneBy({ id: configId });
        if (!configToUpdate) {
            return res.status(404).json({ message: "Configuration not found." });
        }

        // Update the properties
        configToUpdate.name = name;
        configToUpdate.settings = settings;

        await configRepo.save(configToUpdate);
        res.json(configToUpdate);

    } catch (error) {
        console.error(`Error updating configuration ${configId}:`, error);
        res.status(500).json({ message: "Failed to update configuration." });
    }
});


/**
 * @route   DELETE /api/configurations/:id
 * @desc    Delete a configuration.
 */
router.delete("/:id", async (req, res) => {
    const configId = parseInt(req.params.id, 10);
    if (isNaN(configId)) {
        return res.status(400).json({ message: "Invalid Configuration ID." });
    }
    
    const configRepo = AppDataSource.getRepository(Configuration);
    try {
        const deleteResult = await configRepo.delete(configId);

        if (deleteResult.affected === 0) {
            return res.status(404).json({ message: "Configuration not found." });
        }

        res.status(204).send(); // 204 No Content is standard for a successful delete

    } catch (error) {
        // This could catch foreign key constraint errors if results depend on this config
        console.error(`Error deleting configuration ${configId}:`, error);
        res.status(500).json({ message: "Failed to delete configuration." });
    }
});


export default router;