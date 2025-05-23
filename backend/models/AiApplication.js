const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const generateCustomId = require('../utils/generateCustomId'); // Import the generator
const Platform = require('./Platform'); // For dynamic platform validation

const aiApplicationSchema = new Schema({
  _id: {
    type: String,
    default: () => generateCustomId('AI') // Generate ID on creation
  },
  name: {
    type: String,
    required: [true, 'AI 应用名称不能为空'],
    trim: true,
    maxlength: [100, 'AI 应用名称不能超过100个字符']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, '简介不能超过500个字符']
  },
  tags: [{
    type: String,
    trim: true
  }],
  coverImageUrl: {
    type: String, // 存储上传后的图片访问 URL
    trim: true,
  },
  platformType: { // New field
    type: String,
    required: [true, '平台类型不能为空'],
    // Remove static enum validation, will validate dynamically in pre-save hook
  },
  apis: [{
    type: String,
    ref: 'ApiEntry' // 关联到 API 管理的模型
  }],
  type: {
    type: String,
    ref: 'AiType', // 关联到 AI 类型模型
    required: [true, 'AI 应用类型不能为空'],
  },
  formSchema: {
    type: Schema.Types.Mixed, // To store potentially complex/nested JSON for form structure
    default: null // Or {} if you prefer an empty object as default
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active',
  },
  // 考虑是否需要 owner 字段，如果需要区分创建者的话
  // owner: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'User',
  //   required: true
  // },
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
  updatedAt: Date
}, {
  timestamps: true // 添加 createdAt 和 updatedAt 字段
});

// Add pre-save hook for platform validation and ID generation
aiApplicationSchema.pre('save', async function (next) {
  // Validate platform against active platforms
  if (this.isNew || this.isModified('platformType')) {
    try {
      const platformDoc = await Platform.findOne({ name: this.platformType, status: 'active' });
      if (!platformDoc) {
        return next(new Error(`无效或未激活的平台类型: ${this.platformType}`));
      }
    } catch (error) {
      return next(error);
    }
  }

  // ID generation
  if (this.isNew && !this._id) { // Ensure ID is set only for new documents
    this._id = generateCustomId('AI');
  }
  this.updatedAt = new Date(); // Explicitly set updatedAt on every save
  next();
});

module.exports = mongoose.model('AiApplication', aiApplicationSchema); 