const express = require('express');
const router = express.Router();
const Work = require('../models/Work');
const Tag = require('../models/Tag');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Multer Configuration for File Uploads ---
const UPLOADS_DIR = path.join(__dirname, '../uploads/works'); // Store works in a subfolder

// Ensure the uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow images, videos, audio, and .glb for models
  if (file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/') ||
      file.mimetype.startsWith('audio/') ||
      path.extname(file.originalname).toLowerCase() === '.glb') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, videos, audio, and GLB files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit, adjust as needed
});

// --- CRUD Endpoints for Works ---

// POST /api/works - Create a new work (including file upload)
// For simplicity, handling single file upload. For multiple files per "work" (e.g. image gallery), this would need adjustment.
router.post('/', upload.single('workFile'), async (req, res) => {
  try {
    const { title, type, prompt, tags, creator, originalApplication, status } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'Work file is required.' });
    }

    // Determine file type from MIME or extension if not explicitly provided
    let determinedType = type;
    if (!determinedType) {
        if (req.file.mimetype.startsWith('image')) determinedType = 'image';
        else if (req.file.mimetype.startsWith('video')) determinedType = 'video';
        else if (req.file.mimetype.startsWith('audio')) determinedType = 'audio';
        else if (path.extname(req.file.originalname).toLowerCase() === '.glb') determinedType = 'model';
        else return res.status(400).json({ message: 'Could not determine file type. Please specify.'});
    }

    const newWork = new Work({
      title,
      type: determinedType,
      sourceUrl: `/uploads/works/${req.file.filename}`, // Path to access the file via HTTP
      // thumbnailUrl: Can be set explicitly or derived later (e.g. first frame of video, or same as source for image)
      prompt,
      tags: tags ? JSON.parse(tags) : [], // Assuming tags are sent as a JSON string array
      creator, // Assuming creator ID is sent
      originalApplication,
      status
    });

    const savedWork = await newWork.save();
    res.status(201).json(savedWork);
  } catch (error) {
    console.error("Error creating work:", error);
    if (error.message.includes('Invalid file type')) {
        return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error creating work', error: error.message });
  }
});

// GET /api/works - Get all works (with pagination and filtering)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, type, tags, creator, status, search, startDate, endDate } = req.query;
    const query = {};

    if (type) query.type = type;
    if (status) query.status = status;
    if (creator) query.creator = creator;
    if (tags) {
      const tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      if (tagsArray.length > 0) {
        query.tags = { $in: tagsArray };
      }
    }
    if (search) {
        query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { prompt: { $regex: search, $options: 'i' } }
        ];
    }

    // Add date range filtering for createdAt field
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        // Frontend sends ISO string, which is good. new Date() will parse it correctly.
        // Assumes startDate from picker is the beginning of the day.
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        // Set to the end of the selected day to include all items from that day
        endOfDay.setUTCHours(23, 59, 59, 999);
        query.createdAt.$lte = endOfDay;
      }
    }

    const works = await Work.find(query)
      .populate('creator', 'username profilePicture') // Populate creator details
      .populate('originalApplication', 'name') // Populate application name
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
      
    const count = await Work.countDocuments(query);

    res.json({
      works,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalWorks: count
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching works', error: error.message });
  }
});

// GET /api/works/:id - Get a specific work
router.get('/:id', async (req, res) => {
  try {
    const work = await Work.findById(req.params.id)
                            .populate('creator', 'username profilePicture')
                            .populate('originalApplication', 'name');
    if (!work) return res.status(404).json({ message: 'Work not found' });
    res.json(work);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching work', error: error.message });
  }
});

// PUT /api/works/:id - Update work details
router.put('/:id', upload.single('workFile'), async (req, res) => {
  try {
    const { title, type, prompt, tags, status, thumbnailUrl, sourceUrl: bodySourceUrl } = req.body;
    
    // Fetch original work to compare tags later
    const originalWork = await Work.findById(req.params.id);
    if (!originalWork) {
      return res.status(404).json({ message: 'Work not found for fetching original tags.' });
    }
    const originalTags = originalWork.tags ? [...originalWork.tags] : [];

    const updateData = { title, type, prompt, status, thumbnailUrl };

    let newTags = [];
    if (tags) {
        newTags = Array.isArray(tags) ? tags : JSON.parse(tags); // Assuming tags from frontend are already string array
        updateData.tags = newTags;
    }

    let determinedType = type;
    if (req.file) {
      updateData.sourceUrl = `/uploads/works/${req.file.filename}`;
      // If file is updated, type might also need to be updated
      if (!type) { // if type is not explicitly provided with the update, try to determine it
        if (req.file.mimetype.startsWith('image')) determinedType = 'image';
        else if (req.file.mimetype.startsWith('video')) determinedType = 'video';
        else if (req.file.mimetype.startsWith('audio')) determinedType = 'audio';
        else if (path.extname(req.file.originalname).toLowerCase() === '.glb') determinedType = 'model';
      }
      if(determinedType) updateData.type = determinedType; 
    } else if (bodySourceUrl) {
        // Allow updating sourceUrl if it's an external link and no new file is uploaded
        updateData.sourceUrl = bodySourceUrl;
    }
    
    // Remove undefined fields so they don't overwrite existing data with null
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const updatedWork = await Work.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updatedWork) return res.status(404).json({ message: 'Work not found during update' });

    // Opportunistic Tag Cleanup
    if (originalTags.length > 0) {
        const currentNewTags = updatedWork.tags ? updatedWork.tags.map(t => t.toLowerCase().trim()) : [];
        const tagsThatWereRemoved = originalTags.filter(ot => 
            !currentNewTags.includes(ot.toLowerCase().trim())
        );

        if (tagsThatWereRemoved.length > 0) {
            for (const tagName of tagsThatWereRemoved) {
                try {
                    const worksUsingTag = await Work.countDocuments({ tags: tagName });
                    if (worksUsingTag === 0) {
                        await Tag.deleteOne({ name: tagName.toLowerCase() }); // Ensure case-insensitivity for safety
                    }
                } catch (tagCleanupError) {
                    console.error(`Error during cleanup of tag "${tagName}":`, tagCleanupError);
                    // Do not let tag cleanup error fail the main work update response
                }
            }
        }
    }

    res.json(updatedWork);
  } catch (error) {
    console.error("Error updating work:", error);
    res.status(500).json({ message: 'Error updating work', error: error.message });
  }
});

// DELETE /api/works/:id - Delete a work
router.delete('/:id', async (req, res) => {
  try {
    const work = await Work.findById(req.params.id);
    if (!work) return res.status(404).json({ message: 'Work not found' });

    const tagsOfDeletedWork = work.tags ? [...work.tags] : [];

    // Optional: Delete the actual file from /uploads
    if (work.sourceUrl && work.sourceUrl.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../', work.sourceUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    // Also delete thumbnail if it's a separate file managed by the system
    // if (work.thumbnailUrl && work.thumbnailUrl.startsWith('/uploads/') && work.thumbnailUrl !== work.sourceUrl) { ... }

    await Work.findByIdAndDelete(req.params.id);

    // Opportunistic Tag Cleanup after deleting a work
    if (tagsOfDeletedWork.length > 0) {
        for (const tagName of tagsOfDeletedWork) {
            try {
                const worksUsingTag = await Work.countDocuments({ tags: tagName });
                if (worksUsingTag === 0) {
                    await Tag.deleteOne({ name: tagName.toLowerCase() }); // Ensure case-insensitivity
                }
            } catch (tagCleanupError) {
                console.error(`Error during cleanup of tag "${tagName}" after work deletion:`, tagCleanupError);
                // Do not let tag cleanup error fail the main work deletion response
            }
        }
    }

    res.json({ message: 'Work deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting work', error: error.message });
  }
});

// POST /api/works/batch-update-status - Update status for multiple works
router.post('/batch-update-status', async (req, res) => {
  try {
    const { workIds, status } = req.body; // workIds is an array of IDs
    if (!workIds || !Array.isArray(workIds) || !status) {
      return res.status(400).json({ message: 'Invalid request. Provide workIds array and status.' });
    }
    
    const result = await Work.updateMany(
      { _id: { $in: workIds } },
      { $set: { status: status } }
    );

    res.json({ message: `Successfully updated status for ${result.nModified} works.`, result });
  } catch (error) {
    res.status(500).json({ message: 'Error batch updating work statuses', error: error.message });
  }
});

// GET /api/works/inspiration-market - Get all works for the inspiration market (paginated, searchable)
// router.get('/inspiration-market', async (req, res) => { ... }); // Entire route commented out or deleted

module.exports = router;