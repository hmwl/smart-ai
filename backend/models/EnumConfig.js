const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const generateCustomId = require('../utils/generateCustomId');
const { PLATFORM_TYPES } = require('./ApiEntry'); // Import PLATFORM_TYPES

const enumConfigSchema = new Schema({
  _id: {
    type: String,
    default: () => generateCustomId('EC') // Prefix for EnumConfig
  },
  name: {
    type: String,
    required: [true, '配置名称不能为空'],
    trim: true,
  },
  enumType: {
    type: String,
    ref: 'EnumType',
    required: [true, '类型不能为空'],
  },
  translation: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  platform: {
    type: String,
    required: [true, '平台不能为空'],
    enum: PLATFORM_TYPES, // Use the imported enum
    trim: true,
  },
  isUsed: {
    type: Boolean,
    default: false,
  },
  usageCount: {
    type: Number,
    default: 0,
    min: [0, '使用次数不能为负数']
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'inactive'],
    default: 'active',
    trim: true,
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Pre-save hook for ID generation
enumConfigSchema.pre('save', function (next) {
  if (this.isNew && !this._idSetted) {
    this._id = generateCustomId('EC');
  }
  delete this._idSetted;
  next();
});

enumConfigSchema.virtual('idSetted').set(function(value) {
  this._idSetted = value;
});

module.exports = mongoose.model('EnumConfig', enumConfigSchema);
