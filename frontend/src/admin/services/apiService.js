import axios from 'axios';
import { Message } from '@arco-design/web-vue';

// Define the development backend origin
const DEV_BACKEND_ORIGIN = 'http://localhost:3000';

// Function to get the base URL for static assets
export const getStaticAssetBaseUrl = () => {
  return import.meta.env.DEV ? DEV_BACKEND_ORIGIN : window.location.origin;
};

// Determine the base path for API calls (remains relative for proxy)
const API_BASE_PATH = '/api'; 

const apiService = axios.create({
  baseURL: API_BASE_PATH, // Base URL is /api, relies on current origin + proxy
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

// --- Inspiration Category Service Methods ---
// Get all categories
apiService.getInspirationCategories = (params) => { // params: { populateWorks: true/false }
  return apiService.get('/inspiration-categories', { params });
};

// Get a single category by ID
apiService.getInspirationCategoryById = (id) => {
  return apiService.get(`/inspiration-categories/${id}`);
};

// Create a new category
apiService.createInspirationCategory = (data) => { // data: { name, description, order }
  return apiService.post('/inspiration-categories', data);
};

// Update an existing category
apiService.updateInspirationCategory = (id, data) => { // data: { name, description, works (array of work IDs), order }
  return apiService.put(`/inspiration-categories/${id}`, data);
};

// Delete a category by ID
apiService.deleteInspirationCategory = (id) => {
  return apiService.delete(`/inspiration-categories/${id}`);
};

// Add a work to a category (Note: This specific endpoint might be deprecated if work management is done via updateCategory)
apiService.addWorkToInspirationCategory = (categoryId, workId) => {
  return apiService.post(`/inspiration-categories/${categoryId}/add-work`, { workId });
};

// Remove a work from a category (Note: This specific endpoint might be deprecated)
apiService.removeWorkFromInspirationCategory = (categoryId, workId) => {
  // The original service used POST, but a DELETE request might be more semantically correct for a removal.
  // However, backend route for this was POST /:id/remove-work and then DELETE /:id/works/:workId
  // Sticking to POST to match one of the original service's signatures, but backend should be checked.
  // The backend route was DELETE /:id/works/:workId, using that.
  return apiService.delete(`/inspiration-categories/${categoryId}/works/${workId}`);
};
  
// Reorder categories
apiService.reorderInspirationCategories = (orderedCategoryIds) => { // orderedCategoryIds is an array of category IDs
  return apiService.put('/inspiration-categories/reorder-categories', { orderedCategoryIds });
};

// --- Work Service Methods ---
// Get all works (paginated, filterable)
apiService.getWorks = (params) => { // params: { page, limit, type, tags, creator, status, search }
  return apiService.get('/works', { params });
};

// Get a single work by ID
apiService.getWorkById = (id) => {
  return apiService.get(`/works/${id}`);
};

// Create a new work (formData for file upload)
apiService.createWork = (formData) => { // formData should include the file and other fields
  // The request interceptor in apiService should already handle FormData Content-Type
  return apiService.post('/works', formData);
};

// Update an existing work
apiService.updateWork = (id, data) => { // data can be an object or formData if file is being replaced
  // The request interceptor in apiService should already handle FormData Content-Type if data is FormData
  return apiService.put(`/works/${id}`, data);
};

// Delete a work by ID
apiService.deleteWork = (id) => {
  return apiService.delete(`/works/${id}`);
};

// Batch update status of works
apiService.batchUpdateWorkStatus = (workIds, status) => { // workIds is an array
  return apiService.post('/works/batch-update-status', { workIds, status });
};

// --- API Entry (External APIs) Service Methods ---
apiService.getApiEntries = (params) => { // params could include filters like status, platformType
  return apiService.get('/api-entries', { params });
};

apiService.createApiEntry = (data) => {
  return apiService.post('/api-entries', data);
};

apiService.updateApiEntry = (id, data) => {
  return apiService.put(`/api-entries/${id}`, data);
};

apiService.deleteApiEntry = (id) => {
  return apiService.delete(`/api-entries/${id}`);
};

apiService.getApiPlatformTypes = () => {
  return apiService.get('/api-entries/platform-types');
};

export default apiService; 