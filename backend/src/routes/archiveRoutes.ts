import { Router } from "express";
import { AppDataSource } from "../database/data-source";
import { ArchivedResult } from "../entities/ArchivedResult";
import { Configuration } from "../entities/Configuration";
import { Tag } from "../entities/Tag";
import { FindOneOptions } from "typeorm";

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

/**
 * @route   POST /api/archive/import
 * @desc    Import a strategy from a formatted string. This will find or create a
 *          matching configuration and then create a new archived result linked to it.
 */
router.post("/import", async (req, res) => {
    const { parsedData } = req.body;

    if (!parsedData || !parsedData.configurationName || !parsedData.settings || !parsedData.resultData) {
        return res.status(400).json({ message: "Invalid parsed data structure." });
    }

    const configRepo = AppDataSource.getRepository(Configuration);
    const archiveRepo = AppDataSource.getRepository(ArchivedResult);
    
    // We use a transaction to ensure both operations (find/create config AND create archive) succeed or fail together.
    await AppDataSource.transaction(async (transactionalEntityManager) => {
        let configuration: Configuration | null;

        // Step 1: Try to find an existing configuration with the exact same settings.
        // This is a complex query on a JSONB field.
        const searchOptions: FindOneOptions<Configuration> = {
            where: {
                name: parsedData.configurationName,
                // This checks if the 'settings' JSONB contains the provided settings object.
                // NOTE: This is a deep comparison and can be slow on very large tables.
                // An alternative would be to create a hash of the settings object and query that.
                settings: parsedData.settings
            }
        };
        configuration = await transactionalEntityManager.findOne(Configuration, searchOptions);

        // Step 2: If no matching configuration is found, create a new one.
        if (!configuration) {
            console.log(`No matching configuration found for "${parsedData.configurationName}". Creating a new one.`);
            const newConfig = transactionalEntityManager.create(Configuration, {
                name: parsedData.configurationName,
                settings: parsedData.settings,
            });
            configuration = await transactionalEntityManager.save(newConfig);
            console.log(`New configuration created with ID: ${configuration.id}`);
        } else {
            console.log(`Found existing matching configuration with ID: ${configuration.id}`);
        }

        // Step 3: Create the new ArchivedResult, linking it to the found or new configuration.
        const newArchivedResult = transactionalEntityManager.create(ArchivedResult, {
            configuration: configuration,
            strategyName: parsedData.resultData.strategyName,
            resultData: parsedData.resultData.metrics, // Store the relevant metrics part
        });

        await transactionalEntityManager.save(newArchivedResult);
        console.log(`New archived result created and linked to config ID: ${configuration.id}`);
        
        // Send the newly created archived result back to the client
        res.status(201).json(newArchivedResult);
    });
});


/**
 * @route   PUT /api/archive/:id/tags
 * @desc    Update the tags for a specific archived result.
 */
router.put("/:id/tags", async (req, res) => {
    const archiveId = parseInt(req.params.id, 10);
    const tagIds = req.body.tagIds as number[]; // Expect an array of Tag IDs

    if (isNaN(archiveId) || !Array.isArray(tagIds)) {
        return res.status(400).json({ message: "Invalid request body." });
    }

    const archiveRepo = AppDataSource.getRepository(ArchivedResult);
    const tagRepo = AppDataSource.getRepository(Tag);

    try {
        const archiveToUpdate = await archiveRepo.findOneBy({ id: archiveId });
        if (!archiveToUpdate) {
            return res.status(404).json({ message: "Archived result not found." });
        }
        
        // Find the full Tag entities for the given IDs
        const tags = await tagRepo.findByIds(tagIds);
        
        // Assign the new set of tags to the relationship
        archiveToUpdate.tags = tags;
        
        await archiveRepo.save(archiveToUpdate);
        res.json(archiveToUpdate);

    } catch (error) {
        console.error("Error updating tags for archive:", error);
        res.status(500).json({ message: "Failed to update tags." });
    }
});

export default router;