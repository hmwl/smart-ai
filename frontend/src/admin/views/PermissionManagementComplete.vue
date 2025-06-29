<template>
  <div>
    <!-- 顶部操作区域 -->
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">权限管理</h2>
      <a-space>
        <a-input-search
          v-model="searchKeyword"
          placeholder="搜索权限、角色或用户"
          allow-clear
          style="width: 250px;"
        />
        <a-select v-model="scopeFilter" placeholder="按范围筛选" allow-clear style="width: 150px;">
          <a-option value="admin">后台权限</a-option>
          <a-option value="client">用户端权限</a-option>
          <a-option value="both">通用权限</a-option>
        </a-select>
        <a-button type="primary" @click="showCreatePermissionModal">
          <template #icon><icon-plus /></template> 新建权限
        </a-button>
        <a-button type="primary" @click="showCreateRoleModal">
          <template #icon><icon-user-group /></template> 新建角色
        </a-button>
        <a-button @click="refreshData" :loading="loading">
          <template #icon><icon-refresh /></template> 刷新
        </a-button>
      </a-space>
    </div>

    <!-- 标签页切换 -->
    <a-tabs v-model:active-key="activeTab" type="card">
        
        <!-- 权限管理标签页 -->
        <a-tab-pane key="permissions" title="权限管理">
          <a-spin :loading="permissionLoading" tip="加载权限列表中..." class="w-full">
            <a-table
              :data="filteredPermissions"
              :loading="permissionLoading"
              :pagination="permissionPagination"
              @page-change="handlePermissionPageChange"
              @page-size-change="handlePermissionPageSizeChange"
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
                <a-table-column title="权限名称" data-index="name" :width="150" :sortable="{ sortDirections: ['ascend', 'descend'] }"></a-table-column>
                <a-table-column title="权限代码" data-index="code" :width="150" :sortable="{ sortDirections: ['ascend', 'descend'] }"></a-table-column>
                <a-table-column title="模块" data-index="module" :width="100" :sortable="{ sortDirections: ['ascend', 'descend'] }"></a-table-column>
                <a-table-column title="操作" data-index="action" :width="100"></a-table-column>
                <a-table-column title="范围" data-index="scope" :width="100">
                  <template #cell="{ record }">
                    <a-tag :color="getScopeColor(record.scope)">
                      {{ getScopeText(record.scope) }}
                    </a-tag>
                  </template>
                </a-table-column>
                <a-table-column title="状态" data-index="status" :width="80">
                  <template #cell="{ record }">
                    <a-tag :color="record.status === 'active' ? 'green' : 'red'">
                      {{ record.status === 'active' ? '启用' : '禁用' }}
                    </a-tag>
                  </template>
                </a-table-column>
                <a-table-column title="描述" data-index="description" ellipsis tooltip></a-table-column>
                <a-table-column title="操作" :width="150" fixed="right" align="center">
                  <template #cell="{ record }">
                    <a-space>
                      <a-button type="text" status="warning" size="mini" @click="editPermission(record)">编辑</a-button>
                      <a-popconfirm
                        content="确定要删除这个权限吗？"
                        ok-text="确定"
                        cancel-text="取消"
                        @ok="deletePermission(record._id)"
                      >
                        <a-button type="text" status="danger" size="mini">删除</a-button>
                      </a-popconfirm>
                    </a-space>
                  </template>
                </a-table-column>
              </template>
            </a-table>
          </a-spin>
        </a-tab-pane>

        <!-- 角色管理标签页 -->
        <a-tab-pane key="roles" title="角色管理">
          <a-spin :loading="roleLoading" tip="加载角色列表中..." class="w-full">
            <a-table
              :data="filteredRoles"
              :loading="roleLoading"
              :pagination="rolePagination"
              @page-change="handleRolePageChange"
              @page-size-change="handleRolePageSizeChange"
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
                <a-table-column title="角色名称" data-index="name" :width="120" :sortable="{ sortDirections: ['ascend', 'descend'] }"></a-table-column>
                <a-table-column title="角色代码" data-index="code" :width="120" :sortable="{ sortDirections: ['ascend', 'descend'] }"></a-table-column>
                <a-table-column title="范围" data-index="scope" :width="100">
                  <template #cell="{ record }">
                    <a-tag :color="getScopeColor(record.scope)">
                      {{ getScopeText(record.scope) }}
                    </a-tag>
                  </template>
                </a-table-column>
                <a-table-column title="层级" data-index="level" :width="80" align="center" :sortable="{ sortDirections: ['ascend', 'descend'] }"></a-table-column>
                <a-table-column title="类型" data-index="isSystem" :width="100">
                  <template #cell="{ record }">
                    <a-tag :color="record.isSystem ? 'blue' : 'gray'">
                      {{ record.isSystem ? '系统角色' : '自定义角色' }}
                    </a-tag>
                  </template>
                </a-table-column>
                <a-table-column title="状态" data-index="status" :width="80">
                  <template #cell="{ record }">
                    <a-tag :color="record.status === 'active' ? 'green' : 'red'">
                      {{ record.status === 'active' ? '启用' : '禁用' }}
                    </a-tag>
                  </template>
                </a-table-column>
                <a-table-column title="权限数" :width="100" align="center">
                  <template #cell="{ record }">
                    <a-tag color="blue">{{ record.permissions?.length || 0 }}</a-tag>
                  </template>
                </a-table-column>
                <a-table-column title="描述" data-index="description" ellipsis tooltip></a-table-column>
                <a-table-column title="操作" :width="220" fixed="right" align="center">
                  <template #cell="{ record }">
                    <a-space>
                      <a-button type="text" status="normal" size="mini" @click="viewRolePermissions(record)">详情</a-button>
                      <a-button type="text" status="warning" size="mini" @click="editRole(record)">编辑</a-button>
                      <a-button type="text" size="mini" @click="manageRolePermissions(record)">权限设置</a-button>
                      <a-popconfirm
                        v-if="!record.isSystem"
                        content="确定要删除这个角色吗？"
                        ok-text="确定"
                        cancel-text="取消"
                        @ok="deleteRole(record._id)"
                      >
                        <a-button type="text" status="danger" size="mini">删除</a-button>
                      </a-popconfirm>
                    </a-space>
                  </template>
                </a-table-column>
              </template>
            </a-table>
          </a-spin>
        </a-tab-pane>

        <!-- 用户角色分配标签页 -->
        <a-tab-pane key="user-roles" title="用户角色分配">
          <div class="flex justify-between items-center mb-4">
            <div></div>
            <a-space>
              <a-button type="primary" @click="showAssignRoleModal">
                <template #icon><icon-user /></template> 分配角色
              </a-button>
            </a-space>
          </div>

          <a-spin :loading="userRoleLoading" tip="加载用户角色列表中..." class="w-full">
            <a-table
              :data="filteredUserRoles"
              :loading="userRoleLoading"
              :pagination="userRolePagination"
              @page-change="handleUserRolePageChange"
              @page-size-change="handleUserRolePageSizeChange"
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
                <a-table-column title="用户" :width="180">
                  <template #cell="{ record }">
                    <div>
                      <div class="font-medium">{{ record.userDetails?.username || '未知用户' }}</div>
                      <div class="text-xs text-gray-500">{{ record.userId }}</div>
                    </div>
                  </template>
                </a-table-column>
                <a-table-column title="角色" :width="180">
                  <template #cell="{ record }">
                    <div>
                      <div class="font-medium">{{ record.roleDetails?.name || '未知角色' }}</div>
                      <a-tag :color="getScopeColor(record.scope)" size="small">
                        {{ getScopeText(record.scope) }}
                      </a-tag>
                    </div>
                  </template>
                </a-table-column>
                <a-table-column title="状态" data-index="status" :width="100">
                  <template #cell="{ record }">
                    <a-tag :color="getStatusColor(record.status)">
                      {{ getStatusText(record.status) }}
                    </a-tag>
                  </template>
                </a-table-column>
                <a-table-column title="有效期" :width="200">
                  <template #cell="{ record }">
                    <div class="text-sm">
                      <div>生效: {{ formatDate(record.effectiveAt) }}</div>
                      <div v-if="record.expiresAt">
                        过期: {{ formatDate(record.expiresAt) }}
                        <a-tag v-if="isExpired(record.expiresAt)" color="red" size="small">已过期</a-tag>
                      </div>
                      <div v-else>
                        <a-tag color="green" size="small">永久有效</a-tag>
                      </div>
                    </div>
                  </template>
                </a-table-column>
                <a-table-column title="分配时间" data-index="createdAt" :width="150" :sortable="{ sortDirections: ['ascend', 'descend'] }">
                  <template #cell="{ record }">
                    {{ formatDate(record.createdAt) }}
                  </template>
                </a-table-column>
                <a-table-column title="操作" :width="150" fixed="right" align="center">
                  <template #cell="{ record }">
                    <a-space>
                      <a-button type="text" status="normal" size="mini" @click="viewUserPermissions(record)">查看权限</a-button>
                      <a-popconfirm
                        content="确定要移除这个角色分配吗？"
                        ok-text="确定"
                        cancel-text="取消"
                        @ok="removeUserRole(record._id)"
                      >
                        <a-button type="text" status="danger" size="mini">移除</a-button>
                      </a-popconfirm>
                    </a-space>
                  </template>
                </a-table-column>
              </template>
            </a-table>
          </a-spin>
        </a-tab-pane>

      </a-tabs>
    

    <!-- 权限创建/编辑模态框 -->
    <a-modal
      v-model:visible="permissionModalVisible"
      :title="currentPermission ? '编辑权限：' + currentPermission.name : '创建权限'"
      @ok="handlePermissionSubmit"
      @cancel="handlePermissionCancel"
      :ok-text="currentPermission ? '更新权限' : '创建权限'"
      cancel-text="取消"
      :confirm-loading="permissionSubmitLoading"
      width="600px"
    >
      <a-form ref="permissionFormRef" :model="permissionForm" layout="vertical" :rules="permissionRules">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="权限名称" field="name">
              <a-input v-model="permissionForm.name" placeholder="请输入权限名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="权限代码" field="code">
              <a-input v-model="permissionForm.code" placeholder="如：user:create" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="模块" field="module">
              <a-input v-model="permissionForm.module" placeholder="模块名称" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="操作" field="action">
              <a-select v-model="permissionForm.action" placeholder="选择操作">
                <a-option value="create">创建</a-option>
                <a-option value="read">查看</a-option>
                <a-option value="update">更新</a-option>
                <a-option value="delete">删除</a-option>
                <a-option value="manage">管理</a-option>
                <a-option value="execute">执行</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="权限范围" field="scope">
              <a-select v-model="permissionForm.scope" placeholder="选择范围">
                <a-option value="admin">后台权限</a-option>
                <a-option value="client">用户端权限</a-option>
                <a-option value="both">通用权限</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="权限描述" field="description">
          <a-textarea v-model="permissionForm.description" placeholder="请输入权限描述" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 角色创建/编辑模态框 -->
    <a-modal
      v-model:visible="roleModalVisible"
      :title="currentRole ? '编辑角色：' + currentRole.name : '创建角色'"
      @ok="handleRoleSubmit"
      @cancel="handleRoleCancel"
      :ok-text="currentRole ? '更新角色' : '创建角色'"
      cancel-text="取消"
      :confirm-loading="roleSubmitLoading"
      width="700px"
    >
      <a-form ref="roleFormRef" :model="roleForm" layout="vertical" :rules="roleRules">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="角色名称" field="name">
              <a-input v-model="roleForm.name" placeholder="请输入角色名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="角色代码" field="code">
              <a-input v-model="roleForm.code" placeholder="如：content_admin" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="角色范围" field="scope">
              <a-select v-model="roleForm.scope" placeholder="选择范围">
                <a-option value="admin">后台角色</a-option>
                <a-option value="client">用户端角色</a-option>
                <a-option value="both">通用角色</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="角色层级" field="level">
              <a-input-number v-model="roleForm.level" :min="1" :max="10" placeholder="1-10" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="状态" field="status">
              <a-select v-model="roleForm.status" placeholder="选择状态">
                <a-option value="active">启用</a-option>
                <a-option value="disabled">禁用</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="角色描述" field="description">
          <a-textarea v-model="roleForm.description" placeholder="请输入角色描述" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 角色权限管理模态框 -->
    <RolePermissionManager
      v-model:visible="rolePermissionModalVisible"
      :role="currentRole"
      :permissions="allPermissions"
      @success="handleRolePermissionSuccess"
    />

    <!-- 用户角色分配模态框 -->
    <UserRoleAssignmentModal
      v-model:visible="userRoleAssignmentModalVisible"
      @success="handleUserRoleAssignmentSuccess"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import { IconPlus, IconUserGroup, IconUser, IconRefresh } from '@arco-design/web-vue/es/icon';
import apiService from '../services/apiService';
import RolePermissionManager from '../components/RolePermissionManager.vue';
import UserRoleAssignmentModal from '../components/UserRoleAssignmentSimple.vue';

// 响应式数据
const activeTab = ref('permissions');
const loading = ref(false);
const permissionLoading = ref(false);
const roleLoading = ref(false);
const userRoleLoading = ref(false);
const permissionSubmitLoading = ref(false);
const roleSubmitLoading = ref(false);

// 搜索和筛选
const searchKeyword = ref('');
const scopeFilter = ref('');

// 数据列表
const permissions = ref([]);
const roles = ref([]);
const userRoles = ref([]);
const allPermissions = ref([]);

// 计算属性 - 筛选数据
const filteredPermissions = computed(() => {
  let filtered = permissions.value;

  // 搜索关键词筛选
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    filtered = filtered.filter(item =>
      item.name.toLowerCase().includes(keyword) ||
      item.code.toLowerCase().includes(keyword) ||
      item.module.toLowerCase().includes(keyword) ||
      (item.description && item.description.toLowerCase().includes(keyword))
    );
  }

  // 范围筛选
  if (scopeFilter.value) {
    filtered = filtered.filter(item => item.scope === scopeFilter.value);
  }

  return filtered;
});

const filteredRoles = computed(() => {
  let filtered = roles.value;

  // 搜索关键词筛选
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    filtered = filtered.filter(item =>
      item.name.toLowerCase().includes(keyword) ||
      item.code.toLowerCase().includes(keyword) ||
      (item.description && item.description.toLowerCase().includes(keyword))
    );
  }

  // 范围筛选
  if (scopeFilter.value) {
    filtered = filtered.filter(item => item.scope === scopeFilter.value);
  }

  return filtered;
});

const filteredUserRoles = computed(() => {
  let filtered = userRoles.value;

  // 搜索关键词筛选
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    filtered = filtered.filter(item =>
      (item.userDetails?.username && item.userDetails.username.toLowerCase().includes(keyword)) ||
      (item.roleDetails?.name && item.roleDetails.name.toLowerCase().includes(keyword)) ||
      item.userId.toLowerCase().includes(keyword)
    );
  }

  // 范围筛选
  if (scopeFilter.value) {
    filtered = filtered.filter(item => item.scope === scopeFilter.value);
  }

  return filtered;
});

// 分页
const permissionPagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [10, 15, 20, 50]
});

const rolePagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [10, 15, 20, 50]
});

const userRolePagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [10, 15, 20, 50]
});

// 模态框状态
const permissionModalVisible = ref(false);
const roleModalVisible = ref(false);
const rolePermissionModalVisible = ref(false);
const userRoleAssignmentModalVisible = ref(false);
const currentPermission = ref(null);
const currentRole = ref(null);

// 表单数据
const permissionForm = reactive({
  name: '',
  code: '',
  module: '',
  action: '',
  scope: 'admin',
  description: ''
});

const roleForm = reactive({
  name: '',
  code: '',
  scope: 'admin',
  level: 1,
  status: 'active',
  description: ''
});

// 表单引用
const permissionFormRef = ref();
const roleFormRef = ref();

// 表单验证规则
const permissionRules = {
  name: [{ required: true, message: '请输入权限名称' }],
  code: [
    { required: true, message: '请输入权限代码' },
    { pattern: /^[a-z_]+:[a-z_]+$/, message: '权限代码格式应为：模块:操作' }
  ],
  module: [{ required: true, message: '请输入模块名称' }],
  action: [{ required: true, message: '请选择操作类型' }],
  scope: [{ required: true, message: '请选择权限范围' }]
};

const roleRules = {
  name: [{ required: true, message: '请输入角色名称' }],
  code: [
    { required: true, message: '请输入角色代码' },
    { pattern: /^[a-z_]+$/, message: '角色代码只能包含小写字母和下划线' }
  ],
  scope: [{ required: true, message: '请选择角色范围' }]
};

// 监听模块和操作变化，自动生成权限代码
watch([() => permissionForm.module, () => permissionForm.action], ([module, action]) => {
  if (module && action && !currentPermission.value) {
    permissionForm.code = `${module}:${action}`;
  }
});



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

// 数据加载方法
const loadPermissions = async () => {
  permissionLoading.value = true;
  try {
    const params = {
      page: permissionPagination.current,
      limit: permissionPagination.pageSize
    };

    const response = await apiService.getPermissions(params);
    permissions.value = response.data.data || [];
    permissionPagination.total = response.data.pagination?.total || 0;
    console.log(`权限列表加载成功，共 ${permissions.value.length} 个权限`);
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
    const params = {
      page: rolePagination.current,
      limit: rolePagination.pageSize
    };

    const response = await apiService.getRoles(params);
    roles.value = response.data.data || [];
    rolePagination.total = response.data.pagination?.total || 0;
    console.log(`角色列表加载成功，共 ${roles.value.length} 个角色`);
  } catch (error) {
    console.error('加载角色列表失败:', error);
    Message.error(`加载角色列表失败: ${error.message}`);
  } finally {
    roleLoading.value = false;
  }
};

const loadUserRoles = async () => {
  userRoleLoading.value = true;
  try {
    const params = {
      page: userRolePagination.current,
      limit: userRolePagination.pageSize
    };

    const response = await apiService.getUserRoles(params);
    userRoles.value = response.data.data || [];
    userRolePagination.total = response.data.pagination?.total || 0;
    console.log(`用户角色列表加载成功，共 ${userRoles.value.length} 个分配`);
  } catch (error) {
    console.error('加载用户角色列表失败:', error);
    Message.error(`加载用户角色列表失败: ${error.message}`);
  } finally {
    userRoleLoading.value = false;
  }
};

const loadAllPermissions = async () => {
  try {
    const response = await apiService.getPermissions({ limit: 1000 });
    allPermissions.value = response.data.data || [];
  } catch (error) {
    console.error('加载所有权限失败:', error);
  }
};

// 分页事件处理
const handlePermissionPageChange = (page) => {
  permissionPagination.current = page;
  loadPermissions();
};

const handlePermissionPageSizeChange = (pageSize) => {
  permissionPagination.pageSize = pageSize;
  permissionPagination.current = 1;
  loadPermissions();
};

const handleRolePageChange = (page) => {
  rolePagination.current = page;
  loadRoles();
};

const handleRolePageSizeChange = (pageSize) => {
  rolePagination.pageSize = pageSize;
  rolePagination.current = 1;
  loadRoles();
};

const handleUserRolePageChange = (page) => {
  userRolePagination.current = page;
  loadUserRoles();
};

const handleUserRolePageSizeChange = (pageSize) => {
  userRolePagination.pageSize = pageSize;
  userRolePagination.current = 1;
  loadUserRoles();
};

// 模态框显示方法
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

const showUserRoleModal = () => {
  activeTab.value = 'user-roles';
  loadUserRoles();
};

// 刷新数据
const refreshData = async () => {
  loading.value = true;
  try {
    await Promise.all([
      loadPermissions(),
      loadRoles(),
      loadUserRoles(),
      loadAllPermissions()
    ]);
    Message.success('数据刷新成功');
  } catch (error) {
    console.error('刷新数据失败:', error);
    Message.error('刷新数据失败');
  } finally {
    loading.value = false;
  }
};

const showAssignRoleModal = () => {
  userRoleAssignmentModalVisible.value = true;
};

// 编辑方法
const editPermission = (permission) => {
  currentPermission.value = permission;
  Object.assign(permissionForm, {
    name: permission.name || '',
    code: permission.code || '',
    module: permission.module || '',
    action: permission.action || '',
    scope: permission.scope || 'admin',
    description: permission.description || ''
  });
  permissionModalVisible.value = true;
};

const editRole = (role) => {
  currentRole.value = role;
  Object.assign(roleForm, {
    name: role.name || '',
    code: role.code || '',
    scope: role.scope || 'admin',
    level: role.level || 1,
    status: role.status || 'active',
    description: role.description || ''
  });
  roleModalVisible.value = true;
};

// 删除方法
const deletePermission = async (id) => {
  try {
    await apiService.deletePermission(id);
    Message.success('权限删除成功');
    loadPermissions();
  } catch (error) {
    console.error('权限删除失败:', error);
    Message.error(`权限删除失败: ${error.response?.data?.message || error.message}`);
  }
};

const deleteRole = async (id) => {
  try {
    await apiService.deleteRole(id);
    Message.success('角色删除成功');
    loadRoles();
  } catch (error) {
    console.error('角色删除失败:', error);
    Message.error(`角色删除失败: ${error.response?.data?.message || error.message}`);
  }
};

const removeUserRole = async (id) => {
  try {
    await apiService.removeUserRole(id);
    Message.success('用户角色移除成功');
    loadUserRoles();
  } catch (error) {
    console.error('用户角色移除失败:', error);
    Message.error(`用户角色移除失败: ${error.response?.data?.message || error.message}`);
  }
};

// 查看方法
const viewRolePermissions = (role) => {
  Message.info(`角色"${role.name}"拥有 ${role.permissions?.length || 0} 个权限`);
};

const manageRolePermissions = (role) => {
  currentRole.value = role;
  rolePermissionModalVisible.value = true;
};

const viewUserPermissions = async (userRole) => {
  try {
    const response = await apiService.getUserRolesByUserId(userRole.userId, {
      scope: userRole.scope
    });
    const permissions = response.data.data?.permissions || [];
    Message.info(`用户拥有 ${permissions.length} 个权限`);
  } catch (error) {
    console.error('获取用户权限失败:', error);
    Message.error('获取用户权限失败');
  }
};

// 表单重置方法
const resetPermissionForm = () => {
  Object.assign(permissionForm, {
    name: '',
    code: '',
    module: '',
    action: '',
    scope: 'admin',
    description: ''
  });
};

const resetRoleForm = () => {
  Object.assign(roleForm, {
    name: '',
    code: '',
    scope: 'admin',
    level: 1,
    status: 'active',
    description: ''
  });
};

// 表单提交方法
const handlePermissionSubmit = async () => {
  try {
    await permissionFormRef.value.validate();
    permissionSubmitLoading.value = true;

    if (currentPermission.value) {
      // 更新权限
      await apiService.updatePermission(currentPermission.value._id, permissionForm);
      Message.success('权限更新成功');
    } else {
      // 创建权限
      await apiService.createPermission(permissionForm);
      Message.success('权限创建成功');
    }

    permissionModalVisible.value = false;
    loadPermissions();
    loadAllPermissions();
  } catch (error) {
    console.error('权限操作失败:', error);
    Message.error(`权限操作失败: ${error.response?.data?.message || error.message}`);
  } finally {
    permissionSubmitLoading.value = false;
  }
};

const handleRoleSubmit = async () => {
  try {
    await roleFormRef.value.validate();
    roleSubmitLoading.value = true;

    if (currentRole.value) {
      // 更新角色
      await apiService.updateRole(currentRole.value._id, roleForm);
      Message.success('角色更新成功');
    } else {
      // 创建角色
      await apiService.createRole(roleForm);
      Message.success('角色创建成功');
    }

    roleModalVisible.value = false;
    loadRoles();
  } catch (error) {
    console.error('角色操作失败:', error);
    Message.error(`角色操作失败: ${error.response?.data?.message || error.message}`);
  } finally {
    roleSubmitLoading.value = false;
  }
};

// 表单取消方法
const handlePermissionCancel = () => {
  permissionModalVisible.value = false;
  resetPermissionForm();
};

const handleRoleCancel = () => {
  roleModalVisible.value = false;
  resetRoleForm();
};

// 成功回调方法
const handleRolePermissionSuccess = () => {
  loadRoles();
  Message.success('角色权限更新成功');
};

const handleUserRoleAssignmentSuccess = () => {
  loadUserRoles();
  Message.success('用户角色分配成功');
};

// 初始化
onMounted(async () => {
  console.log('权限管理系统开始初始化...');
  try {
    await Promise.all([
      loadPermissions(),
      loadRoles(),
      loadAllPermissions()
    ]);
    console.log('权限管理系统初始化完成');
  } catch (error) {
    console.error('初始化失败:', error);
    Message.error('初始化失败，请刷新重试');
  }
});
</script>

<style scoped>
/* 与其他管理页面保持一致的样式 */
.arco-table-cell .arco-btn-text {
  padding-left: 2px;
  padding-right: 2px;
}

.arco-form {
  margin-top: 10px;
}

.font-medium {
  font-weight: 500;
}

.text-xs {
  font-size: 12px;
}

.text-sm {
  font-size: 14px;
}

.text-gray-500 {
  color: #999;
}
</style>
