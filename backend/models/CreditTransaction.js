const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const generateCustomId = require('../utils/generateCustomId');

const CreditTransactionSchema = new Schema({
  _id: {
    type: String,
    default: () => generateCustomId('CT') // Credit Transaction ID
  },
  user: {
    type: String, // Storing User _id as String
    ref: 'User',
    required: [true, '用户ID不能为空']
  },
  type: {
    type: String,
    enum: ['consumption', 'topup', 'refund', 'grant', 'adjustment'],
    required: [true, '交易类型不能为空']
  },
  aiApplication: {
    type: String, // Storing AiApplication _id as String
    ref: 'AiApplication',
    default: null // Optional, only for 'consumption' type
  },
  creditsChanged: {
    type: Number,
    required: [true, '积分变动数量不能为空']
  },
  balanceBefore: {
    type: Number,
    required: [true, '交易前余额不能为空']
  },
  balanceAfter: {
    type: Number,
    required: [true, '交易后余额不能为空']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, '描述信息不能超过200个字符'],
    default: ''
  },
  referenceId: { // For external references like payment ID, promo code etc.
    type: String,
    trim: true,
    default: null
  },
  promotionActivity: {
    type: String,
    ref: 'PromotionActivity',
    default: null
  },
  relatedOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  transactionDetails: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Pre-save hook for ID generation (if not using default directly in schema for some reason)
// CreditTransactionSchema.pre('save', function(next) {
//   if (this.isNew && !this._id) {
//     this._id = generateCustomId('CT');
//   }
//   next();
// });

module.exports = mongoose.model('CreditTransaction', CreditTransactionSchema); 