const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const generateCustomId = require('../utils/generateCustomId'); // Import the generator

const aiTypeSchema = new Schema({
  _id: {
    type: String,
    default: () => generateCustomId('AT') // Generate ID on creation
  },
  name: {
    type: String,
    required: [true, 'AI 类型名称不能为空'],
    trim: true,
  },
  uri: {
    type: String,
    required: [true, 'AI 类型 URI 不能为空'],
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        // 不可首字符为数字，只包含字母、数字、下划线、中划线
        return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(v);
      },
      message: props => `${props.value} 是无效的 URI 格式！ URI 必须以字母或下划线开头，且只包含字母、数字、下划线或中划线。`
    }
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'inactive'],
    default: 'active',
    trim: true,
  },
  updatedAt: Date
}, {
  timestamps: true
});

// Add pre-save hook for ID generation (only if NEW)
aiTypeSchema.pre('save', function (next) {
  if (this.isNew && !this._id) { // Ensure ID is set only for new documents
    this._id = generateCustomId('AT');
  }
  next();
});

module.exports = mongoose.model('AiType', aiTypeSchema); 