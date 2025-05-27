const mongoose = require('mongoose');
const generateCustomId = require('../utils/generateCustomId');

const configFieldSchema = new mongoose.Schema({
  key: {
    type: String,
    required: [true, '配置字段key不能为空'],
    trim: true,
  },
  label: {
    type: String,
    required: [true, '配置字段标签不能为空'],
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['text', 'select', 'multiSelect'],
    default: 'text',
  },
  defaultValue: {
    type: mongoose.Schema.Types.Mixed, // 支持字符串或数组（多选）
    default: '',
  },
  options: [{
    key: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: ''
    }
  }], // 用于select和multiSelect类型的选项
  required: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    trim: true,
    default: '',
  }
}, { _id: false });

const platformSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => generateCustomId('PL'), // PL for Platform
  },
  name: {
    type: String,
    required: [true, '平台名称不能为空'],
    trim: true,
    unique: true,
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  configFields: [configFieldSchema], // 配置字段定义
  // usageCount is now calculated dynamically, not stored in database
}, { timestamps: true });

platformSchema.pre('save', function(next) {
  if (this.isNew && !this._idSetted) {
    this._id = generateCustomId('PL');
  }
  delete this._idSetted;
  next();
});

module.exports = mongoose.model('Platform', platformSchema); 