<template>
  <div class="reset-password-page">
    <div class="form-container">
      <div class="form-header">
        <h2>重置密码</h2>
      </div>
      <a-form :model="form" @submit="handleSubmit" layout="vertical">
        <a-form-item field="password" label="新密码" :rules="[{ required: true, message: '请输入新密码' }]">
          <a-input-password v-model="form.password" placeholder="请输入新密码" />
        </a-form-item>
        <a-form-item field="confirmPassword" label="确认新密码" :rules="[{ required: true, validator: validateConfirmPassword }]">
          <a-input-password v-model="form.confirmPassword" placeholder="请再次输入新密码" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit" long :loading="loading">重置密码</a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '../services/apiService';
import { Message } from '@arco-design/web-vue';

const form = reactive({
  password: '',
  confirmPassword: '',
});
const token = ref('');
const loading = ref(false);
const route = useRoute();
const router = useRouter();

onMounted(() => {
  token.value = route.query.token;
  if (!token.value) {
    Message.error('无效的重置链接，未找到令牌。');
    router.push('/login');
  }
});

const validateConfirmPassword = (value, callback) => {
  if (value !== form.password) {
    callback('两次输入的密码不一致');
  } else {
    callback();
  }
};

const handleSubmit = async ({ values, errors }) => {
  if (errors) return;

  loading.value = true;
  try {
    const response = await apiClient.post('/auth/client/reset-password', {
      token: token.value,
      password: form.password,
    });
    Message.success(response.data.message || '密码已成功重置！');
    router.push('/login');
  } catch (err) {
    console.error('Password reset failed:', err);
    let errorMsg = '密码重置失败，请稍后重试。';
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
/* Using similar styles as other auth pages */
.reset-password-page {
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
  margin: 0;
}
</style> 