<template>
  <div class="user-role-test">
    <a-card title="用户角色分配测试" :bordered="false">
      
      <!-- 测试表单 -->
      <a-form ref="formRef" :model="testForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="用户ID" field="userId">
              <a-input v-model="testForm.userId" placeholder="输入用户ID" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="角色ID" field="roleId">
              <a-input v-model="testForm.roleId" placeholder="输入角色ID" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="范围" field="scope">
              <a-select v-model="testForm.scope" placeholder="选择范围">
                <a-option value="admin">后台</a-option>
                <a-option value="client">用户端</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="分配原因" field="assignReason">
          <a-input v-model="testForm.assignReason" placeholder="输入分配原因" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="testAssignRole" :loading="loading">测试分配角色</a-button>
            <a-button @click="loadTestData">加载测试数据</a-button>
            <a-button @click="loadUsers">加载用户列表</a-button>
            <a-button @click="loadRoles">加载角色列表</a-button>
          </a-space>
        </a-form-item>
      </a-form>

      <!-- 用户列表 -->
      <a-card title="用户列表" size="small" style="margin-top: 16px">
        <a-list :data="users" :max-height="200">
          <template #item="{ item }">
            <a-list-item>
              <a-list-item-meta
                :title="item.username"
                :description="`ID: ${item._id} | 类型: ${item.userType}`"
              >
                <template #avatar>
                  <a-button size="mini" @click="selectUser(item)">选择</a-button>
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>
      </a-card>

      <!-- 角色列表 -->
      <a-card title="角色列表" size="small" style="margin-top: 16px">
        <a-list :data="roles" :max-height="200">
          <template #item="{ item }">
            <a-list-item>
              <a-list-item-meta
                :title="item.name"
                :description="`ID: ${item._id} | 代码: ${item.code} | 范围: ${item.scope}`"
              >
                <template #avatar>
                  <a-button size="mini" @click="selectRole(item)">选择</a-button>
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>
      </a-card>

      <!-- 测试结果 -->
      <a-card title="测试结果" size="small" style="margin-top: 16px">
        <div v-if="testResult">
          <a-alert
            :type="testResult.success ? 'success' : 'error'"
            :message="testResult.message"
            :description="testResult.details"
            style="margin-bottom: 16px"
          />
          <pre v-if="testResult.data">{{ JSON.stringify(testResult.data, null, 2) }}</pre>
        </div>
        <div v-else>
          <a-empty description="暂无测试结果" />
        </div>
      </a-card>

      <!-- 当前用户角色 -->
      <a-card title="当前用户角色" size="small" style="margin-top: 16px">
        <a-button @click="loadUserRoles" :loading="userRoleLoading" style="margin-bottom: 16px">
          加载用户角色
        </a-button>
        <a-list :data="userRoles" :max-height="200">
          <template #item="{ item }">
            <a-list-item>
              <a-list-item-meta
                :title="`${item.userDetails?.username || '未知用户'} - ${item.roleDetails?.name || '未知角色'}`"
                :description="`范围: ${item.scope} | 状态: ${item.status} | ID: ${item._id}`"
              />
            </a-list-item>
          </template>
        </a-list>
      </a-card>

    </a-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { Message } from '@arco-design/web-vue';
import apiService from '../services/apiService';

const loading = ref(false);
const userRoleLoading = ref(false);
const users = ref([]);
const roles = ref([]);
const userRoles = ref([]);
const testResult = ref(null);

const testForm = reactive({
  userId: '',
  roleId: '',
  scope: 'admin',
  assignReason: '测试分配'
});

// 加载数据
const loadUsers = async () => {
  try {
    const response = await apiService.get('/users', { params: { limit: 20 } });
    users.value = response.data.data || [];
    Message.success(`加载了 ${users.value.length} 个用户`);
  } catch (error) {
    console.error('加载用户失败:', error);
    Message.error('加载用户失败');
  }
};

const loadRoles = async () => {
  try {
    const response = await apiService.getRoles({ limit: 20 });
    roles.value = response.data.data || [];
    Message.success(`加载了 ${roles.value.length} 个角色`);
  } catch (error) {
    console.error('加载角色失败:', error);
    Message.error('加载角色失败');
  }
};

const loadUserRoles = async () => {
  userRoleLoading.value = true;
  try {
    const response = await apiService.getUserRoles({ limit: 50 });
    userRoles.value = response.data.data || [];
    Message.success(`加载了 ${userRoles.value.length} 个用户角色分配`);
  } catch (error) {
    console.error('加载用户角色失败:', error);
    Message.error('加载用户角色失败');
  } finally {
    userRoleLoading.value = false;
  }
};

// 选择用户和角色
const selectUser = (user) => {
  testForm.userId = user._id;
  Message.success(`已选择用户: ${user.username}`);
};

const selectRole = (role) => {
  testForm.roleId = role._id;
  testForm.scope = role.scope;
  Message.success(`已选择角色: ${role.name}`);
};

// 加载测试数据
const loadTestData = async () => {
  await Promise.all([loadUsers(), loadRoles(), loadUserRoles()]);
};

// 测试分配角色
const testAssignRole = async () => {
  if (!testForm.userId || !testForm.roleId) {
    Message.error('请先选择用户和角色');
    return;
  }

  loading.value = true;
  testResult.value = null;

  try {
    console.log('发送角色分配请求:', testForm);
    
    const response = await apiService.assignUserRole(testForm);
    
    testResult.value = {
      success: true,
      message: '角色分配成功',
      details: `用户 ${testForm.userId} 在 ${testForm.scope} 范围下获得了角色 ${testForm.roleId}`,
      data: response.data
    };
    
    Message.success('角色分配成功');
    
    // 重新加载用户角色列表
    await loadUserRoles();
    
  } catch (error) {
    console.error('角色分配失败:', error);
    
    testResult.value = {
      success: false,
      message: '角色分配失败',
      details: error.response?.data?.message || error.message,
      data: error.response?.data || null
    };
    
    Message.error(`角色分配失败: ${error.response?.data?.message || error.message}`);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.user-role-test {
  padding: 20px;
}

pre {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
}
</style>
