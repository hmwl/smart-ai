const express = require('express');
const router =express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authenticateToken = require('../middleware/authenticateToken'); // Assuming you want to protect this route

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // userId and type will be sent as form fields or query params
    // For this example, let's assume they are in req.body if sent as form fields
    // Or req.query if sent as query parameters.
    // We'll use req.body for this example, assuming they are sent along with the file in FormData.
    
    const userId = req.user?.userId; // From authenticateToken middleware - fixed field name
    const type = req.body.type || 'general'; // 'upload', 'mask', 'canvas', or a default
    const subPath = req.params.subPath || 'misc'; // Get subPath from route parameter

    if (!userId) {
      return cb(new Error('User ID is missing. Cannot determine upload path.'));
    }

    const uploadPath = path.join(__dirname, '..', 'uploads', 'form_uploads', subPath, String(userId));
    
    // Create the directory if it doesn't exist
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const userId = req.user?.userId; // Fixed field name
    const type = req.body.type || 'general';
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    // Sanitize type and userId for filename
    const safeType = String(type).replace(/[^a-z0-9_\-]/gi, '_');
    const safeUserId = String(userId).replace(/[^a-z0-9_\-]/gi, '_');
    
    cb(null, `${safeUserId}-${safeType}-${timestamp}${extension}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Example: 10MB file size limit
  fileFilter: function (req, file, cb) {
    // Add any specific file type filtering here if needed
    // Example: Allow only images
    // if (!file.mimetype.startsWith('image/')) {
    //   return cb(new Error('Only image files are allowed!'), false);
    // }
    cb(null, true);
  }
});

// POST /api/files/form-upload/:subPath
// authenticateToken will add req.user if token is valid
router.post('/:subPath', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }
  if (!req.user || !req.user.userId) {
    // This case should ideally be prevented by authenticateToken,
    // but as a fallback for logic error in multer's destination/filename not getting userId
    return res.status(400).json({ message: 'User information missing after authentication.' });
  }

  // Construct the relative path to be returned to the client and stored in DB
  // Path relative to the 'uploads' static serving directory
  const subPathFromRoute = req.params.subPath || 'misc';
  const relativeFilePath = path.join('form_uploads', subPathFromRoute, String(req.user.userId), req.file.filename).replace(/\\/g, '/');

  res.status(200).json({
    message: 'File uploaded successfully.',
    filePath: relativeFilePath, // e.g., "form_uploads/user_avatars/USER_ID/USER_ID-upload-TIMESTAMP.jpg"
    fileName: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
}, (error, req, res, next) => {
  // Multer error handling
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: `Multer error: ${error.message}` });
  } else if (error) {
    // Other errors (e.g., from fs.mkdirSync or custom fileFilter)
    console.error("File upload error:", error);
    return res.status(500).json({ message: error.message || 'File upload failed.' });
  }
  next();
});

module.exports = router; 