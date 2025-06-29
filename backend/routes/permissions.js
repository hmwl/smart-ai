const express = require('express');
const router = express.Router();
const Permission = require('../models/Permission');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');
const User = require('../models/User');
const authenticateToken = require('../middleware/authenticateToken');
const { hasPermission, hasRole } = require('../middleware/permissionCheck');
const { asyncHandler } = require('../middleware/errorHandler');

// 权限管理路由

/**
 * 获取所有权限列表
 * GET /api/permissions
 */
router.get('/', authenticateToken, hasPermission('permission:read', 'admin'), asyncHandler(async (req, res) => {
  const { scope, module, status, page = 1, limit = 50 } = req.query;
  
  const query = {};
  if (scope) query.scope = { $in: [scope, 'both'] };
  if (module) query.module = module;
  if (status) query.status = status;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [permissions, total] = await Promise.all([
    Permission.find(query)
      .sort({ module: 1, level: 1, name: 1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Permission.countDocuments(query)
  ]);
  
  res.json({
    success: true,
    data: permissions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * 获取权限树
 * GET /api/permissions/tree
 */
router.get('/tree', authenticateToken, hasPermission('permission:read', 'admin'), asyncHandler(async (req, res) => {
  const { scope } = req.query;
  const tree = await Permission.getPermissionTree(scope);
  
  res.json({
    success: true,
    data: tree
  });
}));

/**
 * 创建权限
 * POST /api/permissions
 */
router.post('/', authenticateToken, hasPermission('permission:create', 'admin'), asyncHandler(async (req, res) => {
  const permission = new Permission(req.body);
  await permission.save();
  
  res.status(201).json({
    success: true,
    data: permission,
    message: '权限创建成功'
  });
}));

/**
 * 更新权限
 * PUT /api/permissions/:id
 */
router.put('/:id', authenticateToken, hasPermission('permission:update', 'admin'), asyncHandler(async (req, res) => {
  const permission = await Permission.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  
  if (!permission) {
    return res.status(404).json({
      success: false,
      message: '权限不存在'
    });
  }
  
  res.json({
    success: true,
    data: permission,
    message: '权限更新成功'
  });
}));

/**
 * 删除权限
 * DELETE /api/permissions/:id
 */
router.delete('/:id', authenticateToken, hasPermission('permission:delete', 'admin'), asyncHandler(async (req, res) => {
  const permission = await Permission.findById(req.params.id);
  
  if (!permission) {
    return res.status(404).json({
      success: false,
      message: '权限不存在'
    });
  }
  
  // 检查是否有子权限
  const children = await Permission.find({ parentId: req.params.id });
  if (children.length > 0) {
    return res.status(400).json({
      success: false,
      message: '存在子权限，无法删除'
    });
  }
  
  // 检查是否被角色使用
  const rolesUsingPermission = await Role.find({ permissions: req.params.id });
  if (rolesUsingPermission.length > 0) {
    return res.status(400).json({
      success: false,
      message: '权限正在被角色使用，无法删除'
    });
  }
  
  await Permission.findByIdAndDelete(req.params.id);
  
  res.json({
    success: true,
    message: '权限删除成功'
  });
}));

/**
 * 获取所有角色列表
 * GET /api/permissions/roles
 */
router.get('/roles', authenticateToken, hasPermission('role:read', 'admin'), asyncHandler(async (req, res) => {
  const { scope, status, page = 1, limit = 50 } = req.query;
  
  const query = {};
  if (scope) query.scope = { $in: [scope, 'both'] };
  if (status) query.status = status;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [roles, total] = await Promise.all([
    Role.find(query)
      .populate('permissionDetails')
      .sort({ level: 1, name: 1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Role.countDocuments(query)
  ]);
  
  res.json({
    success: true,
    data: roles,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * 创建角色
 * POST /api/permissions/roles
 */
router.post('/roles', authenticateToken, hasPermission('role:create', 'admin'), asyncHandler(async (req, res) => {
  const roleData = {
    ...req.body,
    createdBy: req.user.userId
  };
  
  const role = new Role(roleData);
  await role.save();
  
  res.status(201).json({
    success: true,
    data: role,
    message: '角色创建成功'
  });
}));

/**
 * 更新角色
 * PUT /api/permissions/roles/:id
 */
router.put('/roles/:id', authenticateToken, hasPermission('role:update', 'admin'), asyncHandler(async (req, res) => {
  const updateData = {
    ...req.body,
    updatedBy: req.user.userId
  };
  
  const role = await Role.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  ).populate('permissionDetails');
  
  if (!role) {
    return res.status(404).json({
      success: false,
      message: '角色不存在'
    });
  }
  
  res.json({
    success: true,
    data: role,
    message: '角色更新成功'
  });
}));

/**
 * 删除角色
 * DELETE /api/permissions/roles/:id
 */
router.delete('/roles/:id', authenticateToken, hasPermission('role:delete', 'admin'), asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  
  if (!role) {
    return res.status(404).json({
      success: false,
      message: '角色不存在'
    });
  }
  
  if (role.isSystem) {
    return res.status(400).json({
      success: false,
      message: '系统角色不能删除'
    });
  }
  
  // 检查是否有用户使用此角色
  const userRoles = await UserRole.find({ roleId: req.params.id, status: 'active' });
  if (userRoles.length > 0) {
    return res.status(400).json({
      success: false,
      message: '角色正在被用户使用，无法删除'
    });
  }
  
  await Role.findByIdAndDelete(req.params.id);
  
  res.json({
    success: true,
    message: '角色删除成功'
  });
}));

/**
 * 获取所有用户角色分配（分页）
 * GET /api/permissions/user-roles
 */
router.get('/user-roles', authenticateToken, hasPermission('user_role:read', 'admin'), asyncHandler(async (req, res) => {
  const { scope, username, page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // 构建查询条件
  const query = {
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

  // 如果有用户名筛选，需要先查找用户
  if (username) {
    const users = await User.find({
      username: new RegExp(username, 'i')
    }).select('_id');
    const userIds = users.map(u => u._id);
    query.userId = { $in: userIds };
  }

  const [userRoles, total] = await Promise.all([
    UserRole.find(query)
      .populate('userDetails')
      .populate('roleDetails')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    UserRole.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: userRoles,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * 获取用户角色分配
 * GET /api/permissions/user-roles/:userId
 */
router.get('/user-roles/:userId', authenticateToken, hasPermission('user_role:read', 'admin'), asyncHandler(async (req, res) => {
  const { scope } = req.query;
  const userRoles = await UserRole.getUserActiveRoles(req.params.userId, scope);

  res.json({
    success: true,
    data: userRoles
  });
}));

/**
 * 分配角色给用户
 * POST /api/permissions/user-roles
 */
router.post('/user-roles', authenticateToken, hasPermission('user_role:create', 'admin'), asyncHandler(async (req, res) => {
  const { userId, roleId, scope, expiresAt, assignReason } = req.body;

  // 检查是否已经在同一scope下分配过
  const existingAssignment = await UserRole.findOne({ userId, roleId, scope });
  if (existingAssignment) {
    return res.status(400).json({
      success: false,
      message: `用户在${scope === 'admin' ? '后台' : '用户端'}已经拥有此角色`
    });
  }

  const userRole = new UserRole({
    userId,
    roleId,
    scope,
    expiresAt,
    assignReason,
    assignedBy: req.user.userId
  });

  await userRole.save();

  res.status(201).json({
    success: true,
    data: userRole,
    message: '角色分配成功'
  });
}));

/**
 * 移除用户角色
 * DELETE /api/permissions/user-roles/:id
 */
router.delete('/user-roles/:id', authenticateToken, hasPermission('user_role:delete', 'admin'), asyncHandler(async (req, res) => {
  const userRole = await UserRole.findByIdAndUpdate(
    req.params.id,
    { status: 'disabled' },
    { new: true }
  );

  if (!userRole) {
    return res.status(404).json({
      success: false,
      message: '用户角色分配不存在'
    });
  }

  res.json({
    success: true,
    message: '角色移除成功'
  });
}));

/**
 * 批量分配角色
 * POST /api/permissions/user-roles/batch
 */
router.post('/user-roles/batch', authenticateToken, hasPermission('user_role:create', 'admin'), asyncHandler(async (req, res) => {
  const { userIds, roleIds, scope, expiresAt, assignReason } = req.body;

  const assignments = await UserRole.assignRoles(
    userIds,
    roleIds,
    req.user.userId,
    scope,
    { reason: assignReason, expiresAt }
  );

  res.status(201).json({
    success: true,
    data: assignments,
    message: `成功分配 ${assignments.length} 个角色`
  });
}));

/**
 * 获取当前用户权限
 * GET /api/permissions/my-permissions
 */
router.get('/my-permissions', authenticateToken, asyncHandler(async (req, res) => {
  const { scope = 'client' } = req.query;

  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: '用户不存在'
    });
  }

  const permissions = await user.getAllPermissions(scope);
  const roles = await user.getUserRoles(scope);

  res.json({
    success: true,
    data: {
      permissions,
      roles: roles.map(ur => ({
        roleId: ur.roleId,
        roleName: ur.roleDetails?.name,
        roleCode: ur.roleDetails?.code,
        scope: ur.scope,
        expiresAt: ur.expiresAt
      }))
    }
  });
}));

module.exports = router;
