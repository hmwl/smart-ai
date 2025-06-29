const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const generateCustomId = require('../utils/generateCustomId');

/**
 * 角色模型
 * 定义系统中的角色，每个角色包含多个权限
 */
const roleSchema = new Schema({
  _id: {
    type: String,
    default: () => generateCustomId('RL') // Role ID
  },
  name: {
    type: String,
    required: [true, '角色名称不能为空'],
    unique: true,
    trim: true,
    index: true,
    maxlength: [50, '角色名称不能超过50个字符']
  },
  code: {
    type: String,
    required: [true, '角色代码不能为空'],
    unique: true,
    trim: true,
    index: true,
    // 角色代码格式：小写字母和下划线
    match: [/^[a-z_]+$/, '角色代码只能包含小写字母和下划线']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, '角色描述不能超过200个字符']
  },
  scope: {
    type: String,
    enum: ['admin', 'client', 'both'], // 角色适用范围
    required: [true, '角色范围不能为空'],
    default: 'admin',
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active',
    index: true
  },
  // 角色权限列表
  permissions: [{
    type: String,
    ref: 'Permission'
  }],
  // 角色层级，用于角色继承
  level: {
    type: Number,
    default: 1,
    min: [1, '角色层级不能小于1'],
    max: [10, '角色层级不能大于10']
  },
  // 是否为系统内置角色（内置角色不能删除）
  isSystem: {
    type: Boolean,
    default: false
  },
  // 角色标签
  tags: [{
    type: String,
    trim: true
  }],
  // 创建者
  createdBy: {
    type: String,
    ref: 'User'
  },
  // 最后修改者
  updatedBy: {
    type: String,
    ref: 'User'
  }
}, {
  timestamps: true
});

// 复合索引
roleSchema.index({ scope: 1, status: 1 });
roleSchema.index({ level: 1, scope: 1 });

// 虚拟字段：权限详情
roleSchema.virtual('permissionDetails', {
  ref: 'Permission',
  localField: 'permissions',
  foreignField: '_id'
});

// 实例方法：检查是否有指定权限
roleSchema.methods.hasPermission = function(permissionCode) {
  return this.populated('permissionDetails') 
    ? this.permissionDetails.some(p => p.code === permissionCode && p.status === 'active')
    : false;
};

// 实例方法：添加权限
roleSchema.methods.addPermission = function(permissionId) {
  if (!this.permissions.includes(permissionId)) {
    this.permissions.push(permissionId);
  }
  return this;
};

// 实例方法：移除权限
roleSchema.methods.removePermission = function(permissionId) {
  this.permissions = this.permissions.filter(p => p !== permissionId);
  return this;
};

// 静态方法：根据代码获取角色
roleSchema.statics.getByCode = function(code) {
  return this.findOne({ code, status: 'active' }).populate('permissionDetails');
};

// 静态方法：根据范围获取角色
roleSchema.statics.getByScope = function(scope) {
  const query = { status: 'active' };
  if (scope) {
    query.scope = { $in: [scope, 'both'] };
  }
  return this.find(query).populate('permissionDetails').sort({ level: 1, name: 1 });
};

// 静态方法：获取系统角色
roleSchema.statics.getSystemRoles = function() {
  return this.find({ isSystem: true, status: 'active' }).populate('permissionDetails');
};

// 预处理中间件：保存前验证
roleSchema.pre('save', async function(next) {
  if (this.isNew) {
    // 新角色创建时的验证
    if (!this.createdBy) {
      return next(new Error('创建者不能为空'));
    }
  } else {
    // 更新时的验证
    if (this.isSystem && this.isModified('isSystem')) {
      return next(new Error('不能修改系统角色的系统标识'));
    }
  }
  next();
});

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;
