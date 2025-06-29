<template>
  <div class="permission-test">
    <a-card title="权限管理测试页面" :bordered="false">
      <a-space direction="vertical" size="large" style="width: 100%">
        
        <!-- API测试区域 -->
        <a-card title="API测试" size="small">
          <a-space>
            <a-button @click="testPermissionsAPI" :loading="loading.permissions">
              测试权限API
            </a-button>
            <a-button @click="testRolesAPI" :loading="loading.roles">
              测试角色API
            </a-button>
            <a-button @click="testUserRolesAPI" :loading="loading.userRoles">
              测试用户角色API
            </a-button>
          </a-space>
        </a-card>

        <!-- 结果显示区域 -->
        <a-card title="测试结果" size="small">
          <a-tabs>
            <a-tab-pane key="permissions" title="权限数据">
              <pre>{{ JSON.stringify(testResults.permissions, null, 2) }}</pre>
            </a-tab-pane>
            <a-tab-pane key="roles" title="角色数据">
              <pre>{{ JSON.stringify(testResults.roles, null, 2) }}</pre>
            </a-tab-pane>
            <a-tab-pane key="userRoles" title="用户角色数据">
              <pre>{{ JSON.stringify(testResults.userRoles, null, 2) }}</pre>
            </a-tab-pane>
            <a-tab-pane key="errors" title="错误信息">
              <div v-for="(error, index) in testResults.errors" :key="index" class="error-item">
                <a-alert :message="error.message" :description="error.details" type="error" />
              </div>
            </a-tab-pane>
          </a-tabs>
        </a-card>

        <!-- 基础功能测试 -->
        <a-card title="基础功能测试" size="small">
          <a-space direction="vertical" style="width: 100%">
            
            <!-- 创建权限测试 -->
            <a-card title="创建权限测试" size="small">
              <a-form layout="inline">
                <a-form-item label="权限名称">
                  <a-input v-model="testPermission.name" placeholder="测试权限" />
                </a-form-item>
                <a-form-item label="权限代码">
                  <a-input v-model="testPermission.code" placeholder="test:create" />
                </a-form-item>
                <a-form-item label="模块">
                  <a-input v-model="testPermission.module" placeholder="test" />
                </a-form-item>
                <a-form-item label="操作">
                  <a-select v-model="testPermission.action" placeholder="选择操作">
                    <a-option value="create">创建</a-option>
                    <a-option value="read">查看</a-option>
                    <a-option value="update">更新</a-option>
                    <a-option value="delete">删除</a-option>
                  </a-select>
                </a-form-item>
                <a-form-item>
                  <a-button @click="createTestPermission" :loading="loading.createPermission">
                    创建测试权限
                  </a-button>
                </a-form-item>
              </a-form>
            </a-card>

            <!-- 创建角色测试 -->
            <a-card title="创建角色测试" size="small">
              <a-form layout="inline">
                <a-form-item label="角色名称">
                  <a-input v-model="testRole.name" placeholder="测试角色" />
                </a-form-item>
                <a-form-item label="角色代码">
                  <a-input v-model="testRole.code" placeholder="test_role" />
                </a-form-item>
                <a-form-item label="角色范围">
                  <a-select v-model="testRole.scope" placeholder="选择范围">
                    <a-option value="admin">后台</a-option>
                    <a-option value="client">用户端</a-option>
                  </a-select>
                </a-form-item>
                <a-form-item>
                  <a-button @click="createTestRole" :loading="loading.createRole">
                    创建测试角色
                  </a-button>
                </a-form-item>
              </a-form>
            </a-card>

          </a-space>
        </a-card>

      </a-space>
    </a-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { Message } from '@arco-design/web-vue';
import apiService from '../services/apiService';

// 响应式数据
const loading = reactive({
  permissions: false,
  roles: false,
  userRoles: false,
  createPermission: false,
  createRole: false
});

const testResults = reactive({
  permissions: null,
  roles: null,
  userRoles: null,
  errors: []
});

const testPermission = reactive({
  name: '测试权限',
  code: 'test:create',
  module: 'test',
  action: 'create',
  scope: 'admin',
  description: '这是一个测试权限'
});

const testRole = reactive({
  name: '测试角色',
  code: 'test_role',
  scope: 'admin',
  description: '这是一个测试角色'
});

// 测试方法
const testPermissionsAPI = async () => {
  loading.permissions = true;
  try {
    console.log('开始测试权限API...');
    const response = await apiService.getPermissions({ limit: 10 });
    console.log('权限API响应:', response);
    testResults.permissions = response.data;
    Message.success('权限API测试成功');
  } catch (error) {
    console.error('权限API测试失败:', error);
    testResults.errors.push({
      message: '权限API测试失败',
      details: error.message || error.toString()
    });
    Message.error('权限API测试失败');
  } finally {
    loading.permissions = false;
  }
};

const testRolesAPI = async () => {
  loading.roles = true;
  try {
    console.log('开始测试角色API...');
    const response = await apiService.getRoles({ limit: 10 });
    console.log('角色API响应:', response);
    testResults.roles = response.data;
    Message.success('角色API测试成功');
  } catch (error) {
    console.error('角色API测试失败:', error);
    testResults.errors.push({
      message: '角色API测试失败',
      details: error.message || error.toString()
    });
    Message.error('角色API测试失败');
  } finally {
    loading.roles = false;
  }
};

const testUserRolesAPI = async () => {
  loading.userRoles = true;
  try {
    console.log('开始测试用户角色API...');
    const response = await apiService.getUserRoles({ limit: 10 });
    console.log('用户角色API响应:', response);
    testResults.userRoles = response.data;
    Message.success('用户角色API测试成功');
  } catch (error) {
    console.error('用户角色API测试失败:', error);
    testResults.errors.push({
      message: '用户角色API测试失败',
      details: error.message || error.toString()
    });
    Message.error('用户角色API测试失败');
  } finally {
    loading.userRoles = false;
  }
};

const createTestPermission = async () => {
  loading.createPermission = true;
  try {
    console.log('开始创建测试权限...', testPermission);
    const response = await apiService.createPermission(testPermission);
    console.log('创建权限响应:', response);
    Message.success('测试权限创建成功');
    // 重新测试权限API
    await testPermissionsAPI();
  } catch (error) {
    console.error('创建测试权限失败:', error);
    testResults.errors.push({
      message: '创建测试权限失败',
      details: error.response?.data?.message || error.message || error.toString()
    });
    Message.error('创建测试权限失败');
  } finally {
    loading.createPermission = false;
  }
};

const createTestRole = async () => {
  loading.createRole = true;
  try {
    console.log('开始创建测试角色...', testRole);
    const response = await apiService.createRole(testRole);
    console.log('创建角色响应:', response);
    Message.success('测试角色创建成功');
    // 重新测试角色API
    await testRolesAPI();
  } catch (error) {
    console.error('创建测试角色失败:', error);
    testResults.errors.push({
      message: '创建测试角色失败',
      details: error.response?.data?.message || error.message || error.toString()
    });
    Message.error('创建测试角色失败');
  } finally {
    loading.createRole = false;
  }
};
</script>

<style scoped>
.permission-test {
  padding: 20px;
}

.error-item {
  margin-bottom: 10px;
}

pre {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
}
</style>
