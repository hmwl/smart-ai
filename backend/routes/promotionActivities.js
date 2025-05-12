const express = require('express');
const router = express.Router();
const PromotionActivity = require('../models/PromotionActivity');
const User = require('../models/User'); // For createdBy population
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');

// POST /api/promotion-activities - Create a new promotion activity
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  const { name, startTime, endTime, activityType, activityDetails, remarks, isEnabled } = req.body;
  const createdBy = req.user.userId; // Get admin user ID from token

  if (!name || !startTime || !endTime || !activityType) {
    return res.status(400).json({ message: '活动名称、时间和类型不能为空。' });
  }

  try {
    // Basic validation for dates
    if (new Date(endTime) <= new Date(startTime)) {
        return res.status(400).json({ message: '结束时间必须晚于开始时间。' });
    }

    const newActivity = new PromotionActivity({
      name,
      startTime,
      endTime,
      isEnabled: typeof isEnabled === 'boolean' ? isEnabled : false,
      activityType,
      activityDetails: activityDetails || {},
      remarks,
      createdBy
    });

    const savedActivity = await newActivity.save();
    const populatedActivity = await PromotionActivity.findById(savedActivity._id).populate('createdBy', 'username _id');
    res.status(201).json(populatedActivity);
  } catch (error) {
    console.error('Error creating promotion activity:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: `创建活动验证失败: ${Object.values(error.errors).map(e => e.message).join(', ')}` });
    }
    res.status(500).json({ message: '创建优惠活动失败: ' + error.message });
  }
});

// GET /api/promotion-activities - Get all promotion activities with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  const { page = 1, limit = 15, name, activityType, dateRangeStart, dateRangeEnd, sort = '-createdAt', effectiveStatus } = req.query;
  const query = {};
  const now = new Date();

  if (name) query.name = { $regex: name, $options: 'i' }; // Case-insensitive search
  if (activityType) query.activityType = activityType;

  // Filter by effectiveStatus
  if (effectiveStatus) {
    switch (effectiveStatus) {
      case 'disabled':
        query.isEnabled = false;
        break;
      case 'not_started':
        query.isEnabled = true;
        query.startTime = { $gt: now };
        break;
      case 'ongoing':
        query.isEnabled = true;
        query.startTime = { $lte: now };
        query.endTime = { $gte: now };
        break;
      case 'ended':
        query.isEnabled = true;
        query.endTime = { $lt: now };
        break;
      // No default needed, if status is invalid, it's ignored
    }
  }
  
  if (dateRangeStart || dateRangeEnd) {
    query.$or = [];
    // Option 1: Activity is fully within the selected range
    if (dateRangeStart && dateRangeEnd) {
        query.$or.push({ startTime: { $gte: new Date(dateRangeStart) }, endTime: { $lte: new Date(dateRangeEnd) } });
    }
    // Option 2: Activity starts within the range
    if (dateRangeStart) {
        query.$or.push({ startTime: { $gte: new Date(dateRangeStart), $lte: dateRangeEnd ? new Date(dateRangeEnd) : new Date() } });
    }
    // Option 3: Activity ends within the range
    if (dateRangeEnd) {
        query.$or.push({ endTime: { $gte: dateRangeStart ? new Date(dateRangeStart) : new Date(0) , $lte: new Date(dateRangeEnd) } });
    }
    // Option 4: Activity spans over the selected range
    if (dateRangeStart && dateRangeEnd) {
        query.$or.push({ startTime: { $lte: new Date(dateRangeStart) }, endTime: { $gte: new Date(dateRangeEnd) } });
    }
    if(query.$or.length === 0) delete query.$or; // Clean up if no date range relevant conditions added
  }

  try {
    const activities = await PromotionActivity.find(query)
      .populate('createdBy', 'username _id')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await PromotionActivity.countDocuments(query);

    res.json({
      activities,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching promotion activities:', error);
    res.status(500).json({ message: '获取优惠活动列表失败: ' + error.message });
  }
});

// GET /api/promotion-activities/:id - Get a single promotion activity by ID
router.get('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const activity = await PromotionActivity.findById(req.params.id).populate('createdBy', 'username _id');
    if (!activity) {
      return res.status(404).json({ message: '未找到指定的优惠活动' });
    }
    res.json(activity);
  } catch (error) {
    console.error('Error fetching promotion activity by ID:', error);
    if (error.kind === 'ObjectId') return res.status(400).json({ message: '无效的活动ID格式' });
    res.status(500).json({ message: '获取优惠活动详情失败: ' + error.message });
  }
});

// PUT /api/promotion-activities/:id - Update a promotion activity
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  const { name, startTime, endTime, activityType, activityDetails, remarks, isEnabled } = req.body;
  
  if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
    return res.status(400).json({ message: '结束时间必须晚于开始时间。' });
  }

  try {
    const activity = await PromotionActivity.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ message: '未找到要更新的优惠活动' });
    }

    if (name !== undefined) activity.name = name;
    if (startTime !== undefined) activity.startTime = startTime;
    if (endTime !== undefined) activity.endTime = endTime;
    if (isEnabled !== undefined) activity.isEnabled = isEnabled;
    if (activityType !== undefined) activity.activityType = activityType;
    if (activityDetails !== undefined) activity.activityDetails = activityDetails;
    if (remarks !== undefined) activity.remarks = remarks;
    // createdBy should not be changed on update

    const updatedActivity = await activity.save();
    const populatedActivity = await PromotionActivity.findById(updatedActivity._id).populate('createdBy', 'username _id');
    res.json(populatedActivity);
  } catch (error) {
    console.error('Error updating promotion activity:', error);
     if (error.name === 'ValidationError') {
      return res.status(400).json({ message: `更新活动验证失败: ${Object.values(error.errors).map(e => e.message).join(', ')}` });
    }
    if (error.kind === 'ObjectId') return res.status(400).json({ message: '无效的活动ID格式' });
    res.status(500).json({ message: '更新优惠活动失败: ' + error.message });
  }
});

// DELETE /api/promotion-activities/:id - Delete a promotion activity
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const activity = await PromotionActivity.findByIdAndDelete(req.params.id);
    if (!activity) {
      return res.status(404).json({ message: '未找到要删除的优惠活动' });
    }
    res.json({ message: '优惠活动删除成功', activityId: req.params.id });
  } catch (error) {
    console.error('Error deleting promotion activity:', error);
    if (error.kind === 'ObjectId') return res.status(400).json({ message: '无效的活动ID格式' });
    res.status(500).json({ message: '删除优惠活动失败: ' + error.message });
  }
});

module.exports = router; 