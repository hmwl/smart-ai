const express = require('express');
const router = express.Router();
const AIWidget = require('../models/AIWidget');
const Platform = require('../models/Platform');
const ApiEntry = require('../models/ApiEntry');
const mongoose = require('mongoose');

// 获取AI挂件列表（支持分页、搜索、平台筛选）
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, name = '', platform, status } = req.query;
    const query = {};
    if (name) query.name = { $regex: name, $options: 'i' };
    if (platform) query.platform = platform;
    if (status) query.status = status;
    const total = await AIWidget.countDocuments(query);
    const list = await AIWidget.find(query)
      .populate('platform', 'name')
      .populate('apis', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(Number(pageSize));
    res.json({ total, list });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// 新建AI挂件
router.post('/', async (req, res) => {
  try {
    const { name, description, platform, apis, status } = req.body;
    const widget = await AIWidget.create({ name, description, platform, apis, status });
    res.json(widget);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// 编辑AI挂件
router.put('/:id', async (req, res) => {
  try {
    const { name, description, platform, apis, status } = req.body;
    const widget = await AIWidget.findByIdAndUpdate(
      req.params.id,
      { name, description, platform, apis, status },
      { new: true }
    );
    res.json(widget);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// 删除AI挂件
router.delete('/:id', async (req, res) => {
  try {
    await AIWidget.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

module.exports = router; 