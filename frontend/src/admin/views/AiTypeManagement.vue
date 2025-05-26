<template>
  <div>
    <!-- Toolbar -->
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">类型管理</h2>
      <a-space>
        <!-- Search Input -->
        <a-input-search
          v-model="searchTerm"
          placeholder="按名称或 URI 搜索"
          allow-clear
          style="width: 250px;"
         />
        <!-- Status Filter -->
         <a-select v-model="selectedStatus" placeholder="按状态筛选" allow-clear style="width: 150px;">
            <a-option value="active">活动</a-option>
            <a-option value="inactive">禁用</a-option>
        </a-select>
        <!-- Action Buttons -->
        <a-button type="primary" @click="openCreateModal">
          <template #icon><icon-plus /></template> 添加 AI 类型
        </a-button>
        <a-button @click="refreshAiTypes" :loading="loading">
          <template #icon><icon-refresh /></template> 刷新
        </a-button>
      </a-space>
    </div>

    <!-- Table -->
    <a-spin :loading="loading" tip="加载 AI 类型..." class="w-full">
      <a-table 
        :data="filteredData" 
        :loading="loading" 
        :pagination="pagination" 
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        row-key="_id" 
        stripe 
        :scroll="{ x: 'max-content' }"
       >
        <template #columns>
          <a-table-column title="ID" data-index="_id" key="_id" :width="180">
            <template #cell="{ record }">
              {{ record._id }}
            </template>
          </a-table-column>
          <a-table-column title="名称" data-index="name" key="name" :sortable="{ sortDirections: ['ascend', 'descend'] }"></a-table-column>
          <a-table-column title="URI" data-index="uri" key="uri" :sortable="{ sortDirections: ['ascend', 'descend'] }"></a-table-column>
          <!-- Status Column Added -->
          <a-table-column title="状态" data-index="status" key="status" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              <a-tag :color="record.status === 'active' ? 'green' : 'red'">
                {{ record.status === 'active' ? '活动' : '禁用' }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="使用数" data-index="usageCount" key="usageCount" align="center" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              <a-tag color="arcoblue" v-if="typeof record.usageCount === 'number'">{{ record.usageCount }}</a-tag>
              <span v-else>-</span>
            </template>
          </a-table-column>
          <a-table-column title="创建时间" data-index="createdAt" key="createdAt" :sortable="{ sortDirections: ['ascend', 'descend'] }">
              <template #cell="{ record }">
                {{ formatDateCN(record.createdAt) }}
              </template>
          </a-table-column>
          <!-- Actions Updated -->
          <a-table-column title="操作" key="action" :width="150" fixed="right" align="center"> 
              <template #cell="{ record }">
                <a-space>
                   <a-button type="text" status="warning" size="mini" @click="editAiType(record)">编辑</a-button>
                   <a-tooltip v-if="record.usageCount && record.usageCount > 0" :content="`该类型被 ${record.usageCount} 个AI应用使用，无法删除`">
                     <a-button type="text" status="danger" size="mini" disabled>删除</a-button>
                   </a-tooltip>
                   <a-button v-else type="text" status="danger" size="mini" @click="confirmDeleteAiType(record)">删除</a-button>
                 </a-space>
              </template>
          </a-table-column>
        </template>
      </a-table>
    </a-spin>

    <!-- Create/Edit Modal Updated -->
    <a-modal
      v-model:visible="modalVisible"
      :title="isEditing ? `编辑 AI 类型: ${currentAiType?.name}` : '添加新 AI 类型'"
      @ok="handleSubmit"
      @cancel="handleCancel"
      :confirm-loading="modalLoading"
      unmount-on-close
      width="600px"
    >
      <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical">
        <a-form-item field="name" label="名称">
          <a-input v-model="formState.name" placeholder="请输入 AI 类型名称" />
        </a-form-item>
        <a-form-item field="uri" label="URI (唯一标识符)" tooltip="URI 必须以字母或下划线开头，且只包含字母、数字、下划线或中划线">
          <a-input v-model="formState.uri" placeholder="例如：text_generation, image_enhancement" />
        </a-form-item>
        <!-- Status Field Added -->
        <a-form-item field="status" label="状态">
           <a-select v-model="formState.status" placeholder="请选择状态">
            <a-option value="active">Active (活动)</a-option>
            <a-option value="inactive" :disabled="isEditing && currentAiType && currentAiType.usageCount > 0">
                Inactive (禁用)
                <span v-if="isEditing && currentAiType && currentAiType.usageCount > 0" class="text-xs text-gray-500 ml-1">
                    (被{{currentAiType.usageCount}}个应用使用)
                </span>
            </a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, computed } from 'vue';
// Imports Updated
import { 
    Message, Modal, InputSearch, Button, Table as ATable, TableColumn as ATableColumn, Space, Form, FormItem, Input,
    Spin as ASpin, Tag as ATag, Select as ASelect, Option as AOption,
    Tooltip as ATooltip // Import Tooltip
} from '@arco-design/web-vue';
import { IconRefresh, IconPlus } from '@arco-design/web-vue/es/icon';
import apiService from '../services/apiService';
import { formatDateCN } from '@/admin/utils/date';

// --- Refs and Reactive State Updated ---
const aiTypes = ref([]);
const loading = ref(false);
const searchTerm = ref('');
const selectedStatus = ref(''); // For status filter dropdown
const modalVisible = ref(false);
const modalLoading = ref(false);
const isEditing = ref(false);
const currentAiType = ref(null); // Stores the full object being edited
const formRef = ref(null);

const pagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [10, 15, 20, 50, 100],
});

// --- Helper Functions ---
const getInitialFormState = () => ({
  _id: null, // Keep track of ID for editing
  name: '',
  uri: '',
  status: 'active', // Default status added
});

const formState = reactive(getInitialFormState());

// --- Form Rules Updated ---
const rules = {
  name: [{ required: true, message: '请输入 AI 类型名称' }],
  uri: [
    { required: true, message: '请输入 URI' },
    {
      pattern: /^[a-zA-Z_][a-zA-Z0-9_-]*$/,
      message: 'URI 必须以字母或下划线开头，且只包含字母、数字、下划线或中划线'
    }
  ],
   status: [{ required: true, message: '请选择状态' }], // Status rule added
};

// --- Computed Properties Updated (Filter includes status) ---
const filteredData = computed(() => {
  return aiTypes.value.filter(type => {
    const term = searchTerm.value.toLowerCase().trim();
    const statusFilter = selectedStatus.value;

    const matchesSearch = !term || 
                          type.name.toLowerCase().includes(term) || 
                          type.uri.toLowerCase().includes(term);
    
    const matchesStatus = statusFilter === undefined || statusFilter === '' || type.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
});

// --- API Interaction Updated ---
const fetchAiTypes = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.current,
      limit: pagination.pageSize,
    };
    const response = await apiService.get('/ai-types', { params }); 
    if (response.data && response.data.data) {
      aiTypes.value = response.data.data;
      pagination.total = response.data.totalRecords;
    } else {
      aiTypes.value = response.data || []; 
      pagination.total = response.data?.length || 0;
    }
  } catch (error) {
    Message.error('获取 AI 类型列表失败: ' + (error.response?.data?.message || error.message));
    aiTypes.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
};

// Refresh function added
const refreshAiTypes = () => {
    searchTerm.value = '';
    selectedStatus.value = '';
    pagination.current = 1; // Reset to first page
    fetchAiTypes();
};

const handlePageChange = (page) => {
  pagination.current = page;
  fetchAiTypes();
};

const handlePageSizeChange = (pageSize) => {
  pagination.pageSize = pageSize;
  pagination.current = 1; // Reset to first page
  fetchAiTypes();
};

// --- Modal Logic Updated ---
const openCreateModal = () => {
  Object.assign(formState, getInitialFormState()); // Reset form using helper
  isEditing.value = false;
  currentAiType.value = null;
  modalVisible.value = true;
  formRef.value?.clearValidate(); // Use optional chaining
};

// Renamed from showEditModal, updated logic
const editAiType = (typeRecord) => {
  currentAiType.value = typeRecord; // Store the whole record
  // --- Revision: Use Object.assign to ensure reactivity ---
  Object.assign(formState, {
    _id: typeRecord._id,
    name: typeRecord.name,
    uri: typeRecord.uri,
    status: typeRecord.status,
  });
  // --- End Revision ---

  isEditing.value = true;
  modalVisible.value = true;
  formRef.value?.clearValidate();
};

const handleCancel = () => {
  modalVisible.value = false;
};

// Submit logic updated for create/update and status
const handleSubmit = async () => {
    const validationResult = await formRef.value?.validate();
    if (validationResult) return false; // Validation failed

    modalLoading.value = true;
    let url = '/ai-types';
    let method = 'POST';
    // Prepare payload, including status
    const payload = { ...formState }; 
    if (!isEditing.value) {
        delete payload._id; // Don't send null _id for POST
    }


    if (isEditing.value && currentAiType.value?._id) {
        url = `/ai-types/${currentAiType.value._id}`;
        method = 'PUT';
        delete payload._id; // Don't send _id in the body for PUT if it's in the URL
    } else if (isEditing.value) {
        Message.error('错误：尝试编辑但未找到 AI 类型 ID。');
        modalLoading.value = false;
        return false;
    }


    try {
        if (method === 'POST') {
            await apiService.post(url, payload);
            Message.success('AI 类型创建成功');
        } else { // PUT
             await apiService.put(url, payload);
             Message.success('AI 类型更新成功');
        }
        modalVisible.value = false;
        await fetchAiTypes(); // Refresh list
        return true;
    } catch (error) {
        // Better error handling
        const errorMsg = error.response?.data?.message || error.message || '发生未知错误';
        Message.error(`操作失败: ${errorMsg}`);
        console.error("Error during submit:", error);
        return false;
    } finally {
        modalLoading.value = false;
    }
};


// --- Delete Logic Updated (Using Modal.confirm) ---
const confirmDeleteAiType = (typeRecord) => {
    Modal.confirm({
        title: '确认删除',
        content: `确定要删除 AI 类型 "${typeRecord.name}" (URI: ${typeRecord.uri}) 吗？此操作不可恢复。`,
        okText: '确认删除',
        cancelText: '取消',
        okButtonProps: { status: 'danger' },
        onOk: async () => {
           try {
                await apiService.delete(`/ai-types/${typeRecord._id}`);
                Message.success(`AI 类型 "${typeRecord.name}" 已删除。`);
                await fetchAiTypes(); // Refresh list
                return true; // Indicate success to Modal
            } catch (error) {
                Message.error(`删除失败: ${error.response?.data?.message || error.message}`);
                console.error("Error deleting AI Type:", error);
                return false; // Indicate failure to Modal
            }
        },
        onCancel: () => {
          // Optional: Add logic if needed when cancellation occurs
        }
    });
};


// --- Lifecycle Hook ---
onMounted(fetchAiTypes);

</script>

<style scoped>
/* Consistent button padding */
.arco-table-cell .arco-btn-text {
  padding-left: 2px;
  padding-right: 2px;
}
/* Add other styles if needed */
</style> 