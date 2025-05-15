<template>
  <div class="client-login-page">
    <div class="login-container">
      <div class="login-header">
        <h2>客户端登录</h2>
      </div>
      <a-form :model="loginForm" @submit="handleLogin" layout="vertical" ref="loginFormRef">
          <a-form-item field="username" label="账号" :rules="[{ required: true, message: '请输入账号' }]">
          <a-input v-model="loginForm.username" placeholder="请输入账号" allow-clear />
        </a-form-item>
        <a-form-item field="password" label="密码" :rules="[{ required: true, message: '请输入密码' }]">
          <a-input-password v-model="loginForm.password" placeholder="请输入密码" allow-clear/>
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit" long :loading="loading">登 录</a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import apiClient from '../services/apiService';
import {
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputPassword as AInputPassword,
  Button as AButton,
  Alert as AAlert
} from '@arco-design/web-vue';

const loginForm = reactive({
  username: '',
  password: ''
});
const errorMsg = ref('');
const loading = ref(false);
const loginFormRef = ref(null);
const router = useRouter();
const route = useRoute();

const handleLogin = async () => {
  try {
    await loginFormRef.value.validate();

    errorMsg.value = ''; // Clear previous errors
    loading.value = true;

    const response = await apiClient.post('/auth/client/login', {
      username: loginForm.username,
      password: loginForm.password,
    });

    const token = response.data.token;
    const userData = response.data.user;

    if (token) {
      localStorage.setItem('clientAccessToken', token);
      localStorage.setItem('clientUserInfo', JSON.stringify(userData));

      // Redirect to the intended page or a default
      const redirectPath = route.query.redirect || '/';
      router.push(redirectPath);
    } else {
      errorMsg.value = response.data.message || '登录失败，未收到令牌。';
    }
  } catch (err) {
    console.error('Login failed:', err);
    if (err.response && err.response.data && err.response.data.message) {
      errorMsg.value = err.response.data.message;
    } else if (err.message && err.message.includes('Network Error')) {
      errorMsg.value = '无法连接到服务器，请检查网络。';
    } else if (err.message) {
      errorMsg.value = err.message;
    } else {
      errorMsg.value = '登录失败，请稍后重试。';
    }
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.client-login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--color-bg-1);
  color: var(--color-text-1);
}

.login-container {
  width: 100%;
  max-width: 400px;
  padding: 30px;
  border-radius: 8px;
  background-color: var(--color-bg-2);
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.login-header {
  text-align: center;
  margin-bottom: 24px;
}

.login-header h2 {
  color: var(--color-text-1);
  font-size: 24px;
  margin: 0;
}

:deep(.arco-form-item-label > label) {
  color: var(--color-text-2);
}

.mb-4 {
  margin-bottom: 16px;
}
</style>