<template>
  <div>
    <!-- Toolbar -->
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">API 管理</h2>
      <a-space>
        <!-- Search Input -->
        <a-input-search 
            v-model="searchTerm" 
            placeholder="搜索平台名称或 API 地址" 
            allow-clear
            style="width: 250px;"
         />
        <a-select v-model="selectedPlatformTypeFilter" placeholder="按平台类型筛选" allow-clear style="width: 180px;">
            <a-option v-for="ptype in platformTypes" :key="ptype" :value="ptype">{{ ptype }}</a-option>
        </a-select>
         <a-select v-model="selectedStatus" placeholder="按状态筛选" allow-clear style="width: 150px;">
            <a-option value="active">活动</a-option>
            <a-option value="inactive">禁用</a-option>
        </a-select>
        <!-- Action Buttons -->
        <a-button type="primary" @click="openCreateModal">
          <template #icon><icon-plus /></template> 添加 API
        </a-button>
        <a-button @click="refreshApiEntries" :loading="isLoading">
          <template #icon><icon-refresh /></template> 刷新
        </a-button>
      </a-space>
    </div>

    <!-- Table -->
    <a-spin :loading="isLoading" tip="加载 API 列表中..." class="w-full">
      <a-table 
        :data="filteredApiEntries" 
        :pagination="pagination" 
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        row-key="_id" 
        stripe 
        :scroll="{ x: 'max-content' }" 
      >
        <template #columns>
          <a-table-column title="ID" data-index="_id" :width="180">
               <template #cell="{ record }">
                   {{ record._id }}
               </template>
           </a-table-column>
          <a-table-column title="平台实例名称" data-index="platformName" :width="180" :sortable="{ sortDirections: ['ascend', 'descend'] }"></a-table-column>
          <a-table-column title="平台类型" data-index="platformType" :width="150" :sortable="{ sortDirections: ['ascend', 'descend'] }"></a-table-column>
          <a-table-column title="简介" data-index="description" ellipsis tooltip :width="250"></a-table-column>
          <a-table-column title="API 地址/关键配置" data-index="apiUrl" :width="300" ellipsis tooltip>
            <template #cell="{ record }">
              <div v-if="record.platformType === 'ComfyUI' && record.config && record.config.apiUrl">
                <a :href="record.config.apiUrl" target="_blank" class="text-blue-600 hover:underline">{{ record.config.apiUrl }} <icon-launch /></a>
              </div>
              <div v-else-if="record.platformType === 'OpenAI' && record.config && record.config.apiKey">
                API Key: {{ record.config.apiKey.substring(0, 5) }}...{{ record.config.apiKey.slice(-4) }}
                <br/>
                <span v-if="record.config.defaultModel" class="text-xs text-gray-500">Model: {{ record.config.defaultModel }}</span>
              </div>
               <div v-else-if="record.apiUrl"> <!-- Fallback for older entries or 'Custom' type with main apiUrl -->
                 <a :href="record.apiUrl" target="_blank" class="text-blue-600 hover:underline">{{ record.apiUrl }} <icon-launch /></a>
              </div>
              <span v-else>-</span>
            </template>
          </a-table-column>
          <a-table-column title="状态" data-index="status" :width="100" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              <a-tag :color="record.status === 'active' ? 'green' : 'red'">
                {{ record.status === 'active' ? '活动' : '禁用' }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="使用数" data-index="usageCount" :width="100" align="center" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              <a-tag color="blue" v-if="typeof record.usageCount === 'number'">{{ record.usageCount }}</a-tag>
              <span v-else>-</span>
            </template>
          </a-table-column>
          <a-table-column title="创建时间" data-index="createdAt" :width="180" :sortable="{ sortDirections: ['ascend', 'descend'] }">
             <template #cell="{ record }">{{ formatDate(record.createdAt) }}</template>
           </a-table-column>
          <a-table-column title="操作" :width="150" fixed="right">
            <template #cell="{ record }">
              <a-button type="text" status="warning" size="mini" @click="editApiEntry(record)">编辑</a-button>
              <a-tooltip v-if="record.usageCount && record.usageCount > 0" :content="`该API被 ${record.usageCount} 个应用使用，无法删除`">
                <a-button type="text" status="danger" size="mini" disabled>删除</a-button>
              </a-tooltip>
              <a-button v-else type="text" status="danger" size="mini" @click="confirmDeleteApiEntry(record)">删除</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-spin>

    <!-- Create/Edit Modal -->
    <a-modal
      v-model:visible="modalVisible"
      :title="isEditMode ? `编辑 API: ${currentApiEntry?.platformName}` : '添加新 API'"
      @ok="handleSubmit"
      @cancel="handleCancel"
      :confirm-loading="isSubmitting"
      unmount-on-close
      width="650px"
    >
      <a-form ref="apiFormRef" :model="apiForm" :rules="formRules" layout="vertical">
        <a-form-item field="platformName" label="平台实例名称">
          <a-input v-model="apiForm.platformName" placeholder="例如：ComfyUI" />
        </a-form-item>
        
        <a-form-item field="platformType" label="平台类型">
          <a-select v-model="apiForm.platformType" placeholder="选择平台类型" @change="handlePlatformTypeChange" allow-clear>
            <a-option v-for="ptype in platformTypes" :key="ptype" :value="ptype">{{ ptype }}</a-option>
          </a-select>
        </a-form-item>

        <a-form-item field="description" label="简介 (可选)">
          <a-textarea v-model="apiForm.description" placeholder="简要描述 API 的功能" :auto-size="{ minRows: 2, maxRows: 4 }" />
        </a-form-item>

        <!-- Dynamic Config Fields -->
        <div v-if="apiForm.platformType && platformSpecificFields[apiForm.platformType]">
          <h4 class="text-sm font-medium mb-2 mt-3 text-gray-600">{{ apiForm.platformType }} 特定配置:</h4>
          <div v-for="field in platformSpecificFields[apiForm.platformType]" :key="field.name">
            <a-form-item 
              :field="`config.${field.name}`" 
              :label="field.label"
              :rules="field.required ? [{ required: true, message: `${field.label}不能为空` }] : []"
            >
              <a-input 
                v-if="field.type === 'text' || field.type === 'password'"
                v-model="apiForm.config[field.name]" 
                :placeholder="field.placeholder"
                :type="field.type === 'password' ? 'password' : 'text'"
                allow-clear
              />
              <!-- Add other field types like select, number if needed -->
            </a-form-item>
          </div>
        </div>
        
        <!-- Fallback API URL for 'Custom' type or older entries without specific config structure -->
        <a-form-item v-if="!apiForm.platformType || !platformSpecificFields[apiForm.platformType]?.some(f => f.name === 'apiUrl')" field="apiUrl" label="API 地址 (通用)">
          <a-input v-model="apiForm.apiUrl" placeholder="例如：https://api.example.com/custom_endpoint" />
        </a-form-item>

        <a-form-item field="status" label="状态">
          <a-select v-model="apiForm.status" placeholder="选择状态">
            <a-option value="active">Active (活动)</a-option>
            <a-option value="inactive" :disabled="isEditMode && currentApiEntry && currentApiEntry.usageCount > 0">
              Inactive (禁用)
              <span v-if="isEditMode && currentApiEntry && currentApiEntry.usageCount > 0" class="text-xs text-gray-500 ml-1">
                (被{{currentApiEntry.usageCount}}个应用使用)
              </span>
            </a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, reactive } from 'vue';
import { 
    Message, Modal as AModal, Table as ATable, TableColumn as ATableColumn, Spin as ASpin, 
    Tag as ATag, Button as AButton, Space as ASpace, Form as AForm, FormItem as AFormItem,
    Input as AInput, Textarea as ATextarea, Select as ASelect, Option as AOption, 
    InputSearch as AInputSearch,
    Tooltip as ATooltip
} from '@arco-design/web-vue';
import { IconRefresh, IconPlus, IconLaunch } from '@arco-design/web-vue/es/icon';
import apiService from '@/admin/services/apiService';

const apiEntries = ref([]);
const isLoading = ref(false);
const searchTerm = ref('');
const selectedPlatformTypeFilter = ref(undefined);
const selectedStatus = ref(undefined);
const modalVisible = ref(false);
const isEditMode = ref(false);
const currentApiEntry = ref(null);
const apiFormRef = ref(null);
const apiForm = ref({});
const isSubmitting = ref(false);

const platformTypes = ref([]);

const pagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [10, 15, 20, 50, 100],
});

const platformSpecificFields = {
  ComfyUI: [
    { name: 'apiUrl', label: 'ComfyUI 服务器地址', type: 'text', required: true, placeholder: '例如: http://127.0.0.1:8188' }
  ],
  OpenAI: [
    { name: 'apiKey', label: 'OpenAI API Key', type: 'password', required: true, placeholder: 'sk-...' },
    { name: 'defaultModel', label: '默认模型 (可选)', type: 'text', placeholder: 'dall-e-3' }
  ],
  StabilityAI: [
    { name: 'apiKey', label: 'StabilityAI API Key', type: 'password', required: true, placeholder: 'sk-...' },
    { name: 'defaultEngine', label: '默认引擎 (可选)', type: 'text', placeholder: 'stable-diffusion-v1-5' }
  ],
  Custom: [
     { name: 'apiUrl', label: '自定义 API URL', type: 'text', required: true, placeholder: 'http://custom.api/endpoint' },
     { name: 'customApiKey', label: '自定义 API Key (可选)', type: 'password', placeholder: 'your-custom-key' }
  ]
  // Midjourney and DallE might be covered by OpenAI or have their own specifics
};

const isGenericApiUrlFieldVisible = computed(() => {
  if (!apiForm.value.platformType) return true; // No type selected, generic field is visible
  const specificFields = platformSpecificFields[apiForm.value.platformType];
  // If the platform type has no specific fields defined, or if it does but none of them is named 'apiUrl', the generic field is visible.
  if (!specificFields) return true;
  return !specificFields.find(field => field.name === 'apiUrl');
});

// Validation Rules
const formRules = computed(() => {
  const rules = {
    platformName: [{ required: true, message: '请输入平台实例名称' }],
    platformType: [{ required: true, message: '请选择平台类型' }],
    status: [{ required: true, message: '请选择状态' }],
  };

  // Apply rules for the generic apiUrl field only if it's visible
  if (isGenericApiUrlFieldVisible.value) {
    rules.apiUrl = [
        { required: true, message: '请输入 API 地址' },
        { type: 'url', message: '请输入有效的 URL 格式' },
        { match: /^https?:\/\/.+/, message: 'URL 必须以 http:// 或 https:// 开头' }
    ];
  }

  if (apiForm.value.platformType && platformSpecificFields[apiForm.value.platformType]) {
    platformSpecificFields[apiForm.value.platformType].forEach(field => {
      if (field.required) {
        rules[`config.${field.name}`] = [{ required: true, message: `${field.label}不能为空` }];
        if (field.type === 'text' && (field.name.toLowerCase().includes('url') || field.name.toLowerCase().includes('uri'))) {
           rules[`config.${field.name}`].push(
            { type: 'url', message: '请输入有效的 URL 格式' },
            { match: /^https?:\/\/.+/, message: 'URL 必须以 http:// 或 https:// 开头' }
          );
        }
      }
    });
  }
  return rules;
});

// Filtered API Entries
const filteredApiEntries = computed(() => {
  return apiEntries.value.filter(entry => {
    const term = searchTerm.value.toLowerCase().trim();
    const statusFilter = selectedStatus.value;
    const platformTypeFilter = selectedPlatformTypeFilter.value;

    const matchesSearch = !term || 
                          (entry.platformName && entry.platformName.toLowerCase().includes(term)) ||
                          (entry.config?.apiUrl && entry.config.apiUrl.toLowerCase().includes(term)) || // Search in config.apiUrl
                          (entry.apiUrl && entry.apiUrl.toLowerCase().includes(term)); // Search in old apiUrl
    
    const matchesStatus = statusFilter === undefined || statusFilter === '' || entry.status === statusFilter;
    const matchesPlatformType = platformTypeFilter === undefined || platformTypeFilter === '' || entry.platformType === platformTypeFilter;

    return matchesSearch && matchesStatus && matchesPlatformType;
  });
});

// Helper to get initial form values
const getInitialApiForm = () => ({
  platformName: '',
  platformType: null,
  description: '',
  apiUrl: '', // For Custom or fallback
  config: {},
  status: 'active',
});

const handlePlatformTypeChange = (selectedType) => {
  // Reset config when platform type changes to avoid carrying over old config fields
  apiForm.value.config = {};
  // Optionally, pre-fill default values for the new platform type if any
};

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Fetch API Platform Types
const fetchApiPlatformTypes = async () => {
  try {
    const response = await apiService.getApiPlatformTypes();
    platformTypes.value = response.data;
  } catch (error) {
    console.error('Error fetching API platform types:', error);
    Message.error('获取可用平台类型失败');
    platformTypes.value = ['ComfyUI', 'OpenAI', 'StabilityAI', 'Midjourney', 'DallE', 'Custom']; // Fallback
  }
};

// Fetch API Entries
const fetchApiEntries = async () => {
  isLoading.value = true;
  try {
    const params = {
      page: pagination.current,
      limit: pagination.pageSize,
      // query: searchTerm.value || undefined, 
      // platformType: selectedPlatformTypeFilter.value || undefined,
      // status: selectedStatus.value || undefined,
    };
    // Ensure apiService.getApiEntries or its underlying call (e.g., apiService.get('/api-entries')) handles these params
    const response = await apiService.getApiEntries(params); 
    if (response.data && response.data.data && typeof response.data.totalRecords === 'number') { // Check for paginated structure
      apiEntries.value = response.data.data;
      pagination.total = response.data.totalRecords;
    } else if (Array.isArray(response.data)) { // Fallback if it returns a simple array
      apiEntries.value = response.data;
      pagination.total = response.data.length;
      // Consider logging a warning here if pagination was expected but not received
      // console.warn("fetchApiEntries received a flat array, expected paginated response.");
    } else {
      // Handle other unexpected structures
      console.error("fetchApiEntries received an unexpected response structure:", response.data);
      apiEntries.value = [];
      pagination.total = 0;
    }
  } catch (error) {
    console.error('Error fetching API entries:', error);
    apiEntries.value = []; 
    pagination.total = 0;
    // Message.error might be handled by apiService interceptor
  } finally {
    isLoading.value = false;
  }
};

// Refresh function
const refreshApiEntries = () => {
    searchTerm.value = '';
    selectedStatus.value = undefined;
    selectedPlatformTypeFilter.value = undefined;
    pagination.current = 1; // Reset to first page
    fetchApiEntries();
    fetchApiPlatformTypes(); 
};

const handlePageChange = (page) => {
  pagination.current = page;
  fetchApiEntries();
};

const handlePageSizeChange = (pageSize) => {
  pagination.pageSize = pageSize;
  pagination.current = 1; // Reset to first page
  fetchApiEntries();
};

// --- Modal Logic ---
const openCreateModal = () => {
    apiForm.value = getInitialApiForm();
    isEditMode.value = false;
    currentApiEntry.value = null;
    modalVisible.value = true;
    apiFormRef.value?.clearValidate();
};

const editApiEntry = (entry) => {
    currentApiEntry.value = entry;
    apiForm.value = { 
        _id: entry._id,
        platformName: entry.platformName,
        platformType: entry.platformType,
        description: entry.description || '',
        apiUrl: entry.apiUrl || '', // For fallback/Custom
        config: entry.config ? { ...entry.config } : {}, // Deep copy config
        status: entry.status,
     }; 
    isEditMode.value = true;
    modalVisible.value = true;
    apiFormRef.value?.clearValidate();
};

const handleCancel = () => {
    modalVisible.value = false;
};

const handleSubmit = async () => {
    const validationResult = await apiFormRef.value?.validate();
    if (validationResult) {
      Message.error('请检查表单输入项是否有效。');
      return false;
    }

    isSubmitting.value = true;
    try {
        const dataToSubmit = JSON.parse(JSON.stringify(apiForm.value)); // Deep copy

        // Ensure the top-level dataToSubmit.apiUrl is correctly populated
        if (dataToSubmit.platformType && platformSpecificFields[dataToSubmit.platformType]) {
            const specificPlatformFields = platformSpecificFields[dataToSubmit.platformType];
            // Check if the platform defines its URL within the 'config' object (e.g., ComfyUI, Custom)
            const platformDefinesUrlInConfig = specificPlatformFields.find(f => f.name === 'apiUrl');

            if (platformDefinesUrlInConfig && dataToSubmit.config && dataToSubmit.config.apiUrl) {
                // If so, use this config.apiUrl as the primary top-level apiUrl.
                dataToSubmit.apiUrl = dataToSubmit.config.apiUrl;
            }
            // If platformDefinesUrlInConfig is false (e.g., OpenAI, StabilityAI),
            // dataToSubmit.apiUrl (from the generic apiForm.apiUrl input) is already correctly set.
        }
        // If !dataToSubmit.platformType (no platform type selected),
        // dataToSubmit.apiUrl (from the generic apiForm.apiUrl input) is also correctly set.
        
        if (isEditMode.value && currentApiEntry.value?._id) {
            await apiService.updateApiEntry(currentApiEntry.value._id, dataToSubmit);
            Message.success('API 条目更新成功');
        } else {
            await apiService.createApiEntry(dataToSubmit);
            Message.success('API 条目添加成功');
        }
        modalVisible.value = false;
        fetchApiEntries();
    } catch (error) {
        console.error('Error submitting API entry:', error);
        if (error.response && error.response.data && error.response.data.message) {
            Message.error(`操作失败: ${error.response.data.message}`);
        } else {
            Message.error('操作失败，请稍后重试。');
        }
    } finally {
        isSubmitting.value = false;
    }
};

const confirmDeleteApiEntry = (entry) => {
  if (entry.usageCount && entry.usageCount > 0) {
    Message.warning(`该API被 ${entry.usageCount} 个应用使用，无法删除`);
    return;
  }
  AModal.confirm({
    title: '确认删除',
    content: `您确定要删除 API 条目 "${entry.platformName}" 吗？此操作不可撤销。`,
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      try {
        await apiService.deleteApiEntry(entry._id);
        Message.success(`API 条目 "${entry.platformName}" 已删除`);
        fetchApiEntries();
      } catch (error) {
        console.error('Error deleting API entry:', error);
         if (error.response && error.response.data && error.response.data.message) {
            Message.error(`删除失败: ${error.response.data.message}`);
        } else {
            Message.error('删除失败，请稍后重试。');
        }
      }
    },
  });
};

onMounted(() => {
  fetchApiEntries();
  fetchApiPlatformTypes();
});
</script>

<style scoped>
/* Add any specific styles if needed */
.arco-table-cell .arco-typography {
  margin-bottom: 0;
}
</style> 