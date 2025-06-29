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
apiService.getInspirationCategoryById = (id, options) => {
  return apiService.get(`/inspiration-categories/${id}`, options);
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

// apiService.getApiPlatformTypes = () => { // This line is to be commented out or removed
//   return apiService.get('/api-entries/platform-types'); // This line is to be commented out or removed
// };

// --- Platform Service Methods ---
apiService.getPlatforms = (params) => {
  return apiService.get('/platforms', { params });
};

apiService.getPlatformById = (id) => {
  return apiService.get(`/platforms/${id}`);
};

apiService.createPlatform = (data) => { // data: { name, status? }
  return apiService.post('/platforms', data);
};

apiService.updatePlatform = (id, data) => { // data: { name?, status? }
  return apiService.put(`/platforms/${id}`, data);
};

apiService.deletePlatform = (id) => {
  return apiService.delete(`/platforms/${id}`);
};

// Get platform types (names of active platforms)
apiService.getPlatformTypes = () => { // New method to get list of platform names
  return apiService.get('/platforms/types');
};

// --- Enum Type Service Methods ---
apiService.getEnumTypes = (params) => { // No specific params mentioned, but good to have for future
  return apiService.get('/enum-types', { params });
};

apiService.getEnumTypeById = (id) => {
  return apiService.get(`/enum-types/${id}`);
};

apiService.createEnumType = (data) => { // data: { name, platform, status? }
  return apiService.post('/enum-types', data);
};

apiService.updateEnumType = (id, data) => { // data: { name?, platform?, status? }
  return apiService.put(`/enum-types/${id}`, data);
};

apiService.deleteEnumType = (id) => {
  return apiService.delete(`/enum-types/${id}`);
};

// --- Enum Config Service Methods ---
apiService.getEnumConfigs = (params) => { 
  // params: { platform, enumTypeId, name, status, page, limit }
  return apiService.get('/enum-configs', { params });
};

apiService.getEnumConfigById = (id) => {
  return apiService.get(`/enum-configs/${id}`);
};

apiService.createEnumConfig = (data) => { 
  // data: { name, enumType (ID), translation?, description?, platform, status? }
  return apiService.post('/enum-configs', data);
};

apiService.updateEnumConfig = (id, data) => { 
  // data: { name?, enumType? (ID), translation?, description?, platform?, status?, isUsed? }
  return apiService.put(`/enum-configs/${id}`, data);
};

apiService.deleteEnumConfig = (id) => {
  return apiService.delete(`/enum-configs/${id}`);
};

// --- AI Application Form Config Service Methods ---
apiService.saveAppFormConfig = (payload) => {
  if (!payload || !payload.applicationId || !payload.formSchema) {
    return Promise.reject(new Error('Application ID and Form Schema are required for saving.'));
  }
  // Using POST to create or update the form configuration for a specific application.
  // Alternatively, PUT could be used if the resource is always expected to exist or for full replacement.
  return apiService.post(`/ai-applications/${payload.applicationId}/form-config`, payload.formSchema);
};

apiService.getAppFormConfig = (applicationId) => {
  if (!applicationId) {
    return Promise.reject(new Error('Application ID is required for loading form config.'));
  }
  return apiService.get(`/ai-applications/${applicationId}/form-config`);
};

// It's also useful to have a way to fetch the PLATFORM_TYPES if not already available
// The backend route was /api-entries/platform-types. We can reuse getApiPlatformTypes
// or decide if a dedicated one under /enum-types or /enum-configs is needed.
// For now, components needing platform types can use the existing getApiPlatformTypes.

// --- AIWidget Service Methods ---
apiService.getAIWidgets = (params) => {
  return apiService.get('/ai-widgets', { params });
};
apiService.createAIWidget = (data) => {
  return apiService.post('/ai-widgets', data);
};
apiService.updateAIWidget = (id, data) => {
  return apiService.put(`/ai-widgets/${id}`, data);
};
apiService.deleteAIWidget = (id) => {
  return apiService.delete(`/ai-widgets/${id}`);
};

// --- Announcement Service Methods ---
apiService.getAnnouncements = (params) => {
  return apiService.get('/announcements', { params });
};
apiService.getAnnouncementById = (id) => {
  return apiService.get(`/announcements/${id}`);
};
apiService.createAnnouncement = (data) => {
  return apiService.post('/announcements', data);
};
apiService.updateAnnouncement = (id, data) => {
  return apiService.put(`/announcements/${id}`, data);
};
apiService.deleteAnnouncement = (id) => {
  return apiService.delete(`/announcements/${id}`);
};

// --- Permission Management Service Methods ---
// 权限管理
apiService.getPermissions = (params) => {
  return apiService.get('/permissions', { params });
};

apiService.getPermissionTree = (params) => {
  return apiService.get('/permissions/tree', { params });
};

apiService.createPermission = (data) => {
  return apiService.post('/permissions', data);
};

apiService.updatePermission = (id, data) => {
  return apiService.put(`/permissions/${id}`, data);
};

apiService.deletePermission = (id) => {
  return apiService.delete(`/permissions/${id}`);
};

// 角色管理
apiService.getRoles = (params) => {
  return apiService.get('/permissions/roles', { params });
};

apiService.createRole = (data) => {
  return apiService.post('/permissions/roles', data);
};

apiService.updateRole = (id, data) => {
  return apiService.put(`/permissions/roles/${id}`, data);
};

apiService.deleteRole = (id) => {
  return apiService.delete(`/permissions/roles/${id}`);
};

// 用户角色分配
apiService.getUserRoles = (params) => {
  return apiService.get('/permissions/user-roles', { params });
};

apiService.getUserRolesByUserId = (userId, params) => {
  return apiService.get(`/permissions/user-roles/${userId}`, { params });
};

apiService.assignUserRole = (data) => {
  return apiService.post('/permissions/user-roles', data);
};

apiService.batchAssignUserRoles = (data) => {
  return apiService.post('/permissions/user-roles/batch', data);
};

apiService.removeUserRole = (id) => {
  return apiService.delete(`/permissions/user-roles/${id}`);
};

// 获取当前用户权限
apiService.getMyPermissions = (params) => {
  return apiService.get('/permissions/my-permissions', { params });
};

export default apiService;