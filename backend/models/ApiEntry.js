const mongoose = require('mongoose');
const generateCustomId = require('../utils/generateCustomId'); // Import the generator
const Platform = require('./Platform'); // Import Platform model

// const PLATFORM_TYPES = ['ComfyUI', 'OpenAI', 'StabilityAI', 'Midjourney', 'DallE', 'Custom']; // No longer needed, will fetch from Platform model

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
  platformType: { // This will now store the *name* of the platform from the Platform model
    type: String,
    required: [true, '平台类型不能为空'],
    // We will validate this against the Platform model names in the route or pre-save hook
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
  platform: { // Reference to the Platform document
    type: String, 
    ref: 'Platform',
    required: [true, '平台ID不能为空']
  }
}, { timestamps: true }); // 添加 timestamps 自动管理 createdAt 和 updatedAt

// 添加索引以提高查询效率
apiEntrySchema.index({ platformName: 1 });
apiEntrySchema.index({ status: 1 });
apiEntrySchema.index({ platformType: 1 }); // Added index for platformType
apiEntrySchema.index({ platform: 1 }); // Index for the platform reference

// Pre-save hook to validate platformType against Platform model and set platform ID
apiEntrySchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('platformType')) {
    try {
      const platformDoc = await Platform.findOne({ name: this.platformType, status: 'active' });
      if (!platformDoc) {
        return next(new Error(`无效或未激活的平台类型: ${this.platformType}`));
      }
      // Only set platform ID if it's not already set or if platformType changed
      if (!this.platform || this.isModified('platformType')) {
        this.platform = platformDoc._id;
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Remove the automatic usageCount increment/decrement hooks
// Platform usageCount will be calculated dynamically in the routes

module.exports = mongoose.model('ApiEntry', apiEntrySchema);
// module.exports.PLATFORM_TYPES = PLATFORM_TYPES; // No longer exporting this static array 