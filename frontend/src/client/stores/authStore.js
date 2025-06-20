/**
 * 认证状态管理
 * 统一管理用户认证状态，避免在多个组件中重复逻辑
 */

import { ref, computed, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import apiClient from '../services/apiService';

// 全局状态
const clientAccessToken = ref(localStorage.getItem('clientAccessToken'));
const userData = ref(null);
const loadingUserData = ref(false);

// 计算属性
const isLoggedIn = computed(() => !!clientAccessToken.value);

// 监听token变化，同步到localStorage
watch(clientAccessToken, (newToken) => {
  if (newToken) {
    localStorage.setItem('clientAccessToken', newToken);
  } else {
    localStorage.removeItem('clientAccessToken');
    localStorage.removeItem('clientUserInfo');
    userData.value = null;
  }
}, { immediate: false });

/**
 * 登录
 */
const login = async (credentials) => {
  try {
    const response = await apiClient.post('/auth/client/login', credentials);
    const { token, user } = response.data;
    
    if (token) {
      clientAccessToken.value = token;
      userData.value = user;
      localStorage.setItem('clientUserInfo', JSON.stringify(user));
      Message.success('登录成功');
      return { success: true, user };
    } else {
      throw new Error('登录失败，未收到令牌');
    }
  } catch (error) {
    const message = error.response?.data?.message || error.message || '登录失败';
    Message.error(message);
    return { success: false, error: message };
  }
};

/**
 * 注册
 */
const register = async (userInfo) => {
  try {
    const response = await apiClient.post('/auth/client/register', userInfo);
    Message.success('注册成功，请登录');
    return { success: true, data: response.data };
  } catch (error) {
    const message = error.response?.data?.message || error.message || '注册失败';
    Message.error(message);
    return { success: false, error: message };
  }
};

/**
 * 退出登录
 */
const logout = () => {
  clientAccessToken.value = null;
  userData.value = null;
  Message.success('已退出登录');
};

/**
 * 获取当前用户信息
 */
const fetchCurrentUserData = async () => {
  if (!isLoggedIn.value) {
    userData.value = null;
    return;
  }

  loadingUserData.value = true;
  try {
    const response = await apiClient.get('/auth/me');
    userData.value = response.data;
    localStorage.setItem('clientUserInfo', JSON.stringify(response.data));
  } catch (error) {
    console.error('Failed to fetch user data:', error);
    if (error.response && error.response.status === 401) {
      // Token无效，清除认证状态
      logout();
    }
  } finally {
    loadingUserData.value = false;
  }
};

/**
 * 刷新用户数据
 */
const refreshUserData = () => {
  if (isLoggedIn.value) {
    fetchCurrentUserData();
  }
};

/**
 * 初始化认证状态
 */
const initAuth = () => {
  // 从localStorage恢复用户信息
  const storedUserInfo = localStorage.getItem('clientUserInfo');
  if (storedUserInfo && isLoggedIn.value) {
    try {
      userData.value = JSON.parse(storedUserInfo);
    } catch (error) {
      console.warn('Failed to parse stored user info:', error);
      localStorage.removeItem('clientUserInfo');
    }
  }

  // 如果有token但没有用户信息，尝试获取
  if (isLoggedIn.value && !userData.value) {
    fetchCurrentUserData();
  }
};

/**
 * 处理token过期
 */
const handleTokenExpiration = () => {
  logout();
  Message.warning('登录已过期，请重新登录');
};

// 导出状态和方法
export const useAuthStore = () => {
  return {
    // 状态
    clientAccessToken: computed(() => clientAccessToken.value),
    userData: computed(() => userData.value),
    loadingUserData: computed(() => loadingUserData.value),
    isLoggedIn,
    
    // 方法
    login,
    register,
    logout,
    fetchCurrentUserData,
    refreshUserData,
    initAuth,
    handleTokenExpiration
  };
};

// 默认导出（用于在非组合式API中使用）
export default {
  clientAccessToken,
  userData,
  loadingUserData,
  isLoggedIn,
  login,
  register,
  logout,
  fetchCurrentUserData,
  refreshUserData,
  initAuth,
  handleTokenExpiration
};
