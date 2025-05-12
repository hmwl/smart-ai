const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const generateCustomId = require('../utils/generateCustomId');

const PromotionActivitySchema = new Schema({
  _id: {
    type: String,
    default: () => generateCustomId('PA') // Promotion Activity ID
  },
  name: {
    type: String,
    required: [true, '活动名称不能为空'],
    trim: true,
    maxlength: [100, '活动名称不能超过100个字符']
  },
  startTime: {
    type: Date,
    required: [true, '活动开始时间不能为空']
  },
  endTime: {
    type: Date,
    required: [true, '活动结束时间不能为空']
  },
  isEnabled: {
    type: Boolean,
    default: false,
    required: true
  },
  activityType: {
    type: String,
    enum: ['recharge_discount', 'usage_discount'], //充值折扣, 使用折扣
    required: [true, '活动类型不能为空']
  },
  // Flexible field for type-specific data
  // e.g., for recharge_discount: { conditions: [{minRecharge: 100, bonusCredits: 10, discountPercentage: 5}], limitPerUser: 1 }
  // e.g., for usage_discount: {対象应用: [appId1, appId2], discountPercentage: 10, maxDiscountAmount: 50}
  activityDetails: {
    type: Schema.Types.Mixed,
    default: {}
  },
  remarks: {
    type: String,
    trim: true,
    maxlength: [500, '备注信息不能超过500个字符']
  },
  createdBy: {
    type: String, // Storing User _id as String
    ref: 'User',
    required: true
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Index for common query fields
PromotionActivitySchema.index({ name: 1 });
PromotionActivitySchema.index({ activityType: 1 });
PromotionActivitySchema.index({ startTime: 1, endTime: 1 });
PromotionActivitySchema.index({ isEnabled: 1 }); // Index for the new field

// Virtual for calculated effective status
PromotionActivitySchema.virtual('effectiveStatus').get(function() {
  if (!this.isEnabled) {
    return 'disabled'; // 已禁用
  }
  const now = new Date();
  if (now < this.startTime) {
    return 'not_started'; // 未开始
  }
  if (now > this.endTime) {
    return 'ended'; // 已结束
  }
  return 'ongoing'; // 进行中
});

// Ensure virtuals are included in toJSON and toObject outputs
PromotionActivitySchema.set('toJSON', { virtuals: true });
PromotionActivitySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PromotionActivity', PromotionActivitySchema); 