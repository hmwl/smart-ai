<template>
  <div class="permission-management">
    <a-card title="权限管理" :bordered="false">
      <template #extra>
        <a-space>
          <a-button type="primary" @click="showCreatePermissionModal">
            <template #icon><icon-plus /></template>
            新建权限
          </a-button>
          <a-button @click="showCreateRoleModal">
            <template #icon><icon-user-group /></template>
            新建角色
          </a-button>
        </a-space>
      </template>

      <a-tabs v-model:active-key="activeTab" type="card">
        <!-- 角色管理标签页 -->
        <a-tab-pane key="roles" title="角色管理" :lazy="true">
          <div class="role-filters">
            <a-row :gutter="16">
              <a-col :span="6">
                <a-select v-model="roleFilters.scope" placeholder="选择角色范围" allow-clear>
                  <a-option value="admin">后台角色</a-option>
                  <a-option value="client">用户端角色</a-option>
                  <a-option value="both">通用角色</a-option>
                </a-select>
              </a-col>
              <a-col :span="6">
                <a-select v-model="roleFilters.status" placeholder="选择状态" allow-clear>
                  <a-option value="active">启用</a-option>
                  <a-option value="disabled">禁用</a-option>
                </a-select>
              </a-col>
              <a-col :span="6">
                <a-button type="primary" @click="loadRoles">查询</a-button>
              </a-col>
            </a-row>
          </div>

          <a-table
            :columns="roleColumns"
            :data="roles"
            :loading="roleLoading"
            :pagination="rolePagination"
            @page-change="handleRolePageChange"
          >
            <template #scope="{ record }">
              <a-tag :color="getScopeColor(record.scope)">
                {{ getScopeText(record.scope) }}
              </a-tag>
            </template>
            <template #status="{ record }">
              <a-tag :color="record.status === 'active' ? 'green' : 'red'">
                {{ record.status === 'active' ? '启用' : '禁用' }}
              </a-tag>
            </template>
            <template #isSystem="{ record }">
              <a-tag :color="record.isSystem ? 'blue' : 'gray'">
                {{ record.isSystem ? '系统角色' : '自定义角色' }}
              </a-tag>
            </template>
            <template #permissions="{ record }">
              <a-tag v-for="permission in record.permissionDetails?.slice(0, 3)"
                     :key="permission._id"
                     size="small">
                {{ permission.name }}
              </a-tag>
              <span v-if="record.permissionDetails?.length > 3">
                +{{ record.permissionDetails.length - 3 }}
              </span>
            </template>
            <template #actions="{ record }">
              <a-space>
                <a-button size="small" @click="editRole(record)">编辑</a-button>
                <a-button size="small" @click="manageRolePermissions(record)">权限</a-button>
                <a-popconfirm
                  v-if="!record.isSystem"
                  content="确定要删除这个角色吗？"
                  @ok="deleteRole(record._id)"
                >
                  <a-button size="small" status="danger">删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 权限管理标签页 -->
        <a-tab-pane key="permissions" title="权限管理" :lazy="true">
          <div class="permission-filters">
            <a-row :gutter="16">
              <a-col :span="6">
                <a-select v-model="permissionFilters.scope" placeholder="选择权限范围" allow-clear>
                  <a-option value="admin">后台权限</a-option>
                  <a-option value="client">用户端权限</a-option>
                  <a-option value="both">通用权限</a-option>
                </a-select>
              </a-col>
              <a-col :span="6">
                <a-select v-model="permissionFilters.module" placeholder="选择模块" allow-clear>
                  <a-option v-for="module in modules" :key="module" :value="module">
                    {{ module }}
                  </a-option>
                </a-select>
              </a-col>
              <a-col :span="6">
                <a-select v-model="permissionFilters.status" placeholder="选择状态" allow-clear>
                  <a-option value="active">启用</a-option>
                  <a-option value="disabled">禁用</a-option>
                </a-select>
              </a-col>
              <a-col :span="6">
                <a-button type="primary" @click="loadPermissions">查询</a-button>
              </a-col>
            </a-row>
          </div>

          <a-table
            :columns="permissionColumns"
            :data="permissions"
            :loading="permissionLoading"
            :pagination="permissionPagination"
            @page-change="handlePermissionPageChange"
          >
            <template #scope="{ record }">
              <a-tag :color="getScopeColor(record.scope)">
                {{ getScopeText(record.scope) }}
              </a-tag>
            </template>
            <template #status="{ record }">
              <a-tag :color="record.status === 'active' ? 'green' : 'red'">
                {{ record.status === 'active' ? '启用' : '禁用' }}
              </a-tag>
            </template>
            <template #actions="{ record }">
              <a-space>
                <a-button size="small" @click="editPermission(record)">编辑</a-button>
                <a-popconfirm
                  content="确定要删除这个权限吗？"
                  @ok="deletePermission(record._id)"
                >
                  <a-button size="small" status="danger">删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 用户角色分配标签页 -->
        <a-tab-pane key="user-roles" title="用户角色" :lazy="true">
          <UserRoleAssignment />
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 权限创建/编辑模态框 -->
    <PermissionModal
      v-model:visible="permissionModalVisible"
      :permission="currentPermission"
      :modules="modules"
      @success="handlePermissionSuccess"
    />

    <!-- 角色创建/编辑模态框 -->
    <RoleModal
      v-model:visible="roleModalVisible"
      :role="currentRole"
      :permissions="allPermissions"
      @success="handleRoleSuccess"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { Message } from '@arco-design/web-vue';
import { IconPlus, IconUserGroup } from '@arco-design/web-vue/es/icon';
import apiService from '../services/apiService';
import PermissionModal from '../components/PermissionModal.vue';
import RoleModal from '../components/RoleModal.vue';
import UserRoleAssignment from '../components/UserRoleAssignment.vue';

// 响应式数据
const activeTab = ref('roles');
const permissionLoading = ref(false);
const roleLoading = ref(false);

// 权限相关数据
const permissions = ref([]);
const permissionFilters = reactive({
  scope: '',
  module: '',
  status: ''
});
const permissionPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0
});

// 角色相关数据
const roles = ref([]);
const roleFilters = reactive({
  scope: '',
  status: ''
});
const rolePagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0
});

// 模态框相关
const permissionModalVisible = ref(false);
const roleModalVisible = ref(false);
const currentPermission = ref(null);
const currentRole = ref(null);

// 移除表单数据和引用，由子组件处理

// 所有权限列表（用于角色权限分配）
const allPermissions = ref([]);

// 计算属性
const modules = computed(() => {
  const moduleSet = new Set();
  permissions.value.forEach(p => moduleSet.add(p.module));
  return Array.from(moduleSet);
});

// 表格列定义
const permissionColumns = [
  { title: '权限名称', dataIndex: 'name', width: 150 },
  { title: '权限代码', dataIndex: 'code', width: 150 },
  { title: '模块', dataIndex: 'module', width: 100 },
  { title: '操作', dataIndex: 'action', width: 100 },
  { title: '范围', dataIndex: 'scope', slotName: 'scope', width: 100 },
  { title: '状态', dataIndex: 'status', slotName: 'status', width: 80 },
  { title: '描述', dataIndex: 'description', ellipsis: true },
  { title: '操作', slotName: 'actions', width: 150, align: 'center' }
];

const roleColumns = [
  { title: '角色名称', dataIndex: 'name', width: 120 },
  { title: '角色代码', dataIndex: 'code', width: 200 },
  { title: '范围', dataIndex: 'scope', slotName: 'scope', width: 100 },
  { title: '层级', dataIndex: 'level', width: 80 },
  { title: '类型', dataIndex: 'isSystem', slotName: 'isSystem', width: 100 },
  { title: '状态', dataIndex: 'status', slotName: 'status', width: 80 },
  { title: '权限', slotName: 'permissions', width: 200 },
  { title: '描述', dataIndex: 'description', ellipsis: true },
  { title: '操作', slotName: 'actions', width: 180, align: 'center' }
];

// 方法
const getScopeColor = (scope) => {
  const colors = {
    admin: 'red',
    client: 'blue',
    both: 'green'
  };
  return colors[scope] || 'gray';
};

const getScopeText = (scope) => {
  const texts = {
    admin: '后台',
    client: '用户端',
    both: '通用'
  };
  return texts[scope] || scope;
};

// 加载权限列表
const loadPermissions = async () => {
  permissionLoading.value = true;
  try {
    const params = {
      page: permissionPagination.current,
      limit: permissionPagination.pageSize,
      ...permissionFilters
    };

    const response = await apiService.getPermissions(params);
    permissions.value = response.data.data || [];
    permissionPagination.total = response.data.pagination?.total || 0;
  } catch (error) {
    console.error('加载权限列表失败:', error);
    Message.error(`加载权限列表失败: ${error.message}`);
  } finally {
    permissionLoading.value = false;
  }
};

// 加载角色列表
const loadRoles = async () => {
  roleLoading.value = true;
  try {
    const params = {
      page: rolePagination.current,
      limit: rolePagination.pageSize,
      ...roleFilters
    };

    const response = await apiService.getRoles(params);
    roles.value = response.data.data;
    rolePagination.total = response.data.pagination.total;
  } catch (error) {
    console.error('加载角色列表失败:', error);
    Message.error('加载角色列表失败');
  } finally {
    roleLoading.value = false;
  }
};

// 加载所有权限（用于角色权限分配）
const loadAllPermissions = async () => {
  try {
    const response = await apiService.getPermissions({ limit: 1000 });
    allPermissions.value = response.data.data;
  } catch (error) {
    console.error('加载权限列表失败:', error);
    Message.error('加载权限列表失败');
  }
};

// 事件处理
const handlePermissionPageChange = (page) => {
  permissionPagination.current = page;
  loadPermissions();
};

const handleRolePageChange = (page) => {
  rolePagination.current = page;
  loadRoles();
};

const showCreatePermissionModal = () => {
  currentPermission.value = null;
  permissionModalVisible.value = true;
};

const showCreateRoleModal = () => {
  currentRole.value = null;
  roleModalVisible.value = true;
};

const editPermission = (permission) => {
  currentPermission.value = permission;
  permissionModalVisible.value = true;
};

const editRole = (role) => {
  currentRole.value = role;
  roleModalVisible.value = true;
};

const manageRolePermissions = (role) => {
  // 这里可以打开权限管理模态框
  Message.info('权限管理功能开发中...');
};

const deletePermission = async (id) => {
  try {
    await apiService.deletePermission(id);
    Message.success('权限删除成功');
    loadPermissions();
  } catch (error) {
    console.error('权限删除失败:', error);
    Message.error('权限删除失败');
  }
};

const deleteRole = async (id) => {
  try {
    await apiService.deleteRole(id);
    Message.success('角色删除成功');
    loadRoles();
  } catch (error) {
    console.error('角色删除失败:', error);
    Message.error('角色删除失败');
  }
};

// 成功回调处理
const handlePermissionSuccess = () => {
  loadPermissions();
  loadAllPermissions();
};

const handleRoleSuccess = () => {
  loadRoles();
};

// 初始化
onMounted(async () => {
  try {
    await loadPermissions();
    await loadRoles();
    await loadAllPermissions();
  } catch (error) {
    console.error('初始化权限管理页面失败:', error);
    Message.error('初始化页面失败，请刷新重试');
  }
});
</script>

<style scoped>
.permission-management {
  padding: 20px;
}

.permission-filters,
.role-filters {
  margin-bottom: 16px;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 6px;
}

.permission-module {
  margin-bottom: 20px;
  padding: 16px;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
}

.permission-module h4 {
  margin-bottom: 12px;
  color: #333;
  font-weight: 600;
}

.user-role-placeholder {
  text-align: center;
  padding: 60px 0;
}
</style>