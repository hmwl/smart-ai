const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const generateCustomId = require('../utils/generateCustomId');

/**
 * 权限模型
 * 定义系统中的所有权限点
 */
const permissionSchema = new Schema({
  _id: {
    type: String,
    default: () => generateCustomId('PM') // Permission ID
  },
  name: {
    type: String,
    required: [true, '权限名称不能为空'],
    unique: true,
    trim: true,
    index: true
  },
  code: {
    type: String,
    required: [true, '权限代码不能为空'],
    unique: true,
    trim: true,
    index: true,
    // 权限代码格式：模块:操作，如 user:create, user:read, user:update, user:delete
    match: [/^[a-z_]+:[a-z_]+$/, '权限代码格式应为：模块:操作（如 user:create）']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, '权限描述不能超过200个字符']
  },
  module: {
    type: String,
    required: [true, '所属模块不能为空'],
    trim: true,
    index: true
  },
  action: {
    type: String,
    required: [true, '操作类型不能为空'],
    enum: ['create', 'read', 'update', 'delete', 'manage', 'execute', 'view', 'export', 'import'],
    index: true
  },
  scope: {
    type: String,
    enum: ['admin', 'client', 'both'], // 权限适用范围
    required: [true, '权限范围不能为空'],
    default: 'admin',
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active',
    index: true
  },
  // 权限层级，用于权限继承
  level: {
    type: Number,
    default: 1,
    min: [1, '权限层级不能小于1'],
    max: [10, '权限层级不能大于10']
  },
  // 父权限ID，用于构建权限树
  parentId: {
    type: String,
    ref: 'Permission',
    default: null
  },
  // 权限资源路径，用于前端路由控制
  resourcePath: {
    type: String,
    trim: true
  },
  // 权限标签，用于分类和筛选
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// 复合索引
permissionSchema.index({ module: 1, action: 1 });
permissionSchema.index({ scope: 1, status: 1 });
permissionSchema.index({ parentId: 1, level: 1 });

// 虚拟字段：子权限
permissionSchema.virtual('children', {
  ref: 'Permission',
  localField: '_id',
  foreignField: 'parentId'
});

// 静态方法：获取权限树
permissionSchema.statics.getPermissionTree = async function(scope = null) {
  const query = { parentId: null, status: 'active' };
  if (scope) {
    query.scope = { $in: [scope, 'both'] };
  }
  
  const rootPermissions = await this.find(query).sort({ module: 1, level: 1 });
  
  const buildTree = async (permissions) => {
    const result = [];
    for (const permission of permissions) {
      const children = await this.find({ 
        parentId: permission._id, 
        status: 'active',
        ...(scope && { scope: { $in: [scope, 'both'] } })
      }).sort({ level: 1 });
      
      const permissionObj = permission.toObject();
      if (children.length > 0) {
        permissionObj.children = await buildTree(children);
      }
      result.push(permissionObj);
    }
    return result;
  };
  
  return await buildTree(rootPermissions);
};

// 静态方法：根据代码获取权限
permissionSchema.statics.getByCode = function(code) {
  return this.findOne({ code, status: 'active' });
};

// 静态方法：根据模块获取权限
permissionSchema.statics.getByModule = function(module, scope = null) {
  const query = { module, status: 'active' };
  if (scope) {
    query.scope = { $in: [scope, 'both'] };
  }
  return this.find(query).sort({ level: 1 });
};

const Permission = mongoose.model('Permission', permissionSchema);

module.exports = Permission;
