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
}, {
  timestamps: true
});

module.exports = mongoose.model('AIWidget', AIWidgetSchema); 