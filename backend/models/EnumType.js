const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const generateCustomId = require('../utils/generateCustomId');
const Platform = require('./Platform'); // For dynamic platform validation

const enumTypeSchema = new Schema({
  _id: {
    type: String,
    default: () => generateCustomId('ET') // Prefix for EnumType
  },
  name: {
    type: String,
    required: [true, '类型名称不能为空'],
    trim: true,
  },
  platform: {
    type: String,
    required: [true, '平台不能为空'],
    trim: true,
    // Remove static enum validation, will validate dynamically in pre-save hook
  },
  isUsed: {
    type: Boolean,
    default: false,
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

// Pre-save hook for platform validation and ID generation
enumTypeSchema.pre('save', async function (next) {
  // Validate platform against active platforms
  if (this.isNew || this.isModified('platform')) {
    try {
      const platformDoc = await Platform.findOne({ name: this.platform, status: 'active' });
      if (!platformDoc) {
        return next(new Error(`无效或未激活的平台类型: ${this.platform}`));
      }
    } catch (error) {
      return next(error);
    }
  }

  // ID generation
  if (this.isNew && !this._idSetted) {
    this._id = generateCustomId('ET');
  }
  delete this._idSetted;
  next();
});

enumTypeSchema.virtual('idSetted').set(function(value) {
  this._idSetted = value;
});

module.exports = mongoose.model('EnumType', enumTypeSchema);
