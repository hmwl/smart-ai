<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">应用管理</h2>
      <a-space>
        <a-input-search 
          v-model="searchTerm" 
          placeholder="搜索应用名称" 
          allow-clear
          style="width: 250px;"
        />
        <a-select v-model="selectedType" placeholder="按类型筛选" allow-clear style="width: 150px;">
          <a-option value="website">网站</a-option>
          <a-option value="miniapp">小程序</a-option>
        </a-select>
        <a-select v-model="selectedStatus" placeholder="按状态筛选" allow-clear style="width: 150px;">
          <a-option value="active">活动</a-option>
          <a-option value="disabled">禁用</a-option>
        </a-select>
        <a-button type="primary" @click="openCreateModal">
          <template #icon><icon-plus /></template> 添加应用
        </a-button>
        <a-button @click="refreshApplications" :loading="isLoading">
          <template #icon><icon-refresh /></template> 刷新
        </a-button>
      </a-space>
    </div>

    <a-spin :loading="isLoading" tip="加载应用列表中..." class="w-full">
      <a-table
        :data="filteredApplications"
        :pagination="pagination"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        row-key="_id"
        stripe
        :scroll="{ x: 'max-content' }" 
      >
        <template #columns>
           <a-table-column title="ID" data-index="_id" :width="120">
               <template #cell="{ record }">
                   {{ record._id }}
               </template>
           </a-table-column>
           <a-table-column title="名称" data-index="name" :sortable="{ sortDirections: ['ascend', 'descend'] }" :width="200"></a-table-column>
           <a-table-column title="类型" data-index="type" :width="100" :sortable="{ sortDirections: ['ascend', 'descend'] }">
               <template #cell="{ record }">
                   <a-tag 
                     :color="record.type === 'website' ? 'blue' : (record.type === 'miniapp' ? 'green' : 'gray')"
                   >
                     {{ { website: '网站', miniapp: '小程序' }[record.type] || record.type }}
                   </a-tag>
               </template>
           </a-table-column>
           <a-table-column title="所属人" data-index="owner.username" :width="120">
               <template #cell="{ record }">
                    {{ record.owner?.username || '未知' }} <!-- Handle case where owner might not be populated -->
               </template>
           </a-table-column>
           <a-table-column title="状态" data-index="status" :width="100" :sortable="{ sortDirections: ['ascend', 'descend'] }">
              <template #cell="{ record }">
                <a-tag :color="record.status === 'active' ? 'green' : 'red'">
                  {{ record.status === 'active' ? '活动' : '禁用' }}
                </a-tag>
              </template>
           </a-table-column>
           <a-table-column title="创建时间" data-index="createdAt" :sortable="{ sortDirections: ['ascend', 'descend'] }" :width="200">
             <template #cell="{ record }">
                {{ formatDateCN(record.createdAt) }}
             </template>
           </a-table-column>
            <a-table-column title="更新时间" data-index="updatedAt" :sortable="{ sortDirections: ['ascend', 'descend'] }" :width="200">
             <template #cell="{ record }">
                {{ formatDateCN(record.updatedAt) }}
             </template>
           </a-table-column>
           <a-table-column title="操作" :width="150" fixed="right">
             <template #cell="{ record }">
                <a-button type="text" size="mini" @click="viewApp(record)" disabled>配置</a-button>
                <a-button type="text" status="warning" size="mini" @click="openEditModal(record)">编辑</a-button>
                <a-button type="text" status="danger" size="mini" @click="confirmDeleteApp(record)">删除</a-button>
             </template>
           </a-table-column>
        </template>
      </a-table>
    </a-spin>

    <!-- Create/Edit Application Modal -->
    <a-modal
      :visible="modalVisible"
      :title="isEditMode ? '编辑应用：' + currentApp?.name : '创建新应用'"
      @ok="handleSubmit"
      @cancel="handleCancel"
      :ok-text="isEditMode ? '更新应用' : '创建应用'"
      :confirm-loading="isSubmitting"
      unmount-on-close
      width="600px"
    >
      <a-form ref="appFormRef" :model="appForm" layout="vertical">
        <a-form-item field="name" label="应用名称" :rules="[{ required: true, message: '请输入应用名称' }]" validate-trigger="blur">
          <a-input v-model="appForm.name" placeholder="例如: 我的网站" />
        </a-form-item>
        <a-form-item field="type" label="应用类型" :rules="[{ required: true, message: '请选择应用类型' }]" validate-trigger="change">
          <a-select v-model="appForm.type" placeholder="选择类型">
            <a-option value="website">Web 网站</a-option>
            <a-option value="miniapp">MiniApp 小程序</a-option>
             <!-- Add other types if needed -->
          </a-select>
        </a-form-item>
        <a-form-item field="status" label="状态" :rules="[{ required: true, message: '请选择状态' }]" validate-trigger="change">
          <a-select v-model="appForm.status" placeholder="选择状态">
            <a-option value="active">Active (活动)</a-option>
            <a-option value="disabled">Disabled (禁用)</a-option>
          </a-select>
        </a-form-item>
        <a-form-item field="config" label="配置信息 (JSON 格式, 可选)">
           <a-textarea v-model="appForm.config" placeholder='{ "apiKey": "value", ... }' :auto-size="{ minRows: 3, maxRows: 6 }" />
           <!-- Consider adding JSON validation or a dedicated editor later -->
        </a-form-item>
      </a-form>
    </a-modal>

  </div>
</template>

<script setup>
import { ref, onMounted, computed, reactive } from 'vue';
import {
    Message,
    Table as ATable,
    TableColumn as ATableColumn,
    Spin as ASpin,
    Tag as ATag,
    Button as AButton,
    Space as ASpace,
    Modal as AModal,
    Form as AForm,
    FormItem as AFormItem,
    Input as AInput,
    Textarea as ATextarea,
    Select as ASelect,
    Option as AOption,
    Popconfirm as APopconfirm,
    InputSearch as AInputSearch
} from '@arco-design/web-vue';
import { IconRefresh, IconPlus } from '@arco-design/web-vue/es/icon';
import { debounce } from 'lodash-es';
import apiService from '../services/apiService';
import { formatDateCN } from '@/admin/utils/date';

const applications = ref([]);
const isLoading = ref(false);
const searchTerm = ref('');
const selectedType = ref(undefined);
const selectedStatus = ref(undefined);

// Modal State
const modalVisible = ref(false);
const isEditMode = ref(false);
const currentApp = ref(null);
const appFormRef = ref(null);
const appForm = ref({});
const isSubmitting = ref(false);

const pagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [10, 15, 20, 50, 100],
});

// Filtered applications based on search term AND filters
const filteredApplications = computed(() => {
  return applications.value.filter(app => {
    const term = searchTerm.value.toLowerCase().trim();
    const typeFilter = selectedType.value;
    const statusFilter = selectedStatus.value;

    const matchesSearch = !term || app.name.toLowerCase().includes(term);
    // Treat undefined AND empty string as "no filter"
    const matchesType = typeFilter === undefined || typeFilter === '' || app.type === typeFilter;
    const matchesStatus = statusFilter === undefined || statusFilter === '' || app.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });
});

// Helper to get initial form values
const getInitialForm = () => ({
    name: '',
    type: undefined, // Use undefined for placeholder to show
    status: 'active',
    config: ''
});

const fetchApplications = async () => {
  isLoading.value = true;
  try {
    const params = {
      page: pagination.current,
      limit: pagination.pageSize,
      // You might want to pass current filters (searchTerm, selectedType, selectedStatus) to backend for server-side filtering
      // name: searchTerm.value || undefined, 
      // type: selectedType.value || undefined,
      // status: selectedStatus.value || undefined,
    };
    const response = await apiService.get('/applications', { params }); // Using apiService
    if (response.data && response.data.data) { // Assuming paginated response
      applications.value = response.data.data;
      pagination.total = response.data.totalRecords;
    } else {
      // Fallback for non-paginated or unexpected response structure
      applications.value = response.data || [];
      pagination.total = response.data?.length || 0;
      // console.warn('Received non-standard paginated response for applications');
    }
  } catch (error) {
    // Error handling is simplified as apiService interceptor should handle common cases like auth
    console.error('Error fetching applications:', error);
    if (!error.response) { // Network or other non-HTTP errors
        Message.error('加载应用列表失败，请检查网络连接或联系管理员。');
    }
    // Specific error messages can still be shown if needed, but apiService might already do it.
    applications.value = [];
    pagination.total = 0;
  } finally {
    isLoading.value = false;
  }
};

// Refresh applications and clear search/filters
const refreshApplications = () => {
    searchTerm.value = '';
    selectedType.value = undefined;
    selectedStatus.value = undefined;
    pagination.current = 1; // Reset to first page
    fetchApplications();
};

const handlePageChange = (page) => {
  pagination.current = page;
  fetchApplications();
};

const handlePageSizeChange = (pageSize) => {
  pagination.pageSize = pageSize;
  pagination.current = 1; // Reset to first page
  fetchApplications();
};

// --- Modal Logic ---

const openCreateModal = () => {
    appForm.value = getInitialForm();
    isEditMode.value = false;
    currentApp.value = null;
    modalVisible.value = true;
    appFormRef.value?.clearValidate(); // Clear validation state
};

const openEditModal = (app) => {
    currentApp.value = app;
    appForm.value = {
        name: app.name,
        type: app.type,
        status: app.status,
        // Stringify config for textarea, handle potential non-string config
        config: typeof app.config === 'object' ? JSON.stringify(app.config, null, 2) : (app.config || '')
    };
    isEditMode.value = true;
    modalVisible.value = true;
    appFormRef.value?.clearValidate(); // Clear validation state
};

const handleCancel = () => {
    modalVisible.value = false;
    // Form reset is handled by unmount-on-close or manually if needed
};

const handleSubmit = async () => {
    const validationResult = await appFormRef.value?.validate();
    if (validationResult) {
        const firstErrorField = Object.keys(validationResult)[0];
        if (firstErrorField && appFormRef.value?.scrollToField) {
            appFormRef.value.scrollToField(firstErrorField);
        }
        Message.error('请完善必填项信息');
        return false;
    }

    isSubmitting.value = true;
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
        Message.error('认证令牌丢失，请重新登录。');
        isSubmitting.value = false;
        localStorage.clear(); window.location.reload();
        return false;
    }

    let url = '/api/applications';
    let method = 'POST';

    // Prepare payload, attempt to parse config if not empty
    const payload = { ...appForm.value };
    if (payload.config) {
        try {
            payload.config = JSON.parse(payload.config);
        } catch (e) {
            Message.error('配置信息不是有效的 JSON 格式。');
            isSubmitting.value = false;
            return false; // Keep modal open
        }
    } else {
        // Ensure config is at least an empty object if submitted empty
        // Or handle as per backend requirements (maybe delete key)
        payload.config = {};
    }


    if (isEditMode.value) {
        url = `/api/applications/${currentApp.value._id}`;
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
            let errorMessage = `${isEditMode.value ? '更新' : '创建'}应用失败: ${response.status}`;
            if (errorData.message) {
                errorMessage += ` - ${errorData.message}`;
            }
            if (response.status === 401 || response.status === 403) {
                errorMessage = `认证失败或无权限 (${response.status})，请重新登录。`;
                localStorage.clear(); window.location.reload();
            }
            // Handle specific errors like 400 (validation), 409 (conflict) if needed
            throw new Error(errorMessage);
        }

        // Success
        Message.success(`应用 ${isEditMode.value ? '更新' : '创建'}成功！`);
        await fetchApplications(); // Refresh the list
        modalVisible.value = false; // Close modal
        return true;

    } catch (error) {
        console.error(`Error ${isEditMode.value ? 'updating' : 'creating'} application:`, error);
        Message.error(error.message || `处理应用时发生错误`);
        return false; // Keep modal open on error
    } finally {
        isSubmitting.value = false;
    }
};

// --- Delete Application Logic ---
const confirmDeleteApp = (app) => {
    AModal.confirm({
        title: '确认删除',
        content: `您确定要删除应用 "${app.name}" 吗？此操作不可恢复。`,
        okText: '确认删除',
        cancelText: '取消',
        okButtonProps: {
            status: 'danger'
        },
        onOk: async () => {
            return new Promise(async (resolve, reject) => {
                const accessToken = localStorage.getItem('accessToken');
                if (!accessToken) {
                    Message.error('认证令牌丢失，请重新登录。');
                    localStorage.clear(); window.location.reload();
                    reject(new Error('No access token'));
                    return;
                }
                try {
                    const response = await fetch(`/api/applications/${app._id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                        }
                    });
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ message: '无法解析错误信息' }));
                        let errorMessage = `删除应用失败: ${response.status}`;
                        if (errorData.message) {
                            errorMessage += ` - ${errorData.message}`;
                        }
                         if (response.status === 401 || response.status === 403) {
                            errorMessage = `认证失败或无权限 (${response.status}) ${errorData.message ? '- ' + errorData.message : ''}。`;
                        }
                        throw new Error(errorMessage);
                    }
                    Message.success(`应用 "${app.name}" 已成功删除。`);
                    await fetchApplications(); // Refresh list
                    resolve(true);
                } catch (error) {
                    console.error('Error deleting application:', error);
                    Message.error(error.message || '删除应用时发生错误');
                    reject(error);
                }
            });
        }
    });
};

// Placeholder functions for other actions
const viewApp = (app) => Message.info(`配置应用: ${app.name} (功能待实现)`);

onMounted(() => {
  fetchApplications();
});
</script>

<style scoped>
/* Add specific styles if needed */
.arco-table-cell .arco-btn-text {
  padding-left: 2px;
  padding-right: 2px;
}
.arco-form {
    margin-top: 10px; /* Add some space above form */
}
</style> 