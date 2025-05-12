const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const generateCustomId = require('../utils/generateCustomId'); // Import the generator

const applicationSchema = new Schema({
  _id: {
    type: String,
    default: () => generateCustomId('AP') // Generate ID on creation
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['website', 'miniapp'], // 应用类型
    index: true
  },
  owner: {
    type: String,
    ref: 'User', // 关联到 User 模型
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active',
    index: true
  },
  config: { // 用于存储特定类型的配置，例如 website 的 URL 或 miniapp ID
    type: Object,
    default: {}
  },
  // 可以添加其他字段，例如应用的描述、图标等
  // description: { type: String, trim: true },
  // iconUrl: { type: String, trim: true }
}, {
  timestamps: true // 自动添加 createdAt 和 updatedAt
});

applicationSchema.pre('save', function (next) {
  if (this.isNew && !this._id) { // Ensure ID is set only for new documents
    this._id = generateCustomId('AP');
  }
  next();
});

const Application = mongoose.model('Application', applicationSchema);

module.exports = Application; 