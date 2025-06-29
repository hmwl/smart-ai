const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const generateCustomId = require('../utils/generateCustomId');

/**
 * 用户角色关联模型
 * 管理用户和角色的多对多关系
 */
const userRoleSchema = new Schema({
  _id: {
    type: String,
    default: () => generateCustomId('UR') // UserRole ID
  },
  userId: {
    type: String,
    ref: 'User',
    required: [true, '用户ID不能为空'],
    index: true
  },
  roleId: {
    type: String,
    ref: 'Role',
    required: [true, '角色ID不能为空'],
    index: true
  },
  // 角色分配范围
  scope: {
    type: String,
    enum: ['admin', 'client'],
    required: [true, '角色范围不能为空'],
    index: true
  },
  // 角色状态
  status: {
    type: String,
    enum: ['active', 'disabled', 'expired'],
    default: 'active',
    index: true
  },
  // 角色生效时间
  effectiveAt: {
    type: Date,
    default: Date.now
  },
  // 角色过期时间（可选）
  expiresAt: {
    type: Date,
    default: null
  },
  // 分配者
  assignedBy: {
    type: String,
    ref: 'User',
    required: [true, '分配者不能为空']
  },
  // 分配原因
  assignReason: {
    type: String,
    trim: true,
    maxlength: [200, '分配原因不能超过200个字符']
  },
  // 额外权限（在角色基础上的补充权限）
  additionalPermissions: [{
    type: String,
    ref: 'Permission'
  }],
  // 受限权限（从角色中排除的权限）
  restrictedPermissions: [{
    type: String,
    ref: 'Permission'
  }]
}, {
  timestamps: true
});

// 复合索引
userRoleSchema.index({ userId: 1, scope: 1 });
userRoleSchema.index({ roleId: 1, status: 1 });
userRoleSchema.index({ userId: 1, roleId: 1, scope: 1 }, { unique: true }); // 防止在同一scope下重复分配
userRoleSchema.index({ expiresAt: 1 }); // 用于过期检查

// 虚拟字段：用户详情
userRoleSchema.virtual('userDetails', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// 虚拟字段：角色详情
userRoleSchema.virtual('roleDetails', {
  ref: 'Role',
  localField: 'roleId',
  foreignField: '_id',
  justOne: true
});

// 虚拟字段：额外权限详情
userRoleSchema.virtual('additionalPermissionDetails', {
  ref: 'Permission',
  localField: 'additionalPermissions',
  foreignField: '_id'
});

// 虚拟字段：受限权限详情
userRoleSchema.virtual('restrictedPermissionDetails', {
  ref: 'Permission',
  localField: 'restrictedPermissions',
  foreignField: '_id'
});

// 实例方法：检查角色是否有效
userRoleSchema.methods.isValid = function() {
  const now = new Date();
  return this.status === 'active' && 
         this.effectiveAt <= now && 
         (!this.expiresAt || this.expiresAt > now);
};

// 实例方法：检查角色是否过期
userRoleSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt <= new Date();
};

// 静态方法：获取用户的有效角色
userRoleSchema.statics.getUserActiveRoles = function(userId, scope = null) {
  const query = {
    userId,
    status: 'active',
    effectiveAt: { $lte: new Date() },
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  };
  
  if (scope) {
    query.scope = scope;
  }
  
  return this.find(query)
    .populate('roleDetails')
    .populate('additionalPermissionDetails')
    .populate('restrictedPermissionDetails')
    .sort({ createdAt: -1 });
};

// 静态方法：获取角色的所有用户
userRoleSchema.statics.getRoleUsers = function(roleId, scope = null) {
  const query = {
    roleId,
    status: 'active',
    effectiveAt: { $lte: new Date() },
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  };
  
  if (scope) {
    query.scope = scope;
  }
  
  return this.find(query)
    .populate('userDetails')
    .sort({ createdAt: -1 });
};

// 静态方法：批量分配角色
userRoleSchema.statics.assignRoles = async function(userIds, roleIds, assignedBy, scope, options = {}) {
  const assignments = [];
  
  for (const userId of userIds) {
    for (const roleId of roleIds) {
      assignments.push({
        userId,
        roleId,
        scope,
        assignedBy,
        assignReason: options.reason || '批量分配',
        expiresAt: options.expiresAt || null
      });
    }
  }
  
  return this.insertMany(assignments, { ordered: false });
};

// 预处理中间件：保存前验证
userRoleSchema.pre('save', async function(next) {
  // 检查过期时间
  if (this.expiresAt && this.expiresAt <= this.effectiveAt) {
    return next(new Error('过期时间不能早于生效时间'));
  }
  
  // 检查是否已过期
  if (this.isExpired() && this.status === 'active') {
    this.status = 'expired';
  }
  
  next();
});

const UserRole = mongoose.model('UserRole', userRoleSchema);

module.exports = UserRole;
