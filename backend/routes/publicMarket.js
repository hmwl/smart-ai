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
    const { category_id, page = 1, limit = 12, search, tags: tagsQuery, workType, creatorId } = req.query;
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const skip = (pageInt - 1) * limitInt;

    const baseQueryConditions = { status: 'public_market' };
    const filterOrConditions = [];
    let categoryWorkOrder = null; // To store the order of work IDs from the category

    if (category_id && category_id !== 'all') {
      const category = await InspirationCategory.findById(category_id);
      if (category && category.works) {
        categoryWorkOrder = category.works.map(id => id.toString());
        baseQueryConditions._id = { $in: categoryWorkOrder }; // Filter by works in this category
      } else {
        return res.json({ works: [], total: 0, page: pageInt, limit: limitInt, totalPages: 0 });
      }
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      filterOrConditions.push({ title: searchRegex });
      filterOrConditions.push({ prompt: searchRegex });
      filterOrConditions.push({ tags: searchRegex });
    }

    if (tagsQuery) {
      const parsedTagsArray = tagsQuery.split(',').map(tag => tag.trim()).filter(tag => tag);
      if (parsedTagsArray.length > 0) {
        filterOrConditions.push({ tags: { $in: parsedTagsArray } });
      }
    }

    if (workType) {
      filterOrConditions.push({ type: workType });
    }

    if (creatorId) {
      filterOrConditions.push({ creator: creatorId });
    }

    let finalQuery;
    if (filterOrConditions.length > 0) {
      finalQuery = { $and: [baseQueryConditions, { $or: filterOrConditions }] };
    } else {
      finalQuery = { ...baseQueryConditions };
    }

    let works = [];
    let total = 0;

    // Fetch all works matching the filters (without DB-level pagination if category order is needed)
    const allFilteredWorks = await Work.find(finalQuery)
                                       .populate('creator', 'username profilePicture')
                                       .lean(); // Use lean for potentially large results before sorting

    if (categoryWorkOrder) {
      // If category order is specified, sort the filtered works according to that order
      const workMap = new Map(allFilteredWorks.map(w => [w._id.toString(), w]));
      const orderedFilteredWorks = categoryWorkOrder
        .map(id => workMap.get(id)) // Map to actual work objects
        .filter(Boolean);           // Remove any undefined (if a work in category.works was filtered out)
      
      total = orderedFilteredWorks.length;
      works = orderedFilteredWorks.slice(skip, skip + limitInt);
    } else {
      // If no specific category order (e.g., "all" works or category has no works array),
      // apply default sorting (e.g., by creation date) and pagination at DB level.
      total = await Work.countDocuments(finalQuery); // Get total count first
      works = await Work.find(finalQuery)
                        .sort({ createdAt: -1 }) // Default sort for non-category specific views
                        .skip(skip)
                        .limit(limitInt)
                        .populate('creator', 'username profilePicture')
                        .lean();
    }

    const worksWithFullUrls = works.map(work => {
      // const workObj = work.toObject(); // Not needed if .lean() is used
      const workObj = work; 
      if (workObj.sourceUrl) {
        workObj.sourceUrl = getFullUrl(req, workObj.sourceUrl);
      }
      if (workObj.thumbnailUrl) {
        workObj.thumbnailUrl = getFullUrl(req, workObj.thumbnailUrl);
      }
      if (workObj.creator && workObj.creator.profilePicture) {
        workObj.creator.profilePicture = getFullUrl(req, workObj.creator.profilePicture);
      }
      return workObj;
    });

    res.json({
      works: worksWithFullUrls,
      total,
      page: pageInt,
      limit: limitInt,
      totalPages: Math.ceil(total / limitInt),
    });

  } catch (error) {
    console.error('Error fetching public works:', error);
    res.status(500).json({ message: 'Error fetching public works', error: error.message });
  }
});

// GET /api/public/market/tags - Get tags with counts for public works based on filters
router.get('/tags', async (req, res) => {
  try {
    const { category_id, search, active_tags } = req.query;
    const matchConditions = { status: 'public_market' };

    // 1. Handle category_id filter
    if (category_id && category_id !== 'all') {
      const category = await InspirationCategory.findById(category_id);
      if (category && category.works && category.works.length > 0) {
        matchConditions._id = { $in: category.works.map(id => id) }; // Assuming category.works are ObjectIds
      } else {
        // Category not found or has no works, so no tags will match this category filter
        return res.json([]);
      }
    }

    // 2. Handle search filter
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      if (!matchConditions.$or) matchConditions.$or = [];
      matchConditions.$or.push(
        { title: searchRegex },
        { prompt: searchRegex },
        { tags: searchRegex } // Search within tags as well
      );
    }

    // 3. Handle active_tags filter (tags already selected by the user for filtering works)
    if (active_tags) {
      const activeTagsArray = active_tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      if (activeTagsArray.length > 0) {
        // This ensures that the works we are analyzing for tag counts *already* match these active_tags
        // For OR logic with other filters, this needs careful consideration.
        // The current logic for /tags endpoint is for tag cloud generation, which might need to reflect
        // the main list's filtering logic (AND or OR) if desired for consistency.
        // For now, assuming /tags should count tags from works matching *all* active_tags.
        if (!matchConditions.tags) matchConditions.tags = {};
        matchConditions.tags.$all = activeTagsArray; 
      }
    }

    const aggregationPipeline = [
      { $match: matchConditions },
      { $unwind: "$tags" },
      { 
        $group: {
          _id: { $toLower: "$tags" }, // Group by lowercase tag name for case-insensitivity
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          count: "$count"
        }
      },
      { $sort: { count: -1, name: 1 } }
    ];

    const tagsWithCounts = await Work.aggregate(aggregationPipeline);
    res.json(tagsWithCounts);

  } catch (error) {
    console.error('Error fetching public market tags with counts:', error);
    res.status(500).json({ message: 'Error fetching tags with counts', error: error.message });
  }
});

// More public routes will be added here for works...

module.exports = router; 