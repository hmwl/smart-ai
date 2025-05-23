const express = require('express');
const router = express.Router();
const Platform = require('../models/Platform');
const ApiEntry = require('../models/ApiEntry'); // To check API usage
const EnumType = require('../models/EnumType'); // To check enum type usage
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');

// Middleware to get platform by ID
async function getPlatform(req, res, next) {
    let platform;
    try {
        platform = await Platform.findById(req.params.id);
        if (platform == null) {
            return res.status(404).json({ message: '找不到指定的平台' });
        }
        
        // Calculate dynamic usage counts
        const apiUsageCount = await ApiEntry.countDocuments({ platform: platform._id });
        const enumTypeUsageCount = await EnumType.countDocuments({ platform: platform.name, status: 'active' });
        
        platform = {
            ...platform.toObject(),
            apiUsageCount,
            enumTypeUsageCount,
            totalUsageCount: apiUsageCount + enumTypeUsageCount
        };
        
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.platform = platform;
    next();
}

// GET all platforms
router.get('/', authenticateToken, async (req, res) => {
    try {
        const platforms = await Platform.find().sort({ createdAt: -1 });
        
        // Calculate usage counts for each platform dynamically
        const platformsWithUsage = await Promise.all(
            platforms.map(async (platform) => {
                const apiUsageCount = await ApiEntry.countDocuments({ platform: platform._id });
                const enumTypeUsageCount = await EnumType.countDocuments({ platform: platform.name, status: 'active' });
                
                return {
                    ...platform.toObject(),
                    apiUsageCount,
                    enumTypeUsageCount,
                    totalUsageCount: apiUsageCount + enumTypeUsageCount
                };
            })
        );
        
        res.json(platformsWithUsage);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET platform types (unique names from active platforms)
router.get('/types', authenticateToken, async (req, res) => {
    try {
        const activePlatforms = await Platform.find({ status: 'active' }).select('name').lean();
        const platformNames = activePlatforms.map(p => p.name);
        res.json(platformNames);
    } catch (err) {
        console.error("Error fetching platform types:", err);
        res.status(500).json({ message: '获取平台类型失败', error: err.message });
    }
});

// POST create a new platform
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    const { name, status, configFields } = req.body;
    if (!name) {
        return res.status(400).json({ message: '平台名称不能为空' });
    }

    const platform = new Platform({
        name,
        status: status || 'active',
        configFields: configFields || []
    });

    try {
        const newPlatform = await platform.save();
        // Add usage counts (will be 0 for new platform)
        const platformWithUsage = {
            ...newPlatform.toObject(),
            apiUsageCount: 0,
            enumTypeUsageCount: 0,
            totalUsageCount: 0
        };
        res.status(201).json(platformWithUsage);
    } catch (err) {
        if (err.code === 11000) { // Duplicate key error
            return res.status(400).json({ message: `平台名称 '${name}' 已存在` });
        }
        res.status(400).json({ message: err.message });
    }
});

// PUT update a platform
router.put('/:id', authenticateToken, isAdmin, getPlatform, async (req, res) => {
    const { name, status, configFields } = req.body;
    const platform = res.platform;

    // Check if platform is being deactivated and has usage
    if (status === 'inactive' && platform.status !== 'inactive') {
        if (platform.totalUsageCount > 0) {
            return res.status(400).json({
                message: `无法禁用平台：该平台正在被使用中。API使用数: ${platform.apiUsageCount}, 枚举类型使用数: ${platform.enumTypeUsageCount}`
            });
        }
    }

    if (name != null) {
        // Check if name is being changed and platform has enum types
        if (name !== platform.name && platform.enumTypeUsageCount > 0) {
            return res.status(400).json({
                message: `无法修改平台名称：该平台有 ${platform.enumTypeUsageCount} 个枚举类型正在使用中`
            });
        }
    }

    try {
        // Save the platform
        const platformDoc = await Platform.findById(platform._id);
        
        if (name != null) {
            const oldName = platformDoc.name;
            platformDoc.name = name;
            
            // If name changed, also update all enum types that reference this platform
            if (name !== oldName) {
                await EnumType.updateMany(
                    { platform: oldName },
                    { platform: name }
                );
            }
        }
        
        if (status != null) platformDoc.status = status;
        if (configFields != null) platformDoc.configFields = configFields;
        
        const updatedPlatform = await platformDoc.save();
        
        // Return with current usage counts
        const apiUsageCount = await ApiEntry.countDocuments({ platform: updatedPlatform._id });
        const enumTypeUsageCount = await EnumType.countDocuments({ platform: updatedPlatform.name, status: 'active' });
        
        const platformWithUsage = {
            ...updatedPlatform.toObject(),
            apiUsageCount,
            enumTypeUsageCount,
            totalUsageCount: apiUsageCount + enumTypeUsageCount
        };
        
        res.json(platformWithUsage);
    } catch (err) {
        if (err.code === 11000) { // Duplicate key error
            return res.status(400).json({ message: `平台名称 '${name}' 已存在` });
        }
        res.status(400).json({ message: err.message });
    }
});

// DELETE a platform
router.delete('/:id', authenticateToken, isAdmin, getPlatform, async (req, res) => {
    try {
        const platform = res.platform;
        
        // Check if platform has any usage
        if (platform.totalUsageCount > 0) {
            return res.status(400).json({
                message: `无法删除平台：该平台正在被使用中。API使用数: ${platform.apiUsageCount}, 枚举类型使用数: ${platform.enumTypeUsageCount}`
            });
        }
        
        await Platform.findByIdAndDelete(platform._id);
        res.json({ 
            message: '平台删除成功', 
            platformId: platform._id 
        });
    } catch (err) {
        res.status(500).json({ message: '删除平台失败: ' + err.message });
    }
});

module.exports = router; 