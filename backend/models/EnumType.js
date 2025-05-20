const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const generateCustomId = require('../utils/generateCustomId');
const { PLATFORM_TYPES } = require('./ApiEntry'); // Import PLATFORM_TYPES

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
    enum: PLATFORM_TYPES, // Use the imported enum
    trim: true,
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

// Pre-save hook for ID generation if not already set
enumTypeSchema.pre('save', function (next) {
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
