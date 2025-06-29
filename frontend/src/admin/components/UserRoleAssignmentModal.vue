<template>
  <a-modal 
    v-model:visible="modalVisible"
    title="用户角色分配"
    @ok="handleSubmit"
    @cancel="handleCancel"
    :confirm-loading="loading"
    width="600px"
  >
    <a-form ref="formRef" :model="form" layout="vertical" :rules="rules">
      
      <!-- 用户选择 -->
      <a-form-item label="选择用户" field="userId">
        <a-select 
          v-model="form.userId"
          placeholder="请选择用户"
          show-search
          :filter-option="filterUser"
          @focus="loadUsers"
          @change="handleUserChange"
        >
          <a-option
            v-for="user in users"
            :key="user._id"
            :value="user._id"
            :label="user.username"
          >
            <div class="user-option">
              <div class="user-name">{{ user.username }}</div>
              <div class="user-info">
                <a-tag size="small" :color="user.userType === 'admin' ? 'red' : 'blue'">
                  {{ user.userType === 'admin' ? '管理员' : '普通用户' }}
                </a-tag>
                <span class="user-id">{{ user._id }}</span>
              </div>
            </div>
          </a-option>
        </a-select>
      </a-form-item>

      <!-- 角色选择 -->
      <a-form-item label="选择角色" field="roleId">
        <a-select 
          v-model="form.roleId"
          placeholder="请选择角色"
          @change="handleRoleChange"
          @focus="loadRoles"
        >
          <a-option 
            v-for="role in availableRoles" 
            :key="role._id" 
            :value="role._id"
          >
            <div class="role-option">
              <div class="role-name">{{ role.name }}</div>
              <div class="role-info">
                <a-tag :color="getScopeColor(role.scope)" size="small">
                  {{ getScopeText(role.scope) }}
                </a-tag>
                <a-tag color="orange" size="small">
                  {{ role.permissions?.length || 0 }} 个权限
                </a-tag>
                <span v-if="role.isSystem" class="system-role">系统角色</span>
              </div>
            </div>
          </a-option>
        </a-select>
      </a-form-item>

      <!-- 角色范围 -->
      <a-form-item label="角色范围" field="scope">
        <a-select v-model="form.scope" placeholder="请选择角色范围">
          <a-option value="admin">后台角色</a-option>
          <a-option value="client">用户端角色</a-option>
        </a-select>
      </a-form-item>

      <!-- 过期时间 -->
      <a-form-item label="过期时间" field="expiresAt">
        <a-input 
          v-model="form.expiresAt"
          placeholder="YYYY-MM-DD HH:mm:ss（可选）"
          style="width: 100%"
        />
        <template #help>
          <small>格式：2024-12-31 23:59:59，留空表示永久有效</small>
        </template>
      </a-form-item>

      <!-- 分配原因 -->
      <a-form-item label="分配原因" field="assignReason">
        <a-textarea 
          v-model="form.assignReason" 
          placeholder="请输入分配原因"
          :rows="3"
        />
      </a-form-item>

      <!-- 当前用户角色信息 -->
      <a-form-item v-if="currentUserRoles.length > 0" label="当前用户角色">
        <div class="current-roles">
          <a-tag 
            v-for="userRole in currentUserRoles" 
            :key="userRole._id"
            :color="getScopeColor(userRole.scope)"
            style="margin: 4px"
          >
            {{ userRole.roleDetails?.name }} ({{ getScopeText(userRole.scope) }})
          </a-tag>
        </div>
      </a-form-item>

    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import apiService from '../services/apiService';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:visible', 'success']);

const modalVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

const formRef = ref();
const loading = ref(false);
const users = ref([]);
const availableRoles = ref([]);
const currentUserRoles = ref([]);

const form = reactive({
  userId: '',
  roleId: '',
  scope: 'admin',
  expiresAt: '',
  assignReason: ''
});

const rules = {
  userId: [{ required: true, message: '请选择用户' }],
  roleId: [{ required: true, message: '请选择角色' }],
  scope: [{ required: true, message: '请选择角色范围' }]
};

// 工具方法
const getScopeColor = (scope) => {
  const colors = { admin: 'red', client: 'blue', both: 'green' };
  return colors[scope] || 'gray';
};

const getScopeText = (scope) => {
  const texts = { admin: '后台', client: '用户端', both: '通用' };
  return texts[scope] || scope;
};

const filterUser = (inputValue, option) => {
  return option.label.toLowerCase().includes(inputValue.toLowerCase());
};

// 数据加载方法
const loadUsers = async () => {
  try {
    console.log('开始加载用户列表...');
    const response = await apiService.get('/users', {
      params: { limit: 100 }
    });
    users.value = response.data.data || [];
    console.log('用户列表加载成功:', users.value.length, '个用户');
    console.log('用户数据示例:', users.value[0]);
  } catch (error) {
    console.error('加载用户列表失败:', error);
    Message.error('加载用户列表失败');
  }
};

const loadRoles = async () => {
  try {
    console.log('开始加载角色列表...');
    const response = await apiService.getRoles({ limit: 100 });
    availableRoles.value = response.data.data || [];
    console.log('角色列表加载成功:', availableRoles.value.length, '个角色');
    console.log('角色数据示例:', availableRoles.value[0]);
  } catch (error) {
    console.error('加载角色列表失败:', error);
    Message.error('加载角色列表失败');
  }
};

const loadCurrentUserRoles = async (userId) => {
  if (!userId) {
    currentUserRoles.value = [];
    return;
  }
  
  try {
    const response = await apiService.getUserRolesByUserId(userId);
    currentUserRoles.value = response.data.data || [];
  } catch (error) {
    console.error('加载用户当前角色失败:', error);
    currentUserRoles.value = [];
  }
};

// 事件处理
const handleUserChange = (userId) => {
  console.log('用户选择变更:', userId);
  loadCurrentUserRoles(userId);
};

const handleRoleChange = (roleId) => {
  console.log('角色选择变更:', roleId);
  const role = availableRoles.value.find(r => r._id === roleId);
  if (role) {
    console.log('找到角色:', role);
    form.scope = role.scope;
  } else {
    console.log('未找到角色');
  }
};

const resetForm = () => {
  Object.assign(form, {
    userId: '',
    roleId: '',
    scope: 'admin',
    expiresAt: '',
    assignReason: ''
  });
  currentUserRoles.value = [];
};

const handleSubmit = async () => {
  try {
    console.log('提交前的表单数据:', form);
    console.log('用户列表:', users.value.length, '个用户');
    console.log('角色列表:', availableRoles.value.length, '个角色');

    await formRef.value.validate();
    loading.value = true;

    // 验证必填字段
    if (!form.userId || !form.roleId) {
      Message.error('请选择用户和角色');
      return;
    }

    // 检查是否已经在同一scope下分配过相同角色
    const existingRole = currentUserRoles.value.find(ur =>
      ur.roleId === form.roleId && ur.scope === form.scope && ur.status === 'active'
    );

    if (existingRole) {
      Message.warning(`用户在${form.scope === 'admin' ? '后台' : '用户端'}已经拥有此角色`);
      return;
    }

    // 处理过期时间
    const submitData = { ...form };
    if (submitData.expiresAt) {
      try {
        submitData.expiresAt = new Date(submitData.expiresAt).toISOString();
      } catch (error) {
        Message.error('过期时间格式不正确');
        return;
      }
    } else {
      submitData.expiresAt = null;
    }

    console.log('最终提交数据:', submitData);
    await apiService.assignUserRole(submitData);
    Message.success('角色分配成功');

    emit('success');
    modalVisible.value = false;
  } catch (error) {
    console.error('角色分配失败:', error);
    const message = error.response?.data?.message || '角色分配失败';
    Message.error(message);
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  modalVisible.value = false;
  resetForm();
};

// 监听模态框显示状态
const handleModalOpen = () => {
  if (modalVisible.value) {
    loadUsers();
    loadRoles();
  }
};

// 监听模态框状态变化
watch(modalVisible, (visible) => {
  if (visible) {
    handleModalOpen();
  } else {
    resetForm();
  }
});
</script>

<style scoped>
.user-option {
  width: 100%;
}

.user-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-id {
  font-size: 12px;
  color: #999;
}

.role-option {
  width: 100%;
}

.role-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.role-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.system-role {
  font-size: 12px;
  color: #666;
}

.current-roles {
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  min-height: 40px;
}
</style>
