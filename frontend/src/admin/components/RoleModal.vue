<template>
  <a-modal 
    v-model:visible="modalVisible"
    :title="role ? '编辑角色' : '新建角色'"
    @ok="handleSubmit"
    @cancel="handleCancel"
    :confirm-loading="loading"
    width="800px"
  >
    <a-form ref="formRef" :model="form" layout="vertical" :rules="rules">
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="角色名称" field="name">
            <a-input v-model="form.name" placeholder="请输入角色名称" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="角色代码" field="code">
            <a-input v-model="form.code" placeholder="如：admin_user" />
          </a-form-item>
        </a-col>
      </a-row>
      
      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item label="角色范围" field="scope">
            <a-select v-model="form.scope" placeholder="请选择角色范围">
              <a-option value="admin">后台角色</a-option>
              <a-option value="client">用户端角色</a-option>
              <a-option value="both">通用角色</a-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="角色层级" field="level">
            <a-input-number 
              v-model="form.level" 
              :min="1" 
              :max="10" 
              placeholder="1-10"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="状态" field="status">
            <a-select v-model="form.status" placeholder="请选择状态">
              <a-option value="active">启用</a-option>
              <a-option value="disabled">禁用</a-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="角色描述" field="description">
        <a-textarea 
          v-model="form.description" 
          placeholder="请输入角色描述"
          :rows="3"
        />
      </a-form-item>

      <a-form-item label="权限分配" field="permissions">
        <div class="permission-assignment">
          <div class="permission-search">
            <a-input-search
              v-model="searchKeyword"
              placeholder="搜索权限..."
              style="margin-bottom: 16px"
            />
          </div>
          
          <div class="permission-scope-tabs">
            <a-tabs v-model:active-key="activeScope" size="small">
              <a-tab-pane key="admin" title="后台权限">
                <div class="permission-modules">
                  <div 
                    v-for="module in filteredAdminModules" 
                    :key="module" 
                    class="permission-module"
                  >
                    <div class="module-header">
                      <a-checkbox 
                        :model-value="isModuleSelected(module, 'admin')"
                        :indeterminate="isModuleIndeterminate(module, 'admin')"
                        @change="handleModuleChange(module, 'admin', $event)"
                      >
                        <strong>{{ module }}</strong>
                      </a-checkbox>
                    </div>
                    <div class="module-permissions">
                      <a-checkbox-group v-model="form.permissions">
                        <a-row :gutter="[8, 8]">
                          <a-col 
                            :span="12" 
                            v-for="permission in getModulePermissions(module, 'admin')" 
                            :key="permission._id"
                          >
                            <a-checkbox :value="permission._id">
                              {{ permission.name }}
                              <a-tag size="small" color="blue">{{ permission.action }}</a-tag>
                            </a-checkbox>
                          </a-col>
                        </a-row>
                      </a-checkbox-group>
                    </div>
                  </div>
                </div>
              </a-tab-pane>
              
              <a-tab-pane key="client" title="用户端权限">
                <div class="permission-modules">
                  <div 
                    v-for="module in filteredClientModules" 
                    :key="module" 
                    class="permission-module"
                  >
                    <div class="module-header">
                      <a-checkbox 
                        :model-value="isModuleSelected(module, 'client')"
                        :indeterminate="isModuleIndeterminate(module, 'client')"
                        @change="handleModuleChange(module, 'client', $event)"
                      >
                        <strong>{{ module }}</strong>
                      </a-checkbox>
                    </div>
                    <div class="module-permissions">
                      <a-checkbox-group v-model="form.permissions">
                        <a-row :gutter="[8, 8]">
                          <a-col 
                            :span="12" 
                            v-for="permission in getModulePermissions(module, 'client')" 
                            :key="permission._id"
                          >
                            <a-checkbox :value="permission._id">
                              {{ permission.name }}
                              <a-tag size="small" color="green">{{ permission.action }}</a-tag>
                            </a-checkbox>
                          </a-col>
                        </a-row>
                      </a-checkbox-group>
                    </div>
                  </div>
                </div>
              </a-tab-pane>
            </a-tabs>
          </div>
        </div>
      </a-form-item>

      <a-form-item label="标签" field="tags">
        <a-input
          v-model="tagsInput"
          placeholder="输入标签，用逗号分隔"
          @blur="updateTags"
        />
        <template #help>
          <small>多个标签用逗号分隔，如：管理,系统,重要</small>
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
  role: {
    type: Object,
    default: null
  },
  permissions: {
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
const searchKeyword = ref('');
const activeScope = ref('admin');
const tagsInput = ref('');

const form = reactive({
  name: '',
  code: '',
  scope: 'admin',
  level: 1,
  status: 'active',
  description: '',
  permissions: [],
  tags: []
});

const rules = {
  name: [
    { required: true, message: '请输入角色名称' }
  ],
  code: [
    { required: true, message: '请输入角色代码' },
    { 
      pattern: /^[a-z_]+$/, 
      message: '角色代码只能包含小写字母和下划线' 
    }
  ],
  scope: [
    { required: true, message: '请选择角色范围' }
  ]
};

// 计算属性
const filteredPermissions = computed(() => {
  if (!searchKeyword.value) return props.permissions;
  
  const keyword = searchKeyword.value.toLowerCase();
  return props.permissions.filter(permission => 
    permission.name.toLowerCase().includes(keyword) ||
    permission.code.toLowerCase().includes(keyword) ||
    permission.module.toLowerCase().includes(keyword)
  );
});

const adminPermissions = computed(() => 
  filteredPermissions.value.filter(p => p.scope === 'admin' || p.scope === 'both')
);

const clientPermissions = computed(() => 
  filteredPermissions.value.filter(p => p.scope === 'client' || p.scope === 'both')
);

const filteredAdminModules = computed(() => {
  const modules = new Set();
  adminPermissions.value.forEach(p => modules.add(p.module));
  return Array.from(modules).sort();
});

const filteredClientModules = computed(() => {
  const modules = new Set();
  clientPermissions.value.forEach(p => modules.add(p.module));
  return Array.from(modules).sort();
});

// 方法
const getModulePermissions = (module, scope) => {
  const permissions = scope === 'admin' ? adminPermissions.value : clientPermissions.value;
  return permissions.filter(p => p.module === module);
};

const isModuleSelected = (module, scope) => {
  const modulePermissions = getModulePermissions(module, scope);
  return modulePermissions.length > 0 && 
         modulePermissions.every(p => form.permissions.includes(p._id));
};

const isModuleIndeterminate = (module, scope) => {
  const modulePermissions = getModulePermissions(module, scope);
  const selectedCount = modulePermissions.filter(p => form.permissions.includes(p._id)).length;
  return selectedCount > 0 && selectedCount < modulePermissions.length;
};

const handleModuleChange = (module, scope, checked) => {
  const modulePermissions = getModulePermissions(module, scope);
  
  if (checked) {
    // 选中模块下所有权限
    modulePermissions.forEach(p => {
      if (!form.permissions.includes(p._id)) {
        form.permissions.push(p._id);
      }
    });
  } else {
    // 取消选中模块下所有权限
    modulePermissions.forEach(p => {
      const index = form.permissions.indexOf(p._id);
      if (index > -1) {
        form.permissions.splice(index, 1);
      }
    });
  }
};

// 监听角色变化，填充表单
watch(() => props.role, (newRole) => {
  if (newRole) {
    Object.assign(form, {
      name: newRole.name || '',
      code: newRole.code || '',
      scope: newRole.scope || 'admin',
      level: newRole.level || 1,
      status: newRole.status || 'active',
      description: newRole.description || '',
      permissions: newRole.permissions || [],
      tags: newRole.tags || []
    });
    tagsInput.value = (newRole.tags || []).join(', ');
  } else {
    resetForm();
  }
}, { immediate: true, deep: true });

const resetForm = () => {
  Object.assign(form, {
    name: '',
    code: '',
    scope: 'admin',
    level: 1,
    status: 'active',
    description: '',
    permissions: [],
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

const handleSubmit = async () => {
  try {
    await formRef.value.validate();
    loading.value = true;

    // 更新标签
    updateTags();

    const submitData = { ...form };

    if (props.role) {
      // 更新角色
      await apiService.updateRole(props.role._id, submitData);
      Message.success('角色更新成功');
    } else {
      // 创建角色
      await apiService.createRole(submitData);
      Message.success('角色创建成功');
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
</script>

<style scoped>
.permission-assignment {
  max-height: 400px;
  overflow-y: auto;
}

.permission-module {
  margin-bottom: 20px;
  padding: 16px;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  background: #fafafa;
}

.module-header {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e5e5;
}

.module-permissions {
  padding-left: 24px;
}

.permission-scope-tabs {
  margin-top: 16px;
}

.a-form-item {
  margin-bottom: 16px;
}
</style>
