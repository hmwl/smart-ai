/**
 * 管理后台权限指令
 * 用于在管理后台模板中控制元素的显示/隐藏
 */

import apiService from '../services/apiService';

/**
 * 权限检查指令
 * 使用方式：
 * v-permission="'user:create'"
 * v-permission="['user:create', 'user:update']"
 */
const permission = {
  mounted(el, binding) {
    checkPermission(el, binding);
  },
  updated(el, binding) {
    checkPermission(el, binding);
  }
};

/**
 * 角色检查指令
 * 使用方式：
 * v-role="'admin'"
 * v-role="['admin', 'manager']"
 */
const role = {
  mounted(el, binding) {
    checkRole(el, binding);
  },
  updated(el, binding) {
    checkRole(el, binding);
  }
};

/**
 * 检查权限
 */
async function checkPermission(el, binding) {
  const { value } = binding;
  
  if (!value) {
    console.warn('v-permission指令需要提供权限值');
    return;
  }

  // 检查是否有token
  const token = localStorage.getItem('accessToken');
  if (!token) {
    hideElement(el);
    return;
  }

  try {
    const permissions = Array.isArray(value) ? value : [value];
    const hasPermission = await checkUserPermissions(permissions);
    
    if (!hasPermission) {
      hideElement(el);
    } else {
      showElement(el);
    }
  } catch (error) {
    console.error('权限检查失败:', error);
    hideElement(el);
  }
}

/**
 * 检查角色
 */
async function checkRole(el, binding) {
  const { value } = binding;
  
  if (!value) {
    console.warn('v-role指令需要提供角色值');
    return;
  }

  // 检查是否有token
  const token = localStorage.getItem('accessToken');
  if (!token) {
    hideElement(el);
    return;
  }

  try {
    const roles = Array.isArray(value) ? value : [value];
    const hasRole = await checkUserRoles(roles);
    
    if (!hasRole) {
      hideElement(el);
    } else {
      showElement(el);
    }
  } catch (error) {
    console.error('角色检查失败:', error);
    hideElement(el);
  }
}

/**
 * 检查用户权限
 */
async function checkUserPermissions(permissions) {
  try {
    const response = await apiService.getMyPermissions({ scope: 'admin' });
    const userPermissions = response.data.data.permissions || [];
    
    // 检查是否拥有所需权限
    return permissions.some(permission => userPermissions.includes(permission));
  } catch (error) {
    console.error('权限查询失败:', error);
    return false;
  }
}

/**
 * 检查用户角色
 */
async function checkUserRoles(roles) {
  try {
    const response = await apiService.getMyPermissions({ scope: 'admin' });
    const userRoles = response.data.data.roles || [];
    const userRoleCodes = userRoles.map(r => r.roleCode);
    
    // 检查是否拥有所需角色
    return roles.some(role => userRoleCodes.includes(role));
  } catch (error) {
    console.error('角色查询失败:', error);
    return false;
  }
}

/**
 * 隐藏元素
 */
function hideElement(el) {
  if (!el._originalDisplay) {
    el._originalDisplay = el.style.display || '';
  }
  el.style.display = 'none';
}

/**
 * 显示元素
 */
function showElement(el) {
  if (el._originalDisplay !== undefined) {
    el.style.display = el._originalDisplay;
  } else {
    el.style.display = '';
  }
}

/**
 * 权限检查工具函数
 * 可以在JavaScript中使用
 */
export const permissionUtils = {
  /**
   * 检查是否有权限
   */
  async hasPermission(permission) {
    return await checkUserPermissions([permission]);
  },

  /**
   * 检查是否有任一权限
   */
  async hasAnyPermission(permissions) {
    return await checkUserPermissions(permissions);
  },

  /**
   * 检查是否有角色
   */
  async hasRole(role) {
    return await checkUserRoles([role]);
  },

  /**
   * 检查是否有任一角色
   */
  async hasAnyRole(roles) {
    return await checkUserRoles(roles);
  },

  /**
   * 获取当前用户权限
   */
  async getCurrentUserPermissions() {
    try {
      const response = await apiService.getMyPermissions({ scope: 'admin' });
      return response.data.data;
    } catch (error) {
      console.error('获取用户权限失败:', error);
      return { permissions: [], roles: [] };
    }
  }
};

// 导出指令
export default {
  permission,
  role
};

// 安装函数
export function install(app) {
  app.directive('permission', permission);
  app.directive('role', role);
}
