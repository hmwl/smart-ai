<template>
  <a-modal 
    v-model:visible="modalVisible"
    :title="permission ? '编辑权限' : '新建权限'"
    @ok="handleSubmit"
    @cancel="handleCancel"
    :confirm-loading="loading"
    width="600px"
  >
    <a-form ref="formRef" :model="form" layout="vertical" :rules="rules">
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="权限名称" field="name">
            <a-input v-model="form.name" placeholder="请输入权限名称" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="权限代码" field="code">
            <a-input v-model="form.code" placeholder="如：user:create" />
          </a-form-item>
        </a-col>
      </a-row>
      
      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item label="模块" field="module">
            <a-select v-model="form.module" placeholder="选择或输入模块" allow-create>
              <a-option v-for="module in modules" :key="module" :value="module">
                {{ module }}
              </a-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="操作" field="action">
            <a-select v-model="form.action" placeholder="请选择操作">
              <a-option value="create">创建</a-option>
              <a-option value="read">查看</a-option>
              <a-option value="update">更新</a-option>
              <a-option value="delete">删除</a-option>
              <a-option value="manage">管理</a-option>
              <a-option value="execute">执行</a-option>
              <a-option value="view">浏览</a-option>
              <a-option value="export">导出</a-option>
              <a-option value="import">导入</a-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="权限范围" field="scope">
            <a-select v-model="form.scope" placeholder="请选择权限范围">
              <a-option value="admin">后台权限</a-option>
              <a-option value="client">用户端权限</a-option>
              <a-option value="both">通用权限</a-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="权限层级" field="level">
            <a-input-number 
              v-model="form.level" 
              :min="1" 
              :max="10" 
              placeholder="1-10"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="状态" field="status">
            <a-select v-model="form.status" placeholder="请选择状态">
              <a-option value="active">启用</a-option>
              <a-option value="disabled">禁用</a-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="父权限" field="parentId">
        <a-select
          v-model="form.parentId"
          placeholder="选择父权限（可选）"
          allow-clear
        >
          <a-option v-for="permission in flatPermissions" :key="permission._id" :value="permission._id">
            {{ permission.name }} ({{ permission.code }})
          </a-option>
        </a-select>
      </a-form-item>

      <a-form-item label="资源路径" field="resourcePath">
        <a-input v-model="form.resourcePath" placeholder="如：/admin/users（可选）" />
      </a-form-item>

      <a-form-item label="权限描述" field="description">
        <a-textarea 
          v-model="form.description" 
          placeholder="请输入权限描述"
          :rows="3"
        />
      </a-form-item>

      <a-form-item label="标签" field="tags">
        <a-input
          v-model="tagsInput"
          placeholder="输入标签，用逗号分隔"
          @blur="updateTags"
        />
        <template #help>
          <small>多个标签用逗号分隔，如：系统,核心,重要</small>
        </template>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue';
import { Message } from '@arco-design/web-vue';
import apiService from '../services/apiService';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  permission: {
    type: Object,
    default: null
  },
  modules: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:visible', 'success']);

const modalVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

const formRef = ref();
const loading = ref(false);
const permissionTree = ref([]);
const flatPermissions = ref([]);
const tagsInput = ref('');

const form = reactive({
  name: '',
  code: '',
  module: '',
  action: '',
  scope: 'admin',
  level: 1,
  status: 'active',
  parentId: null,
  resourcePath: '',
  description: '',
  tags: []
});

const rules = {
  name: [
    { required: true, message: '请输入权限名称' }
  ],
  code: [
    { required: true, message: '请输入权限代码' },
    { 
      pattern: /^[a-z_]+:[a-z_]+$/, 
      message: '权限代码格式应为：模块:操作（如 user:create）' 
    }
  ],
  module: [
    { required: true, message: '请选择模块' }
  ],
  action: [
    { required: true, message: '请选择操作' }
  ],
  scope: [
    { required: true, message: '请选择权限范围' }
  ]
};

// 监听权限变化，填充表单
watch(() => props.permission, (newPermission) => {
  if (newPermission) {
    Object.assign(form, {
      name: newPermission.name || '',
      code: newPermission.code || '',
      module: newPermission.module || '',
      action: newPermission.action || '',
      scope: newPermission.scope || 'admin',
      level: newPermission.level || 1,
      status: newPermission.status || 'active',
      parentId: newPermission.parentId || null,
      resourcePath: newPermission.resourcePath || '',
      description: newPermission.description || '',
      tags: newPermission.tags || []
    });
    tagsInput.value = (newPermission.tags || []).join(', ');
  } else {
    resetForm();
  }
}, { immediate: true, deep: true });

// 监听模块和操作变化，自动生成权限代码
watch([() => form.module, () => form.action], ([module, action]) => {
  if (module && action && !props.permission) {
    form.code = `${module}:${action}`;
  }
}, { flush: 'post' });

const resetForm = () => {
  Object.assign(form, {
    name: '',
    code: '',
    module: '',
    action: '',
    scope: 'admin',
    level: 1,
    status: 'active',
    parentId: null,
    resourcePath: '',
    description: '',
    tags: []
  });
  tagsInput.value = '';
};

const updateTags = () => {
  if (tagsInput.value) {
    form.tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
  } else {
    form.tags = [];
  }
};

const loadPermissionTree = async () => {
  try {
    const response = await apiService.getPermissions({ limit: 1000 });
    flatPermissions.value = response.data.data || [];
    permissionTree.value = response.data.data || [];
  } catch (error) {
    console.error('加载权限列表失败:', error);
  }
};

const handleSubmit = async () => {
  try {
    await formRef.value.validate();
    loading.value = true;

    // 更新标签
    updateTags();

    const submitData = { ...form };

    if (props.permission) {
      // 更新权限
      await apiService.updatePermission(props.permission._id, submitData);
      Message.success('权限更新成功');
    } else {
      // 创建权限
      await apiService.createPermission(submitData);
      Message.success('权限创建成功');
    }

    emit('success');
    modalVisible.value = false;
  } catch (error) {
    const message = error.response?.data?.message || '操作失败';
    Message.error(message);
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  modalVisible.value = false;
  resetForm();
};

// 监听模态框显示状态，加载权限树
watch(modalVisible, (visible) => {
  if (visible) {
    loadPermissionTree();
  }
});
</script>

<style scoped>
.a-form-item {
  margin-bottom: 16px;
}
</style>
