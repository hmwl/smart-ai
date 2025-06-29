<template>
  <div class="permission-management">
    <a-card title="权限管理（简化版）" :bordered="false">
      
      <!-- 基础信息显示 -->
      <a-space direction="vertical" size="large" style="width: 100%">
        
        <!-- 权限列表 -->
        <a-card title="权限列表" size="small">
          <template #extra>
            <a-button type="primary" @click="loadPermissions" :loading="permissionLoading">
              刷新权限
            </a-button>
          </template>
          
          <div v-if="permissionLoading" class="loading">
            <a-spin tip="加载中..." />
          </div>
          
          <div v-else-if="permissions.length === 0" class="empty">
            <a-empty description="暂无权限数据" />
          </div>
          
          <div v-else>
            <a-list :data="permissions" :max-height="300">
              <template #item="{ item }">
                <a-list-item>
                  <a-list-item-meta
                    :title="item.name"
                    :description="`${item.code} - ${item.description || '无描述'}`"
                  >
                    <template #avatar>
                      <a-tag :color="getScopeColor(item.scope)">
                        {{ getScopeText(item.scope) }}
                      </a-tag>
                    </template>
                  </a-list-item-meta>
                  <template #actions>
                    <a-tag :color="item.status === 'active' ? 'green' : 'red'">
                      {{ item.status === 'active' ? '启用' : '禁用' }}
                    </a-tag>
                  </template>
                </a-list-item>
              </template>
            </a-list>
          </div>
        </a-card>

        <!-- 角色列表 -->
        <a-card title="角色列表" size="small">
          <template #extra>
            <a-button type="primary" @click="loadRoles" :loading="roleLoading">
              刷新角色
            </a-button>
          </template>
          
          <div v-if="roleLoading" class="loading">
            <a-spin tip="加载中..." />
          </div>
          
          <div v-else-if="roles.length === 0" class="empty">
            <a-empty description="暂无角色数据" />
          </div>
          
          <div v-else>
            <a-list :data="roles" :max-height="300">
              <template #item="{ item }">
                <a-list-item>
                  <a-list-item-meta
                    :title="item.name"
                    :description="`${item.code} - ${item.description || '无描述'}`"
                  >
                    <template #avatar>
                      <a-tag :color="getScopeColor(item.scope)">
                        {{ getScopeText(item.scope) }}
                      </a-tag>
                    </template>
                  </a-list-item-meta>
                  <template #actions>
                    <a-space>
                      <a-tag :color="item.status === 'active' ? 'green' : 'red'">
                        {{ item.status === 'active' ? '启用' : '禁用' }}
                      </a-tag>
                      <a-tag :color="item.isSystem ? 'blue' : 'gray'">
                        {{ item.isSystem ? '系统' : '自定义' }}
                      </a-tag>
                      <a-tag color="orange">
                        权限: {{ item.permissions?.length || 0 }}
                      </a-tag>
                    </a-space>
                  </template>
                </a-list-item>
              </template>
            </a-list>
          </div>
        </a-card>

        <!-- 操作区域 -->
        <a-card title="快速操作" size="small">
          <a-space>
            <a-button @click="testAPI" :loading="testLoading">
              测试API连接
            </a-button>
            <a-button @click="showStats">
              显示统计信息
            </a-button>
            <a-button @click="clearData">
              清空显示数据
            </a-button>
          </a-space>
        </a-card>

        <!-- 统计信息 -->
        <a-card v-if="showStatistics" title="统计信息" size="small">
          <a-descriptions :column="2" bordered>
            <a-descriptions-item label="权限总数">
              {{ permissions.length }}
            </a-descriptions-item>
            <a-descriptions-item label="角色总数">
              {{ roles.length }}
            </a-descriptions-item>
            <a-descriptions-item label="后台权限">
              {{ permissions.filter(p => p.scope === 'admin').length }}
            </a-descriptions-item>
            <a-descriptions-item label="用户端权限">
              {{ permissions.filter(p => p.scope === 'client').length }}
            </a-descriptions-item>
            <a-descriptions-item label="系统角色">
              {{ roles.filter(r => r.isSystem).length }}
            </a-descriptions-item>
            <a-descriptions-item label="自定义角色">
              {{ roles.filter(r => !r.isSystem).length }}
            </a-descriptions-item>
          </a-descriptions>
        </a-card>

        <!-- 错误信息 -->
        <a-card v-if="errors.length > 0" title="错误信息" size="small">
          <a-alert
            v-for="(error, index) in errors"
            :key="index"
            :message="error.message"
            :description="error.details"
            type="error"
            style="margin-bottom: 10px"
            closable
            @close="removeError(index)"
          />
        </a-card>

      </a-space>
    </a-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import apiService from '../services/apiService';

// 响应式数据
const permissionLoading = ref(false);
const roleLoading = ref(false);
const testLoading = ref(false);
const showStatistics = ref(false);

const permissions = ref([]);
const roles = ref([]);
const errors = reactive([]);

// 工具方法
const getScopeColor = (scope) => {
  const colors = { admin: 'red', client: 'blue', both: 'green' };
  return colors[scope] || 'gray';
};

const getScopeText = (scope) => {
  const texts = { admin: '后台', client: '用户端', both: '通用' };
  return texts[scope] || scope;
};

const addError = (message, details) => {
  errors.push({ message, details, timestamp: new Date() });
};

const removeError = (index) => {
  errors.splice(index, 1);
};

// 数据加载方法
const loadPermissions = async () => {
  console.log('开始加载权限列表...');
  permissionLoading.value = true;
  try {
    const response = await apiService.getPermissions({ limit: 100 });
    console.log('权限API响应:', response);
    permissions.value = response.data.data || [];
    console.log(`权限列表加载成功，共 ${permissions.value.length} 个权限`);
    Message.success(`权限列表加载成功，共 ${permissions.value.length} 个权限`);
  } catch (error) {
    console.error('加载权限列表失败:', error);
    const errorMsg = error.response?.data?.message || error.message || '未知错误';
    addError('加载权限列表失败', errorMsg);
    Message.error(`加载权限列表失败: ${errorMsg}`);
  } finally {
    permissionLoading.value = false;
  }
};

const loadRoles = async () => {
  console.log('开始加载角色列表...');
  roleLoading.value = true;
  try {
    const response = await apiService.getRoles({ limit: 100 });
    console.log('角色API响应:', response);
    roles.value = response.data.data || [];
    console.log(`角色列表加载成功，共 ${roles.value.length} 个角色`);
    Message.success(`角色列表加载成功，共 ${roles.value.length} 个角色`);
  } catch (error) {
    console.error('加载角色列表失败:', error);
    const errorMsg = error.response?.data?.message || error.message || '未知错误';
    addError('加载角色列表失败', errorMsg);
    Message.error(`加载角色列表失败: ${errorMsg}`);
  } finally {
    roleLoading.value = false;
  }
};

const testAPI = async () => {
  testLoading.value = true;
  try {
    console.log('开始测试API连接...');
    
    // 测试权限API
    const permResponse = await apiService.getPermissions({ limit: 1 });
    console.log('权限API测试成功:', permResponse);
    
    // 测试角色API
    const roleResponse = await apiService.getRoles({ limit: 1 });
    console.log('角色API测试成功:', roleResponse);
    
    Message.success('API连接测试成功');
  } catch (error) {
    console.error('API连接测试失败:', error);
    const errorMsg = error.response?.data?.message || error.message || '未知错误';
    addError('API连接测试失败', errorMsg);
    Message.error(`API连接测试失败: ${errorMsg}`);
  } finally {
    testLoading.value = false;
  }
};

const showStats = () => {
  showStatistics.value = !showStatistics.value;
  Message.info(showStatistics.value ? '显示统计信息' : '隐藏统计信息');
};

const clearData = () => {
  permissions.value = [];
  roles.value = [];
  errors.splice(0, errors.length);
  showStatistics.value = false;
  Message.info('数据已清空');
};

// 初始化
onMounted(async () => {
  console.log('权限管理页面（简化版）开始初始化...');
  try {
    await Promise.all([
      loadPermissions(),
      loadRoles()
    ]);
    console.log('权限管理页面初始化完成');
  } catch (error) {
    console.error('初始化失败:', error);
    addError('页面初始化失败', error.message || '未知错误');
  }
});
</script>

<style scoped>
.permission-management {
  padding: 20px;
}

.loading,
.empty {
  text-align: center;
  padding: 40px 0;
}

.a-list {
  max-height: 300px;
  overflow-y: auto;
}
</style>
