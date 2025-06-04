const mongoose = require('mongoose');
const { Schema } = mongoose;
const generateCustomId = require('../utils/generateCustomId');

const announcementSchema = new Schema({
  _id: {
    type: String,
    default: () => generateCustomId('AN')
  },
  title: { type: String, required: true },
  type: { type: String, required: true },
  summary: { type: String },
  content: { type: String, required: true },
  status: { type: String, default: 'draft' },
  publishType: { type: String, default: 'draft' },
  isPopup: { type: Boolean, default: false },
  popupDays: { type: Number, default: 0 },
  popupStartDate: { type: Date },
  readStats: [{ date: String, count: Number }], // [{date: '2024-06-01', count: 10}]
  publisher: { type: String }, // 可关联管理员ID，先用字符串
  effectiveAt: { type: Date },
  popupTime: { type: String }, // 展示弹窗时间段
}, { versionKey: false, timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema); 