<template>
  <div class="user-role-assignment">
    <div class="assignment-header">
      <a-row :gutter="16">
        <a-col :span="8">
          <a-select 
            v-model="filters.scope" 
            placeholder="选择角色范围" 
            allow-clear
            @change="loadUserRoles"
          >
            <a-option value="admin">后台角色</a-option>
            <a-option value="client">用户端角色</a-option>
          </a-select>
        </a-col>
        <a-col :span="8">
          <a-input 
            v-model="filters.username" 
            placeholder="搜索用户名"
            @press-enter="loadUserRoles"
          />
        </a-col>
        <a-col :span="8">
          <a-space>
            <a-button type="primary" @click="loadUserRoles">查询</a-button>
            <a-button type="primary" @click="showAssignModal">
              <template #icon><icon-plus /></template>
              分配角色
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </div>

    <a-table 
      :columns="columns" 
      :data="userRoles" 
      :loading="loading"
      :pagination="pagination"
      @page-change="handlePageChange"
      row-key="_id"
    >
      <template #username="{ record }">
        <div class="user-info">
          <div class="username">{{ record.userDetails?.username }}</div>
          <div class="user-id">{{ record.userDetails?._id }}</div>
        </div>
      </template>

      <template #role="{ record }">
        <div class="role-info">
          <div class="role-name">{{ record.roleDetails?.name }}</div>
          <a-tag :color="getScopeColor(record.scope)" size="small">
            {{ getScopeText(record.scope) }}
          </a-tag>
        </div>
      </template>

      <template #status="{ record }">
        <a-tag :color="getStatusColor(record.status)">
          {{ getStatusText(record.status) }}
        </a-tag>
      </template>

      <template #validity="{ record }">
        <div class="validity-info">
          <div>生效：{{ formatDate(record.effectiveAt) }}</div>
          <div v-if="record.expiresAt">
            过期：{{ formatDate(record.expiresAt) }}
            <a-tag v-if="isExpired(record.expiresAt)" color="red" size="small">已过期</a-tag>
          </div>
          <div v-else>
            <a-tag color="green" size="small">永久有效</a-tag>
          </div>
        </div>
      </template>

      <template #actions="{ record }">
        <a-space>
          <a-button size="small" @click="editUserRole(record)">编辑</a-button>
          <a-button size="small" @click="viewPermissions(record)">查看权限</a-button>
          <a-popconfirm 
            content="确定要移除这个角色分配吗？" 
            @ok="removeUserRole(record._id)"
          >
            <a-button size="small" status="danger">移除</a-button>
          </a-popconfirm>
        </a-space>
      </template>
    </a-table>

    <!-- 角色分配模态框 -->
    <a-modal 
      v-model:visible="assignModalVisible"
      title="分配角色"
      @ok="handleAssignSubmit"
      @cancel="handleAssignCancel"
      :confirm-loading="assignLoading"
      width="600px"
    >
      <a-form ref="assignFormRef" :model="assignForm" layout="vertical" :rules="assignRules">
        <a-form-item label="选择用户" field="userId">
          <a-select 
            v-model="assignForm.userId"
            placeholder="请选择用户"
            show-search
            :filter-option="filterUser"
            @focus="loadUsers"
          >
            <a-option 
              v-for="user in users" 
              :key="user._id" 
              :value="user._id"
              :label="user.username"
            >
              <div class="user-option">
                <div>{{ user.username }}</div>
                <div class="user-option-id">{{ user._id }}</div>
              </div>
            </a-option>
          </a-select>
        </a-form-item>

        <a-form-item label="选择角色" field="roleId">
          <a-select 
            v-model="assignForm.roleId"
            placeholder="请选择角色"
            @change="handleRoleChange"
          >
            <a-option 
              v-for="role in availableRoles" 
              :key="role._id" 
              :value="role._id"
            >
              <div class="role-option">
                <span>{{ role.name }}</span>
                <a-tag :color="getScopeColor(role.scope)" size="small">
                  {{ getScopeText(role.scope) }}
                </a-tag>
              </div>
            </a-option>
          </a-select>
        </a-form-item>

        <a-form-item label="角色范围" field="scope">
          <a-select v-model="assignForm.scope" placeholder="请选择角色范围">
            <a-option value="admin">后台角色</a-option>
            <a-option value="client">用户端角色</a-option>
          </a-select>
        </a-form-item>

        <a-form-item label="过期时间" field="expiresAt">
          <a-input
            v-model="assignForm.expiresAt"
            placeholder="YYYY-MM-DD HH:mm:ss（可选）"
            style="width: 100%"
          />
          <template #help>
            <small>格式：2024-12-31 23:59:59，留空表示永久有效</small>
          </template>
        </a-form-item>

        <a-form-item label="分配原因" field="assignReason">
          <a-textarea 
            v-model="assignForm.assignReason" 
            placeholder="请输入分配原因"
            :rows="3"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 权限查看模态框 -->
    <a-modal 
      v-model:visible="permissionModalVisible"
      title="用户权限详情"
      :footer="false"
      width="800px"
    >
      <div v-if="currentUserPermissions">
        <h4>角色信息</h4>
        <a-descriptions :column="2" bordered>
          <a-descriptions-item label="角色名称">
            {{ currentUserPermissions.roleName }}
          </a-descriptions-item>
          <a-descriptions-item label="角色代码">
            {{ currentUserPermissions.roleCode }}
          </a-descriptions-item>
          <a-descriptions-item label="角色范围">
            <a-tag :color="getScopeColor(currentUserPermissions.scope)">
              {{ getScopeText(currentUserPermissions.scope) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="过期时间">
            {{ currentUserPermissions.expiresAt ? formatDate(currentUserPermissions.expiresAt) : '永久有效' }}
          </a-descriptions-item>
        </a-descriptions>

        <h4 style="margin-top: 20px;">权限列表</h4>
        <div class="permission-list">
          <a-tag 
            v-for="permission in currentUserPermissions.permissions" 
            :key="permission"
            color="blue"
            style="margin: 4px"
          >
            {{ permission }}
          </a-tag>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { IconPlus } from '@arco-design/web-vue/es/icon';
import apiService from '../services/apiService';

// 响应式数据
const loading = ref(false);
const assignLoading = ref(false);
const userRoles = ref([]);
const users = ref([]);
const availableRoles = ref([]);
const currentUserPermissions = ref(null);

// 模态框状态
const assignModalVisible = ref(false);
const permissionModalVisible = ref(false);

// 表单引用
const assignFormRef = ref();

// 筛选条件
const filters = reactive({
  scope: '',
  username: ''
});

// 分页
const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0
});

// 分配表单
const assignForm = reactive({
  userId: '',
  roleId: '',
  scope: 'admin',
  expiresAt: null,
  assignReason: ''
});

// 表单验证规则
const assignRules = {
  userId: [{ required: true, message: '请选择用户' }],
  roleId: [{ required: true, message: '请选择角色' }],
  scope: [{ required: true, message: '请选择角色范围' }]
};

// 表格列定义
const columns = [
  { title: '用户', slotName: 'username', width: 200 },
  { title: '角色', slotName: 'role', width: 200 },
  { title: '状态', slotName: 'status', width: 100 },
  { title: '有效期', slotName: 'validity', width: 200 },
  { title: '分配时间', dataIndex: 'createdAt', width: 150, render: ({ record }) => formatDate(record.createdAt) },
  { title: '操作', slotName: 'actions', width: 200, align: 'center' }
];

// 工具方法
const getScopeColor = (scope) => {
  const colors = { admin: 'red', client: 'blue', both: 'green' };
  return colors[scope] || 'gray';
};

const getScopeText = (scope) => {
  const texts = { admin: '后台', client: '用户端', both: '通用' };
  return texts[scope] || scope;
};

const getStatusColor = (status) => {
  const colors = { active: 'green', disabled: 'red', expired: 'orange' };
  return colors[status] || 'gray';
};

const getStatusText = (status) => {
  const texts = { active: '正常', disabled: '禁用', expired: '已过期' };
  return texts[status] || status;
};

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('zh-CN');
};

const isExpired = (date) => {
  return date && new Date(date) < new Date();
};

const filterUser = (inputValue, option) => {
  return option.label.toLowerCase().includes(inputValue.toLowerCase());
};

// 数据加载方法
const loadUserRoles = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.current,
      limit: pagination.pageSize,
      ...filters
    };

    const response = await apiService.getUserRoles(params);
    userRoles.value = response.data.data || [];
    pagination.total = response.data.pagination?.total || 0;
  } catch (error) {
    console.error('加载用户角色失败:', error);
    Message.error('加载用户角色失败');
  } finally {
    loading.value = false;
  }
};

const loadUsers = async () => {
  try {
    const response = await apiService.get('/users', {
      params: { limit: 100 }
    });
    users.value = response.data.data || [];
  } catch (error) {
    console.error('加载用户列表失败:', error);
    Message.error('加载用户列表失败');
  }
};

const loadRoles = async () => {
  try {
    const response = await apiService.getRoles({ limit: 100 });
    availableRoles.value = response.data.data || [];
  } catch (error) {
    console.error('加载角色列表失败:', error);
    Message.error('加载角色列表失败');
  }
};

// 事件处理
const handlePageChange = (page) => {
  pagination.current = page;
  loadUserRoles();
};

const showAssignModal = () => {
  resetAssignForm();
  assignModalVisible.value = true;
  loadUsers();
  loadRoles();
};

const handleRoleChange = (roleId) => {
  const role = availableRoles.value.find(r => r._id === roleId);
  if (role) {
    assignForm.scope = role.scope;
  }
};

const resetAssignForm = () => {
  Object.assign(assignForm, {
    userId: '',
    roleId: '',
    scope: 'admin',
    expiresAt: null,
    assignReason: ''
  });
};

const handleAssignSubmit = async () => {
  try {
    await assignFormRef.value.validate();
    assignLoading.value = true;

    await apiService.assignUserRole(assignForm);
    Message.success('角色分配成功');

    assignModalVisible.value = false;
    loadUserRoles();
  } catch (error) {
    console.error('角色分配失败:', error);
    const message = error.response?.data?.message || '角色分配失败';
    Message.error(message);
  } finally {
    assignLoading.value = false;
  }
};

const handleAssignCancel = () => {
  assignModalVisible.value = false;
  resetAssignForm();
};

const editUserRole = (userRole) => {
  // 编辑用户角色功能
  Message.info('编辑功能开发中...');
};

const viewPermissions = async (userRole) => {
  try {
    const response = await apiService.getUserRolesByUserId(userRole.userId, {
      scope: userRole.scope
    });
    currentUserPermissions.value = {
      roleName: userRole.roleDetails?.name,
      roleCode: userRole.roleDetails?.code,
      scope: userRole.scope,
      expiresAt: userRole.expiresAt,
      permissions: response.data.data.permissions || []
    };
    permissionModalVisible.value = true;
  } catch (error) {
    console.error('获取用户权限失败:', error);
    Message.error('获取用户权限失败');
  }
};

const removeUserRole = async (userRoleId) => {
  try {
    await apiService.removeUserRole(userRoleId);
    Message.success('角色移除成功');
    loadUserRoles();
  } catch (error) {
    console.error('角色移除失败:', error);
    Message.error('角色移除失败');
  }
};

// 初始化
onMounted(() => {
  loadUserRoles();
});
</script>

<style scoped>
.user-role-assignment {
  padding: 20px;
}

.assignment-header {
  margin-bottom: 20px;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 6px;
}

.user-info .username {
  font-weight: 600;
}

.user-info .user-id {
  font-size: 12px;
  color: #999;
}

.role-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.validity-info {
  font-size: 12px;
}

.validity-info > div {
  margin-bottom: 4px;
}

.user-option-id {
  font-size: 12px;
  color: #999;
}

.role-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.permission-list {
  max-height: 200px;
  overflow-y: auto;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
}
</style>
