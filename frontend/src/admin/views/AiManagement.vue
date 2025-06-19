<template>
  <!-- Outer container like other pages -->
  <div>

    <!-- Toolbar -->
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">AI 应用管理</h2>
      <a-space>
        <!-- Search Input -->
        <a-input-search
          v-model="searchName"
          placeholder="按名称搜索"
          allow-clear
          style="width: 200px;"
        />
        <!-- Type Filter -->
        <a-select
          v-model="filterType"
          placeholder="按类型筛选"
          allow-clear
          style="width: 150px;"
        >
          <a-option v-for="type in aiTypes" :key="type._id" :value="type._id">
            {{ type.name }}
          </a-option>
        </a-select>
        <!-- Platform Filter -->
        <a-select
          v-model="filterPlatform"
          placeholder="按平台筛选"
          allow-clear
          style="width: 150px;"
        >
          <a-option v-for="platform in platformTypes" :key="platform._id" :value="platform._id">
            {{ platform.name }}
          </a-option>
        </a-select>
        <!-- Status Filter -->
        <a-select
          v-model="filterStatus"
          placeholder="按状态筛选"
          allow-clear
          style="width: 120px;"
        >
          <a-option value="active">激活</a-option>
          <a-option value="inactive">禁用</a-option>
        </a-select>
        <!-- New Filter for Credits Consumed -->
        <a-select
          v-model="filterCredits"
          placeholder="按积分筛选"
          allow-clear
          style="width: 140px;"
        >
          <a-option :value="0">免费</a-option>
          <a-option value="paid">付费</a-option>
        </a-select>
        <!-- Action Buttons -->
        <a-button type="primary" @click="showCreateModal">
          <template #icon><icon-plus /></template> 添加 AI 应用
        </a-button>
        <a-button @click="refreshData" :loading="loading">
          <template #icon><icon-refresh /></template> 刷新
        </a-button>
      </a-space>
    </div>

    <!-- Revision: Use a-table-column definition -->
    <a-spin :loading="loading" tip="加载 AI 应用列表中..." class="w-full">
      <a-table
        :data="filteredData"
        :loading="loading"
        rowKey="_id"
        stripe  
        :pagination="pagination" 
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        :scroll="{ x: 'max-content' }" 
      >
        <template #columns>
          <!-- Revision: Add ID column -->
           <a-table-column title="ID" data-index="_id" :width="120">
               <template #cell="{ record }">
                   {{ record._id }}
               </template>
           </a-table-column>
           <!-- End Revision -->
           <a-table-column title="封面" data-index="coverImageUrl" :width="80" align="center">
             <template #cell="{ record }">
                <a-image v-if="record.coverImageUrl" :src="getImageUrl(record.coverImageUrl)" width="40" height="40" fit="cover" :alt="record.name" />
                <span v-else>-</span>
             </template>
          </a-table-column>
          <a-table-column title="应用名称" data-index="name" :width="180" :sortable="{ sortDirections: ['ascend', 'descend'] }"></a-table-column>
          <a-table-column title="应用简介" data-index="description" ellipsis tooltip :width="250"></a-table-column>
          <a-table-column title="应用类型" data-index="type.name" :width="120" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              <span v-if="record.type && record.type.name">{{ record.type.name }} ({{ record.type.uri }})</span>
              <span v-else-if="record.type">{{ record.type }}</span>
              <span v-else>未知类型</span>
            </template>
          </a-table-column>
          <a-table-column title="平台类型" data-index="platformType" :width="120">
            <template #cell="{ record }">
              <a-tag v-if="record.platformType"
                :color="getPlatformColor(typeof record.platformType === 'object' ? record.platformType.name : record.platformType)">
                {{ typeof record.platformType === 'object' ? record.platformType.name : record.platformType }}
              </a-tag>
              <span v-else>-</span>
            </template>
          </a-table-column>
          <a-table-column title="API 数量" data-index="apis.length" :width="120" align="center" :sortable="{ sortDirections: ['ascend', 'descend'] }">
             <template #cell="{ record }">
                {{ record.apis ? record.apis.length : 0 }}
             </template>
          </a-table-column>
          <a-table-column title="所需积分" data-index="creditsConsumed" :width="120" align="center" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              <a-tag v-if="record.creditsConsumed === 0" color="green">免费</a-tag>
              <span v-else>{{ record.creditsConsumed }}</span>
            </template>
          </a-table-column>
          <a-table-column title="标签" data-index="tags" :width="150">
             <template #cell="{ record }">
                <a-space wrap>
                  <a-tag v-for="tag in record.tags" :key="tag" color="blue">{{ tag }}</a-tag>
                </a-space>
             </template>
          </a-table-column>
          <a-table-column title="状态" data-index="status" :width="100" align="center" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              <a-tag :color="record.status === 'active' ? 'green' : 'red'">
                {{ record.status === 'active' ? '激活' : '禁用' }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="创建时间" data-index="createdAt" key="createdAt" :width="200" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              {{ formatDateCN(record.createdAt) }}
            </template>
          </a-table-column>
          <a-table-column title="更新时间" data-index="updatedAt" key="updatedAt" :width="200" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              {{ formatDateCN(record.updatedAt) }}
            </template>
          </a-table-column>
          <a-table-column title="操作" key="action" :width="220" fixed="right" align="center">
            <template #cell="{ record }">
              <a-space>
                <a-button type="text" status="warning" size="mini" @click="showEditModal(record)">编辑</a-button>
                <a-button type="text" size="mini" @click="openFormBuilder(record)">配置</a-button>
                <a-popconfirm
                  content="确定要删除这个 AI 应用吗？相关的封面图片也会被删除。"
                  ok-text="确定"
                  cancel-text="取消"
                  @ok="handleDelete(record._id)"
                >
                  <a-button type="text" status="danger" size="mini">删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-spin>
    <!-- End Revision -->

    <!-- Modal remains the same -->
    <a-modal
      :title="isEditing ? '编辑 AI 应用：' + formState.name : '创建 AI 应用'"
      :visible="modalVisible"
      :confirm-loading="modalLoading"
      width="800px"
      @ok="handleSubmit"
      @cancel="handleCancel"
      :ok-text="isEditing ? '更新 AI 应用' : '创建 AI 应用'"
      cancel-text="取消"
      unmount-on-close  
    >
      <a-form :model="formState" ref="formRef" layout="vertical" :rules="rules">
        <!-- Revision: Use Row/Col for layout -->
        <a-row :gutter="16">

          <a-col :span="6">
            <a-form-item label="封面图片 (小于 1MB)" field="coverImage" style="height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
              <!-- Revision: Show preview image OR upload component -->
              <div style="width: 104px; height: 104px; margin-bottom: 8px; border: 1px dashed #d9d9d9; display: flex; align-items: center; justify-content: center;">
                 <!-- Show Image Preview if available -->
                 <img 
                   v-if="imageUrl && !uploadLoading" 
                   :src="imageUrl" 
                   style="max-width: 100%; max-height: 100%; object-fit: contain;" 
                   alt="封面预览"
                 />
                <!-- Show Upload component if no image or loading -->
                <a-upload
                   v-else
                   v-model:file-list="fileList"
                   list-type="picture-card"
                   :limit="1"
                   accept="image/*"
                   :before-upload="beforeUpload"
                   @change="handleUploadChange" 
                   :show-file-list="false"
                   :custom-request="() => {}" 
                 >
                     <!-- Default slot content (plus icon or loading) -->
                     <div class="arco-upload-picture-card-text">
                       <IconPlus v-if="!uploadLoading" />
                       <IconLoading v-else spin />
                       <div style="margin-top: 10px; font-weight: 600">{{ uploadLoading ? '上传中...' : '上传封面' }}</div>
                     </div>
                 </a-upload>
               </div>
              <!-- End Revision -->

              <!-- Remove button - shown only when image exists -->
              <a-button v-if="imageUrl && !uploadLoading" @click="handleUploadRemove" danger size="small" style="align-self: flex-start;">移除图片</a-button>
              <input type="hidden" v-model="formState.removeCoverImage">
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="18">
            <a-form-item label="应用名称" field="name" required>
              <a-input v-model="formState.name" placeholder="请输入 AI 应用名称" />
            </a-form-item>
            <a-form-item label="应用简介" field="description">
              <a-textarea v-model="formState.description" placeholder="请输入简介" :rows="3" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <!-- Remaining fields below the top row -->
            <a-form-item label="应用类型" field="type" required>
              <a-select
            v-model="formState.type"
            placeholder="请选择 AI 类型"
            show-search
            :filter-option="filterOption"
            allow-clear
          >
            <a-option v-for="type in aiTypes.filter(t => t.status === 'active')" :key="type._id" :value="type._id">
              {{ type.name }} ({{ type.uri }})
            </a-option>
          </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <!-- New Form Item for Credits Consumed -->
            <a-form-item label="所需积分" field="creditsConsumed" required>
              <a-input-number 
            v-model="formState.creditsConsumed" 
                placeholder="输入所需积分，0表示免费" 
                :min="0" 
                :precision="0" 
                style="width: 100%;"
              />
            </a-form-item>
          </a-col>
        </a-row>
          <a-form-item label="平台类型" field="platformType" required>
          <a-select
            v-model="formState.platformType"
            placeholder="请选择平台类型"
            show-search
            :filter-option="filterOption"
            allow-clear
          >
            <a-option v-for="platform in platformTypes" :key="platform._id" :value="platform._id">
              {{ platform.name }}
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="关联 API" field="apis" required>
          <a-select
            :key="apiSelectKey" 
            v-model="formState.apis"
            multiple
            placeholder="选择关联的 API"
            style="width: 100%"
            show-search
            :filter-option="filterOption"
            allow-clear
            :options="availableApiOptionsForForm" 
          >
           </a-select>
        </a-form-item>
        <a-form-item label="标签" field="tags">
          <a-input-tag
            v-model="formState.tags" 
            :style="{ width: '100%' }"
            placeholder="输入标签后按回车确认"
            allow-clear
            :token-separators="[',']"
            unique-value
          />
        </a-form-item>
        <a-form-item label="状态" field="status" required>
          <a-select v-model="formState.status" placeholder="请选择状态">
            <a-option value="active">Active (激活)</a-option>
            <a-option value="inactive">Inactive (禁用)</a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <FormBuilderModal
      v-model:visible="formBuilderModalVisible"
      :application-id="currentAppForFormBuilder?._id"
      :application-name="currentAppForFormBuilder?.name"
      :platform-type="currentAppForFormBuilder?.platformType"
      @save="onFormBuilderSave"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, reactive, nextTick } from 'vue';
import {
  Message, Modal, InputSearch, Row, Col, Button, Table, Space, Popconfirm, Form,
  FormItem, Input, Textarea, Select, Tag, Upload, Image as AImage, InputTag, Spin,
  Option
} from '@arco-design/web-vue';
import { IconPlus, IconLoading, IconRefresh } from '@arco-design/web-vue/es/icon';
import apiService, { getStaticAssetBaseUrl } from '../services/apiService';
import FormBuilderModal from '../components/form-builder/FormBuilderModal.vue';
import { formatDateCN } from '@/admin/utils/date';

// Explicitly rename components if needed or use directly
const ARow = Row;
const ACol = Col;
const AInputSearch = InputSearch;
const AForm = Form;
const AFormItem = FormItem;
const AInput = Input;
const ATextarea = Textarea;
const ASelect = Select;
const AOption = Option;
const AInputTag = InputTag;
const ATag = Tag;
const AUpload = Upload;
const ATable = Table;
const ATableColumn = Table.Column;
const ASpin = Spin;
const APopconfirm = Popconfirm;
const ASpace = Space;
const AButton = Button;

const aiApplications = ref([]);
const aiTypes = ref([]);
const platformTypes = ref([]);
const allApiEntries = ref([]); // To store all fetched API entries
const loading = ref(false);
const searchName = ref('');
const filterType = ref(undefined);
const filterPlatform = ref(undefined);
const filterStatus = ref(undefined);
const filterCredits = ref(''); // New filter state, default to 'all'

const modalVisible = ref(false);
const modalLoading = ref(false);
const isEditing = ref(false);
const currentAppId = ref(null);
const formRef = ref(null);

// Form Builder Modal State
const formBuilderModalVisible = ref(false);
const currentAppForFormBuilder = ref(null);

// Reactive state for the form within the modal
const formState = ref({
  _id: null,
  name: '',
  description: '',
  type: null,
  apis: [], // MUST be array for multi-select
  tags: [], // MUST be array for input-tag
  coverImage: '', // Holds path after upload, might need adjustment based on backend
  coverImageUrl: '', // For displaying existing image
  coverImageFile: null, // For new upload file object
  removeCoverImage: false,
  status: 'active',
  creditsConsumed: 0, // Added to formState
  platformType: null, // Added
});

// Upload state
const fileList = ref([]);
const imageUrl = ref('');
const uploadLoading = ref(false);

const rules = {
  name: [{ required: true, message: '请输入 AI 应用名称' }],
  description: [{ required: false }],
  type: [{ required: true, message: '请选择 AI 类型', trigger: 'change' }],
  platformType: [{ required: true, message: '请选择平台类型', trigger: 'change' }],
  apis: [{ required: true, type: 'array', min: 1, message: '请至少选择一个关联 API', trigger: 'change' }],
  tags: [{ required: false }],
  coverImage: [{ required: false }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
  creditsConsumed: [
    { required: true, message: '请输入所需积分' },
    { type: 'number', message: '所需积分必须是数字' },
    { validator: (value, callback) => {
        if (value < 0) {
          callback('所需积分不能为负数');
        } else if (!Number.isInteger(value)) {
          callback('所需积分必须是整数');
        } else {
          callback();
        }
      }
    }
  ],
};

// Helper to construct full image URL
const getImageUrl = (relativePath) => {
  if (!relativePath) return '';
  
  const staticAssetBase = getStaticAssetBaseUrl();
  
  // Ensure the relative path starts with a slash if it doesn't already
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

  // Construct the full URL
  return `${staticAssetBase}${path}`;
};

// Computed property for filtering data
const filteredData = computed(() => {
  const result = aiApplications.value.filter(app => {
    const nameMatch = searchName.value ? app.name.toLowerCase().includes(searchName.value.toLowerCase()) : true;
    
    const typeMatch = filterType.value !== undefined && filterType.value !== ''
                      ? (app.type && app.type._id === filterType.value) 
                      : true;
    
    // Platform filter logic
    const platformMatch = filterPlatform.value !== undefined && filterPlatform.value !== ''
                          ? (() => {
                              // Handle both object and string platformType
                              if (typeof app.platformType === 'object' && app.platformType._id) {
                                return app.platformType._id === filterPlatform.value;
                              } else if (typeof app.platformType === 'string') {
                                // Find platform by name
                                const platform = platformTypes.value.find(p => p.name === app.platformType);
                                return platform && platform._id === filterPlatform.value;
                              }
                              return false;
                            })()
                          : true;
                      
    const statusMatch = filterStatus.value !== undefined && filterStatus.value !== '' 
                      ? app.status === filterStatus.value 
                      : true;
    
    let creditsMatch = true;
    if (filterCredits.value !== 'all' && filterCredits.value !== undefined) {
      if (filterCredits.value === 0) { // Free
        creditsMatch = app.creditsConsumed === 0;
      } else if (filterCredits.value === 'paid') { // Paid
        creditsMatch = app.creditsConsumed > 0;
      }
    }
    return nameMatch && typeMatch && platformMatch && statusMatch && creditsMatch;
  });
  return result;
});

// Computed options for API select
const apiOptions = computed(() => {
  // Filter for active APIs
  const options = allApiEntries.value
    .filter(api => api.status === 'active') // Only include active APIs
    .map(api => ({
      label: `${api.platformName} (${api.apiUrl})`, // Original label format
      value: api._id,
    }));
  return options;
});

// Computed property for API selection in the form, filtered by platformType
const availableApiOptionsForForm = computed(() => {
  if (!formState.value.platformType) {
    return []; // No platform type selected for the AI App, so no APIs can be chosen
  }
  
  // 根据选择的平台类型ID找到对应的平台名称
  const selectedPlatform = platformTypes.value.find(p => p._id === formState.value.platformType);
  const platformName = selectedPlatform ? selectedPlatform.name : null;
  
  if (!platformName) {
    return [];
  }
  
  const filtered = allApiEntries.value
    .filter(api => api.platformType === platformName && api.status === 'active');
  
  const mapped = filtered.map((api, index) => {
      const apiId = api._id;
      const platformInstanceName = api.platformName;
      const configApiUrl = api.config?.apiUrl;
      const legacyApiUrl = api.apiUrl;
      const displayUrl = configApiUrl || legacyApiUrl || 'Config N/A';
      
      const option = {
        label: `${platformInstanceName} (${apiId}) - ${displayUrl}`,
        value: apiId,
      };
      return option;
    });
  
  return mapped;
});

// Generic filter option for selects
const filterOption = (input, option) => {
  // Check if option and option.children exist and have content
  const children = option?.children?.[0]?.children;
  if (typeof children === 'string') {
    return children.toLowerCase().includes(input.toLowerCase());
  }
  // Fallback for apiOptions where label is directly available
  if (option?.label) {
    return option.label.toLowerCase().includes(input.toLowerCase());
  }
  return false;
};

const defaultApiOptions = ref([]);

const pagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [10, 15, 20, 50, 100],
});

// --- Computed Properties ---
// ... existing code ...
// Fetch all data (AI applications, types, and platform types)
const fetchData = async () => {
  loading.value = true;
  try {
    // Fetch AI Types and Platform Types first (or in parallel)
    const [typesResponse, platformTypesResponse] = await Promise.all([
      apiService.get('/ai-types'), // Assuming this fetches ALL active types for dropdowns
      apiService.get('/platforms') // 使用新的平台 API
    ]);
    aiTypes.value = typesResponse.data || [];
    platformTypes.value = platformTypesResponse.data || [];

    // Fetch AI Applications with pagination
    const appParams = {
      page: pagination.current,
      limit: pagination.pageSize,
      // query: searchName.value || undefined, // If backend supports server-side filtering for these
      // type: filterType.value || undefined,
      // status: filterStatus.value || undefined,
      // credits: filterCredits.value, // Note: 0 is a valid value, undefined for no filter
    };
    const applicationsResponse = await apiService.get('/ai-applications', { params: appParams });
    if (applicationsResponse.data) {
      if (Array.isArray(applicationsResponse.data.data)) { // Standard paginated response
        aiApplications.value = applicationsResponse.data.data;
        pagination.total = applicationsResponse.data.totalRecords || 0;
      } else if (Array.isArray(applicationsResponse.data)) { // Response data itself is the array
        aiApplications.value = applicationsResponse.data;
        // If the response is just an array, total might be its length,
        // or the backend might not support pagination for this response type.
        pagination.total = applicationsResponse.data.length; 
      } else { // Unexpected structure
        Message.error('获取 AI 应用列表格式不正确');
        aiApplications.value = [];
        pagination.total = 0;
      }
    } else { // No data in response
      Message.error('获取 AI 应用列表无数据返回');
      aiApplications.value = [];
      pagination.total = 0;
    }

  } catch (error) {
    Message.error('加载 AI 应用数据失败: ' + (error.response?.data?.message || error.message));
    aiApplications.value = [];
    aiTypes.value = [];
    platformTypes.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
};

const refreshData = () => {
  searchName.value = '';
  filterType.value = undefined;
  filterPlatform.value = undefined;
  filterStatus.value = undefined;
  filterCredits.value = undefined;
  pagination.current = 1; // Reset to first page
  fetchData();
};

const handlePageChange = (page) => {
  pagination.current = page;
  fetchData(); // Refetch data for the new page
};

const handlePageSizeChange = (pageSize) => {
  pagination.pageSize = pageSize;
  pagination.current = 1; // Reset to first page
  fetchData(); // Refetch data with new page size
};

// Function to get image URL, assuming it's served from backend/uploads or a similar public path
// ... existing code ...

const fetchAiApplications = async () => {
  loading.value = true;
  try {
    // Use apiService consistently
    const response = await apiService.get('/ai-applications');
    aiApplications.value = response.data; // Assign data
  } catch (error) {
    // Log error from apiService explicitly
    console.error('Error fetching AI applications:', error);
    Message.error('获取 AI 应用列表失败: ' + (error.response?.data?.message || error.message));
  } finally {
    loading.value = false;
  }
};

const fetchAiTypes = async () => {
  try {
    // --- Revision: Use apiService --- 
    const response = await apiService.get('/ai-types');
    // --- End Revision ---
    aiTypes.value = response.data;
  } catch (error) {
    // apiService interceptor should handle detailed error messages
    console.error('Error fetching AI types:', error);
    Message.error('获取 AI 类型选项失败'); // Simplified message
  }
};

const fetchPlatformTypes = async () => {
  try {
    const response = await apiService.get('/platforms');
    // 直接使用完整的平台对象
    platformTypes.value = response.data;
  } catch (error) {
    console.error('Error fetching platform types:', error);
    Message.error('获取平台类型失败');
    platformTypes.value = [];
  }
};

const fetchAllApiEntries = async () => {
  try {
    const response = await apiService.getApiEntries(); // Uses the correct /api-entries endpoint
    allApiEntries.value = response.data;
  } catch (error) {
    console.error('Error fetching API entries for AiManagement:', error);
    Message.error('获取可用API列表失败');
    allApiEntries.value = [];
  }
};

const resetForm = () => {
  formState.value = {
    _id: null,
    name: '',
    description: '',
    type: null,
    apis: [],
    tags: [],
    coverImage: '',
    coverImageUrl: '',
    coverImageFile: null,
    removeCoverImage: false,
    status: 'inactive',
    creditsConsumed: null, // Reset creditsConsumed
    platformType: null, // Reset platformType
  };
  fileList.value = [];
  imageUrl.value = '';
  uploadLoading.value = false;
  // Clear validation if formRef exists
  formRef.value?.clearValidate(); 
};

const showCreateModal = () => {
  isEditing.value = false;
  currentAppId.value = null;
  resetForm();
  modalVisible.value = true;
  apiSelectKey.value++; 
};

const showEditModal = async (record) => {
  isEditing.value = true;
  resetForm();
  apiSelectKey.value++; 

  // Assign fields from record to the reactive formState
  formState.value._id = record._id;
  formState.value.name = record.name;
  formState.value.description = record.description;
  formState.value.tags = record.tags ? [...record.tags] : [];
  
  formState.value.type = record.type ? record.type._id : null;
  
  // 根据平台类型名称找到对应的平台ID
  if (record.platformType) {
    if (typeof record.platformType === 'object' && record.platformType._id) {
      // 如果是对象，直接使用ID
      formState.value.platformType = record.platformType._id;
    } else {
      // 如果是字符串名称，找到对应的平台ID
      const platform = platformTypes.value.find(p => p.name === record.platformType);
      formState.value.platformType = platform ? platform._id : null;
    }
  } else {
    formState.value.platformType = null;
  }
  
  formState.value.status = record.status;
  formState.value.creditsConsumed = record.creditsConsumed === undefined ? 0 : Number(record.creditsConsumed);
  const relativePath = record.coverImageUrl;
  const fullUrl = relativePath ? getImageUrl(relativePath) : null;
  formState.value.coverImageUrl = fullUrl;
  formState.value.coverImageFile = null; 
  formState.value.removeCoverImage = false;

  // Update image preview state
  imageUrl.value = formState.value.coverImageUrl;
  fileList.value = imageUrl.value ? [{ uid: '-1', name: 'cover.png', status: 'done', url: imageUrl.value }] : [];
  
  modalVisible.value = true;

  await nextTick(); // Wait for DOM updates, options to compute
  
  // 确保正确设置 APIs 数组
  const apiIds = record.apis ? record.apis.map(api => api._id || api) : [];
  formState.value.apis = apiIds;

  formRef.value?.clearValidate(); 
};

const handleCancel = () => {
  modalVisible.value = false;
  resetForm();
};

// --- Upload Logic ---
const beforeUpload = (file) => {
  const isImage = file.type.startsWith('image/');
  if (!isImage) {
    Message.error('只能上传图片文件!');
  }
  const isLt100k = file.size / 1024 < 1024;
  if (!isLt100k) {
    Message.error('图片大小必须小于 1MB!');
  }
  return isImage && isLt100k;
};

const getBase64 = (img, callback) => {
  const reader = new FileReader();
  reader.addEventListener('load', () => callback(reader.result));
  reader.readAsDataURL(img);
};

// Updated to handle file selection and preview generation
const handleUploadChange = (fileList, fileItem) => {
    // fileItem contains the file object under fileItem.file
    const file = fileItem.file;
    if (!file) return; // Exit if no file

    // Use beforeUpload for validation
    if (!beforeUpload(file)) {
        // --- Revision: If validation fails, reset image state to allow re-upload ---
        removeImage(); // Clear preview, file object, and set remove flag if needed.
                       // This should also reset fileList.value and imageUrl.value.
        // Ensure uploadLoading is also reset, removeImage should handle it but double check.
        uploadLoading.value = false; 
        // --- End Revision ---
        return;
    }

    // Update internal state immediately
    formState.value.coverImageFile = file;
    formState.value.removeCoverImage = false; // New file selected, don't remove
    uploadLoading.value = true;

    // Generate Base64 preview
    getBase64(file, base64Url => {
        imageUrl.value = base64Url;
        uploadLoading.value = false;
        // Update fileList for Arco Upload display if needed (we hide it, but good practice)
        fileList.value = [{ uid: file.uid || '-1', name: file.name, status: 'done', url: base64Url, originFile: file }];
    });
}

// Function to handle file removal from the Upload component UI (if shown) or preview
const handleUploadRemove = (fileItem) => {
    removeImage(); // Call existing removeImage logic
    return true; // Indicate removal was successful
}

const removeImage = () => {
  imageUrl.value = '';
  formState.value.coverImageFile = null;
  formState.value.removeCoverImage = true; // Set flag to remove existing server image if needed
  fileList.value = []; // Clear Arco file list
  uploadLoading.value = false; // Ensure loading indicator is off
};

// --- End Upload Logic ---

// --- Form Submission Logic ---
const handleSubmit = async () => {

  let validationErrors;
  try {
    validationErrors = await formRef.value.validate();
  } catch (e) {
    Message.error('表单校验函数执行出错，请联系管理员。');
    return false; // Prevent submission if validate() itself fails
  }

  if (validationErrors && Object.keys(validationErrors).length > 0) {
    try {
      const firstErrorField = Object.keys(validationErrors)[0];
      if (firstErrorField && formRef.value?.scrollToField) {
        formRef.value.scrollToField(firstErrorField);
      }
    } catch (focusError) {
      console.error("Error focusing field:", focusError);
    }
    return false; // Crucial: Prevent modal from closing and API call
  }

  // If validation passes, proceed with submission logic
  modalLoading.value = true;

  // Get access token
  const accessToken = localStorage.getItem('accessToken');
  if (!accessToken) {
    Message.error('认证令牌丢失，请重新登录。');
    modalLoading.value = false;
    localStorage.clear();
    window.location.reload();
    // If reload happens, this return might not fully execute, but it's good for logical flow.
    return false;
  }

  const formData = new FormData();
  // Append standard fields
  formData.append('name', formState.value.name);
  formData.append('description', formState.value.description || '');
  formData.append('type', formState.value.type);
  formData.append('status', formState.value.status);
  formData.append('creditsConsumed', formState.value.creditsConsumed === undefined ? 0 : Number(formState.value.creditsConsumed));

  // Append array fields: tags and apis
  if (formState.value.tags && Array.isArray(formState.value.tags)) {
    formState.value.tags.forEach(tag => {
      if (tag) {
        formData.append('tags', tag);
      }
    });
  }

  // 使用平台名称而不是ID
  if (formState.value.platformType) {
    const selectedPlatform = platformTypes.value.find(p => p._id === formState.value.platformType);
    const platformName = selectedPlatform ? selectedPlatform.name : formState.value.platformType;
    formData.append('platformType', platformName);
  }

  // 处理关联的 APIs
  let apiIdsToAppend = [];
  const currentApis = formState.value.apis;
  if (Array.isArray(currentApis)) {
    apiIdsToAppend = currentApis;
  } else if (currentApis) {
    apiIdsToAppend = [currentApis];
  }

  if (apiIdsToAppend.length > 0) {
    apiIdsToAppend.forEach(apiId => {
      if (apiId) {
        formData.append('apis', apiId);
      }
    });
  }

  // Append the cover image file if a new one is selected
  if (formState.value.coverImageFile instanceof File) {
    formData.append('coverImage', formState.value.coverImageFile, formState.value.coverImageFile.name);
  } else if (isEditing.value && formState.value.removeCoverImage) {
    formData.append('removeCoverImage', 'true');
  }

  // Determine URL and Method
  let url = '/ai-applications';
  let method = 'POST';
  if (isEditing.value && formState.value._id) {
    url = `/ai-applications/${formState.value._id}`;
    method = 'PUT';
  }

  const config = {
    headers: {} // apiService likely handles Authorization and Content-Type for FormData
  };

  try { // Try-catch for the API call itself
    let response;
    if (method === 'POST') {
      response = await apiService.post(url, formData, config);
    } else { // PUT
      response = await apiService.put(url, formData, config);
    }

    // Success
    modalLoading.value = false;
    Message.success(`AI 应用 ${isEditing.value ? '更新' : '创建'}成功`);
    modalVisible.value = false; // Close modal on success
    await fetchData(); // Refresh the data grid
    return true; // Indicate success to @ok handler (optional, as modalVisible is set)

  } catch (apiError) { // Catch errors from the API call or fetchData
    modalLoading.value = false;
    let errorMsg = `API 请求失败: ${apiError.message}`;
    if (apiError.response) {
      errorMsg = `API 请求失败 (${apiError.response.status}): ${apiError.response.data?.message || apiError.message}`;
      if (apiError.response.status === 401 || apiError.response.status === 403) {
        Message.warning('登录状态失效或无权限，请重新登录。');
        localStorage.clear();
        window.location.reload();
        // If reload happens, this return might not fully execute, but it's good for logical flow.
        return false;
      }
    }
    Message.error(errorMsg);
    return false; // Keep modal open on API failure
  }
};
// --- End Form Submission Logic ---

const handleDelete = async (id) => {
  try {
    await apiService.delete(`/ai-applications/${id}`);
    Message.success('AI 应用删除成功');
    fetchData(); // Refresh list
  } catch (error) {
    Message.error('删除 AI 应用失败: ' + (error.response?.data?.message || error.message));
  }
};

const apiSelectKey = ref(0); // Key for forcing re-render of API select

// Add a watcher for platformType changes to clear selected APIs and update key
watch(() => formState.value.platformType, (newPlatformType, oldPlatformType) => {
  if (newPlatformType !== oldPlatformType) {
    formState.value.apis = []; // Clear selected APIs if platform type changes
    apiSelectKey.value++;    // Increment key to force re-render
  }
});

const openFormBuilder = (app) => {
  currentAppForFormBuilder.value = app;
  formBuilderModalVisible.value = true;
};

const onFormBuilderSave = () => {
  // Optionally, refresh application list or specific item if form config affects display
  fetchData(); // Assuming fetchData is your main data refresh method
};

// Lifecycle hook to fetch initial data
onMounted(() => {
  fetchData(); // Fetch AI Applications, AI Types, and Platform Types
  fetchAllApiEntries(); // Fetch all API entries for the form select
});

// --- Utils ---
const getPlatformColor = (platform) => {
  const colors = {
    OpenAI: 'arcoblue',
    ComfyUI: 'green',
    StabilityAI: 'orangered',
    Midjourney: 'purple',
    DallE: 'pinkpurple',
    Custom: 'gray'
  };
  return colors[platform] || 'blue';
};

</script>

<style scoped>
/* Remove obsolete styles if any */
/* Adjust if needed */
.arco-form-item {
  display: flex;
  flex-direction: column;
}

/* Add specific styles if needed */
.arco-table-cell .arco-btn-text {
  padding-left: 2px;
  padding-right: 2px;
}
.arco-form {
    margin-top: 10px; /* Add some space above form */
}
</style>