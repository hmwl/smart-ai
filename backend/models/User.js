const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
const generateCustomId = require('../utils/generateCustomId'); // Import the generator

const userSchema = new Schema({
  _id: {
    type: String,
    default: () => generateCustomId('US') // Generate ID on creation
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true, // 去除前后空格
    index: true // 添加索引以提高查询效率
  },
  passwordHash: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: false, // 邮箱设为非必需
    unique: true,
    sparse: true, // 允许 email 字段为空，但如果存在则必须唯一
    trim: true,
    lowercase: true // 存储为小写
  },
  nickname: { // New nickname field
    type: String,
    required: false,
    trim: true,
    maxlength: 50 // Optional: set a max length
  },
  status: {
    type: String,
    enum: ['active', 'disabled', 'pending'], // pending for email verification, for example
    default: 'active' // 默认状态为 active
  },
  isAdmin: {
    type: Boolean,
    default: false // 默认不是管理员
  },
  verificationCode: { // For email verification code
    type: String,
    default: null
  },
  verificationCodeExpires: { // Expiration for the code
    type: Date,
    default: null
  },
  resetPasswordToken: { // For password reset
    type: String,
    default: null
  },
  resetPasswordTokenExpires: { // Expiration for the reset token
    type: Date,
    default: null
  },
  lastLoginAt: {
    type: Date,
    default: null
  },
  refreshToken: {
    type: String,
    default: null // 默认没有 refresh token
  },
  refreshTokenExpires: {
    type: Date,
    default: null
  },
  // New field for credits balance
  creditsBalance: {
    type: Number,
    required: true, // Should always have a balance, even if 0
    default: 0,
    min: [0, '积分余额不能为负数']
  }
}, {
  timestamps: true // 自动添加 createdAt 和 updatedAt 字段
});

// Pre-save hook to hash password before saving
userSchema.pre('save', async function (next) {
  // Only generate ID if the document is new (not being updated)
  if (this.isNew) {
    // The default function should handle this, but as a safeguard:
    if (!this._id) {
      this._id = generateCustomId('US');
    }
  }

  // Hash password if it has been modified (or is new)
  // 只有在密码字段真正被修改时才重新哈希
  if (this.isModified('passwordHash')) {
    try {
      // 检查密码是否已经是哈希值（避免重复哈希）
      if (!this.passwordHash.startsWith('$2a$') && !this.passwordHash.startsWith('$2b$')) {
        const salt = await bcrypt.genSalt(10);
        this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
      }
    } catch (error) {
      return next(error);
    }
  }

  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);

module.exports = User; 