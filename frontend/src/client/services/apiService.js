import axios from 'axios';
import { Message } from '@arco-design/web-vue'; // Assuming Arco Design is used for messages
import { router } from '../router'; // Assuming router is exported from here

// Define the development backend origin
const DEV_BACKEND_ORIGIN = 'http://localhost:3000';

// Function to get the base URL for static assets
export const getStaticAssetBaseUrl = () => {
  return import.meta.env.DEV ? DEV_BACKEND_ORIGIN : window.location.origin;
};

// Base URL for client-specific APIs
// Adjust if your client APIs are served from a different path e.g. /api/client
const API_BASE_PATH = '/api'; 

const apiClient = axios.create({
  baseURL: API_BASE_PATH,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('clientAccessToken'); // Use client-specific token
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const handleTokenExpiration = () => {
  localStorage.removeItem('clientAccessToken');
  localStorage.removeItem('clientUserInfo'); // Also remove user info if you store it
  // Use router to navigate to login page
  if (router.currentRoute.value.name !== 'ClientLogin') {
    router.push({ name: 'ClientLogin', query: { redirect: router.currentRoute.value.fullPath } });
  }
};

// Response interceptor for handling common errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const message = data?.message || '';
      const requestUrl = error.config.url; // Get the request URL

      // Check if the error is 401 or 403 AND if the request was NOT for changing password
      if ((status === 401 || (status === 403 && message.includes('认证令牌已过期'))) && requestUrl !== '/auth/change-password') {
        Message.error(message || (status === 401 ? '认证失败，请重新登录。' : '访问被拒绝，会话可能已过期。'));
        handleTokenExpiration();
      } else if (status === 403 && requestUrl !== '/auth/change-password') { // Also ignore 403 for password change
        Message.error(message || '您没有权限执行此操作。');
      } else if (status === 400) {
        console.warn('Bad Request (400): ', message || 'Validation Error');
      } else if (status === 404) {
        console.warn('Resource Not Found (404): ', message || error.config.url);
      } else {
        Message.error(message || `服务器错误 (${status})`);
      }
    } else if (error.request) {
      Message.error('网络错误：无法连接到服务器。');
    } else {
      Message.error('请求发送失败：' + error.message);
    }
    return Promise.reject(error);
  }
);

// Add public inspiration market methods here
apiClient.getPublicInspirationCategories = () => {
  return apiClient.get('/public/market/inspiration-categories'); // Path relative to API_BASE_PATH ('/api')
};

apiClient.getPublicWorks = (params) => {
  // params: { category_id, page, limit, search, tags }
  return apiClient.get('/public/market/works', { params }); // Path relative to API_BASE_PATH ('/api')
};

// Added new method to fetch tags with counts for the public market
apiClient.getPublicMarketTags = (params) => {
  // params: { category_id, search, active_tags }
  return apiClient.get('/public/market/tags', { params }); // Path relative to API_BASE_PATH ('/api')
};

// Method to get enum configurations by EnumType ID
apiClient.getEnumConfigsByType = (enumTypeId) => {
  if (!enumTypeId) {
    return Promise.reject(new Error('Enum Type ID is required to fetch enum configs.'));
  }
  return apiClient.get(`/public/enum-types/${enumTypeId}/configs`); // Example: GET /api/public/enum-types/ETXYZ123/configs
};

// 获取平台字段 options（含 description）
apiClient.getPlatformFieldOptions = (platformId, fieldKey) => {
  if (!platformId || !fieldKey) return Promise.reject(new Error('platformId 和 fieldKey 必填'));
  return apiClient.get(`/public/platforms/${platformId}/fields/${fieldKey}/options`);
};

export default apiClient; 