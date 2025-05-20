const express = require('express');
const router = express.Router();
const EnumConfig = require('../models/EnumConfig');
const EnumType = require('../models/EnumType');
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');
const { PLATFORM_TYPES } = require('../models/ApiEntry');

// Middleware to get EnumConfig by ID
async function getEnumConfig(req, res, next) {
    let enumConfig;
    try {
        enumConfig = await EnumConfig.findById(req.params.id).populate('enumType', 'name platform');
        if (enumConfig == null) {
            return res.status(404).json({ message: '找不到指定的枚举配置' });
        }
    } catch (err) {
        return res.status(500).json({ message: '服务器错误: ' + err.message });
    }
    res.enumConfig = enumConfig;
    next();
}

// GET all Enum Configs (with filtering)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { platform, enumTypeId, name, status, page = 1, limit = 10 } = req.query;
        const queryOptions = {};

        if (platform) queryOptions.platform = platform;
        if (enumTypeId) queryOptions.enumType = enumTypeId;
        if (name) queryOptions.name = { $regex: name, $options: 'i' };
        if (status) queryOptions.status = status;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const enumConfigs = await EnumConfig.find(queryOptions)
            .populate('enumType', 'name platform')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();
        
        const totalRecords = await EnumConfig.countDocuments(queryOptions);

        // Update isUsed based on usageCount
        const configsWithUsage = enumConfigs.map(config => ({
            ...config,
            isUsed: config.usageCount > 0
        }));

        res.json({
            data: configsWithUsage,
            totalPages: Math.ceil(totalRecords / parseInt(limit)),
            currentPage: parseInt(page),
            totalRecords
        });
    } catch (err) {
        res.status(500).json({ message: '获取枚举配置列表失败: ' + err.message });
    }
});

// POST create a new Enum Config
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    const { name, enumType: enumTypeId, translation, description, platform, status } = req.body;

    if (!name || !enumTypeId || !platform) {
        return res.status(400).json({ message: '配置名称、类型ID和平台不能为空' });
    }

    if (!PLATFORM_TYPES.includes(platform)) {
        return res.status(400).json({ message: `无效的平台类型: ${platform}。允许的平台有: ${PLATFORM_TYPES.join(', ')}` });
    }
    
    try {
        const typeExists = await EnumType.findById(enumTypeId);
        if (!typeExists) {
            return res.status(400).json({ message: `指定的枚举类型 ID (${enumTypeId}) 不存在` });
        }
        if (typeExists.platform !== platform) {
            return res.status(400).json({ message: `枚举配置的平台 (${platform}) 必须与其关联的枚举类型的平台 (${typeExists.platform}) 一致。` });
        }

        const enumConfig = new EnumConfig({
            name,
            enumType: enumTypeId,
            translation,
            description,
            platform,
            ...(status && { status })
        });

        const newEnumConfig = await enumConfig.save();
        const populatedConfig = await EnumConfig.findById(newEnumConfig._id).populate('enumType', 'name platform').lean();
        res.status(201).json(populatedConfig);
    } catch (err) {
        if (err.name === 'ValidationError') {
            let errors = Object.values(err.errors).map(el => el.message);
            return res.status(400).json({ message: `创建枚举配置验证失败: ${errors.join(', ')}` });
        }
        res.status(400).json({ message: '创建枚举配置失败: ' + err.message });
    }
});

// GET a single Enum Config by ID
router.get('/:id', authenticateToken, isAdmin, getEnumConfig, (req, res) => {
    res.json(res.enumConfig);
});

// PUT update an Enum Config
router.put('/:id', authenticateToken, isAdmin, getEnumConfig, async (req, res) => {
    const { name, enumType: enumTypeId, translation, description, platform, status, isUsed } = req.body;
    let currentEnumType = res.enumConfig.enumType; // This is a populated object or ID

    // If enumTypeId is provided, means the type might be changing
    if (enumTypeId) {
        const newType = await EnumType.findById(enumTypeId);
        if (!newType) {
            return res.status(400).json({ message: `指定的枚举类型 ID (${enumTypeId}) 不存在` });
        }
        currentEnumType = newType; // This is a Mongoose document
    }
    
    // Determine the platform to be used for validation and saving
    // If 'platform' is in req.body, it takes precedence. Otherwise, use the platform of the (new or existing) enumType.
    const effectivePlatform = platform || (currentEnumType ? currentEnumType.platform : res.enumConfig.platform);

    if (platform && !PLATFORM_TYPES.includes(platform)) {
      return res.status(400).json({ message: `请求中提供的平台类型无效: ${platform}` });
    }
    
    // Validate that the config's platform matches its type's platform
    if (currentEnumType && currentEnumType.platform !== effectivePlatform) {
        return res.status(400).json({ message: `枚举配置的平台 (${effectivePlatform}) 与其类型的平台 (${currentEnumType.platform}) 不一致。` });
    }

    if (name != null) res.enumConfig.name = name;
    if (enumTypeId != null) res.enumConfig.enumType = enumTypeId; // Assign ID
    if (translation != null) res.enumConfig.translation = translation;
    if (description != null) res.enumConfig.description = description;
    
    // Set the platform on the enumConfig itself
    res.enumConfig.platform = effectivePlatform;

    if (status != null) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ message: '无效的状态值，必须是 active 或 inactive' });
      }
       res.enumConfig.status = status;
    }
    if (typeof isUsed === 'boolean') {
        res.enumConfig.isUsed = isUsed;
    }

    try {
        const updatedEnumConfig = await res.enumConfig.save();
        const populatedConfig = await EnumConfig.findById(updatedEnumConfig._id).populate('enumType', 'name platform').lean();
        res.json(populatedConfig);
    } catch (err) {
        if (err.name === 'ValidationError') {
            let errors = Object.values(err.errors).map(el => el.message);
            return res.status(400).json({ message: `更新枚举配置验证失败: ${errors.join(', ')}` });
        }
        res.status(400).json({ message: '更新枚举配置失败: ' + err.message });
    }
});

// DELETE an Enum Config
router.delete('/:id', authenticateToken, isAdmin, getEnumConfig, async (req, res) => {
    try {
        if (res.enumConfig.isUsed) {
            return res.status(400).json({
                message: '无法删除：该枚举配置已被标记为"已使用"。'
            });
        }
        await EnumConfig.deleteOne({ _id: res.enumConfig._id });
        res.json({ message: '枚举配置删除成功', configId: res.enumConfig._id });
    } catch (err) {
        res.status(500).json({ message: '删除枚举配置失败: ' + err.message });
    }
});

module.exports = router;
