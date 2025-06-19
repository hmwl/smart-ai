<template>
  <div class="forgot-password-page">
    <div class="form-container">
      <div class="form-header">
        <h2>忘记密码</h2>
        <p>请输入您的邮箱地址，我们将向您发送密码重置链接。</p>
      </div>
      <a-form :model="form" @submit="handleSubmit" layout="vertical">
        <a-form-item field="email" label="邮箱" :rules="[{ required: true, type: 'email', message: '请输入有效的邮箱地址' }]">
          <a-input v-model="form.email" placeholder="请输入您的邮箱地址" allow-clear />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit" long :loading="loading">发送重置链接</a-button>
        </a-form-item>
        <div class="text-center">
          <router-link to="/login" style="color: var(--color-text-2);">返回登录</router-link>
        </div>
      </a-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import apiClient from '../services/apiService';
import { Message } from '@arco-design/web-vue';

const form = reactive({
  email: '',
});
const loading = ref(false);

const handleSubmit = async ({ values, errors }) => {
  if (errors) return;

  loading.value = true;
  try {
    const response = await apiClient.post('/auth/client/forgot-password', {
      email: form.email,
    });
    Message.success(response.data.message || '请求已发送，请检查您的邮箱。');
  } catch (err) {
    console.error('Forgot password request failed:', err);
    // Even on error, show a generic success message to prevent user enumeration
    Message.success('如果该邮箱存在于我们的系统中，一封密码重置邮件已经发送到您的邮箱。');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.forgot-password-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--color-bg-1);
}
.form-container {
  width: 100%;
  max-width: 400px;
  padding: 30px;
  border-radius: 8px;
  background-color: var(--color-bg-2);
  border: 1px solid var(--color-border);
}
.form-header {
  text-align: center;
  margin-bottom: 24px;
}
.form-header h2 {
  color: var(--color-text-1);
  font-size: 24px;
  margin-bottom: 8px;
}
.form-header p {
  color: var(--color-text-2);
}
</style> 