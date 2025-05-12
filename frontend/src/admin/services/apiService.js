import axios from 'axios';
import { Message } from '@arco-design/web-vue';

// Determine the base URL dynamically
// In development (using Vite dev server), proxy should handle /api
// In production, assume API is at the same origin under /api
// Set the base URL to always include /api
const API_BASE_URL = '/api'; 

const apiService = axios.create({
  baseURL: API_BASE_URL, // Base URL is now /api
  timeout: 10000, // Request timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the auth token
apiService.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    // Ensure Content-Type is set correctly for FormData
    // Axios usually handles this automatically when data is FormData,
    // but explicitly removing it if it was set to json might be safer.
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']; 
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
apiService.interceptors.response.use(
  (response) => {
    // Any status code that lie within the range of 2xx cause this function to trigger
    return response;
  },
  (error) => {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401 || status === 403) {
        // 处理未授权或禁止访问的错误
        const message = status === 401 
          ? (data?.message || '认证失败，请重新登录。')
          : (data?.message || '无权访问此资源，请检查您的权限或重新登录。');
        
        Message.error(`${message} (${status})`);
        
        // 清除本地存储中的用户凭证
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userInfo');
        
        // 直接构建后台登录页的URL (假设后台部署在根目录)
        const adminLoginUrl = window.location.origin + '/src/admin/';

        // 安全检查：避免在已是登录页时无限循环
        if (window.location.href.split('#')[0] + '#/login' !== adminLoginUrl) { // 比较时也构造成同样的形式
            setTimeout(() => {
                window.location.replace(adminLoginUrl); 
            }, 50); 
        }

      } else if (status === 400) {
          // Bad Request (e.g., validation errors)
          // Message is usually handled by the component calling the API
          console.warn('Bad Request (400): ', data?.message || 'Validation Error');
      } else if (status === 404) {
          // Not Found
          console.warn('Resource Not Found (404): ', data?.message || error.config.url);
      } else if (status === 409) {
           // Conflict (e.g., duplicate entry)
           console.warn('Conflict (409): ', data?.message || 'Duplicate entry');
      } else {
        // Other server errors (5xx)
        Message.error(data?.message || `服务器错误 (${status})`);
      }
    } else if (error.request) {
      // The request was made but no response was received
      Message.error('网络错误：无法连接到服务器。请检查您的网络连接。');
    } else {
      // Something happened in setting up the request that triggered an Error
      Message.error('请求发送失败：' + error.message);
    }
    return Promise.reject(error);
  }
);

export default apiService; 