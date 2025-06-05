const mongoose = require('mongoose');
const { Schema } = mongoose;
const generateCustomId = require('../utils/generateCustomId'); // 路径根据实际情况调整

const AIWidgetSchema = new Schema({
  _id: {
    type: String,
    default: () => generateCustomId('WG') // WG 代表 Widget，可自定义前缀
  },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  platform: { type: String, ref: 'Platform', required: true },
  apis: [{ type: String, ref: 'ApiEntry' }],
  status: { type: String, enum: ['enabled', 'disabled'], default: 'enabled' },
  usageCount: { type: Number, default: 0 },
  creditsConsumed: {
    type: Number,
    required: [true, '消耗积分不能为空'],
    default: 0,
    min: [0, '消耗积分不能为负数'],
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} 不是一个有效的整数积分值'
    }
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('AIWidget', AIWidgetSchema); 