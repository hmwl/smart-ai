const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Application = require('../models/Application');
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');

// Middleware to load application and check ownership/admin status
async function getApplication(req, res, next) {
  let application;
  const appId = req.params.id;

  // --- Revision: Remove ObjectId validation as _id is now String ---
  /*
  if (!mongoose.Types.ObjectId.isValid(appId)) {
    return res.status(400).json({ message: '无效的应用 ID 格式' });
  }
  */
  // --- End Revision ---

  try {
    // --- Revision: Use findOne instead of findById ---
    application = await Application.findOne({ _id: appId });
    // --- End Revision ---
    if (application == null) {
      return res.status(404).json({ message: '找不到指定的应用' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }

  // Check ownership or admin status
  // Allow access if the user is an admin OR the user owns the application
  if (!req.user.isAdmin && application.owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: '无权访问此应用' });
  }

  res.application = application; // Attach application to response object
  next();
}

// GET /api/applications - 获取应用列表
// 管理员获取所有，普通用户获取自己的
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = {};
    if (!req.user.isAdmin) {
      query.owner = req.user.userId; // 普通用户只能查询自己的
    }
    // 可添加分页、排序、过滤 (按类型、状态等)
    const applications = await Application.find(query).populate('owner', 'username email'); // 填充 owner 信息
    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: '获取应用列表失败: ' + err.message });
  }
});

// POST /api/applications - 创建新应用
router.post('/', authenticateToken, async (req, res) => {
  const { name, type, config, status } = req.body;

  if (!name || !type) {
    return res.status(400).json({ message: '应用名称和类型不能为空' });
  }

  const application = new Application({
    name,
    type,
    config: config || {},
    status: status || 'active',
    owner: req.user.userId // 创建者为当前登录用户
  });

  try {
    const newApplication = await application.save();
    // Populate owner info before sending response
    await newApplication.populate('owner', 'username email');
    res.status(201).json(newApplication);
  } catch (err) {
    res.status(400).json({ message: '创建应用失败: ' + err.message }); // 400 for validation errors
  }
});

// GET /api/applications/:id - 获取单个应用信息
// 使用 getApplication 中间件进行查找和权限检查
router.get('/:id', authenticateToken, getApplication, (req, res) => {
  res.json(res.application);
});

// PUT /api/applications/:id - 更新应用信息
// 使用 getApplication 中间件进行查找和权限检查
router.put('/:id', authenticateToken, getApplication, async (req, res) => {
  const { name, type, config, status } = req.body;

  if (name != null) res.application.name = name;
  if (type != null) res.application.type = type;
  if (config != null) res.application.config = config;
  if (status != null) res.application.status = status;
  // Owner is generally not changed here

  try {
    const updatedApplication = await res.application.save();
    // Populate owner info before sending response
    await updatedApplication.populate('owner', 'username email');
    res.json(updatedApplication);
  } catch (err) {
    res.status(400).json({ message: '更新应用失败: ' + err.message });
  }
});

// DELETE /api/applications/:id - 删除应用
// 使用 getApplication 中间件进行查找和权限检查
router.delete('/:id', authenticateToken, getApplication, async (req, res) => {
  try {
    await Application.deleteOne({ _id: res.application._id });
    res.json({ message: '应用删除成功', appId: res.application._id });
  } catch (err) {
    res.status(500).json({ message: '删除应用失败: ' + err.message });
  }
});

module.exports = router; 