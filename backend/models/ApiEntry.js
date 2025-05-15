const mongoose = require('mongoose');
const generateCustomId = require('../utils/generateCustomId'); // Import the generator

const PLATFORM_TYPES = ['ComfyUI', 'OpenAI', 'StabilityAI', 'Midjourney', 'DallE', 'Custom']; // Added 'Custom' for flexibility

const apiEntrySchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => generateCustomId('AE') // AE for Api Entry
  },
  platformName: {
    type: String,
    required: [true, '平台实例名称不能为空'], // Changed help text slightly
    trim: true,
  },
  platformType: { // New field
    type: String,
    required: [true, '平台类型不能为空'],
    enum: PLATFORM_TYPES,
  },
  description: {
    type: String,
    trim: true,
  },
  apiUrl: {
    type: String,
    required: [true, 'API 地址不能为空'],
    trim: true,
    unique: true, // API 地址应该是唯一的
    // Basic URL format validation (can be enhanced)
    match: [/^https?:\/\/.+/, '请输入有效的 API 地址 (以 http:// 或 https:// 开头)']
  },
  config: { // New field for platform-specific configurations
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'inactive'],
    default: 'active',
  },
}, { timestamps: true }); // 添加 timestamps 自动管理 createdAt 和 updatedAt

// 添加索引以提高查询效率
apiEntrySchema.index({ platformName: 1 });
apiEntrySchema.index({ status: 1 });
apiEntrySchema.index({ platformType: 1 }); // Added index for platformType

module.exports = mongoose.model('ApiEntry', apiEntrySchema);
module.exports.PLATFORM_TYPES = PLATFORM_TYPES; // Exporting for use elsewhere 