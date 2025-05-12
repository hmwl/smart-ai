const express = require('express');
const router = express.Router();
const AiType = require('../models/AiType');
const AiApplication = require('../models/AiApplication');
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');

// Middleware to get AiType by ID
async function getAiType(req, res, next) {
    let aiType;
    try {
        aiType = await AiType.findOne({ _id: req.params.id });
        if (aiType == null) {
            return res.status(404).json({ message: '找不到指定的 AI 类型' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.aiType = aiType;
    next();
}

// GET all AI Types
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const aiTypes = await AiType.find().sort({ name: 1 }).lean();
        const typesWithUsage = await Promise.all(aiTypes.map(async (type) => {
            const usageCount = await AiApplication.countDocuments({ type: type._id });
            return { ...type, usageCount };
        }));
        res.json(typesWithUsage);
    } catch (err) {
        res.status(500).json({ message: '获取 AI 类型列表失败: ' + err.message });
    }
});

// POST create a new AI Type
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    // --- Revision: Include status --- 
    const { name, uri, status } = req.body;
    if (!name || !uri) { // Status has a default, so not strictly required in body
        return res.status(400).json({ message: '名称和 URI 不能为空' });
    }

    const aiType = new AiType({
        name,
        uri,
        // Only include status if provided, otherwise default applies
        ...(status && { status })
    });
    // --- End Revision ---

    try {
        const newAiType = await aiType.save();
        res.status(201).json(newAiType);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: `URI '${uri}' 已存在` });
        } else if (err.name === 'ValidationError') {
            let errors = Object.values(err.errors).map(el => el.message);
            return res.status(400).json({ message: `创建 AI 类型验证失败: ${errors.join(', ')}` });
        } else {
            res.status(400).json({ message: '创建 AI 类型失败: ' + err.message });
        }
    }
});

// GET a single AI Type by ID
router.get('/:id', authenticateToken, isAdmin, getAiType, (req, res) => {
    res.json(res.aiType);
});

// PUT update an AI Type
router.put('/:id', authenticateToken, isAdmin, getAiType, async (req, res) => {
    const { name, uri, status } = req.body;

    // Check usage if attempting to disable
    if (status === 'inactive') {
        // Only check if the current status is not already inactive
        if (res.aiType.status !== 'inactive') { 
            const usageCount = await AiApplication.countDocuments({ type: res.aiType._id });
            if (usageCount > 0) {
                return res.status(400).json({
                    message: `无法禁用：该AI类型正在被 ${usageCount} 个AI应用使用。请先更改这些应用类型。`
                });
            }
        }
    }

    if (name != null) res.aiType.name = name;
    if (uri != null) res.aiType.uri = uri;
    if (status != null) {
      // Optional: Add validation if status is not one of the allowed enum values
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ message: '无效的状态值，必须是 active 或 inactive' });
      }
       res.aiType.status = status;
    }

    try {
        const updatedAiType = await res.aiType.save();
        res.json(updatedAiType);
    } catch (err) {
         if (err.code === 11000) {
            return res.status(409).json({ message: `URI '${uri}' 已存在` });
        } else if (err.name === 'ValidationError') {
            let errors = Object.values(err.errors).map(el => el.message);
            return res.status(400).json({ message: `更新 AI 类型验证失败: ${errors.join(', ')}` });
        } else {
            res.status(400).json({ message: '更新 AI 类型失败: ' + err.message });
        }
    }
});

// DELETE an AI Type
router.delete('/:id', authenticateToken, isAdmin, getAiType, async (req, res) => {
    try {
        const usageCount = await AiApplication.countDocuments({ type: res.aiType._id });
        if (usageCount > 0) {
            return res.status(400).json({ 
                message: `无法删除：该AI类型正在被 ${usageCount} 个AI应用使用。请先更改这些应用类型。` 
            });
        }
        await AiType.deleteOne({ _id: res.aiType._id });
        res.json({ message: 'AI 类型删除成功', typeId: res.aiType._id });
    } catch (err) {
        res.status(500).json({ message: '删除 AI 类型失败: ' + err.message });
    }
});

module.exports = router; 