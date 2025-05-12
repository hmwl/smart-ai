const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define a fixed ID for the single settings document for easy retrieval/update
const SINGLE_SETTING_ID = 'global_credit_settings';

const CreditSettingSchema = new Schema({
  _id: {
    type: String,
    default: SINGLE_SETTING_ID
  },
  initialCredits: {
    type: Number,
    required: [true, '初始积分不能为空'],
    default: 0,
    min: [0, '初始积分不能为负数']
  },
  exchangeRate: { // How many credits for 1 RMB
    type: Number,
    required: [true, '积分兑换比率不能为空'],
    default: 100, // Example: 1 RMB = 100 credits
    min: [0.01, '兑换比率必须大于0'] // Smallest unit for 1 RMB
  },
  paymentPlatforms: [{ // Enabled payment platforms
    type: String,
    enum: ['wechat', 'alipay', 'unionpay', 'unifiedpay'] 
  }]
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Ensure that attempts to create a new document with a different ID are remapped to the fixed ID
CreditSettingSchema.pre('validate', function(next) {
  if (this.isNew && this._id !== SINGLE_SETTING_ID) {
    this._id = SINGLE_SETTING_ID;
  }
  next();
});

module.exports = mongoose.model('CreditSetting', CreditSettingSchema); 