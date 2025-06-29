const User = require('../models/User');
const Permission = require('../models/Permission');
const Role = require('../models/Role');

/**
 * 权限检查中间件
 * 支持多种权限检查方式
 */

/**
 * 检查用户是否有指定权限
 * @param {string|Array} permissions - 权限代码或权限代码数组
 * @param {string} scope - 权限范围 ('admin' | 'client')
 * @param {string} operator - 操作符 ('AND' | 'OR')，当permissions为数组时使用
 */
const hasPermission = (permissions, scope = 'admin', operator = 'OR') => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          message: '未认证用户'
        });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 检查用户状态
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: '用户已被禁用'
        });
      }

      if (user.permissionStatus === 'suspended') {
        return res.status(403).json({
          success: false,
          message: '用户权限已被暂停'
        });
      }

      // 超级管理员直接通过（保留向后兼容）
      if (user.isAdmin && scope === 'admin') {
        return next();
      }

      // 权限检查
      const permissionList = Array.isArray(permissions) ? permissions : [permissions];
      const results = await Promise.all(
        permissionList.map(permission => user.hasPermission(permission, scope))
      );

      let hasAccess = false;
      if (operator === 'AND') {
        hasAccess = results.every(result => result === true);
      } else {
        hasAccess = results.some(result => result === true);
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: '权限不足',
          requiredPermissions: permissionList,
          scope: scope
        });
      }

      next();
    } catch (error) {
      console.error('权限检查错误:', error);
      res.status(500).json({
        success: false,
        message: '权限检查失败'
      });
    }
  };
};

/**
 * 检查用户是否有指定角色
 * @param {string|Array} roles - 角色代码或角色代码数组
 * @param {string} scope - 角色范围
 * @param {string} operator - 操作符
 */
const hasRole = (roles, scope = 'admin', operator = 'OR') => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          message: '未认证用户'
        });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 超级管理员直接通过
      if (user.isAdmin && scope === 'admin') {
        return next();
      }

      const roleList = Array.isArray(roles) ? roles : [roles];
      const results = await Promise.all(
        roleList.map(role => user.hasRole(role, scope))
      );

      let hasAccess = false;
      if (operator === 'AND') {
        hasAccess = results.every(result => result === true);
      } else {
        hasAccess = results.some(result => result === true);
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: '角色权限不足',
          requiredRoles: roleList,
          scope: scope
        });
      }

      next();
    } catch (error) {
      console.error('角色检查错误:', error);
      res.status(500).json({
        success: false,
        message: '角色检查失败'
      });
    }
  };
};

/**
 * 检查用户类型
 * @param {string|Array} userTypes - 用户类型或用户类型数组
 */
const hasUserType = (userTypes) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          message: '未认证用户'
        });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '用户不存在'
        });
      }

      const typeList = Array.isArray(userTypes) ? userTypes : [userTypes];
      if (!typeList.includes(user.userType)) {
        return res.status(403).json({
          success: false,
          message: '用户类型权限不足',
          requiredTypes: typeList,
          currentType: user.userType
        });
      }

      next();
    } catch (error) {
      console.error('用户类型检查错误:', error);
      res.status(500).json({
        success: false,
        message: '用户类型检查失败'
      });
    }
  };
};

/**
 * 组合权限检查
 * 支持复杂的权限组合逻辑
 */
const complexPermissionCheck = (config) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          message: '未认证用户'
        });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '用户不存在'
        });
      }

      // 超级管理员直接通过
      if (user.isAdmin && config.scope === 'admin') {
        return next();
      }

      // 执行复杂权限检查逻辑
      const hasAccess = await evaluatePermissionConfig(user, config);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: '权限不足',
          config: config
        });
      }

      next();
    } catch (error) {
      console.error('复杂权限检查错误:', error);
      res.status(500).json({
        success: false,
        message: '权限检查失败'
      });
    }
  };
};

/**
 * 评估权限配置
 */
async function evaluatePermissionConfig(user, config) {
  // 这里可以实现复杂的权限逻辑
  // 例如：(role1 AND permission1) OR (role2 AND permission2)
  // 暂时简化实现
  if (config.permissions) {
    const permissionResults = await Promise.all(
      config.permissions.map(p => user.hasPermission(p, config.scope))
    );
    return permissionResults.some(result => result === true);
  }
  
  if (config.roles) {
    const roleResults = await Promise.all(
      config.roles.map(r => user.hasRole(r, config.scope))
    );
    return roleResults.some(result => result === true);
  }
  
  return false;
}

module.exports = {
  hasPermission,
  hasRole,
  hasUserType,
  complexPermissionCheck
};
