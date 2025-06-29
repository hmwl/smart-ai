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
        <!-- 权限管理标签页 -->
        <a-tab-pane key="permissions" title="权限管理">
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
                <a-button type="primary" @click="loadPermissions">查询</a-button>
              </a-col>
            </a-row>
          </div>

          <a-table 
            :columns="permissionColumns" 
            :data="permissions" 
            :loading="permissionLoading"
            :pagination="false"
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

        <!-- 角色管理标签页 -->
        <a-tab-pane key="roles" title="角色管理">
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
                <a-button type="primary" @click="loadRoles">查询</a-button>
              </a-col>
            </a-row>
          </div>

          <a-table 
            :columns="roleColumns" 
            :data="roles" 
            :loading="roleLoading"
            :pagination="false"
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
            <template #actions="{ record }">
              <a-space>
                <a-button size="small" @click="editRole(record)">编辑</a-button>
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
      </a-tabs>
    </a-card>

    <!-- 简单的权限创建模态框 -->
    <a-modal 
      v-model:visible="permissionModalVisible"
      title="权限管理"
      @ok="handlePermissionSubmit"
      @cancel="handlePermissionCancel"
    >
      <a-form ref="permissionFormRef" :model="permissionForm" layout="vertical">
        <a-form-item label="权限名称" field="name">
          <a-input v-model="permissionForm.name" placeholder="请输入权限名称" />
        </a-form-item>
        <a-form-item label="权限代码" field="code">
          <a-input v-model="permissionForm.code" placeholder="如：user:create" />
        </a-form-item>
        <a-form-item label="模块" field="module">
          <a-input v-model="permissionForm.module" placeholder="请输入模块名称" />
        </a-form-item>
        <a-form-item label="操作" field="action">
          <a-select v-model="permissionForm.action" placeholder="请选择操作">
            <a-option value="create">创建</a-option>
            <a-option value="read">查看</a-option>
            <a-option value="update">更新</a-option>
            <a-option value="delete">删除</a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="权限范围" field="scope">
          <a-select v-model="permissionForm.scope" placeholder="请选择权限范围">
            <a-option value="admin">后台权限</a-option>
            <a-option value="client">用户端权限</a-option>
            <a-option value="both">通用权限</a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 简单的角色创建模态框 -->
    <a-modal 
      v-model:visible="roleModalVisible"
      title="角色管理"
      @ok="handleRoleSubmit"
      @cancel="handleRoleCancel"
    >
      <a-form ref="roleFormRef" :model="roleForm" layout="vertical">
        <a-form-item label="角色名称" field="name">
          <a-input v-model="roleForm.name" placeholder="请输入角色名称" />
        </a-form-item>
        <a-form-item label="角色代码" field="code">
          <a-input v-model="roleForm.code" placeholder="如：admin_user" />
        </a-form-item>
        <a-form-item label="角色范围" field="scope">
          <a-select v-model="roleForm.scope" placeholder="请选择角色范围">
            <a-option value="admin">后台角色</a-option>
            <a-option value="client">用户端角色</a-option>
            <a-option value="both">通用角色</a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { IconPlus, IconUserGroup } from '@arco-design/web-vue/es/icon';
import apiService from '../services/apiService';

// 响应式数据
const activeTab = ref('permissions');
const permissionLoading = ref(false);
const roleLoading = ref(false);

// 权限相关数据
const permissions = ref([]);
const permissionFilters = reactive({
  scope: '',
  module: '',
  status: ''
});

// 角色相关数据
const roles = ref([]);
const roleFilters = reactive({
  scope: '',
  status: ''
});

// 模态框相关
const permissionModalVisible = ref(false);
const roleModalVisible = ref(false);
const currentPermission = ref(null);
const currentRole = ref(null);

// 表单数据
const permissionForm = reactive({
  name: '',
  code: '',
  module: '',
  action: '',
  scope: 'admin'
});

const roleForm = reactive({
  name: '',
  code: '',
  scope: 'admin'
});

// 表单引用
const permissionFormRef = ref();
const roleFormRef = ref();

// 表格列定义
const permissionColumns = [
  { title: '权限名称', dataIndex: 'name', width: 150 },
  { title: '权限代码', dataIndex: 'code', width: 150 },
  { title: '模块', dataIndex: 'module', width: 100 },
  { title: '操作', dataIndex: 'action', width: 100 },
  { title: '范围', dataIndex: 'scope', slotName: 'scope', width: 100 },
  { title: '状态', dataIndex: 'status', slotName: 'status', width: 80 },
  { title: '操作', slotName: 'actions', width: 150, align: 'center' }
];

const roleColumns = [
  { title: '角色名称', dataIndex: 'name', width: 120 },
  { title: '角色代码', dataIndex: 'code', width: 120 },
  { title: '范围', dataIndex: 'scope', slotName: 'scope', width: 100 },
  { title: '层级', dataIndex: 'level', width: 80 },
  { title: '类型', dataIndex: 'isSystem', slotName: 'isSystem', width: 100 },
  { title: '状态', dataIndex: 'status', slotName: 'status', width: 80 },
  { title: '操作', slotName: 'actions', width: 180, align: 'center' }
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

// 数据加载方法
const loadPermissions = async () => {
  permissionLoading.value = true;
  try {
    const response = await apiService.getPermissions({ limit: 100 });
    permissions.value = response.data.data || [];
    console.log('权限列表加载成功:', permissions.value.length, '个权限');
  } catch (error) {
    console.error('加载权限列表失败:', error);
    Message.error(`加载权限列表失败: ${error.message}`);
  } finally {
    permissionLoading.value = false;
  }
};

const loadRoles = async () => {
  roleLoading.value = true;
  try {
    const response = await apiService.getRoles({ limit: 100 });
    roles.value = response.data.data || [];
    console.log('角色列表加载成功:', roles.value.length, '个角色');
  } catch (error) {
    console.error('加载角色列表失败:', error);
    Message.error(`加载角色列表失败: ${error.message}`);
  } finally {
    roleLoading.value = false;
  }
};

// 事件处理
const showCreatePermissionModal = () => {
  currentPermission.value = null;
  resetPermissionForm();
  permissionModalVisible.value = true;
};

const showCreateRoleModal = () => {
  currentRole.value = null;
  resetRoleForm();
  roleModalVisible.value = true;
};

const editPermission = (permission) => {
  currentPermission.value = permission;
  Object.assign(permissionForm, permission);
  permissionModalVisible.value = true;
};

const editRole = (role) => {
  currentRole.value = role;
  Object.assign(roleForm, role);
  roleModalVisible.value = true;
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

// 表单处理
const resetPermissionForm = () => {
  Object.assign(permissionForm, {
    name: '', code: '', module: '', action: '', scope: 'admin'
  });
};

const resetRoleForm = () => {
  Object.assign(roleForm, {
    name: '', code: '', scope: 'admin'
  });
};

const handlePermissionSubmit = async () => {
  try {
    if (currentPermission.value) {
      await apiService.updatePermission(currentPermission.value._id, permissionForm);
      Message.success('权限更新成功');
    } else {
      await apiService.createPermission(permissionForm);
      Message.success('权限创建成功');
    }
    permissionModalVisible.value = false;
    loadPermissions();
  } catch (error) {
    console.error('权限操作失败:', error);
    Message.error('权限操作失败');
  }
};

const handleRoleSubmit = async () => {
  try {
    if (currentRole.value) {
      await apiService.updateRole(currentRole.value._id, roleForm);
      Message.success('角色更新成功');
    } else {
      await apiService.createRole(roleForm);
      Message.success('角色创建成功');
    }
    roleModalVisible.value = false;
    loadRoles();
  } catch (error) {
    console.error('角色操作失败:', error);
    Message.error('角色操作失败');
  }
};

const handlePermissionCancel = () => {
  permissionModalVisible.value = false;
  resetPermissionForm();
};

const handleRoleCancel = () => {
  roleModalVisible.value = false;
  resetRoleForm();
};

// 初始化
onMounted(async () => {
  try {
    await loadPermissions();
    await loadRoles();
  } catch (error) {
    console.error('初始化失败:', error);
    Message.error('初始化失败，请刷新重试');
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
</style>
