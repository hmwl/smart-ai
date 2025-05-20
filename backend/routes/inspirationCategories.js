const express = require('express');
const router = express.Router();
const InspirationCategory = require('../models/InspirationCategory');
const Work = require('../models/Work'); // Needed for validating work IDs and counts

// PUT /api/inspiration-categories/reorder-categories - Reorder categories themselves
router.put('/reorder-categories', async (req, res) => {
    try {
        const { orderedCategoryIds } = req.body; // Array of category IDs in the new order
        if (!Array.isArray(orderedCategoryIds)) {
            return res.status(400).json({ message: 'orderedCategoryIds must be an array.' });
        }

        const bulkOps = orderedCategoryIds.map((id, index) => ({
            updateOne: {
                filter: { _id: id },
                update: { $set: { order: index } }
            }
        }));

        if (bulkOps.length > 0) {
            await InspirationCategory.bulkWrite(bulkOps);
        }
        res.json({ message: 'Categories reordered successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error reordering categories', error: error.message });
    }
});

// POST /api/inspiration-categories - Create a new category
router.post('/', async (req, res) => {
  try {
    const { name, description, order } = req.body;
    const newCategory = new InspirationCategory({ name, description, order: order || 0 });
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    if (error.code === 11000) { // MongoError: Duplicate key
        return res.status(400).json({ message: 'Category name already exists.' });
    }
    res.status(500).json({ message: 'Error creating category', error: error.message });
  }
});

// GET /api/inspiration-categories - Get all categories (optionally populated with work details)
router.get('/', async (req, res) => {
  try {
    const { populateWorks } = req.query; // e.g., 'true' or 'count' or 'false' (default)
    let categories;
    if (populateWorks === 'true') {
      categories = await InspirationCategory.find().populate('works').sort('order');
    } else {
      categories = await InspirationCategory.find().sort('order');
    }
    
    // If only workCount is needed and not full population
    const categoriesWithCounts = await Promise.all(categories.map(async (category) => {
      const workCount = await Work.countDocuments({ _id: { $in: category.works } });
      return { ...category.toObject(), workCount };
    }));
    
    res.json(categoriesWithCounts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inspiration categories', error: error.message });
  }
});

// GET /api/inspiration-categories/:id - Get a specific category (populated with work details)
router.get('/:id', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const skip = (page - 1) * limit;
        const searchTerm = req.query.search ? req.query.search.trim() : '';
        const workTypeFilter = req.query.workType ? req.query.workType.trim() : '';
        const creatorIdFilter = req.query.creatorId ? req.query.creatorId.trim() : '';
        const tagsFilter = req.query.tags ? req.query.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

        const categoryData = await InspirationCategory.findById(req.params.id);
        if (!categoryData) return res.status(404).json({ message: 'Category not found' });

        let baseWorkQuery = {
            _id: { $in: categoryData.works }, // Works belonging to this category
            status: 'public_market' 
        };

        const filterOrConditions = [];

        if (searchTerm) {
            const searchRegex = new RegExp(searchTerm, 'i');
            filterOrConditions.push({ title: searchRegex });
            filterOrConditions.push({ prompt: searchRegex });
            filterOrConditions.push({ tags: searchRegex });
        }

        if (workTypeFilter) {
            filterOrConditions.push({ type: workTypeFilter });
        }

        if (creatorIdFilter) {
            filterOrConditions.push({ creator: creatorIdFilter });
        }

        if (tagsFilter.length > 0) {
            // For OR logic, if any of the tags match
            filterOrConditions.push({ tags: { $in: tagsFilter } });
        }

        let finalWorkQuery;
        if (filterOrConditions.length > 0) {
            finalWorkQuery = {
                ...baseWorkQuery, // Contains _id: { $in: categoryData.works } and status: 'public_market'
                $or: filterOrConditions
            };
        } else {
            finalWorkQuery = { ...baseWorkQuery }; // No filters, just base conditions
        }       

        const totalWorks = await Work.countDocuments(finalWorkQuery);
        
        // Fetch the ordered work IDs from the category first
        let orderedWorkIdsInCategory = categoryData.works.map(w => w.toString());

        // If there are filters, we need to find which of these orderedWorkIds still match
        if (filterOrConditions.length > 0 || searchTerm) { // searchTerm implies filterOrConditions will be populated
            const matchingFilteredWorks = await Work.find(finalWorkQuery).select('_id').lean();
            const matchingFilteredWorkIds = matchingFilteredWorks.map(w => w._id.toString());
            // Intersect orderedWorkIdsInCategory with matchingFilteredWorkIds, preserving order of orderedWorkIdsInCategory
            orderedWorkIdsInCategory = orderedWorkIdsInCategory.filter(id => matchingFilteredWorkIds.includes(id));
        }
        
        // Now apply pagination to the (potentially filtered) ordered list of IDs
        const paginatedWorkIds = orderedWorkIdsInCategory.slice(skip, skip + limit);

        // Fetch the actual work details for the paginated IDs, maintaining their order
        const worksMap = new Map();
        const workDetails = await Work.find({ _id: { $in: paginatedWorkIds } })
            .populate('creator', 'username avatar')
            .lean();
        workDetails.forEach(work => worksMap.set(work._id.toString(), work));
        
        const works = paginatedWorkIds.map(id => worksMap.get(id)).filter(Boolean); // filter(Boolean) removes undefined if any ID wasn't found
        
        const categoryJson = categoryData.toJSON();
        categoryJson.works = works; 
        categoryJson.totalWorks = totalWorks; // This total is based on filters, not just total in category
        
        res.json(categoryJson);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching category', error: error.message });
    }
});

// PUT /api/inspiration-categories/:id - Update a category (rename, reorder works, add/remove works, update description)
router.put('/:id', async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { name, description, works: newWorkIdsRaw, order } = req.body;

    const category = await InspirationCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const oldWorkIds = category.works.map(id => id.toString());
    // Ensure newWorkIdsRaw is an array of strings, even if it's empty or not provided
    const newWorkIds = Array.isArray(newWorkIdsRaw) ? newWorkIdsRaw.map(id => id.toString()) : oldWorkIds;

    // Update category fields
    if (name !== undefined) category.name = name;
    if (description !== undefined) category.description = description;
    if (order !== undefined) category.order = order;
    
    // Check if the order or content of works has changed
    const oldWorkIdsStringified = JSON.stringify(oldWorkIds);
    const newWorkIdsStringified = JSON.stringify(newWorkIds);

    if (oldWorkIdsStringified !== newWorkIdsStringified) {
        category.works = newWorkIds; // Save the new order
    }
    
    await category.save();

    // Check if the set of works has changed (for status updates)
    // We create sorted copies for this comparison.
    const oldWorkIdsSorted = [...oldWorkIds].sort();
    const newWorkIdsSorted = [...newWorkIds].sort();

    if (JSON.stringify(oldWorkIdsSorted) !== JSON.stringify(newWorkIdsSorted)) {
      // Works added to this category
      const addedToThisCategory = newWorkIds.filter(id => !oldWorkIds.includes(id));
      if (addedToThisCategory.length > 0) {
        await Work.updateMany({ _id: { $in: addedToThisCategory } }, { status: 'public_market' });
      }

      // Works removed from this category
      const removedFromThisCategory = oldWorkIds.filter(id => !newWorkIds.includes(id));
      for (const workId of removedFromThisCategory) {
        const otherCategoriesCount = await InspirationCategory.countDocuments({ works: workId });
        // If count is 0, it means it's not in any category after being removed from this one (already saved)
        if (otherCategoriesCount === 0) {
          await Work.findByIdAndUpdate(workId, { status: 'private' });
        }
      }
    }
    
    const updatedCategory = await InspirationCategory.findById(categoryId).populate('works');
    res.json(updatedCategory);
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(400).json({ message: 'Error updating inspiration category', error: error.message });
  }
});

// DELETE /api/inspiration-categories/:id - Delete a category
router.delete('/:id', async (req, res) => {
  try {
    const categoryId = req.params.id;
    const category = await InspirationCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const worksInThisCategory = category.works.map(id => id.toString());

    await InspirationCategory.findByIdAndDelete(categoryId);

    // After deleting the category, check each work that was in it
    for (const workId of worksInThisCategory) {
      const otherCategoriesCount = await InspirationCategory.countDocuments({ works: workId });
      if (otherCategoriesCount === 0) {
        await Work.findByIdAndUpdate(workId, { status: 'private' });
      }
    }

    res.json({ message: 'Inspiration category deleted successfully, work statuses updated.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting inspiration category', error: error.message });
  }
});

// POST /api/inspiration-categories/:id/add-work - Add a work to a category
router.post('/:id/add-work', async (req, res) => {
    try {
        const { workId } = req.body;
        if (!workId) return res.status(400).json({ message: 'Work ID is required.' });

        const category = await InspirationCategory.findById(req.params.id);
        if (!category) return res.status(404).json({ message: 'Category not found.' });

        const work = await Work.findById(workId);
        if (!work) return res.status(404).json({ message: 'Work not found.' });

        if (category.works.includes(workId)) { 
            return res.status(400).json({ message: 'Work already in this category.' });
        }

        category.works.push(workId);
        await category.save();
        res.json(category);
    } catch (error) {
        res.status(500).json({ message: 'Error adding work to category', error: error.message });
    }
});

// POST /api/inspiration-categories/:id/remove-work - Remove a work from a category
router.delete('/:id/works/:workId', async (req, res) => {
    try {
        const categoryId = req.params.id;
        const workIdToRemove = req.params.workId;

        const category = await InspirationCategory.findById(categoryId);
        if (!category) return res.status(404).json({ message: 'Category not found.' });

        const initialLength = category.works.length;
        category.works = category.works.filter(id => id.toString() !== workIdToRemove);

        if (category.works.length === initialLength) {
            return res.status(404).json({ message: 'Work not found in this category.' });
        }
        
        await category.save();
        const updatedCategoryWithWorkCount = await InspirationCategory.findById(categoryId);
        const responseJson = updatedCategoryWithWorkCount.toJSON();
        responseJson.workCount = updatedCategoryWithWorkCount.works.length;
        res.json(responseJson);

    } catch (error) {
        res.status(500).json({ message: 'Error removing work from category', error: error.message });
    }
});

module.exports = router; 