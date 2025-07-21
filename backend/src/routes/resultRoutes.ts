import { Router } from "express";
import { AppDataSource } from "../database/data-source";
import { OptimizationResult } from "../entities/OptimizationResult";

const router = Router();

/**
 * @route   GET /api/results
 * @desc    Get a list of all completed optimization runs for the history page.
 */
router.get("/:instrument", async (req, res) => {
    const { instrument} = req.params;
    const resultRepo = AppDataSource.getRepository(OptimizationResult);
    try {
        const results = await resultRepo.find({
            order: { completedAt: "DESC" },
            // Using 'relations' is more explicit and reliable than relying on eager loading alone
            relations: {
                configuration: true,
            },
            // Now that relations are loaded, select can be used to trim the payload
            select: {
                id: true,
                startedAt: true,
                completedAt: true,
                configuration: {
                    id: true,
                    name: true,
                    settings: true,
                }
            },
            where: { instrument }
        });
        res.json(results);
    } catch (error) {
        console.error("Error fetching result list:", error);
        res.status(500).json({ message: "Error fetching result list" });
    }
});

/**
 * @route   GET /api/results/:id
 * @desc    Get the full details for a single optimization run, including the results blob.
 */
router.get("/:instrument/:id", async (req, res) => {
    const resultId = parseInt(req.params.id, 10);
    const {instrument} = req.params;
    if (isNaN(resultId)) {
        return res.status(400).json({ message: "Invalid Result ID." });
    }

    const resultRepo = AppDataSource.getRepository(OptimizationResult);
    try {
        // --- THE CORE FIX IS HERE ---
        // We replace `findOneBy` with `findOne` and explicitly load the relation.
        const result = await resultRepo.findOne({
            where: { id: resultId, instrument: instrument },
            relations: {
                configuration: true,
            },
        });

        if (!result) {
            return res.status(404).json({ message: "Result not found." });
        }
        res.json(result);
    } catch (error) {
        console.error(`Error fetching result ${resultId}:`, error);
        res.status(500).json({ message: "Error fetching result" });
    }
});

/**
 * @route   DELETE /api/results/:id
 * @desc    Delete a specific optimization result run from the history.
 */
router.delete("/:instrument/:id", async (req, res) => {
    const resultId = parseInt(req.params.id, 10);
    if (isNaN(resultId)) {
        return res.status(400).json({ message: "Invalid Result ID." });
    }

    const resultRepo = AppDataSource.getRepository(OptimizationResult);
    try {
        const deleteResult = await resultRepo.delete(resultId);

        if (deleteResult.affected === 0) {
            return res.status(404).json({ message: "Optimization result not found." });
        }
        
        // Success, no content to return.
        res.status(204).send();

    } catch (error) {
        // This could catch errors if other tables have strict foreign key constraints
        console.error(`Error deleting optimization result ${resultId}:`, error);
        res.status(500).json({ message: "Failed to delete optimization result." });
    }
});

export default router;