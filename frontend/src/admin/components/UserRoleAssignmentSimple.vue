<template>
  <a-modal 
    v-model:visible="modalVisible"
    title="用户角色分配（简化版）"
    @ok="handleSubmit"
    @cancel="handleCancel"
    :confirm-loading="loading"
    width="600px"
  >
    <div class="debug-info" style="margin-bottom: 16px; padding: 8px; background: #f0f0f0; border-radius: 4px;">
      <div><strong>调试信息：</strong></div>
      <div>用户数量: {{ users.length }}</div>
      <div>角色数量: {{ availableRoles.length }}</div>
      <div>当前选择的用户ID: {{ form.userId }}</div>
      <div>当前选择的角色ID: {{ form.roleId }}</div>
    </div>

    <a-form ref="formRef" :model="form" layout="vertical">
      
      <!-- 用户选择 -->
      <a-form-item label="选择用户" field="userId">
        <a-select 
          v-model="form.userId"
          placeholder="请选择用户"
          @change="handleUserChange"
          @focus="loadUsers"
        >
          <a-option 
            v-for="user in users" 
            :key="user._id" 
            :value="user._id"
          >
            {{ user.username }} ({{ user._id }})
          </a-option>
        </a-select>
        <div v-if="users.length === 0" style="margin-top: 8px;">
          <a-button size="small" @click="loadUsers">手动加载用户</a-button>
        </div>
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
            {{ role.name }} ({{ role._id }})
          </a-option>
        </a-select>
        <div v-if="availableRoles.length === 0" style="margin-top: 8px;">
          <a-button size="small" @click="loadRoles">手动加载角色</a-button>
        </div>
      </a-form-item>

      <!-- 角色范围 -->
      <a-form-item label="角色范围" field="scope">
        <a-select v-model="form.scope" placeholder="请选择角色范围">
          <a-option value="admin">后台角色</a-option>
          <a-option value="client">用户端角色</a-option>
        </a-select>
      </a-form-item>

      <!-- 分配原因 -->
      <a-form-item label="分配原因" field="assignReason">
        <a-input v-model="form.assignReason" placeholder="请输入分配原因" />
      </a-form-item>

    </a-form>

    <!-- 测试按钮 -->
    <div style="margin-top: 16px; padding: 8px; background: #f9f9f9; border-radius: 4px;">
      <a-space>
        <a-button size="small" @click="loadUsers">加载用户</a-button>
        <a-button size="small" @click="loadRoles">加载角色</a-button>
        <a-button size="small" @click="testFormData">测试表单数据</a-button>
      </a-space>
    </div>
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

const form = reactive({
  userId: '',
  roleId: '',
  scope: 'admin',
  assignReason: '测试分配'
});

// 数据加载方法
const loadUsers = async () => {
  try {
    console.log('开始加载用户列表...');
    const response = await apiService.get('/users', { 
      params: { limit: 50 } 
    });
    console.log('用户API响应:', response);
    users.value = response.data.data || [];
    console.log('用户列表加载成功:', users.value.length, '个用户');
    if (users.value.length > 0) {
      console.log('第一个用户:', users.value[0]);
    }
    Message.success(`加载了 ${users.value.length} 个用户`);
  } catch (error) {
    console.error('加载用户列表失败:', error);
    Message.error('加载用户列表失败: ' + error.message);
  }
};

const loadRoles = async () => {
  try {
    console.log('开始加载角色列表...');
    const response = await apiService.getRoles({ limit: 50 });
    console.log('角色API响应:', response);
    availableRoles.value = response.data.data || [];
    console.log('角色列表加载成功:', availableRoles.value.length, '个角色');
    if (availableRoles.value.length > 0) {
      console.log('第一个角色:', availableRoles.value[0]);
    }
    Message.success(`加载了 ${availableRoles.value.length} 个角色`);
  } catch (error) {
    console.error('加载角色列表失败:', error);
    Message.error('加载角色列表失败: ' + error.message);
  }
};

// 事件处理
const handleUserChange = (userId) => {
  console.log('用户选择变更:', userId);
  form.userId = userId;
};

const handleRoleChange = (roleId) => {
  console.log('角色选择变更:', roleId);
  form.roleId = roleId;
  const role = availableRoles.value.find(r => r._id === roleId);
  if (role) {
    console.log('找到角色:', role);
    form.scope = role.scope;
  }
};

const testFormData = () => {
  console.log('当前表单数据:', form);
  console.log('用户列表:', users.value);
  console.log('角色列表:', availableRoles.value);
  Message.info('表单数据已输出到控制台');
};

const resetForm = () => {
  Object.assign(form, {
    userId: '',
    roleId: '',
    scope: 'admin',
    assignReason: '测试分配'
  });
};

const handleSubmit = async () => {
  try {
    console.log('=== 开始提交 ===');
    console.log('提交前的表单数据:', form);
    
    loading.value = true;

    // 验证必填字段
    if (!form.userId || !form.roleId) {
      Message.error('请选择用户和角色');
      console.log('验证失败: 缺少用户或角色');
      return;
    }

    // 准备提交数据
    const submitData = {
      userId: form.userId,
      roleId: form.roleId,
      scope: form.scope,
      assignReason: form.assignReason,
      expiresAt: null
    };

    console.log('最终提交数据:', submitData);
    
    const response = await apiService.assignUserRole(submitData);
    console.log('分配成功响应:', response);
    
    Message.success('角色分配成功');
    emit('success');
    modalVisible.value = false;
    
  } catch (error) {
    console.error('角色分配失败:', error);
    console.log('错误详情:', error.response?.data);
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

// 监听模态框状态变化
watch(modalVisible, (visible) => {
  if (visible) {
    console.log('模态框打开，开始加载数据...');
    loadUsers();
    loadRoles();
  } else {
    resetForm();
  }
});
</script>

<style scoped>
.debug-info {
  font-size: 12px;
  color: #666;
}

.debug-info div {
  margin-bottom: 4px;
}
</style>
