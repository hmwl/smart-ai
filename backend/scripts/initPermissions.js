const mongoose = require('mongoose');
const Permission = require('../models/Permission');
const Role = require('../models/Role');
const User = require('../models/User');
const UserRole = require('../models/UserRole');

// 连接数据库
require('dotenv').config();
const mongoConnectionString = process.env.MONGODB_URI;

/**
 * 初始化权限数据
 */
async function initPermissions() {
  try {
    await mongoose.connect(mongoConnectionString);
    console.log('数据库连接成功');

    // 清除现有权限数据（可选）
    // await Permission.deleteMany({});
    // await Role.deleteMany({});
    // await UserRole.deleteMany({});

    // 创建基础权限
    const permissions = await createBasePermissions();
    console.log(`创建了 ${permissions.length} 个权限`);

    // 创建基础角色
    const roles = await createBaseRoles(permissions);
    console.log(`创建了 ${roles.length} 个角色`);

    // 为超级管理员分配角色
    await assignSuperAdminRole(roles);
    console.log('超级管理员角色分配完成');

    console.log('权限初始化完成');
  } catch (error) {
    console.error('权限初始化失败:', error);
  } finally {
    await mongoose.disconnect();
  }
}

/**
 * 创建基础权限
 */
async function createBasePermissions() {
  const permissionData = [
    // 用户管理权限
    { name: '用户查看', code: 'user:read', module: 'user', action: 'read', scope: 'admin', description: '查看用户列表和详情' },
    { name: '用户创建', code: 'user:create', module: 'user', action: 'create', scope: 'admin', description: '创建新用户' },
    { name: '用户更新', code: 'user:update', module: 'user', action: 'update', scope: 'admin', description: '更新用户信息' },
    { name: '用户删除', code: 'user:delete', module: 'user', action: 'delete', scope: 'admin', description: '删除用户' },
    { name: '用户管理', code: 'user:manage', module: 'user', action: 'manage', scope: 'admin', description: '用户完整管理权限' },

    // 权限管理权限
    { name: '权限查看', code: 'permission:read', module: 'permission', action: 'read', scope: 'admin', description: '查看权限列表' },
    { name: '权限创建', code: 'permission:create', module: 'permission', action: 'create', scope: 'admin', description: '创建新权限' },
    { name: '权限更新', code: 'permission:update', module: 'permission', action: 'update', scope: 'admin', description: '更新权限信息' },
    { name: '权限删除', code: 'permission:delete', module: 'permission', action: 'delete', scope: 'admin', description: '删除权限' },

    // 角色管理权限
    { name: '角色查看', code: 'role:read', module: 'role', action: 'read', scope: 'admin', description: '查看角色列表' },
    { name: '角色创建', code: 'role:create', module: 'role', action: 'create', scope: 'admin', description: '创建新角色' },
    { name: '角色更新', code: 'role:update', module: 'role', action: 'update', scope: 'admin', description: '更新角色信息' },
    { name: '角色删除', code: 'role:delete', module: 'role', action: 'delete', scope: 'admin', description: '删除角色' },

    // 用户角色管理权限
    { name: '用户角色查看', code: 'user_role:read', module: 'user_role', action: 'read', scope: 'admin', description: '查看用户角色分配' },
    { name: '用户角色分配', code: 'user_role:create', module: 'user_role', action: 'create', scope: 'admin', description: '分配角色给用户' },
    { name: '用户角色移除', code: 'user_role:delete', module: 'user_role', action: 'delete', scope: 'admin', description: '移除用户角色' },

    // AI应用管理权限
    { name: 'AI应用查看', code: 'ai_app:read', module: 'ai_app', action: 'read', scope: 'admin', description: '查看AI应用列表' },
    { name: 'AI应用创建', code: 'ai_app:create', module: 'ai_app', action: 'create', scope: 'admin', description: '创建AI应用' },
    { name: 'AI应用更新', code: 'ai_app:update', module: 'ai_app', action: 'update', scope: 'admin', description: '更新AI应用' },
    { name: 'AI应用删除', code: 'ai_app:delete', module: 'ai_app', action: 'delete', scope: 'admin', description: '删除AI应用' },

    // 内容管理权限
    { name: '内容查看', code: 'content:read', module: 'content', action: 'read', scope: 'admin', description: '查看内容列表' },
    { name: '内容创建', code: 'content:create', module: 'content', action: 'create', scope: 'admin', description: '创建内容' },
    { name: '内容更新', code: 'content:update', module: 'content', action: 'update', scope: 'admin', description: '更新内容' },
    { name: '内容删除', code: 'content:delete', module: 'content', action: 'delete', scope: 'admin', description: '删除内容' },

    // 系统设置权限
    { name: '系统设置查看', code: 'system:read', module: 'system', action: 'read', scope: 'admin', description: '查看系统设置' },
    { name: '系统设置更新', code: 'system:update', module: 'system', action: 'update', scope: 'admin', description: '更新系统设置' },

    // 客户端权限
    { name: '个人资料查看', code: 'profile:read', module: 'profile', action: 'read', scope: 'client', description: '查看个人资料' },
    { name: '个人资料更新', code: 'profile:update', module: 'profile', action: 'update', scope: 'client', description: '更新个人资料' },
    { name: 'AI应用使用', code: 'ai_app:execute', module: 'ai_app', action: 'execute', scope: 'client', description: '使用AI应用' },
    { name: '作品查看', code: 'work:read', module: 'work', action: 'read', scope: 'client', description: '查看作品' },
    { name: '作品创建', code: 'work:create', module: 'work', action: 'create', scope: 'client', description: '创建作品' },
  ];

  const permissions = [];
  for (const permData of permissionData) {
    const existing = await Permission.findOne({ code: permData.code });
    if (!existing) {
      const permission = new Permission(permData);
      await permission.save();
      permissions.push(permission);
    } else {
      permissions.push(existing);
    }
  }

  return permissions;
}

/**
 * 创建基础角色
 */
async function createBaseRoles(permissions) {
  const roleData = [
    {
      name: '超级管理员',
      code: 'super_admin',
      description: '系统超级管理员，拥有所有权限',
      scope: 'admin',
      level: 10,
      isSystem: true,
      permissions: permissions.filter(p => p.scope === 'admin' || p.scope === 'both').map(p => p._id)
    },
    {
      name: '系统管理员',
      code: 'system_admin',
      description: '系统管理员，拥有大部分管理权限',
      scope: 'admin',
      level: 8,
      isSystem: true,
      permissions: permissions.filter(p => 
        (p.scope === 'admin' || p.scope === 'both') && 
        !['permission:delete', 'role:delete', 'system:update'].includes(p.code)
      ).map(p => p._id)
    },
    {
      name: '内容管理员',
      code: 'content_admin',
      description: '内容管理员，负责内容和AI应用管理',
      scope: 'admin',
      level: 5,
      isSystem: true,
      permissions: permissions.filter(p => 
        ['content:read', 'content:create', 'content:update', 'content:delete',
         'ai_app:read', 'ai_app:create', 'ai_app:update', 'ai_app:delete'].includes(p.code)
      ).map(p => p._id)
    },
    {
      name: '普通用户',
      code: 'normal_user',
      description: '普通客户端用户',
      scope: 'client',
      level: 1,
      isSystem: true,
      permissions: permissions.filter(p => 
        p.scope === 'client' || p.scope === 'both'
      ).map(p => p._id)
    },
    {
      name: 'VIP用户',
      code: 'vip_user',
      description: 'VIP客户端用户，拥有更多权限',
      scope: 'client',
      level: 3,
      isSystem: true,
      permissions: permissions.filter(p => 
        p.scope === 'client' || p.scope === 'both'
      ).map(p => p._id)
    }
  ];

  const roles = [];
  for (const roleInfo of roleData) {
    const existing = await Role.findOne({ code: roleInfo.code });
    if (!existing) {
      // 为系统角色设置一个默认的创建者
      const roleWithCreator = {
        ...roleInfo,
        createdBy: 'system' // 系统初始化时使用系统作为创建者
      };
      const role = new Role(roleWithCreator);
      await role.save();
      roles.push(role);
    } else {
      roles.push(existing);
    }
  }

  return roles;
}

/**
 * 为超级管理员分配角色
 */
async function assignSuperAdminRole(roles) {
  const superAdminRole = roles.find(r => r.code === 'super_admin');
  if (!superAdminRole) {
    console.log('未找到超级管理员角色');
    return;
  }

  // 查找所有isAdmin为true的用户
  const adminUsers = await User.find({ isAdmin: true });
  
  for (const user of adminUsers) {
    const existing = await UserRole.findOne({ 
      userId: user._id, 
      roleId: superAdminRole._id 
    });
    
    if (!existing) {
      const userRole = new UserRole({
        userId: user._id,
        roleId: superAdminRole._id,
        scope: 'admin',
        assignedBy: user._id, // 自己分配给自己
        assignReason: '系统初始化分配超级管理员角色'
      });
      await userRole.save();
      console.log(`为用户 ${user.username} 分配了超级管理员角色`);
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initPermissions();
}

module.exports = { initPermissions };
