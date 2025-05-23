const express = require('express');
const router = express.Router();
const ApiEntry = require('../models/ApiEntry');
// const { PLATFORM_TYPES } = require('../models/ApiEntry'); // Removed, platform types are now dynamic
const AiApplication = require('../models/AiApplication');
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');
const Platform = require('../models/Platform'); // Added for validation if needed, though model hook handles it

// Middleware for all routes in this file - REMOVED global router.use()
// router.use(authenticateToken, isAdmin); 

// Middleware to get ApiEntry by ID
async function getApiEntry(req, res, next) {
    let apiEntry;
    try {
        // Populate the platform field to get platform details if needed
        apiEntry = await ApiEntry.findById(req.params.id).populate('platform', 'name status'); 
        if (apiEntry == null) {
            return res.status(404).json({ message: '找不到指定的 API 条目' });
        }
        
        // Don't convert to plain object here - keep it as Mongoose document
        // Calculate usage count for this API entry
        const usageCount = await AiApplication.countDocuments({ 
            apis: apiEntry._id,
            status: 'active'
        });
        
        // Add usageCount as a virtual property
        apiEntry.usageCount = usageCount;
        
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.apiEntry = apiEntry;
    next();
}

// GET all ApiEntries
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        // Populate platform details when fetching all entries
        const apiEntries = await ApiEntry.find().populate('platform', 'name status').sort({ createdAt: -1 }); 
        
        // Calculate usage count for each API entry
        const apiEntriesWithUsage = await Promise.all(
            apiEntries.map(async (entry) => {
                const usageCount = await AiApplication.countDocuments({ 
                    apis: entry._id,
                    status: 'active' // Only count active applications
                });
                return {
                    ...entry.toObject(),
                    usageCount
                };
            })
        );
        
        res.json(apiEntriesWithUsage);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /platform-types route, as this is now in platforms.js routes
/*
router.get('/platform-types', authenticateToken, isAdmin, (req, res) => {
  try {
    // This is now handled by /api/platforms/types
    res.status(404).json({ message: 'This endpoint is deprecated. Use /api/platforms/types' });
  } catch (error) {
    console.error("Error fetching platform types:", error);
    res.status(500).json({ message: '获取平台类型失败', error: error.message });
  }
});
*/

// POST create a new ApiEntry
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    const { platformName, platformType, description, apiUrl, config, status, platform } = req.body;

    if (!platformName || !platformType) {
        return res.status(400).json({ message: '平台实例名称和平台类型不能为空' });
    }

    try {
        // Find the platform by name or ID
        let platformDoc;
        if (platform) {
            // If platform ID is provided, use it
            platformDoc = await Platform.findById(platform);
        } else if (platformType) {
            // If only platformType (name) is provided, find by name
            platformDoc = await Platform.findOne({ name: platformType, status: 'active' });
        }
        
        if (!platformDoc) {
            return res.status(400).json({ message: `无效或未激活的平台类型: ${platformType}` });
        }

        // Create the ApiEntry with explicit platform ID
        const apiEntry = new ApiEntry({
            platformName,
            platformType: platformDoc.name, // Use the platform name
            description,
            apiUrl,
            config,
            status,
            platform: platformDoc._id // Explicitly set the platform ID
        });

        const newApiEntry = await apiEntry.save();
        // Populate platform details in the response
        const populatedEntry = await ApiEntry.findById(newApiEntry._id).populate('platform', 'name status');
        
        // Calculate usage count for the new entry (should be 0)
        const usageCount = await AiApplication.countDocuments({ 
            apis: populatedEntry._id,
            status: 'active'
        });
        
        const entryWithUsage = {
            ...populatedEntry.toObject(),
            usageCount
        };
        
        res.status(201).json(entryWithUsage);
    } catch (err) {
        // Handle specific validation error for platformType if needed, though model hook might cover it
        if (err.message && err.message.includes('无效或未激活的平台类型')) {
            return res.status(400).json({ message: err.message });
        }
        if (err.code === 11000 && err.keyPattern && err.keyPattern.apiUrl) {
             return res.status(400).json({ message: `API 地址 '${apiUrl}' 已存在.` });
        }
        res.status(400).json({ message: err.message });
    }
});

// PUT update an ApiEntry
router.put('/:id', authenticateToken, isAdmin, getApiEntry, async (req, res) => {
    const { platformName, platformType, description, apiUrl, config, status, platform } = req.body;

    // res.apiEntry is now a Mongoose document
    const apiEntryDoc = res.apiEntry;

    if (platformName != null) apiEntryDoc.platformName = platformName;
    if (description != null) apiEntryDoc.description = description;
    if (apiUrl != null) apiEntryDoc.apiUrl = apiUrl;
    if (config != null) apiEntryDoc.config = config;
    if (status != null) apiEntryDoc.status = status;

    // If platformType is being changed, validate the new platform
    if (platformType != null && platformType !== apiEntryDoc.platformType) {
        try {
            const newPlatformDoc = await Platform.findOne({ name: platformType, status: 'active' });
            if (!newPlatformDoc) {
                return res.status(400).json({ message: `更新失败：无效或未激活的平台类型: ${platformType}` });
            }
            apiEntryDoc.platformType = platformType;
            apiEntryDoc.platform = newPlatformDoc._id;
        } catch (error) {
            return res.status(400).json({ message: error.message });
        }
    }

    // If platform ID is directly provided, use it
    if (platform != null) {
        try {
            const platformDoc = await Platform.findById(platform);
            if (!platformDoc) {
                return res.status(400).json({ message: `更新失败：无效的平台ID: ${platform}` });
            }
            apiEntryDoc.platform = platform;
            apiEntryDoc.platformType = platformDoc.name;
        } catch (error) {
            return res.status(400).json({ message: error.message });
        }
    }

    try {
        const updatedApiEntry = await apiEntryDoc.save();
        const populatedEntry = await ApiEntry.findById(updatedApiEntry._id).populate('platform', 'name status');
        
        // Calculate usage count for the updated entry
        const usageCount = await AiApplication.countDocuments({ 
            apis: populatedEntry._id,
            status: 'active'
        });
        
        const entryWithUsage = {
            ...populatedEntry.toObject(),
            usageCount
        };
        
        res.json(entryWithUsage);
    } catch (err) {
        if (err.code === 11000 && err.keyPattern && err.keyPattern.apiUrl) {
            return res.status(400).json({ message: `API 地址 '${apiUrl}' 已存在.` });
        }
        res.status(400).json({ message: err.message });
    }
});

// DELETE an ApiEntry
router.delete('/:id', authenticateToken, isAdmin, getApiEntry, async (req, res) => {
    try {
        // res.apiEntry is now a Mongoose document, get the ID from it
        const apiEntryId = res.apiEntry._id;
        await ApiEntry.findByIdAndDelete(apiEntryId);
        res.json({ message: 'API 条目已删除' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// GET count of ApiEntries for a specific platform ID
// This is an example, actual usage count is on Platform model
router.get('/count/by-platform/:platformId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const platformId = req.params.platformId;
        const count = await ApiEntry.countDocuments({ platform: platformId });
        res.json({ platformId: platformId, count: count });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router; 