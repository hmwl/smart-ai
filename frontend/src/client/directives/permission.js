/**
 * 权限指令
 * 用于在模板中控制元素的显示/隐藏
 */

import { useAuthStore } from '../stores/authStore';

/**
 * 权限检查指令
 * 使用方式：
 * v-permission="'user:create'"
 * v-permission="['user:create', 'user:update']"
 * v-permission:admin="'user:create'"
 * v-permission:client="'profile:update'"
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
 * v-role:admin="'super_admin'"
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
 * 用户类型检查指令
 * 使用方式：
 * v-user-type="'admin'"
 * v-user-type="['admin', 'client']"
 */
const userType = {
  mounted(el, binding) {
    checkUserType(el, binding);
  },
  updated(el, binding) {
    checkUserType(el, binding);
  }
};

/**
 * 检查权限
 */
async function checkPermission(el, binding) {
  const { value, arg } = binding;
  const scope = arg || 'client'; // 默认为客户端权限
  
  if (!value) {
    console.warn('v-permission指令需要提供权限值');
    return;
  }

  const authStore = useAuthStore();
  if (!authStore.isLoggedIn.value) {
    hideElement(el);
    return;
  }

  try {
    const permissions = Array.isArray(value) ? value : [value];
    const hasPermission = await checkUserPermissions(permissions, scope);
    
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
  const { value, arg } = binding;
  const scope = arg || 'client';
  
  if (!value) {
    console.warn('v-role指令需要提供角色值');
    return;
  }

  const authStore = useAuthStore();
  if (!authStore.isLoggedIn.value) {
    hideElement(el);
    return;
  }

  try {
    const roles = Array.isArray(value) ? value : [value];
    const hasRole = await checkUserRoles(roles, scope);
    
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
 * 检查用户类型
 */
function checkUserType(el, binding) {
  const { value } = binding;
  
  if (!value) {
    console.warn('v-user-type指令需要提供用户类型值');
    return;
  }

  const authStore = useAuthStore();
  if (!authStore.isLoggedIn.value || !authStore.userData.value) {
    hideElement(el);
    return;
  }

  const userTypes = Array.isArray(value) ? value : [value];
  const currentUserType = authStore.userData.value.userType || 'client';
  
  if (!userTypes.includes(currentUserType)) {
    hideElement(el);
  } else {
    showElement(el);
  }
}

/**
 * 检查用户权限
 */
async function checkUserPermissions(permissions, scope) {
  try {
    const response = await fetch('/api/permissions/my-permissions?' + new URLSearchParams({ scope }), {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('clientAccessToken')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('权限查询失败');
    }
    
    const data = await response.json();
    const userPermissions = data.data.permissions || [];
    
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
async function checkUserRoles(roles, scope) {
  try {
    const response = await fetch('/api/permissions/my-permissions?' + new URLSearchParams({ scope }), {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('clientAccessToken')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('角色查询失败');
    }
    
    const data = await response.json();
    const userRoles = data.data.roles || [];
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
  async hasPermission(permission, scope = 'client') {
    return await checkUserPermissions([permission], scope);
  },

  /**
   * 检查是否有任一权限
   */
  async hasAnyPermission(permissions, scope = 'client') {
    return await checkUserPermissions(permissions, scope);
  },

  /**
   * 检查是否有角色
   */
  async hasRole(role, scope = 'client') {
    return await checkUserRoles([role], scope);
  },

  /**
   * 检查是否有任一角色
   */
  async hasAnyRole(roles, scope = 'client') {
    return await checkUserRoles(roles, scope);
  },

  /**
   * 检查用户类型
   */
  hasUserType(userType) {
    const authStore = useAuthStore();
    if (!authStore.isLoggedIn.value || !authStore.userData.value) {
      return false;
    }
    
    const currentUserType = authStore.userData.value.userType || 'client';
    const types = Array.isArray(userType) ? userType : [userType];
    return types.includes(currentUserType);
  }
};

// 导出指令
export default {
  permission,
  role,
  userType
};

// 安装函数
export function install(app) {
  app.directive('permission', permission);
  app.directive('role', role);
  app.directive('user-type', userType);
}
