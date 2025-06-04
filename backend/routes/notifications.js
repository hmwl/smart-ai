const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const authenticateToken = require('../middleware/authenticateToken');

// 获取消息列表（支持分页、筛选、类别tab）
router.get('/', authenticateToken, async (req, res) => {
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
    // 只返回已生效的公告
    filter.status = 'active';
    filter.effectiveAt = { $lte: new Date() };
    const total = await Announcement.countDocuments(filter);
    const list = await Announcement.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(Number(pageSize))
      .lean();
    const userId = req.user.userId;
    // 标记每条消息的 isRead 字段
    list.forEach(item => {
      item.isRead = Array.isArray(item.readUsers) && item.readUsers.includes(userId);
      delete item.readUsers; // 前端无需全部已读用户
    });
    res.json({ total, list });
  } catch (err) {
    res.status(500).json({ message: '获取消息列表失败', error: err.message });
  }
});

// 获取未读数量（全部/平台/账户）
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const baseFilter = { status: 'active', effectiveAt: { $lte: new Date() } };
    const all = await Announcement.countDocuments({ ...baseFilter, readUsers: { $ne: userId } });
    const platform = await Announcement.countDocuments({ ...baseFilter, type: { $in: ['notice', 'notice2', 'activity', 'promotion'] }, readUsers: { $ne: userId } });
    const account = await Announcement.countDocuments({ ...baseFilter, type: 'other', readUsers: { $ne: userId } });
    res.json({ all, platform, account });
  } catch (err) {
    res.status(500).json({ message: '获取未读数量失败', error: err.message });
  }
});

// 批量标记已读
router.post('/mark-read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.json({ success: true });
    await Announcement.updateMany(
      { _id: { $in: ids }, readUsers: { $ne: userId } },
      { $addToSet: { readUsers: userId } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: '标记已读失败', error: err.message });
  }
});

// 批量标记未读
router.post('/mark-unread', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.json({ success: true });
    await Announcement.updateMany(
      { _id: { $in: ids }, readUsers: userId },
      { $pull: { readUsers: userId } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: '标记未读失败', error: err.message });
  }
});

module.exports = router; 