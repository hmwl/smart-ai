const express = require('express');
const router = express.Router();
const Tag = require('../models/Tag');
const authenticateToken = require('../middleware/authenticateToken'); // Corrected import
const isAdmin = require('../middleware/isAdmin'); // Corrected import

// GET /api/tags - Get all tags
router.get('/', async (req, res) => {
  try {
    const tags = await Tag.find({}).sort({ name: 1 }); // Sort by name
    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ message: 'Error fetching tags', error: error.message });
  }
});

// POST /api/tags - Create a new tag or return existing if found (upsert-like behavior for name)
// Typically, tag creation might be open or admin-protected based on your app's logic
router.post('/', authenticateToken, async (req, res) => { // Or use isAdmin if only admins can create tags
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ message: 'Tag name is required and must be a non-empty string.' });
  }

  const tagName = name.trim().toLowerCase(); // Normalize tag name

  try {
    let tag = await Tag.findOne({ name: tagName });
    if (tag) {
      // Tag already exists, return it
      return res.status(200).json({ message: 'Tag already exists.', tag });
    } else {
      // Tag does not exist, create it
      const newTag = new Tag({ name: tagName });
      await newTag.save();
      return res.status(201).json(newTag);
    }
  } catch (error) {
    console.error('Error creating tag:', error);
    if (error.code === 11000) { // Duplicate key error (should be caught by findOne, but as a safeguard)
        return res.status(409).json({ message: 'Tag name already exists.' });
    }
    res.status(500).json({ message: 'Error creating tag', error: error.message });
  }
});

// Optional: GET /api/tags/:id - Get a specific tag by ID
router.get('/:id', async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id);
    if (!tag) return res.status(404).json({ message: 'Tag not found' });
    res.json(tag);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tag', error: error.message });
  }
});

// Optional: PUT /api/tags/:id - Update a tag (e.g., rename - be careful with existing works)
// Renaming tags can be complex if you need to update all works that use the old name.
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ message: 'New tag name is required.' });
  }
  const newTagName = name.trim().toLowerCase();

  try {
    // Check if another tag with the new name already exists
    const existingTagWithNewName = await Tag.findOne({ name: newTagName, _id: { $ne: req.params.id } });
    if (existingTagWithNewName) {
        return res.status(409).json({ message: `Tag name '${newTagName}' already exists.` });
    }

    const updatedTag = await Tag.findByIdAndUpdate(req.params.id, { name: newTagName }, { new: true });
    if (!updatedTag) return res.status(404).json({ message: 'Tag not found to update' });
    
    // TODO: Consider if you need to update this tag name in all Work documents that use it.
    // This can be a heavy operation. Example: await Work.updateMany({ tags: oldTagName }, { $set: { "tags.$": newTagName } }); (This syntax is tricky with arrays)
    // A safer approach might be to iterate or use a more specific update logic if tags are referenced by name.

    res.json(updatedTag);
  } catch (error) {
    res.status(500).json({ message: 'Error updating tag', error: error.message });
  }
});

// Optional: DELETE /api/tags/:id - Delete a tag
// Consider what happens to works using this tag. Do they lose the tag? Is deletion restricted if in use?
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const tagToDelete = await Tag.findById(req.params.id);
    if (!tagToDelete) return res.status(404).json({ message: 'Tag not found' });

    // Optional: Check if the tag is in use and prevent deletion or remove from works.
    // const worksUsingTag = await Work.countDocuments({ tags: tagToDelete.name });
    // if (worksUsingTag > 0) {
    //   return res.status(400).json({ message: `Tag "${tagToDelete.name}" is currently in use by ${worksUsingTag} works and cannot be deleted.` });
    // }
    // Or, remove the tag from all works that use it:
    // await Work.updateMany({ tags: tagToDelete.name }, { $pull: { tags: tagToDelete.name } });

    await Tag.findByIdAndDelete(req.params.id);
    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting tag', error: error.message });
  }
});


module.exports = router; 