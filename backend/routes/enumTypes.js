const express = require('express');
const router = express.Router();
const EnumType = require('../models/EnumType');
const EnumConfig = require('../models/EnumConfig'); // To check for usage
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');
const { PLATFORM_TYPES } = require('../models/ApiEntry'); // For validation

// Middleware to get EnumType by ID
async function getEnumType(req, res, next) {
    let enumType;
    try {
        enumType = await EnumType.findById(req.params.id);
        if (enumType == null) {
            return res.status(404).json({ message: '找不到指定的枚举类型' });
        }
    } catch (err) {
        return res.status(500).json({ message: '服务器错误: ' + err.message });
    }
    res.enumType = enumType;
    next();
}

// GET all Enum Types
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const enumTypes = await EnumType.find().sort({ name: 1 }).lean();
        const typesWithUsage = await Promise.all(enumTypes.map(async (type) => {
            const usageCount = await EnumConfig.countDocuments({ enumType: type._id });
            // The 'isUsed' field from the model itself is also available if it's being maintained
            // but usageCount is a direct measure for current use.
            return { ...type, usageCount, isUsed: type.isUsed || usageCount > 0 }; 
        }));
        res.json(typesWithUsage);
    } catch (err) {
        res.status(500).json({ message: '获取枚举类型列表失败: ' + err.message });
    }
});

// POST create a new Enum Type
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    const { name, platform, status } = req.body;

    if (!name || !platform) {
        return res.status(400).json({ message: '类型名称和平台不能为空' });
    }

    if (!PLATFORM_TYPES.includes(platform)) {
        return res.status(400).json({ message: `无效的平台类型: ${platform}。允许的平台有: ${PLATFORM_TYPES.join(', ')}` });
    }

    const enumType = new EnumType({
        name,
        platform,
        ...(status && { status })
    });

    try {
        const newEnumType = await enumType.save();
        res.status(201).json(newEnumType);
    } catch (err) {
        if (err.name === 'ValidationError') {
            let errors = Object.values(err.errors).map(el => el.message);
            return res.status(400).json({ message: `创建枚举类型验证失败: ${errors.join(', ')}` });
        }
        res.status(400).json({ message: '创建枚举类型失败: ' + err.message });
    }
});

// GET a single Enum Type by ID
router.get('/:id', authenticateToken, isAdmin, getEnumType, async (req, res) => {
    try {
        const usageCount = await EnumConfig.countDocuments({ enumType: res.enumType._id });
        const enumTypeData = res.enumType.toObject();
        res.json({ ...enumTypeData, usageCount, isUsed: res.enumType.isUsed || usageCount > 0 });
    } catch (err) {
        res.status(500).json({ message: '获取枚举类型详情失败: ' + err.message });
    }
});

// PUT update an Enum Type
router.put('/:id', authenticateToken, isAdmin, getEnumType, async (req, res) => {
    const { name, platform, status } = req.body;

    if (platform && !PLATFORM_TYPES.includes(platform)) {
        return res.status(400).json({ message: `无效的平台类型: ${platform}。允许的平台有: ${PLATFORM_TYPES.join(', ')}` });
    }

    if (status === 'inactive' && res.enumType.status !== 'inactive') {
        const usageCount = await EnumConfig.countDocuments({ enumType: res.enumType._id });
        if (usageCount > 0) {
            return res.status(400).json({
                message: `无法禁用：该枚举类型正在被 ${usageCount} 个枚举配置使用。`
            });
        }
    }

    if (name != null) res.enumType.name = name;
    if (platform != null) res.enumType.platform = platform;
    if (status != null) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ message: '无效的状态值，必须是 active 或 inactive' });
      }
       res.enumType.status = status;
    }

    try {
        const updatedEnumType = await res.enumType.save();
        res.json(updatedEnumType);
    } catch (err) {
        if (err.name === 'ValidationError') {
            let errors = Object.values(err.errors).map(el => el.message);
            return res.status(400).json({ message: `更新枚举类型验证失败: ${errors.join(', ')}` });
        }
        res.status(400).json({ message: '更新枚举类型失败: ' + err.message });
    }
});

// DELETE an Enum Type
router.delete('/:id', authenticateToken, isAdmin, getEnumType, async (req, res) => {
    try {
        const usageCount = await EnumConfig.countDocuments({ enumType: res.enumType._id });
        if (usageCount > 0) { // Also respects model's isUsed if it were more directly managed
            return res.status(400).json({
                message: `无法删除：该枚举类型正在被 ${usageCount} 个枚举配置使用。`
            });
        }
        await EnumType.deleteOne({ _id: res.enumType._id });
        res.json({ message: '枚举类型删除成功', typeId: res.enumType._id });
    } catch (err) {
        res.status(500).json({ message: '删除枚举类型失败: ' + err.message });
    }
});

module.exports = router;
