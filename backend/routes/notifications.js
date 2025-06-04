const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');

// 获取消息列表（支持分页、筛选、类别tab）
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, category, type, status } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    // category: 平台/账户，简单用 type 区分，后续可扩展
    if (category === 'platform') {
      filter.type = { $in: ['notice', 'notice2', 'activity', 'promotion'] };
    } else if (category === 'account') {
      filter.type = 'other';
    }
    const total = await Announcement.countDocuments(filter);
    const list = await Announcement.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(Number(pageSize));
    res.json({ total, list });
  } catch (err) {
    res.status(500).json({ message: '获取消息列表失败', error: err.message });
  }
});

// 获取未读数量（全部/平台/账户）
router.get('/unread-count', async (req, res) => {
  // TODO: 需结合用户已读表/记录，暂返回0
  res.json({ all: 0, platform: 0, account: 0 });
});

// 批量标记已读
router.post('/mark-read', async (req, res) => {
  // TODO: 需结合用户已读表/记录
  res.json({ success: true });
});

// 批量标记未读
router.post('/mark-unread', async (req, res) => {
  // TODO: 需结合用户已读表/记录
  res.json({ success: true });
});

module.exports = router; 