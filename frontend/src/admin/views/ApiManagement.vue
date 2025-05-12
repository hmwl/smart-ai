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
        <!-- Add Filters later if needed (e.g., by status) -->
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
      <a-table :data="filteredApiEntries" :pagination="{ pageSize: 15 }" row-key="_id" stripe :scroll="{ x: 1100 }">
        <template #columns>
          <a-table-column title="ID" data-index="_id" :width="180">
               <template #cell="{ record }">
                   {{ record._id }}
               </template>
           </a-table-column>
          <a-table-column title="平台名称" data-index="platformName" :width="180" :sortable="{ sortDirections: ['ascend', 'descend'] }"></a-table-column>
          <a-table-column title="简介" data-index="description" ellipsis tooltip></a-table-column>
          <a-table-column title="API 地址" data-index="apiUrl" :width="300" ellipsis tooltip>
            <template #cell="{ record }">
              <a :href="record.apiUrl" target="_blank" class="text-blue-600 hover:underline">{{ record.apiUrl }} <icon-launch /></a>
            </template>
          </a-table-column>
          <a-table-column title="状态" data-index="status" :width="100" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              <a-tag :color="record.status === 'active' ? 'green' : 'red'">
                {{ record.status === 'active' ? '活动' : '禁用' }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="使用数" data-index="usageCount" :width="120" align="center" :sortable="{ sortDirections: ['ascend', 'descend'] }">
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
      width="600px"
    >
      <a-form ref="apiFormRef" :model="apiForm" :rules="formRules" layout="vertical">
        <a-form-item field="platformName" label="平台名称">
          <a-input v-model="apiForm.platformName" placeholder="例如：ComfyUI" />
        </a-form-item>
        <a-form-item field="description" label="简介">
          <a-textarea v-model="apiForm.description" placeholder="简要描述 API 的功能（可选）" :auto-size="{ minRows: 2, maxRows: 4 }" />
        </a-form-item>
        <a-form-item field="apiUrl" label="API 地址">
          <a-input v-model="apiForm.apiUrl" placeholder="例如：https://api.example.com/weather" />
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
import { ref, onMounted, computed } from 'vue';
import { 
    Message, Modal, Table as ATable, TableColumn as ATableColumn, Spin as ASpin, 
    Tag as ATag, Button as AButton, Space as ASpace, Form as AForm, FormItem as AFormItem,
    Input as AInput, Textarea as ATextarea, Select as ASelect, Option as AOption, 
    InputSearch as AInputSearch,
    Tooltip as ATooltip
} from '@arco-design/web-vue';
import { IconRefresh, IconPlus, IconLaunch } from '@arco-design/web-vue/es/icon';

const apiEntries = ref([]);
const isLoading = ref(false);
const searchTerm = ref('');
const selectedStatus = ref(undefined);
const modalVisible = ref(false);
const isEditMode = ref(false);
const currentApiEntry = ref(null);
const apiFormRef = ref(null);
const apiForm = ref({});
const isSubmitting = ref(false);

// Validation Rules
const formRules = {
  platformName: [{ required: true, message: '请输入平台名称' }],
  apiUrl: [
    { required: true, message: '请输入 API 地址' },
    { type: 'url', message: '请输入有效的 URL 格式' },
    { match: /^https?:\/\/.+/, message: 'URL 必须以 http:// 或 https:// 开头' }
  ],
  status: [{ required: true, message: '请选择状态' }],
};

// Filtered API Entries
const filteredApiEntries = computed(() => {
  return apiEntries.value.filter(entry => {
    const term = searchTerm.value.toLowerCase().trim();
    const statusFilter = selectedStatus.value;

    const matchesSearch = !term || 
                          entry.platformName.toLowerCase().includes(term) ||
                          entry.apiUrl.toLowerCase().includes(term);
    
    const matchesStatus = statusFilter === undefined || statusFilter === '' || entry.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
});

// Helper to get initial form values
const getInitialApiForm = () => ({
  platformName: '',
  description: '',
  apiUrl: '',
  status: 'active',
});

// Helper function to format date (reuse if available globally, otherwise define here)
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Fetch API Entries
const fetchApiEntries = async () => {
  isLoading.value = true;
  const accessToken = localStorage.getItem('accessToken');
  if (!accessToken) { Message.error('未认证'); isLoading.value = false; return; }

  try {
    const response = await fetch('/api/external-apis', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) {
             Message.error(`无权限 (${response.status})`);
        } else {
            throw new Error(`获取 API 列表失败: ${response.status} ${errorData.message || ''}`);
        }
        return;
    }
    apiEntries.value = await response.json();
  } catch (error) {
    Message.error(error.message);
    apiEntries.value = []; 
  } finally {
    isLoading.value = false;
  }
};

// Refresh function to clear filters and fetch data
const refreshApiEntries = () => {
    searchTerm.value = '';
    selectedStatus.value = undefined;
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
        description: entry.description || '',
        apiUrl: entry.apiUrl,
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
    if (validationResult) return false;

    isSubmitting.value = true;
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) { Message.error('认证令牌丢失'); isSubmitting.value = false; return false; }

    let url = '/api/external-apis';
    let method = 'POST';
    const payload = { ...apiForm.value };
    delete payload._id; // Remove frontend ID before sending

    if (isEditMode.value) {
        url = `/api/external-apis/${currentApiEntry.value._id}`;
        method = 'PUT';
    }

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '无法解析错误信息' }));
            let errorMessage = `${isEditMode.value ? '更新' : '创建'}失败: ${response.status}`;
            if (errorData.message) {
                 errorMessage += ` - ${errorData.message}`;
             }
            throw new Error(errorMessage);
        }
        Message.success(`API 条目 ${isEditMode.value ? '更新' : '创建'}成功！`);
        await fetchApiEntries();
        modalVisible.value = false;
        return true;
    } catch (error) {
        Message.error(error.message);
        return false;
    } finally {
        isSubmitting.value = false;
    }
};

// --- Delete Logic ---
const confirmDeleteApiEntry = (entry) => {
    Modal.confirm({
        title: '确认删除',
        content: `确定要删除 API 条目 "${entry.platformName}" 吗？此操作不可恢复。`, 
        okText: '确认删除',
        cancelText: '取消',
        okButtonProps: { status: 'danger' },
        onOk: async () => {
           return new Promise(async (resolve, reject) => {
                const accessToken = localStorage.getItem('accessToken');
                if (!accessToken) { Message.error('认证令牌丢失'); reject(new Error('No token')); return; }
                 try {
                    const response = await fetch(`/api/external-apis/${entry._id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                     if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ message: '无法解析错误信息' }));
                        let errorMessage = `删除失败: ${response.status}`;
                        if (errorData.message) errorMessage += ` - ${errorData.message}`; 
                        throw new Error(errorMessage);
                    }
                     Message.success(`API 条目 "${entry.platformName}" 已删除。`);
                    await fetchApiEntries();
                    resolve(true);
                } catch (error) {
                    Message.error(error.message || '删除时发生错误');
                    reject(error);
                }
           });
        }
    });
};

// --- Lifecycle Hook ---
onMounted(() => {
  fetchApiEntries();
});

</script>

<style scoped>
/* Add styles if needed */
.arco-table-cell .arco-btn-text {
  padding-left: 2px;
  padding-right: 2px;
}
</style> 