<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">用户管理</h2>
      <a-space>
        <a-input-search 
           v-model="searchTerm" 
           placeholder="搜索用户 (用户名或邮箱)" 
           allow-clear
           style="width: 250px;"
        />
        <a-select v-model="selectedStatus" placeholder="按状态筛选" allow-clear style="width: 150px;">
          <a-option value="active">正常</a-option>
          <a-option value="disabled">禁用</a-option>
        </a-select>
        <a-select v-model="selectedIsAdmin" placeholder="按管理员筛选" allow-clear style="width: 150px;">
          <a-option :value="true">是</a-option>
          <a-option :value="false">否</a-option>
        </a-select>
        <a-button type="primary" @click="openCreateModal">
             <template #icon><icon-plus /></template> 创建用户
        </a-button>
        <a-button @click="refreshUsers" :loading="isLoading">
          <template #icon><icon-refresh /></template> 刷新
        </a-button>
      </a-space>
    </div>

    <a-spin :loading="isLoading" tip="加载用户列表中..." class="w-full">
      <a-table
        :data="filteredUsers"
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
           <a-table-column title="用户名" data-index="username" :sortable="{ sortDirections: ['ascend', 'descend'] }" :width="200"></a-table-column>
           <a-table-column title="邮箱" data-index="email" :width="200">
              <template #cell="{ record }">
                {{ record.email || '-' }} <!-- Display dash if no email -->
              </template>
           </a-table-column>
           <a-table-column title="状态" data-index="status" :sortable="{ sortDirections: ['ascend', 'descend'] }">
              <template #cell="{ record }">
                <a-tag :color="record.status === 'active' ? 'green' : 'red'">
                  {{ record.status === 'active' ? '正常' : '禁用' }}
                </a-tag>
              </template>
           </a-table-column>
           <a-table-column title="管理员" data-index="isAdmin" :sortable="{ sortDirections: ['ascend', 'descend'] }" :width="100">
             <template #cell="{ record }">
                <a-tag :color="record.isAdmin ? 'blue' : 'gray'">{{ record.isAdmin ? '是' : '否' }}</a-tag>
             </template>
           </a-table-column>
           <!-- New Column for Credits Balance -->
           <a-table-column title="积分余额" data-index="creditsBalance" :width="120" align="right" :sortable="{ sortDirections: ['ascend', 'descend'] }">
             <template #cell="{ record }">
                {{ typeof record.creditsBalance === 'number' ? record.creditsBalance : '-' }}
             </template>
           </a-table-column>
           <a-table-column title="注册时间" data-index="createdAt" :sortable="{ sortDirections: ['ascend', 'descend'] }" :width="200">
             <template #cell="{ record }">
                {{ formatDateCN(record.createdAt) }}
             </template>
           </a-table-column>
            <a-table-column title="上次登录" data-index="lastLoginAt" :sortable="{ sortDirections: ['ascend', 'descend'] }" :width="200">
             <template #cell="{ record }">
                {{ record.lastLoginAt ? formatDateCN(record.lastLoginAt) : '从未登录' }}
             </template>
           </a-table-column>
           <!-- TODO: Add Actions column (Edit, Delete, Change Status) -->
           <a-table-column title="操作" :width="150" fixed="right">
             <template #cell="{ record }">
                <a-button type="text" status="warning" size="mini" @click="editUser(record)">编辑</a-button>
                <a-tooltip 
                  v-if="record.username === 'admin'" 
                  content="不允许删除 'admin' 用户。"
                >
                  <a-button type="text" status="danger" size="mini" disabled>删除</a-button>
                </a-tooltip>
                <a-tooltip 
                  v-else-if="record.isAdmin && adminUsersCount <= 1" 
                  content="系统中至少需要保留一名管理员。"
                >
                  <a-button type="text" status="danger" size="mini" disabled>删除</a-button>
                </a-tooltip>
                <a-button 
                  v-else 
                  type="text" 
                  status="danger" 
                  size="mini" 
                  @click="confirmDeleteUser(record)"
                >删除</a-button>
             </template>
           </a-table-column>
        </template>
      </a-table>
    </a-spin>

    <!-- User Create/Edit Modal -->
    <a-modal
      v-model:visible="userModalVisible"
      :title="isEditMode ? `编辑用户: ${currentUser?.username}` : '创建新用户'"
      @ok="handleSubmit"
      @cancel="handleCancel"
      :confirm-loading="isSubmitting"
      unmount-on-close 
    >
      <a-form ref="userFormRef" :model="userForm" :rules="formRules" layout="vertical">
        <!-- Username (Required for Create, Readonly for Edit) -->
        <a-form-item field="username" label="用户名" :rules="isEditMode ? [] : [{ required: true, message: '请输入用户名' }]" validate-trigger="blur">
          <a-input v-model="userForm.username" placeholder="输入用户名" :disabled="isEditMode" />
        </a-form-item>
        
        <!-- Email (Optional for Create, still validate format if provided) -->
         <a-form-item field="email" label="邮箱" :rules="[{ type: 'email', message: '请输入有效的邮箱格式' }]" validate-trigger="blur">
           <a-input v-model="userForm.email" placeholder="输入用户邮箱 (可选)" />
         </a-form-item>

        <!-- Password (Required for Create, Optional for Edit) -->
        <a-form-item field="password" label="新密码" :rules="isEditMode ? [] : [{ required: true, message: '请输入密码' }]" validate-trigger="blur">
          <a-input-password v-model="userForm.password" :placeholder="isEditMode ? '留空则不修改密码' : '输入登录密码'" allow-clear />
        </a-form-item>

         <!-- Confirm Password (Only for Create) -->
         <a-form-item v-if="!isEditMode" field="confirmPassword" label="确认密码" :rules="[{ required: true, message: '请再次输入密码' }, { validator: validatePasswordMatch }]" validate-trigger="blur">
           <a-input-password v-model="userForm.confirmPassword" placeholder="再次输入登录密码" allow-clear />
         </a-form-item>

        <a-form-item field="status" label="状态">
          <a-select v-model="userForm.status" placeholder="选择用户状态">
            <a-option value="active">Active (正常)</a-option>
            <a-option value="disabled">Disabled (禁用)</a-option>
          </a-select>
        </a-form-item>

        <a-form-item field="isAdmin" label="管理员权限">
          <a-switch v-model="userForm.isAdmin" />
        </a-form-item>

        <!-- Credit Modification Section (Only for Edit Mode) -->
        <template v-if="isEditMode">
          <a-divider orientation="center">积分调整</a-divider>
          <a-form-item field="creditModification.type" label="积分修改方式">
            <a-select 
              v-model="userForm.creditModification.type" 
              placeholder="选择修改方式 (默认不修改)"
              allow-clear
              @change="handleCreditModificationTypeChange"
            >
              <a-option value="grant">赠送积分</a-option>
              <a-option value="adjust">调整积分</a-option>
            </a-select>
          </a-form-item>

          <a-form-item 
            v-if="userForm.creditModification && userForm.creditModification.type"
            field="creditModification.amount" 
            label="积分变动数额" 
            :rules="[{ required: true, message: '请输入积分变动数额' }, { type: 'number', message: '请输入有效的数字'}, { validator: validateCreditAmount }]"
          >
            <a-input-number 
              v-model="userForm.creditModification.amount" 
              :placeholder="userForm.creditModification.type === 'adjust' ? '正数为增加，负数为扣减' : '输入赠送的积分数额 (非负数)'"
              style="width: 100%;"
            />
          </a-form-item>

          <a-form-item 
            v-if="userForm.creditModification && userForm.creditModification.type"
            field="creditModification.reason" 
            label="变动原因说明" 
            :rules="[{ required: true, message: '请输入变动原因' }]"
          >
            <a-textarea 
              v-model="userForm.creditModification.reason" 
              placeholder="例如：新用户注册奖励，活动补偿等"
              :auto-size="{minRows:2, maxRows:4}"
            />
          </a-form-item>
        </template>
        <!-- End Credit Modification Section -->

      </a-form>
    </a-modal>

  </div>
</template>

<script setup>
import { ref, onMounted, computed, reactive } from 'vue';
import {
    Message,
    Modal,
    Table as ATable,
    TableColumn as ATableColumn,
    Spin as ASpin,
    Tag as ATag,
    Button as AButton,
    Modal as AModal,
    Form as AForm,
    FormItem as AFormItem,
    Input as AInput,
    InputPassword as AInputPassword,
    Select as ASelect,
    Option as AOption,
    Switch as ASwitch,
    Space as ASpace,
    InputSearch as AInputSearch,
    Divider as ADivider
} from '@arco-design/web-vue';
import { IconRefresh, IconPlus, IconEdit, IconDelete } from '@arco-design/web-vue/es/icon';
import { debounce } from 'lodash-es';
import apiService from '@/admin/services/apiService';
import { formatDateCN } from '@/admin/utils/date';

const users = ref([]);
const isLoading = ref(false);
const userModalVisible = ref(false);
const isEditMode = ref(false);
const currentUser = ref(null);
const userFormRef = ref(null);
const userForm = ref({});
const isSubmitting = ref(false);
const searchTerm = ref('');
const selectedStatus = ref(undefined); // Filter state for status (undefined means all)
const selectedIsAdmin = ref(undefined); // Filter state for isAdmin (undefined means all)

const pagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [10, 15, 20, 50, 100],
});

// Computed property to count admin users
const adminUsersCount = computed(() => {
  return users.value.filter(user => user.isAdmin).length;
});

// Helper to get initial form values
const getInitialUserForm = () => ({
  username: '',
  email: '',
  password: '',
  confirmPassword: '', // Added for create validation
  status: 'active',
  isAdmin: false,
  creditModification: { // Added for credit modification
    type: null,
    amount: null,
    reason: ''
  }
});

// --- Password confirmation validator --- 
const validatePasswordMatch = (value, callback) => {
    if (!isEditMode.value && value !== userForm.value.password) {
        callback('两次输入的密码不一致');
    }
    callback();
};

// Combine rules (optional, can keep inline too)
const formRules = computed(() => {
    // Add more rules here if needed, e.g., password complexity
    return {
        // email: [{ required: !isEditMode.value, message: '请输入邮箱' }, { type: 'email', message: '请输入有效的邮箱格式' }],
        // Other fields are handled inline for now
    };
});

// Filtered users based on search term AND filters
const filteredUsers = computed(() => {
  const term = searchTerm.value.toLowerCase().trim();
  const statusFilter = selectedStatus.value;
  const isAdminFilter = selectedIsAdmin.value;


  const filtered = users.value.filter((user, index) => {
    const matchesSearch = !term || 
                          user.username.toLowerCase().includes(term) ||
                          (user.email && user.email.toLowerCase().includes(term));

    // Treat undefined AND empty string as "no filter" for status
    const matchesStatus = statusFilter === undefined || statusFilter === '' || user.status === statusFilter;
    
    // Treat undefined AND empty string as "no filter" for isAdmin
    // Note: user.isAdmin is boolean, isAdminFilter might be boolean, undefined, or ''
    const matchesAdmin = isAdminFilter === undefined || isAdminFilter === '' || user.isAdmin === isAdminFilter;

    // Log first few items for detail
    // if (index < 3) { 
    // }

    return matchesSearch && matchesStatus && matchesAdmin;
  });
  return filtered;
});

// Fetch users function
const fetchUsers = async () => {
  isLoading.value = true;
  try {
    const params = {
      page: pagination.current,
      limit: pagination.pageSize,
      // query: searchTerm.value || undefined, // If backend supports generic search
      // status: selectedStatus.value || undefined,
      // isAdmin: selectedIsAdmin.value, // Note: undefined might be treated differently by backend than false
    };
    const response = await apiService.get('/users', { params });
    if (response.data && response.data.data) { // Assuming paginated response
      users.value = response.data.data;
      pagination.total = response.data.totalRecords;
    } else {
      // Fallback for non-paginated or unexpected response structure
      users.value = response.data || [];
      pagination.total = response.data?.length || 0;
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    if (!error.response) {
        Message.error('加载用户列表失败，请检查网络连接。');
    }
    users.value = [];
    pagination.total = 0;
  } finally {
    isLoading.value = false;
  }
};

// Refresh users and clear search/filters
const refreshUsers = () => {
    searchTerm.value = '';
    selectedStatus.value = undefined;
    selectedIsAdmin.value = undefined;
    pagination.current = 1; // Reset to first page
    fetchUsers();
};

const handlePageChange = (page) => {
  pagination.current = page;
  fetchUsers();
};

const handlePageSizeChange = (pageSize) => {
  pagination.pageSize = pageSize;
  pagination.current = 1; // Reset to first page
  fetchUsers();
};

// --- Modal Logic ---
const openCreateModal = () => {
    userForm.value = getInitialUserForm();
    isEditMode.value = false;
    currentUser.value = null;
    userModalVisible.value = true;
    userFormRef.value?.clearValidate(); // Clear validation on open
};

const editUser = (user) => {
  currentUser.value = user;
  // Reset password fields for edit mode
  userForm.value = { 
      ...user, 
      password: '', // Clear password for edit
      confirmPassword: '', // Clear confirm password
      creditModification: { // Initialize/reset credit modification part
        type: null,
        amount: null,
        reason: ''
      }
  };
  isEditMode.value = true;
  userModalVisible.value = true;
  userFormRef.value?.clearValidate(); // Clear validation on open
};

const handleCancel = () => {
  userModalVisible.value = false;
};

// --- Handle Submit (Create/Update) ---
const handleSubmit = async () => {
  const validationResult = await userFormRef.value?.validate();
  if (validationResult) { 
    // Scroll to the first error field for better UX if validationResult is an object of errors
    const firstErrorField = Object.keys(validationResult)[0];
    if (firstErrorField && userFormRef.value?.scrollToField) {
        userFormRef.value.scrollToField(firstErrorField);
    }
    return false; 
  }

  isSubmitting.value = true;

  // Construct payload, removing confirmPassword and password if empty during edit
  let payload = { ...userForm.value };
  delete payload.confirmPassword; 

  if (isEditMode.value && !payload.password) {
    delete payload.password; // Don't send empty password for update if not changed
  }
  if (!isEditMode.value && !payload.password) {
    Message.error('创建用户时密码不能为空');
    isSubmitting.value = false;
    return false;
  }

  // Handle credit modification fields
  if (isEditMode.value && payload.creditModification && payload.creditModification.type) {
    payload.creditModificationType = payload.creditModification.type;
    payload.creditModificationAmount = payload.creditModification.amount;
    payload.creditModificationReason = payload.creditModification.reason;
  }
  delete payload.creditModification; // Remove the nested object before sending

  // const accessToken = localStorage.getItem('accessToken');
  // if (!accessToken) {
  //   Message.error('认证失败，请重新登录。');
  //   isSubmitting.value = false;
  //   return false;
  // }

  try {
    let response;
    if (isEditMode.value) {
      // response = await fetch(`/api/users/${currentUser.value._id}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      //   body: JSON.stringify(payload)
      // });
      response = await apiService.put(`/users/${currentUser.value._id}`, payload);
    } else {
      // response = await fetch('/api/users', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      //   body: JSON.stringify(payload)
      // });
      response = await apiService.post('/users', payload);
    }

    // if (!response.ok) {
    //   const errorData = await response.json().catch(() => ({ message: '请求失败' }));
    //   let detail = errorData.message || '';
    //    if (errorData.errors) { // Handle validation errors from backend if any
    //        detail = errorData.errors.map(e => e.msg).join('; ');
    //    }
    //   throw new Error(`${isEditMode.value ? '更新' : '创建'}用户失败: ${detail} (${response.status})`);
    // }

    Message.success(`用户 ${isEditMode.value ? '更新' : '创建'}成功`);
    userModalVisible.value = false;
    await fetchUsers();

  } catch (error) {
    console.error('Error submitting user:', error);
    // Message.error(error.message || '处理用户时发生错误');
    // Specific error handling for 409 (e.g. duplicate username/email)
    if (error.response && error.response.status === 409) {
        Message.error(`操作失败: ${error.response.data.message || '用户名或邮箱已存在'}`);
    } else if (error.response && error.response.status === 400 && error.response.data.errors) {
        const errorMessages = error.response.data.errors.map(e => e.msg).join('; ');
        Message.error(`表单验证失败: ${errorMessages}`);
    } else if (!error.response) {
        Message.error('操作失败，请检查网络连接。');
    }
  } finally {
    isSubmitting.value = false;
  }
};

// --- Delete User Logic ---
const confirmDeleteUser = (user) => {
  if (user.username === 'admin') {
    Message.warning('不允许删除 \'admin\' 用户。');
    return;
  }
  if (user.isAdmin && adminUsersCount.value <= 1) {
    Message.warning('系统中至少需要保留一名管理员，无法删除此用户。');
    return;
  }

  Modal.confirm({
    title: '确认删除',
    content: `确定要删除用户 " ${user.username} " 吗？此操作不可撤销。`,
    okText: '确认删除',
    cancelText: '取消',
    onOk: async () => {
      // const accessToken = localStorage.getItem('accessToken');
      // if (!accessToken) { Message.error('认证失败'); return; }
      try {
        // const response = await fetch(`/api/users/${user._id}`, {
        //   method: 'DELETE',
        //   headers: { 'Authorization': `Bearer ${accessToken}` }
        // });
        // if (!response.ok) {
        //   const errorData = await response.json().catch(() => ({ message: '请求失败' }));
        //   throw new Error(`删除用户失败: ${errorData.message || response.status}`);
        // }
        await apiService.delete(`/users/${user._id}`);
        Message.success(`用户 " ${user.username} " 删除成功`);
        await fetchUsers(); // Refresh list
        } catch (error) {
          console.error('Error deleting user:', error);
        // Message.error(error.message || '删除用户时发生错误');
        if (!error.response) {
            Message.error('删除用户失败，请检查网络连接。');
        }
        // apiService interceptor handles other errors.
        }
    }
  });
};

// --- Credit Amount Validator ---
const validateCreditAmount = (value, callback) => {
  if (userForm.value.creditModification && userForm.value.creditModification.type === 'grant') {
    if (value === null || value === undefined || value < 0) {
      return callback('赠送积分数额必须为非负数');
    }
  }
  // For 'adjust', both positive and negative are allowed.
  // The { type: 'number' } rule handles non-numeric input.
  callback();
};

// --- Handle Credit Modification Type Change ---
const handleCreditModificationTypeChange = (value) => {
  if (userForm.value.creditModification) {
    userForm.value.creditModification.amount = null;
    userForm.value.creditModification.reason = '';
    // Trigger validation or clear errors for amount and reason if needed
    userFormRef.value?.clearValidate(['creditModification.amount', 'creditModification.reason']);
  }
};

onMounted(() => {
  fetchUsers(); // Fetch users when component is mounted
});
</script>

<style scoped>
/* Add specific styles for AdminPanel if needed */
.arco-table-cell .arco-btn-text {
  padding-left: 2px;
  padding-right: 2px;
}
.arco-form {
    padding: 0 10px; /* Add some padding to the form */
}
</style> 