<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">枚举管理</h2>
      <a-space>
        <a-input-search
          v-model="searchParams.name"
          placeholder="搜索配置名称"
          style="width: 200px;"
          allow-clear
          @search="fetchEnumConfigs"
          @press-enter="fetchEnumConfigs"
        />
        <a-select
          v-model="searchParams.platform"
          placeholder="筛选平台"
          style="width: 150px;"
          allow-clear
          @change="fetchEnumConfigs"
        >
          <a-option v-for="platform in platformTypes" :key="platform" :value="platform">
            {{ platform }}
          </a-option>
        </a-select>
        <a-select
          v-model="searchParams.enumTypeId"
          placeholder="筛选类型"
          style="width: 150px;"
          allow-clear
          :loading="loadingEnumTypes"
          show-search
          :filter-option="filterOption"
          @change="fetchEnumConfigs"
        >
          <a-option v-for="type in enumTypesForFilter" :key="type._id" :value="type._id">
            {{ type.name }} ({{ type.platform }})
          </a-option>
        </a-select>
        <a-select
          v-model="searchParams.status"
          placeholder="筛选状态"
          style="width: 120px;"
          allow-clear
          @change="fetchEnumConfigs"
        >
          <a-option value="active">有效</a-option>
          <a-option value="inactive">无效</a-option>
        </a-select>
        <a-button type="primary" status="warning" @click="openTypeManagementModal">
          <template #icon><icon-settings /></template>类型管理
        </a-button>
        <a-button type="primary" @click="openAddConfigModal">
          <template #icon><icon-plus /></template>添加配置
        </a-button>
        <a-button @click="refreshList" :loading="loading">
          <template #icon><icon-refresh /></template> 刷新
        </a-button>
      </a-space>
    </div>

    <a-spin :loading="loading" tip="加载枚举配置列表中..." class="w-full">
      <a-table
        :columns="columns"
        :data="enumConfigs"
        :loading="loading"
        :pagination="pagination"
        row-key="_id"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        :scroll="{ x: 'max-content' }"
      >
        <template #platform="{ record }">
          <a-tag :color="getPlatformColor(record.platform)">{{ record.platform }}</a-tag>
        </template>
        <template #enumType="{ record }">
          {{ record.enumType?.name || 'N/A' }}
        </template>
        <template #usageCount="{ record }">
          <a-tag :color="record.usageCount > 0 ? 'blue' : 'default'">
            {{ record.usageCount || 0 }}
          </a-tag>
        </template>
        <template #status="{ record }">
          <a-tag :color="record.status === 'active' ? 'green' : 'orangered'">
            {{ record.status === 'active' ? '有效' : '无效' }}
          </a-tag>
        </template>
        <template #createdAt="{ record }">
          {{ formatDate(record.createdAt) }}
        </template>
        <template #actions="{ record }">
          <a-space>
            <a-button
              type="text"
              size="mini"
              status="warning"
              @click="openEditConfigModal(record)"
            >
              编辑
            </a-button>
            <a-tooltip v-if="record.usageCount && record.usageCount > 0" :content="`此配置被 ${record.usageCount} 个地方使用，无法删除。`">
              <a-button
                type="text"
                size="mini"
                status="danger"
                disabled
              >
                删除
              </a-button>
            </a-tooltip>
            <a-button
              v-else
              type="text"
              size="mini"
              status="danger"
              @click="handleDeleteConfig(record._id, record.usageCount)"
            >
              删除
            </a-button>
          </a-space>
        </template>
      </a-table>
    </a-spin>

    <enum-config-form-modal
      v-model:visible="configModalVisible"
      :is-edit="isEditMode"
      :record-data="currentConfigRecord"
      :platform-types="platformTypes"
      :enum-types="enumTypesForFilter" 
      @success="onConfigFormSuccess"
    />

    <enum-type-management-modal
      v-model:visible="typeManagementModalVisible"
      :platform-types="platformTypes"
      @success="onTypeManagementSuccess"
    />

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import { 
  IconPlus, IconEdit, IconDelete, IconSettings, IconSearch, IconRefresh 
} from '@arco-design/web-vue/es/icon';
import apiService from '@/admin/services/apiService';
import EnumConfigFormModal from '../components/EnumConfigFormModal.vue';
import EnumTypeManagementModal from '../components/EnumTypeManagementModal.vue';

const enumConfigs = ref([]);
const loading = ref(false);
const loadingEnumTypes = ref(false);
const platformTypes = ref([]);
const enumTypesForFilter = ref([]); // For the filter dropdown

const searchParams = reactive({
  name: '',
  platform: undefined,
  enumTypeId: undefined,
  status: undefined,
});

const pagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [10, 15, 20, 50, 100],
});

const columns = [
  { title: 'ID', dataIndex: '_id', key: '_id', width: 100, ellipsis: true, tooltip: true },
  { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true, tooltip: true, width: 200 },
  { title: '类型', key: 'enumType', slotName: 'enumType', width: 150 },
  { title: '翻译', dataIndex: 'translation', key: 'translation', ellipsis: true, tooltip: true, width: 180 },
  { title: '说明', dataIndex: 'description', key: 'description', ellipsis: true, tooltip: true, width: 180 },
  { title: '平台', key: 'platform', slotName: 'platform', width: 120 },
  { title: '使用数', dataIndex: 'usageCount', key: 'usageCount', slotName: 'usageCount', width: 90, align: 'center' },
  { title: '状态', key: 'status', slotName: 'status', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180, slotName: 'createdAt' },
  { title: '操作', key: 'actions', slotName: 'actions', width: 150, fixed: 'right', align: 'center' },
];

// --- Modal State ---
const configModalVisible = ref(false);
const typeManagementModalVisible = ref(false);
const isEditMode = ref(false);
const currentConfigRecord = ref(null);

// --- Fetching Data ---
const fetchEnumConfigs = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.current,
      limit: pagination.pageSize,
      name: searchParams.name || undefined,
      platform: searchParams.platform || undefined,
      enumTypeId: searchParams.enumTypeId || undefined,
      status: searchParams.status || undefined,
    };
    const response = await apiService.getEnumConfigs(params);
    if (response.data && response.data.data) {
      enumConfigs.value = response.data.data;
      pagination.total = response.data.totalRecords;
    } else {
      enumConfigs.value = [];
      pagination.total = 0;
    }
  } catch (error) {
    Message.error('获取枚举配置列表失败: ' + (error.response?.data?.message || error.message));
    enumConfigs.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
};

const fetchPlatformTypes = async () => {
  try {
    // Assuming getApiPlatformTypes is an existing method that returns an array of strings
    const response = await apiService.getApiPlatformTypes(); 
    if (response.data && Array.isArray(response.data)) {
      platformTypes.value = response.data;
    }
  } catch (error) {
    Message.error('获取平台类型失败: ' + (error.response?.data?.message || error.message));
  }
};

const fetchAllEnumTypesForFilter = async () => {
  loadingEnumTypes.value = true;
  try {
    // Fetch all types for the filter, no pagination needed here usually
    const response = await apiService.getEnumTypes();
    if (response.data && Array.isArray(response.data)) {
      enumTypesForFilter.value = response.data;
    }
  } catch (error) {
    Message.error('获取所有枚举类型作筛选用失败: ' + (error.response?.data?.message || error.message));
  } finally {
    loadingEnumTypes.value = false;
  }
};


// --- Event Handlers ---
const handlePageChange = (page) => {
  pagination.current = page;
  fetchEnumConfigs();
};

const handlePageSizeChange = (pageSize) => {
  pagination.pageSize = pageSize;
  pagination.current = 1;
  fetchEnumConfigs();
};

const refreshList = () => {
  searchParams.name = '';
  searchParams.platform = undefined;
  searchParams.enumTypeId = undefined;
  searchParams.status = undefined;
  pagination.current = 1;
  fetchEnumConfigs();
  fetchAllEnumTypesForFilter();
};

const openAddConfigModal = () => {
  isEditMode.value = false;
  currentConfigRecord.value = null;
  configModalVisible.value = true;
};

const openEditConfigModal = (record) => {
  isEditMode.value = true;
  currentConfigRecord.value = { ...record }; // Clone to avoid direct mutation
  configModalVisible.value = true;
};

const onConfigFormSuccess = () => {
  fetchEnumConfigs(); // Refresh list after successful add/edit
  // Optionally, if a type was added/updated that might affect filters:
  // fetchAllEnumTypesForFilter(); 
};

const handleDeleteConfig = async (id, isUsed) => {
  if (isUsed) {
    Message.error('此配置已被使用，不可删除。');
    return;
  }
  try {
    await apiService.deleteEnumConfig(id);
    Message.success('删除成功');
    fetchEnumConfigs(); // Refresh list
  } catch (error) {
    Message.error('删除失败: ' + (error.response?.data?.message || error.message));
  }
};

const openTypeManagementModal = () => {
  typeManagementModalVisible.value = true;
};

const onTypeManagementSuccess = () => {
  // When types are managed (added/edited/deleted),
  // we should refresh the enum types used for filtering in the main page.
  fetchAllEnumTypesForFilter();
  // Also, refresh the main enum configs list as types might affect them (e.g. display name)
  fetchEnumConfigs(); 
};

// --- Utils ---
const formatDate = (dateString) => {
  // console.log('formatDate input:', dateString);
  // console.log('formatDate new Date():', new Date(dateString));
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getPlatformColor = (platform) => {
  // Basic color mapping, can be extended
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

const filterOption = (inputValue, option) => {
  // For <a-select> with show-search
  return option.children[0].children.toLowerCase().includes(inputValue.toLowerCase());
};


onMounted(() => {
  fetchPlatformTypes();
  fetchAllEnumTypesForFilter();
  fetchEnumConfigs();
});

</script>

<style scoped>
/* Add specific styles for AdminPanel if needed */
.arco-table-cell .arco-btn-text {
  padding-left: 2px;
  padding-right: 2px;
}
</style>
