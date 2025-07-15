import { Router } from "express";
import { AppDataSource } from "../database/data-source";
import { ArchivedResult } from "../entities/ArchivedResult";
import { Configuration } from "../entities/Configuration";

const router = Router();

/**
 * @route   POST /api/archive
 * @desc    Archive a specific result combination, linking it to its parent configuration.
 */
router.post("/", async (req, res) => {
    // We now expect the IDs and the specific result data
    const { configurationId, resultData, strategyName } = req.body;

    if (!configurationId || !resultData || !strategyName) {
        return res.status(400).json({ message: "Configuration ID, result data, and strategy name are required." });
    }

    const archiveRepo = AppDataSource.getRepository(ArchivedResult);
    const configRepo = AppDataSource.getRepository(Configuration);

    try {
        // Find the parent configuration to link to
        const parentConfig = await configRepo.findOneBy({ id: configurationId });
        if (!parentConfig) {
            return res.status(404).json({ message: "Parent configuration not found." });
        }

        // Create the new entity, providing the full Configuration object for the relation
        const newArchivedResult = archiveRepo.create({
            configuration: parentConfig,
            resultData: resultData,
            strategyName: strategyName,
        });

        await archiveRepo.save(newArchivedResult);
        res.status(201).json(newArchivedResult);

    } catch (error) {
        console.error("Error saving to archive:", error);
        res.status(500).json({ message: "Failed to save to archive." });
    }
});

/**
 * @route   GET /api/archive
 * @desc    Get all archived (hand-picked) strategies.
 */
router.get("/", async (req, res) => {
    const archiveRepo = AppDataSource.getRepository(ArchivedResult);
    try {
        const archivedResults = await archiveRepo.find({
            order: { archivedAt: "DESC" }
        });
        res.json(archivedResults);
    } catch (error) {
        console.error("Error fetching archive:", error);
        res.status(500).json({ message: "Error fetching archive." });
    }
});

/**
 * @route   DELETE /api/archive/:id
 * @desc    Delete a specific archived result.
 */
router.delete("/:id", async (req, res) => {
    const archiveId = parseInt(req.params.id, 10);
    if (isNaN(archiveId)) {
        return res.status(400).json({ message: "Invalid Archive ID." });
    }

    const archiveRepo = AppDataSource.getRepository(ArchivedResult);
    try {
        const deleteResult = await archiveRepo.delete(archiveId);

        if (deleteResult.affected === 0) {
            return res.status(404).json({ message: "Archived result not found." });
        }
        
        // Success, no content to return.
        res.status(204).send();

    } catch (error) {
        console.error(`Error deleting archived result ${archiveId}:`, error);
        res.status(500).json({ message: "Failed to delete archived result." });
    }
});

export default router;