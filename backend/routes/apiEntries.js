const express = require('express');
const router = express.Router();
const ApiEntry = require('../models/ApiEntry');
const AiApplication = require('../models/AiApplication');
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');

// Middleware for all routes in this file - REMOVED global router.use()
// router.use(authenticateToken, isAdmin); 

// GET / - Get all API entries (Apply middleware individually)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const entries = await ApiEntry.find().sort({ createdAt: -1 }).lean();
    
    // For each entry, calculate its usage count by AiApplications
    const entriesWithUsage = await Promise.all(entries.map(async (entry) => {
      // Count how many AiApplication documents have this entry._id in their 'apis' array
      const usageCount = await AiApplication.countDocuments({ apis: entry._id });
      return { ...entry, usageCount }; // Add usageCount to the entry object
    }));
    
    res.json(entriesWithUsage);
  } catch (error) {
    console.error("Error fetching API entries:", error);
    res.status(500).json({ message: '获取 API 列表失败', error: error.message });
  }
});

// POST / - Create a new API entry (Apply middleware individually)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  const { platformName, description, apiUrl, status } = req.body;

  try {
    const existingEntry = await ApiEntry.findOne({ apiUrl });
    if (existingEntry) {
      return res.status(409).json({ message: `API 地址 '${apiUrl}' 已存在` });
    }
    const newEntry = new ApiEntry({ platformName, description, apiUrl, status: status || 'active' });
    const savedEntry = await newEntry.save();
    res.status(201).json(savedEntry);
  } catch (error) {
    console.error("Error creating API entry:", error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: '创建 API 失败：验证错误', error: error.message });
    } else if (error.code === 11000) { 
         return res.status(409).json({ message: `API 地址 '${apiUrl}' 已存在` });
    }
    res.status(500).json({ message: '创建 API 失败', error: error.message });
  }
});

// PUT /:id - Update an API entry (Apply middleware individually)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { platformName, description, apiUrl, status } = req.body;

  try {
    // If attempting to change status to 'inactive' (disable)
    if (status === 'inactive') {
      const entryToUpdate = await ApiEntry.findById(id);
      if (!entryToUpdate) {
        return res.status(404).json({ message: '未找到要更新的 API 条目' });
      }
      // Only check usage if the current status is not already inactive
      if (entryToUpdate.status !== 'inactive') {
        const usageCount = await AiApplication.countDocuments({ apis: id });
        if (usageCount > 0) {
          return res.status(400).json({ 
            message: `无法禁用：该 API 正在被 ${usageCount} 个AI应用使用。请先从AI应用中移除此API关联。` 
          });
        }
      }
    }

    if (apiUrl) {
        const existingEntry = await ApiEntry.findOne({ apiUrl: apiUrl, _id: { $ne: id } });
        if (existingEntry) {
            return res.status(409).json({ message: `更新失败：API 地址 '${apiUrl}' 已被其他条目使用` });
        }
    }
    const updatedEntry = await ApiEntry.findOneAndUpdate(
      { _id: id },
      { platformName, description, apiUrl, status },
      { new: true, runValidators: true } 
    );
    if (!updatedEntry) {
      return res.status(404).json({ message: '未找到要更新的 API 条目' });
    }
    res.json(updatedEntry);
  } catch (error) {
    console.error("Error updating API entry:", error);
     if (error.name === 'ValidationError') {
      return res.status(400).json({ message: '更新 API 失败：验证错误', error: error.message });
    } else if (error.code === 11000) {
         return res.status(409).json({ message: `更新失败：API 地址 '${apiUrl}' 已存在` });
    }
    res.status(500).json({ message: '更新 API 失败', error: error.message });
  }
});

// DELETE /:id - Delete an API entry (Apply middleware individually)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Check usage before attempting to delete
    const usageCount = await AiApplication.countDocuments({ apis: id });
    if (usageCount > 0) {
      return res.status(400).json({
        message: `无法删除：该 API 正在被 ${usageCount} 个AI应用使用。请先从AI应用中移除此API关联。`
      });
    }

    const deletedEntry = await ApiEntry.findOneAndDelete({ _id: id });
    if (!deletedEntry) {
      return res.status(404).json({ message: '未找到要删除的 API 条目' });
    }
    res.status(200).json({ message: `API 条目 '${deletedEntry.platformName}' 已成功删除` });
  } catch (error) {
    console.error("Error deleting API entry:", error);
    res.status(500).json({ message: '删除 API 失败', error: error.message });
  }
});

module.exports = router; 