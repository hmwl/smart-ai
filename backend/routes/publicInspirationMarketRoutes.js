const express = require('express');
const router = express.Router();
const InspirationCategory = require('../models/InspirationCategory');
const Work = require('../models/Work'); // Needed to check work status

// Helper function to construct full URLs for images/assets
const getFullUrl = (req, relativePath) => {
  if (!relativePath) return null;
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath; // Already a full URL
  }
  // Ensure the relativePath starts with a slash if it's from /uploads
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${req.protocol}://${req.get('host')}${path}`;
};

// GET /api/public/inspiration-categories - Get public categories
// Returns categories that contain at least one work marked as 'public_market'
router.get('/inspiration-categories', async (req, res) => {
  try {
    const categories = await InspirationCategory.find().sort({ order: 1, name: 1 });

    if (categories.length === 0) {
      return res.json([]);
    }

    const publicCategories = [];

    for (const category of categories) {

      if (!category.works || category.works.length === 0) {
        continue; // Skip to next category if no works
      }

      const queryConditions = {
        _id: { $in: category.works },
        status: 'public_market'
      };
      
      const publicWorksCount = await Work.countDocuments(queryConditions);

      if (publicWorksCount > 0) {
        publicCategories.push({
          _id: category._id,
          name: category.name,
          description: category.description,
          order: category.order,
          publicWorkCount: publicWorksCount,
        });
      }
    }
    
    res.json(publicCategories);

  } catch (error) {
    console.error('Error fetching public inspiration categories:', error);
    res.status(500).json({ message: 'Error fetching public inspiration categories', error: error.message });
  }
});

// GET /api/public/market/works - Get public works with filtering and pagination
router.get('/works', async (req, res) => {
  try {
    const { category_id, page = 1, limit = 12, search } = req.query;
    const queryOptions = { status: 'public_market' };
    let categoryWorksIds = null;

    if (category_id && category_id !== 'all') {
      const category = await InspirationCategory.findById(category_id);
      if (category) {
        categoryWorksIds = category.works.map(id => id.toString());
        queryOptions._id = { $in: categoryWorksIds };
      } else {
        // Category not found, return empty results for this category_id
        return res.json({ works: [], total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 });
      }
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      queryOptions.$or = [
        { title: searchRegex },
        { prompt: searchRegex },
        { tags: searchRegex } // Assumes tags are stored as an array of strings
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const worksQuery = Work.find(queryOptions)
      .sort({ createdAt: -1 }) // Default sort, can be made configurable
      .skip(skip)
      .limit(parseInt(limit));
      // .populate('creator', 'username profilePicture'); // Example if creator population is needed

    const works = await worksQuery.exec();
    const total = await Work.countDocuments(queryOptions);

    const worksWithFullUrls = works.map(work => {
      const workObj = work.toObject();
      if (workObj.sourceUrl) {
        workObj.sourceUrl = getFullUrl(req, workObj.sourceUrl);
      }
      if (workObj.thumbnailUrl) { // Assuming thumbnailUrl might exist
        workObj.thumbnailUrl = getFullUrl(req, workObj.thumbnailUrl);
      }
      // Add any other URL transformations if needed
      return workObj;
    });

    res.json({
      works: worksWithFullUrls,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    });

  } catch (error) {
    console.error('Error fetching public works:', error);
    res.status(500).json({ message: 'Error fetching public works', error: error.message });
  }
});

// More public routes will be added here for works...

module.exports = router;
