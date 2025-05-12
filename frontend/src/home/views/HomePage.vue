<template>
  <div class="space-x-4 mb-6">
    <a-button v-if="!isLoggedIn" type="primary" @click="showAuthModal = true">登录 / 注册</a-button>
    <a-button v-if="isLoggedIn" type="primary" @click="goToClient">进入用户端</a-button>
    <a-button @click="goToAdmin">后台管理</a-button>
    <a-button v-if="isLoggedIn" @click="handleLogout">退出登录</a-button>
  </div>

  <div class="mt-4 p-4 border rounded bg-gray-50">
    <h2 class="text-xl">平台介绍</h2>
    <p>这里是关于 Smart AI 平台的详细介绍...</p>
    <a-button type="primary">了解更多</a-button>
  </div>

  <!-- Auth Modal -->
  <a-modal
    v-model:visible="showAuthModal"
    :title="isRegistering ? '用户注册' : '用户登录'"
    @ok="handleAuthSubmit"
    @cancel="cancelAuthModal"
    :confirm-loading="authLoading"
    :ok-text="isRegistering ? '注册' : '登录'"
    unmount-on-close
    :ok-button-props="undefined" 
  >
    <a-form :model="authForm" layout="vertical" ref="authFormRef" id="authFormId" >
      <a-form-item field="username" label="用户名" required :rules="[{ required: true, message: '请输入用户名'}]">
        <a-input v-model="authForm.username" placeholder="请输入用户名" />
      </a-form-item>
      <a-form-item v-if="isRegistering" field="email" label="邮箱 (可选)" :rules="[{ type: 'email', message: '请输入有效的邮箱地址'}]">
          <a-input v-model="authForm.email" placeholder="请输入邮箱地址" />
      </a-form-item>
      <a-form-item field="password" label="密码" required :rules="[{ required: true, message: '请输入密码'}, { minLength: 6, message: '密码至少需要6位'}]">
        <a-input-password v-model="authForm.password" placeholder="请输入密码" />
      </a-form-item>
      <a-form-item v-if="isRegistering" field="confirmPassword" label="确认密码" required :rules="[{ required: true, message: '请再次输入密码'}, { validator: validatePasswordConfirm }]" >
          <a-input-password v-model="authForm.confirmPassword" placeholder="请再次输入密码" />
      </a-form-item>

      <!-- Always render the alert, show message conditionally -->
      <a-alert v-show="authError" type="error" class="mb-4">
          {{ authError }}
      </a-alert>

      <!-- Toggle Link -->
      <div class="text-center">
          <a-link @click="toggleAuthMode">
              {{ isRegistering ? '已有账号？去登录' : '没有账号？去注册' }}
          </a-link>
      </div>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive, nextTick, onMounted } from 'vue';
import axios from 'axios';
import { Modal, Form, FormItem, Input, InputPassword, Button, Alert, Link, Message } from '@arco-design/web-vue';

// --- State ---
const isLoggedIn = ref(false);
const showAuthModal = ref(false);
const authLoading = ref(false);
const authError = ref('');
const isRegistering = ref(false);
const authFormRef = ref(null);

const initialFormState = {
  username: '',
  password: '',
  email: '',
  confirmPassword: ''
};
const authForm = reactive({ ...initialFormState });

// --- Methods ---
const checkLoginStatus = () => {
    const token = localStorage.getItem('accessToken');
    const userInfo = localStorage.getItem('userInfo');
    // Basic check: token exists and user info exists
    isLoggedIn.value = !!token && !!userInfo;
    // More robust check could involve validating the token expiry or making a quick API call
};

const goToAdmin = () => {
  window.location.href = '/src/admin/index.html';
};

const goToClient = () => {
    window.location.href = '/src/client/index.html';
};

const handleLogout = () => {
    // Optional: Call backend logout endpoint to invalidate refresh token
    // axios.post('/api/auth/logout', {}, { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });

    // Clear local storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userInfo');
    isLoggedIn.value = false; // Update state
    Message.success('已退出登录');
};

const validatePasswordConfirm = (value, callback) => {
    if (value !== authForm.password) {
        callback('两次输入的密码不一致');
    }
};

const resetAuthModal = () => {
    isRegistering.value = false;
    authError.value = '';
    Object.assign(authForm, initialFormState);
    authFormRef.value?.clearValidate();
};

const cancelAuthModal = () => {
    showAuthModal.value = false;
    setTimeout(resetAuthModal, 300);
};

const toggleAuthMode = () => {
    isRegistering.value = !isRegistering.value;
    authError.value = '';
    authForm.email = '';
    authForm.confirmPassword = '';
    nextTick(() => {
        authFormRef.value?.clearValidate();
    });
};

const handleAuthSubmit = async () => {
  authError.value = ''; // Reset error at the beginning

  // Validate form first
  const validationResult = await authFormRef.value?.validate();
  if (validationResult) {
    // Validation failed, Form items show errors.
    // Return false to prevent modal from closing.
    return false;
  }

  // Validation passed
  authLoading.value = true;

  const url = isRegistering.value ? '/api/auth/register' : '/api/auth/login';
  const payload = {
    username: authForm.username,
    password: authForm.password,
  };
  if (isRegistering.value) {
    payload.email = authForm.email;
  }

  try {
    const response = await axios.post(url, payload);

    if (isRegistering.value) {
      Message.success('注册成功！请登录。');
      toggleAuthMode();
      // Implicitly return true/undefined, modal will close
    } else {
      if (response.data && response.data.accessToken && response.data.refreshToken) {
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.setItem('userInfo', JSON.stringify(response.data.user));
        isLoggedIn.value = true;
        Message.success('登录成功！正在跳转...');
        // Don't hide modal here, let the implicit return true handle it
        // showAuthModal.value = false;
        resetAuthModal(); // Reset form for next time
        window.location.href = '/src/client/index.html';
        // Implicitly return true/undefined, modal will close
      } else {
        // Should not happen, but handle defensively
        authError.value = '登录响应格式不正确';
        return false; // Prevent modal close on unexpected success format
      }
    }
  } catch (error) {
    console.error("Auth failed:", error);
    if (error.response && error.response.data && error.response.data.message) {
      authError.value = error.response.data.message;
    } else {
      authError.value = isRegistering.value ? '注册请求失败' : '登录请求失败';
    }
    // Return false to prevent modal from closing on API error
    return false;

  } finally {
    authLoading.value = false; // Always stop loading indicator
  }
  // If function reaches here without returning false, modal will close
};

// --- Lifecycle Hooks ---
onMounted(() => {
    checkLoginStatus(); // Check login status when component mounts
});

</script> 