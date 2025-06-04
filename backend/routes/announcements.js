const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');

// 获取公告列表（支持分页、筛选）
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, type, keyword } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (keyword) filter.title = { $regex: keyword, $options: 'i' };
    const total = await Announcement.countDocuments(filter);
    const list = await Announcement.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(Number(pageSize))
      .lean();
    // 新增：统计每条公告的已读用户数
    list.forEach(item => {
      item.readCount = Array.isArray(item.readUsers) ? item.readUsers.length : 0;
    });
    res.json({ total, list });
  } catch (err) {
    res.status(500).json({ message: '获取公告列表失败', error: err.message });
  }
});

// 获取单条公告
router.get('/:id', async (req, res) => {
  try {
    const item = await Announcement.findById(req.params.id);
    if (!item) return res.status(404).json({ message: '公告不存在' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: '获取公告失败', error: err.message });
  }
});

// 创建公告
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const ann = new Announcement(data);
    await ann.save();
    res.status(201).json(ann);
  } catch (err) {
    res.status(400).json({ message: '创建公告失败', error: err.message });
  }
});

// 编辑公告
router.put('/:id', async (req, res) => {
  try {
    const data = req.body;
    const ann = await Announcement.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!ann) return res.status(404).json({ message: '公告不存在' });
    res.json(ann);
  } catch (err) {
    res.status(400).json({ message: '更新公告失败', error: err.message });
  }
});

// 删除公告
router.delete('/:id', async (req, res) => {
  try {
    const result = await Announcement.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: '公告不存在' });
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ message: '删除公告失败', error: err.message });
  }
});

module.exports = router; 