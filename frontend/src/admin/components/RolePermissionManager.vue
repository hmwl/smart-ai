<template>
  <a-modal 
    v-model:visible="modalVisible"
    :title="`管理角色权限 - ${role?.name}`"
    @ok="handleSubmit"
    @cancel="handleCancel"
    :confirm-loading="loading"
    width="900px"
  >
    <div class="role-permission-manager">
      
      <!-- 角色信息 -->
      <a-card title="角色信息" size="small" style="margin-bottom: 16px">
        <a-descriptions :column="3" bordered>
          <a-descriptions-item label="角色名称">{{ role?.name }}</a-descriptions-item>
          <a-descriptions-item label="角色代码">{{ role?.code }}</a-descriptions-item>
          <a-descriptions-item label="角色范围">
            <a-tag :color="getScopeColor(role?.scope)">
              {{ getScopeText(role?.scope) }}
            </a-tag>
          </a-descriptions-item>
        </a-descriptions>
      </a-card>

      <!-- 权限分配 -->
      <a-card title="权限分配" size="small">
        <template #extra>
          <a-space>
            <a-input-search
              v-model="searchKeyword"
              placeholder="搜索权限..."
              style="width: 200px"
            />
            <a-button @click="selectAll">全选</a-button>
            <a-button @click="selectNone">全不选</a-button>
          </a-space>
        </template>

        <!-- 权限范围切换 -->
        <a-tabs v-model:active-key="activeScope" size="small" style="margin-bottom: 16px">
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
                  <a-tag size="small" color="blue">
                    {{ getModulePermissions(module, 'admin').length }} 个权限
                  </a-tag>
                </div>
                <div class="module-permissions">
                  <a-checkbox-group v-model="selectedPermissions">
                    <a-row :gutter="[8, 8]">
                      <a-col 
                        :span="12" 
                        v-for="permission in getModulePermissions(module, 'admin')" 
                        :key="permission._id"
                      >
                        <a-checkbox :value="permission._id">
                          <div class="permission-item">
                            <div class="permission-name">{{ permission.name }}</div>
                            <div class="permission-code">{{ permission.code }}</div>
                          </div>
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
                  <a-tag size="small" color="green">
                    {{ getModulePermissions(module, 'client').length }} 个权限
                  </a-tag>
                </div>
                <div class="module-permissions">
                  <a-checkbox-group v-model="selectedPermissions">
                    <a-row :gutter="[8, 8]">
                      <a-col 
                        :span="12" 
                        v-for="permission in getModulePermissions(module, 'client')" 
                        :key="permission._id"
                      >
                        <a-checkbox :value="permission._id">
                          <div class="permission-item">
                            <div class="permission-name">{{ permission.name }}</div>
                            <div class="permission-code">{{ permission.code }}</div>
                          </div>
                        </a-checkbox>
                      </a-col>
                    </a-row>
                  </a-checkbox-group>
                </div>
              </div>
            </div>
          </a-tab-pane>
        </a-tabs>

        <!-- 已选权限统计 -->
        <a-card title="已选权限统计" size="small" style="margin-top: 16px">
          <a-space>
            <a-tag color="blue">总计: {{ selectedPermissions.length }}</a-tag>
            <a-tag color="red">后台权限: {{ selectedAdminPermissions.length }}</a-tag>
            <a-tag color="green">用户端权限: {{ selectedClientPermissions.length }}</a-tag>
          </a-space>
        </a-card>

      </a-card>
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

const loading = ref(false);
const searchKeyword = ref('');
const activeScope = ref('admin');
const selectedPermissions = ref([]);

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

const selectedAdminPermissions = computed(() => {
  return selectedPermissions.value.filter(id => {
    const permission = props.permissions.find(p => p._id === id);
    return permission && (permission.scope === 'admin' || permission.scope === 'both');
  });
});

const selectedClientPermissions = computed(() => {
  return selectedPermissions.value.filter(id => {
    const permission = props.permissions.find(p => p._id === id);
    return permission && (permission.scope === 'client' || permission.scope === 'both');
  });
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

const getModulePermissions = (module, scope) => {
  const permissions = scope === 'admin' ? adminPermissions.value : clientPermissions.value;
  return permissions.filter(p => p.module === module);
};

const isModuleSelected = (module, scope) => {
  const modulePermissions = getModulePermissions(module, scope);
  return modulePermissions.length > 0 && 
         modulePermissions.every(p => selectedPermissions.value.includes(p._id));
};

const isModuleIndeterminate = (module, scope) => {
  const modulePermissions = getModulePermissions(module, scope);
  const selectedCount = modulePermissions.filter(p => selectedPermissions.value.includes(p._id)).length;
  return selectedCount > 0 && selectedCount < modulePermissions.length;
};

const handleModuleChange = (module, scope, checked) => {
  const modulePermissions = getModulePermissions(module, scope);
  
  if (checked) {
    // 选中模块下所有权限
    modulePermissions.forEach(p => {
      if (!selectedPermissions.value.includes(p._id)) {
        selectedPermissions.value.push(p._id);
      }
    });
  } else {
    // 取消选中模块下所有权限
    modulePermissions.forEach(p => {
      const index = selectedPermissions.value.indexOf(p._id);
      if (index > -1) {
        selectedPermissions.value.splice(index, 1);
      }
    });
  }
};

const selectAll = () => {
  const currentPermissions = activeScope.value === 'admin' ? adminPermissions.value : clientPermissions.value;
  currentPermissions.forEach(p => {
    if (!selectedPermissions.value.includes(p._id)) {
      selectedPermissions.value.push(p._id);
    }
  });
  Message.success(`已选择所有${activeScope.value === 'admin' ? '后台' : '用户端'}权限`);
};

const selectNone = () => {
  const currentPermissions = activeScope.value === 'admin' ? adminPermissions.value : clientPermissions.value;
  currentPermissions.forEach(p => {
    const index = selectedPermissions.value.indexOf(p._id);
    if (index > -1) {
      selectedPermissions.value.splice(index, 1);
    }
  });
  Message.success(`已取消选择所有${activeScope.value === 'admin' ? '后台' : '用户端'}权限`);
};

// 监听角色变化，初始化选中的权限
watch(() => props.role, (newRole) => {
  if (newRole) {
    selectedPermissions.value = [...(newRole.permissions || [])];
  } else {
    selectedPermissions.value = [];
  }
}, { immediate: true });

const handleSubmit = async () => {
  if (!props.role) return;
  
  loading.value = true;
  try {
    const updateData = {
      ...props.role,
      permissions: selectedPermissions.value
    };
    
    await apiService.updateRole(props.role._id, updateData);
    Message.success('角色权限更新成功');
    
    emit('success');
    modalVisible.value = false;
  } catch (error) {
    console.error('角色权限更新失败:', error);
    Message.error(`角色权限更新失败: ${error.response?.data?.message || error.message}`);
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  modalVisible.value = false;
  // 重置为原始权限
  if (props.role) {
    selectedPermissions.value = [...(props.role.permissions || [])];
  }
};
</script>

<style scoped>
.role-permission-manager {
  max-height: 600px;
  overflow-y: auto;
}

.permission-modules {
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e5e5;
}

.module-permissions {
  padding-left: 24px;
}

.permission-item {
  width: 100%;
}

.permission-name {
  font-weight: 500;
  margin-bottom: 2px;
}

.permission-code {
  font-size: 12px;
  color: #999;
}
</style>
