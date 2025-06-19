<template>
  <div class="client-register-page">
    <div class="register-container">
      <div class="register-header">
        <h2>客户端注册</h2>
      </div>
      <a-form :model="registerForm" @submit="handleRegister" layout="vertical" ref="registerFormRef">
        <a-form-item field="username" label="账号" :rules="[{ required: true, message: '请输入账号' }]">
          <a-input v-model="registerForm.username" placeholder="请输入账号" allow-clear />
        </a-form-item>
        <a-form-item field="email" label="邮箱" :rules="[{ required: true, type: 'email', message: '请输入有效的邮箱地址' }]">
          <a-input v-model="registerForm.email" placeholder="请输入邮箱" allow-clear />
        </a-form-item>
        <a-form-item field="code" label="验证码" :rules="[{ required: true, message: '请输入6位验证码' }]">
          <a-input-group>
            <a-input v-model="registerForm.code" placeholder="6位验证码" :max-length="6" style="flex-grow: 1;" />
            <a-button @click="sendCode" :disabled="isSendingCode || countdown > 0">
              {{ countdown > 0 ? `${countdown}s` : '发送验证码' }}
            </a-button>
          </a-input-group>
        </a-form-item>
        <a-form-item field="password" label="密码" :rules="[{ required: true, message: '请输入密码' }]">
          <a-input-password v-model="registerForm.password" placeholder="请输入密码" allow-clear />
        </a-form-item>
        <a-form-item field="confirmPassword" label="确认密码" :rules="[{ required: true, validator: validateConfirmPassword }]">
          <a-input-password v-model="registerForm.confirmPassword" placeholder="请再次输入密码" allow-clear />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit" long :loading="loading">注 册</a-button>
        </a-form-item>
         <div class="text-center">
          <router-link to="/login">已有账号？立即登录</router-link>
        </div>
      </a-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '../services/apiService';
import { Message } from '@arco-design/web-vue';

const registerForm = reactive({
  username: '',
  email: '',
  code: '',
  password: '',
  confirmPassword: ''
});
const loading = ref(false);
const isSendingCode = ref(false);
const countdown = ref(0);
const registerFormRef = ref(null);
const router = useRouter();

const validateConfirmPassword = (value, callback) => {
  if (value !== registerForm.password) {
    callback('两次输入的密码不一致');
  } else {
    callback();
  }
};

const sendCode = async () => {
  if (!registerForm.email) {
    Message.error('请输入邮箱地址');
    return;
  }
  // A simple regex for email validation on the client side before sending
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(registerForm.email)) {
    Message.error('请输入有效的邮箱地址');
    return;
  }

  isSendingCode.value = true;
  try {
    await apiClient.post('/auth/client/send-registration-code', { email: registerForm.email });
    Message.success('验证码已发送，请注意查收。');
    countdown.value = 60;
    const interval = setInterval(() => {
      countdown.value -= 1;
      if (countdown.value <= 0) {
        clearInterval(interval);
      }
    }, 1000);
  } catch (err) {
    console.error('Failed to send code:', err);
    Message.error(err.response?.data?.message || '发送验证码失败');
  } finally {
    isSendingCode.value = false;
  }
};

const handleRegister = async () => {
  const { validate } = registerFormRef.value;
  const err = await validate();
  if (err) return;

  loading.value = true;
  try {
    const response = await apiClient.post('/auth/client/register', {
      username: registerForm.username,
      email: registerForm.email,
      password: registerForm.password,
      code: registerForm.code,
    });

    Message.success(response.data.message || '注册成功！');
    router.push('/login');
    
  } catch (err) {
    console.error('Registration failed:', err);
    let errorMsg = '注册失败，请稍后重试。';
    if (err.response && err.response.data && err.response.data.message) {
      errorMsg = err.response.data.message;
    }
    Message.error(errorMsg);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.client-register-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--color-bg-1);
  color: var(--color-text-1);
}

.register-container {
  width: 100%;
  max-width: 400px;
  padding: 30px;
  border-radius: 8px;
  background-color: var(--color-bg-2);
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.register-header {
  text-align: center;
  margin-bottom: 24px;
}

.register-header h2 {
  color: var(--color-text-1);
  font-size: 24px;
  margin: 0;
}

:deep(.arco-form-item-label > label) {
  color: var(--color-text-2);
}
</style> 