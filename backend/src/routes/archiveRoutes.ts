import { Router } from "express";
import { AppDataSource } from "../database/data-source";
import { ArchivedResult } from "../entities/ArchivedResult";

const router = Router();

/**
 * @route   POST /api/archive
 * @desc    Save a single, hand-picked result to the overall history.
 */
router.post("/", async (req, res) => {
    const { name, notes, resultData, configurationData } = req.body;

    if (!name || !resultData || !configurationData) {
        return res.status(400).json({ message: "Name, result data, and configuration data are required." });
    }

    const archiveRepo = AppDataSource.getRepository(ArchivedResult);
    // --- NEW: Pass configurationData when creating the entity ---
    const newArchivedResult = archiveRepo.create({ name, notes, resultData, configurationData });

    try {
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