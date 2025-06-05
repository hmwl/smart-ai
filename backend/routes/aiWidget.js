const express = require('express');
const router = express.Router();
const AIWidget = require('../models/AIWidget');
const Platform = require('../models/Platform');
const ApiEntry = require('../models/ApiEntry');
const mongoose = require('mongoose');
const AiApplication = require('../models/AiApplication');

// 获取AI挂件列表（支持分页、搜索、平台筛选）
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, name = '', platform, status, creditsFilter } = req.query;
    const query = {};
    if (name) query.name = { $regex: name, $options: 'i' };
    if (platform) query.platform = platform;
    if (status) query.status = status;

    // Handle creditsFilter
    if (creditsFilter) {
      if (creditsFilter === 'free') {
        query.creditsConsumed = 0;
      } else if (creditsFilter === 'paid') {
        query.creditsConsumed = { $gt: 0 };
      }
    }

    const total = await AIWidget.countDocuments(query);
    const list = await AIWidget.find(query)
      .populate('platform', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * parseInt(pageSize))
      .limit(parseInt(pageSize));

    // Calculate usage counts
    const widgetUsageCounts = await AiApplication.aggregate([
      { $match: { 'formSchema.fields.props.widgetUsages.widgetId': { $exists: true, $ne: [] } } }, // Ensure widgetUsages exists and is not empty
      { $unwind: '$formSchema.fields' },
      { $unwind: '$formSchema.fields.props.widgetUsages' },
      {
        $group: {
          _id: '$formSchema.fields.props.widgetUsages.widgetId',
          count: { $sum: 1 }
        }
      }
    ]);

    const countsMap = new Map();
    widgetUsageCounts.forEach(item => {
      if (item._id) { // Ensure item._id is not null or undefined
        countsMap.set(item._id.toString(), item.count);
      }
    });

    const populatedList = list.map(widget => {
      const plainWidget = widget.toObject();
      plainWidget.usageCount = countsMap.get(widget._id.toString()) || 0;
      
      // Preserve populated platform name
      if (widget.platform && widget.platform.name && plainWidget.platform) {
         plainWidget.platform = { _id: widget.platform._id.toString(), name: widget.platform.name }; 
      } else if (widget.platform && plainWidget.platform) { // If platform is just an ID
         plainWidget.platform = widget.platform.toString();
      }

      return plainWidget;
    });
    
    res.json({ total, list: populatedList });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// 新建AI挂件
router.post('/', async (req, res) => {
  try {
    const { name, description, platform, apis, status, creditsConsumed } = req.body;
    const widget = await AIWidget.create({ name, description, platform, apis, status, creditsConsumed });
    res.json(widget);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// 编辑AI挂件
router.put('/:id', async (req, res) => {
  try {
    const { name, description, platform, apis, status, creditsConsumed } = req.body;
    const widget = await AIWidget.findByIdAndUpdate(
      req.params.id,
      { name, description, platform, apis, status, creditsConsumed },
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