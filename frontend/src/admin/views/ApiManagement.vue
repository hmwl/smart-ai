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
            @search="fetchApiEntries" 
            @press-enter="fetchApiEntries"
         />
        <a-select 
          v-model="selectedPlatformTypeFilter" 
          placeholder="按平台类型筛选" 
          allow-clear 
          style="width: 180px;" 
          @change="fetchApiEntries" 
          :loading="loadingPlatformTypes"
        >
            <a-option v-for="ptype in platformTypes" :key="ptype" :value="ptype">{{ ptype }}</a-option>
        </a-select>
         <a-select v-model="selectedStatus" placeholder="按状态筛选" allow-clear style="width: 150px;" @change="fetchApiEntries">
            <a-option value="active">活动</a-option>
            <a-option value="inactive">禁用</a-option>
        </a-select>
        <!-- Platform Management Button -->
        <a-button type="primary" status="warning" @click="openPlatformManagementModal">
          <template #icon><icon-settings /></template>平台管理
        </a-button>
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
          <a-table-column title="平台类型" data-index="platformType" :width="150" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              <a-tag v-if="record.platform && record.platform.name" :color="getPlatformColor(record.platform.name)">
                {{ record.platform.name }}
              </a-tag>
              <a-tag v-else-if="record.platformType" :color="getPlatformColor(record.platformType)">
                {{ record.platformType }} 
              </a-tag>
              <span v-else>-</span>
            </template>
          </a-table-column>
          <a-table-column title="简介" data-index="description" ellipsis tooltip :width="250"></a-table-column>
          <a-table-column title="API 地址/关键配置" data-index="apiUrl" :width="300" ellipsis tooltip>
            <template #cell="{ record }">
              <div v-if="(record.platform?.name === 'ComfyUI' || record.platformType === 'ComfyUI') && record.config && record.config.apiUrl">
                <a :href="record.config.apiUrl" target="_blank" class="text-blue-600 hover:underline">{{ record.config.apiUrl }} <icon-launch /></a>
              </div>
              <div v-else-if="(record.platform?.name === 'OpenAI' || record.platformType === 'OpenAI') && record.config && record.config.apiKey">
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
          <a-table-column title="创建时间" data-index="createdAt" :width="200" :sortable="{ sortDirections: ['ascend', 'descend'] }">
             <template #cell="{ record }">
               {{ formatDateCN(record.createdAt) }}
             </template>
           </a-table-column>
           <a-table-column title="更新时间" data-index="updatedAt" :width="200" :sortable="{ sortDirections: ['ascend', 'descend'] }">
             <template #cell="{ record }">
               {{ formatDateCN(record.updatedAt) }}
             </template>
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
      :visible="modalVisible"
      :title="isEditMode ? '编辑 API：' + currentApiEntry?.platformName : '添加新 API'"
      @ok="handleSubmit"
      @cancel="handleCancel"
      :ok-text="isEditMode ? '更新 API' : '创建 API'"
      :confirm-loading="isSubmitting"
      unmount-on-close
      width="650px"
    >
      <a-form ref="apiFormRef" :model="apiForm" :rules="formRules" layout="vertical">
        <a-form-item field="platformName" label="平台实例名称">
          <a-input v-model="apiForm.platformName" placeholder="例如：我的 ComfyUI 服务" />
        </a-form-item>
        
        <a-form-item field="platformType" label="平台类型">
          <a-select 
            v-model="apiForm.platformType" 
            placeholder="选择平台类型" 
            @change="handlePlatformTypeChangeInForm" 
            allow-clear 
            :loading="loadingPlatformTypes"
          >
            <a-option v-for="ptype in platformTypes" :key="ptype" :value="ptype">{{ ptype }}</a-option>
          </a-select>
        </a-form-item>

        <a-form-item field="description" label="简介 (可选)">
          <a-textarea v-model="apiForm.description" placeholder="简要描述 API 的功能" :auto-size="{ minRows: 2, maxRows: 4 }" />
        </a-form-item>

        <!-- Dynamic Config Fields -->
        <div v-if="apiForm.platformType && currentPlatformConfigFields.length > 0">
          <h4 class="text-sm font-medium mb-2 mt-3 text-gray-600">{{ apiForm.platformType }} 特定配置:</h4>
          <div v-for="field in currentPlatformConfigFields" :key="field.key">
            <a-form-item 
              :field="`config.${field.key}`" 
              :label="field.label + '（' + field.key + '）'"
              :rules="field.required ? [{ required: true, message: `${field.label}不能为空` }] : []"
            >
              <!-- 文本输入框 -->
              <a-input 
                v-if="field.type === 'text'"
                v-model="apiForm.config[field.key]" 
                :placeholder="field.placeholder || `请输入${field.label}`"
                allow-clear
              />
              <!-- 下拉选择框 -->
              <a-select
                v-else-if="field.type === 'select'"
                v-model="apiForm.config[field.key]"
                :placeholder="field.placeholder || `请选择${field.label}`"
                allow-clear
              >
                <a-option 
                  v-for="option in field.options" 
                  :key="option.key" 
                  :value="option.key"
                >
                  {{ option.value }}({{ option.key }})
                </a-option>
              </a-select>
              <!-- 多选框 -->
              <a-select
                v-else-if="field.type === 'multiSelect'"
                v-model="apiForm.config[field.key]"
                :placeholder="field.placeholder || `请选择${field.label}`"
                multiple
                allow-clear
              >
                <a-option 
                  v-for="option in field.options" 
                  :key="option.key" 
                  :value="option.key"
                >
                  {{ option.value }}({{ option.key }})
                </a-option>
              </a-select>
            </a-form-item>
          </div>
        </div>
        
        <!-- Fallback API URL for 'Custom' type or older entries without specific config structure -->
        <a-form-item v-if="!apiForm.platformType || !currentPlatformConfigFields.some(f => f.key === 'apiUrl')" field="apiUrl" label="API 地址 (通用)">
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

    <platform-management-modal 
      v-model:visible="platformModalVisible"
      @success="handlePlatformManagementSuccess"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, reactive } from 'vue';
import { 
    Message, Modal as AModal, Table as ATable, TableColumn as ATableColumn, Spin as ASpin, 
    Tag as ATag, Button as AButton, Space as ASpace, Form as AForm, FormItem as AFormItem,
    Input as AInput, Textarea as ATextarea, Select as ASelect, Option as AOption, 
    InputSearch as AInputSearch,
    Tooltip as ATooltip,
    Popconfirm as APopconfirm
} from '@arco-design/web-vue';
import { IconRefresh, IconPlus, IconLaunch, IconSettings } from '@arco-design/web-vue/es/icon';
import apiService from '@/admin/services/apiService';
import PlatformManagementModal from '../components/PlatformManagementModal.vue';
import { formatDateCN } from '@/admin/utils/date';

const apiEntries = ref([]);
const isLoading = ref(false);
const searchTerm = ref('');
const selectedPlatformTypeFilter = ref(undefined);
const selectedStatus = ref(undefined);
const modalVisible = ref(false);
const isEditMode = ref(false);
const currentApiEntry = ref(null);
const apiFormRef = ref(null);
const apiForm = ref({ config: {} });
const isSubmitting = ref(false);

const platformTypes = ref([]);
const platforms = ref([]); // 存储完整的平台信息，包括配置字段
const loadingPlatformTypes = ref(false);
const platformModalVisible = ref(false);

const pagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [10, 15, 20, 50, 100],
});

// 动态获取当前选中平台的配置字段
const currentPlatformConfigFields = computed(() => {
  if (!apiForm.value.platformType) return [];
  const platform = platforms.value.find(p => p.name === apiForm.value.platformType);
  return platform?.configFields || [];
});

const isGenericApiUrlFieldVisible = computed(() => {
  if (!apiForm.value.platformType) return true;
  const specificFields = currentPlatformConfigFields.value;
  if (!specificFields) return true;
  return !specificFields.find(field => field.key === 'apiUrl');
});

const formRules = computed(() => {
  const rules = {
    platformName: [{ required: true, message: '请输入平台实例名称' }],
    platformType: [{ required: true, message: '请选择平台类型' }],
    status: [{ required: true, message: '请选择状态' }],
  };

  if (isGenericApiUrlFieldVisible.value) {
    rules.apiUrl = [
        { required: true, message: '请输入 API 地址' },
        { type: 'url', message: '请输入有效的 URL 格式' },
        { match: /^https?:\/\/.+/, message: 'URL 必须以 http:// 或 https:// 开头' }
    ];
  }

  if (apiForm.value.platformType && currentPlatformConfigFields.value) {
    currentPlatformConfigFields.value.forEach(field => {
      if (field.required) {
        rules[`config.${field.key}`] = [{ required: true, message: `${field.label}不能为空` }];
        if (field.type === 'text' && (field.key.toLowerCase().includes('url') || field.key.toLowerCase().includes('uri'))) {
           rules[`config.${field.key}`].push(
            { type: 'url', message: '请输入有效的 URL 格式' },
            { match: /^https?:\/\/.+/, message: 'URL 必须以 http:// 或 https:// 开头' }
          );
        }
      }
    });
  }
  return rules;
});

const filteredApiEntries = computed(() => {
  return apiEntries.value.filter(entry => {
    const term = searchTerm.value.toLowerCase().trim();
    const statusFilter = selectedStatus.value;
    const platformTypeFilter = selectedPlatformTypeFilter.value;

    const matchesSearch = !term || 
                          (entry.platformName && entry.platformName.toLowerCase().includes(term)) ||
                          (entry.config?.apiUrl && entry.config.apiUrl.toLowerCase().includes(term)) ||
                          (entry.apiUrl && entry.apiUrl.toLowerCase().includes(term));
    
    const matchesStatus = statusFilter === undefined || statusFilter === '' || entry.status === statusFilter;
    const matchesPlatformType = platformTypeFilter === undefined || platformTypeFilter === '' || entry.platformType === platformTypeFilter;

    return matchesSearch && matchesStatus && matchesPlatformType;
  });
});

const getInitialApiForm = () => ({
  platformName: '',
  platformType: null,
  description: '',
  apiUrl: '',
  config: {},
  status: 'active',
});

const handlePlatformTypeChangeInForm = async (value, isInitialLoad = false) => {
  if (!isInitialLoad) {
    apiForm.value.config = {}; 
  }
  
  if (value) {
    // 获取平台信息并设置配置字段默认值
    const platform = platforms.value.find(p => p.name === value);
    if (platform) {
      apiForm.value.platform = platform._id;
      
      // 为配置字段设置默认值（仅在非编辑模式或字段为空时）
      if (platform.configFields) {
        platform.configFields.forEach(field => {
          if (field.defaultValue !== undefined && field.defaultValue !== '' && (!apiForm.value.config[field.key] || !isInitialLoad)) {
            if (!apiForm.value.config) {
              apiForm.value.config = {};
            }
            // 处理多选字段的默认值
            if (field.type === 'multiSelect' && Array.isArray(field.defaultValue)) {
              apiForm.value.config[field.key] = [...field.defaultValue];
            } else {
              apiForm.value.config[field.key] = field.defaultValue;
            }
          }
        });
      }
    }
  }
  
  apiFormRef.value?.clearValidate(['config']);
};

const fetchApiEntries = async () => {
  isLoading.value = true;
  try {
    const params = {
      page: pagination.current,
      limit: pagination.pageSize,
      searchTerm: searchTerm.value || undefined,
      platformType: selectedPlatformTypeFilter.value || undefined,
      status: selectedStatus.value || undefined,
    };
    const response = await apiService.getApiEntries(params);
    if (response.data && Array.isArray(response.data)) {
      apiEntries.value = response.data;
      pagination.total = response.data.length; 
    } else if (response.data && response.data.data) {
        apiEntries.value = response.data.data;
        pagination.total = response.data.totalRecords;
    } else {
      apiEntries.value = [];
      pagination.total = 0;
    }
  } catch (error) {
    Message.error('获取 API 列表失败: ' + (error.response?.data?.message || error.message));
    apiEntries.value = [];
    pagination.total = 0;
  } finally {
    isLoading.value = false;
  }
};

const fetchPlatformTypes = async () => {
  loadingPlatformTypes.value = true;
  try {
    // 获取完整的平台信息
    const platformsResponse = await apiService.getPlatforms(); 
    if (platformsResponse.data && Array.isArray(platformsResponse.data)) {
      platforms.value = platformsResponse.data;
      // 提取活跃平台的名称作为平台类型
      platformTypes.value = platformsResponse.data
        .filter(platform => platform.status === 'active')
        .map(platform => platform.name);
    }
  } catch (error) {
    Message.error('获取平台类型列表失败: ' + (error.response?.data?.message || error.message));
    platformTypes.value = [];
    platforms.value = [];
  } finally {
    loadingPlatformTypes.value = false;
  }
};

const refreshApiEntries = () => {
  fetchApiEntries();
  fetchPlatformTypes();
};

const handlePageChange = (page) => {
  pagination.current = page;
  fetchApiEntries();
};

const handlePageSizeChange = (pageSize) => {
  pagination.pageSize = pageSize;
  pagination.current = 1;
  fetchApiEntries();
};

const openCreateModal = () => {
  isEditMode.value = false;
  currentApiEntry.value = null;
  apiForm.value = {
    platformName: '',
    platformType: undefined,
    description: '',
    apiUrl: '',
    config: {},
    status: 'active',
  };
  apiFormRef.value?.clearValidate();
  modalVisible.value = true;
};

const editApiEntry = (entry) => {
  isEditMode.value = true;
  currentApiEntry.value = JSON.parse(JSON.stringify(entry));
  
  // 初始化配置对象，包含默认值
  const config = entry.config ? JSON.parse(JSON.stringify(entry.config)) : {};
  
  apiForm.value = {
    _id: entry._id,
    platformName: entry.platformName,
    platformType: entry.platform?.name || entry.platformType,
    platform: entry.platform?._id || entry.platform,
    description: entry.description || '',
    apiUrl: entry.apiUrl || '',
    config,
    status: entry.status,
  };
  
  // 设置平台类型后，为配置字段设置默认值
  handlePlatformTypeChangeInForm(apiForm.value.platformType, true);
  apiFormRef.value?.clearValidate();
  modalVisible.value = true;
};

const handleCancel = () => {
  modalVisible.value = false;
  apiFormRef.value?.clearValidate();
};

const handleSubmit = async () => {
  const validationResult = await apiFormRef.value?.validate();
  // If validationResult is an object (truthy), it means validation failed.
  if (validationResult) {
    // Optional: Scroll to the first error field
    const firstErrorField = Object.keys(validationResult)[0];
    if (firstErrorField && apiFormRef.value?.scrollToField) {
      apiFormRef.value.scrollToField(firstErrorField);
    }
    return false; // Prevent modal from closing
  }

  isSubmitting.value = true;
  try {
    const payload = { ...apiForm.value };
    
    // 确保platform字段正确设置
    if (payload.platformType && !payload.platform) {
      const foundPlatform = platforms.value.find(p => p.name === payload.platformType);
      if (foundPlatform) {
        payload.platform = foundPlatform._id; // Ensure platform ID is sent
      }
    }
    // console.log('Submitting API Entry Payload:', payload);

    if (isEditMode.value) {
      await apiService.updateApiEntry(currentApiEntry.value._id, payload);
      Message.success('API 更新成功');
    } else {
      await apiService.createApiEntry(payload);
      Message.success('API 添加成功');
    }
    modalVisible.value = false;
    fetchApiEntries();
    // return true; // Optional: return true on success
  } catch (error) {
    Message.error('操作失败: ' + (error.response?.data?.message || error.message));
    return false; // Keep modal open if API call fails
  } finally {
    isSubmitting.value = false;
  }
};

const confirmDeleteApiEntry = (entry) => {
  AModal.confirm({
    title: '确认删除',
    content: `确定要删除 API 条目 "${entry.platformName}" 吗？此操作不可恢复。`,
    okText: '删除',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      try {
        await apiService.deleteApiEntry(entry._id);
        Message.success('API 删除成功');
        fetchApiEntries();
      } catch (error) {
        Message.error('删除失败: ' + (error.response?.data?.message || error.message));
      }
    },
  });
};

watch([searchTerm, selectedPlatformTypeFilter, selectedStatus], () => {
  pagination.current = 1;
  fetchApiEntries();
});

const handlePlatformManagementSuccess = () => {
  fetchPlatformTypes();
  fetchApiEntries();
};

const getPlatformColor = (platformName) => {
  if (!platformName) return 'gray';
  let hash = 0;
  for (let i = 0; i < platformName.length; i++) {
    hash = platformName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['blue', 'green', 'orange', 'red', 'purple', 'cyan', 'magenta', 'volcano', 'gold', 'lime'];
  return colors[Math.abs(hash) % colors.length];
};

const openPlatformManagementModal = () => {
  platformModalVisible.value = true;
};

onMounted(() => {
  fetchApiEntries();
  fetchPlatformTypes();
});
</script>

<style scoped>
/* Add any specific styles if needed */
.arco-table-cell .arco-typography {
  margin-bottom: 0;
}
</style> 