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

export default router;