const express = require('express');
const router = express.Router();
const Work = require('../models/Work');
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
    const { page = 1, limit = 10, type, tags, creator, status, search } = req.query;
    const query = {};

    if (type) query.type = type;
    if (status) query.status = status;
    if (creator) query.creator = creator;
    if (tags) query.tags = { $in: tags.split(',') }; // Example: tags=tag1,tag2
    if (search) {
        query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { prompt: { $regex: search, $options: 'i' } }
        ];
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
    const updateData = { title, type, prompt, status, thumbnailUrl };

    if (tags) {
        updateData.tags = Array.isArray(tags) ? tags : JSON.parse(tags);
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
    if (!updatedWork) return res.status(404).json({ message: 'Work not found' });
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

module.exports = router;