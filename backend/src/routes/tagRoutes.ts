import { Router } from "express";
import { AppDataSource } from "../database/data-source";
import { Tag } from "../entities/Tag";

const router = Router();

// GET all tags
router.get("/", async (req, res) => {
    const tagRepo = AppDataSource.getRepository(Tag);
    try {
        const tags = await tagRepo.find({ order: { name: "ASC" } });
        res.json(tags);
    } catch (error) { res.status(500).json({ message: "Error fetching tags" }); }
});

// POST a new tag
router.post("/", async (req, res) => {
    const { name, color } = req.body;
    if (!name || !color) {
        return res.status(400).json({ message: "Name and color are required." });
    }
    const tagRepo = AppDataSource.getRepository(Tag);
    const newTag = tagRepo.create({ name, color });
    try {
        await tagRepo.save(newTag);
        res.status(201).json(newTag);
    } catch (error) { res.status(500).json({ message: "Error creating tag. It may already exist." }); }
});

// DELETE a tag
router.delete("/:id", async (req, res) => {
    const tagId = parseInt(req.params.id, 10);
    const tagRepo = AppDataSource.getRepository(Tag);
    try {
        await tagRepo.delete(tagId);
        res.status(204).send();
    } catch (error) { res.status(500).json({ message: "Error deleting tag" }); }
});

/**
 * @route   PUT /api/tags/:id
 * @desc    Update an existing tag's name and/or color.
 */
router.put("/:id", async (req, res) => {
    const tagId = parseInt(req.params.id, 10);
    const { name, color } = req.body;

    if (isNaN(tagId) || (!name && !color)) {
        return res.status(400).json({ message: "Invalid request. A name or color is required." });
    }

    const tagRepo = AppDataSource.getRepository(Tag);
    try {
        const tagToUpdate = await tagRepo.findOneBy({ id: tagId });
        if (!tagToUpdate) {
            return res.status(404).json({ message: "Tag not found." });
        }

        // Update properties if they were provided
        if (name) tagToUpdate.name = name;
        if (color) tagToUpdate.color = color;

        await tagRepo.save(tagToUpdate);
        res.json(tagToUpdate);

    } catch (error) {
        // This will catch unique constraint violations if the new name already exists
        console.error(`Error updating tag ${tagId}:`, error);
        res.status(500).json({ message: "Failed to update tag. The name may already be in use." });
    }
});

export default router;