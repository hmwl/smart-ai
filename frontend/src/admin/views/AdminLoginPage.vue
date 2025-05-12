<template>
  <div class="admin-login-page flex justify-center items-center min-h-screen bg-gray-100">
    <div class="login-form-container p-8 bg-white rounded shadow-md" style="max-width: 300px; margin: auto;">
      <h2 class="text-2xl font-bold mb-6 text-center">后台管理登录</h2>
      <a-form :model="loginForm" @submit="handleAdminLogin" layout="vertical" ref="loginFormRef">
        <a-form-item field="username" label="管理员账号" required :rules="[{required: true, message: '请输入账号'}]">
          <a-input v-model="loginForm.username" placeholder="请输入管理员账号" />
        </a-form-item>
        <a-form-item field="password" label="密码" required :rules="[{required: true, message: '请输入密码'}]">
          <a-input-password v-model="loginForm.password" placeholder="请输入密码" />
        </a-form-item>
        <a-alert v-if="loginError" type="error" class="mb-4">
          {{ loginError }}
        </a-alert>
        <a-button type="primary" html-type="submit" long :loading="loginLoading">登 录</a-button>
      </a-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import axios from 'axios';
import { Form, FormItem, Input, InputPassword, Button, Alert, Message } from '@arco-design/web-vue';

// Define props or emits if needed to communicate with App.vue
const emit = defineEmits(['login-success']);

const loginFormRef = ref(null);
const loginLoading = ref(false);
const loginError = ref('');
const loginForm = reactive({
  username: '',
  password: ''
});

const handleAdminLogin = async () => {
  loginError.value = '';
  const validationResult = await loginFormRef.value?.validate();
  if (validationResult) {
    return; // Validation failed
  }

  loginLoading.value = true;
  try {
    const response = await axios.post('/api/auth/login', {
      username: loginForm.username,
      password: loginForm.password
    });

    if (response.data && response.data.user && response.data.accessToken) {
      // Login attempt successful, now check for admin role
      if (response.data.user.isAdmin) {
        // It IS an admin!
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken || ''); // Handle if refresh token missing
        localStorage.setItem('userInfo', JSON.stringify(response.data.user));
        Message.success('管理员登录成功!');
        emit('login-success'); // Notify parent component (App.vue)
      } else {
        // Login successful, but NOT an admin
        loginError.value = '登录成功，但您没有管理员权限。';
        // Do not store token or emit success
      }
    } else {
      // Unexpected response format
      loginError.value = '登录响应格式不正确。';
    }
  } catch (error) {
    console.error("Admin Login failed:", error);
    if (error.response && error.response.data && error.response.data.message) {
      loginError.value = error.response.data.message; // e.g., "用户名或密码错误"
    } else {
      loginError.value = '登录请求失败，请检查网络或联系管理员。';
    }
  } finally {
    loginLoading.value = false;
  }
};
</script>

<style scoped>
.admin-login-page {
  /* Optional: Add background image or other styling */
}
/* login-form-container styling is now mostly inline */
</style> 