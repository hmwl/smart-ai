<template>
  <div class="verification-page">
    <div class="verification-container">
      <div v-if="loading" class="text-center">
        <a-spin size="large" />
        <p class="mt-4">正在验证您的邮箱，请稍候...</p>
      </div>
      <div v-else-if="error" class="text-center">
        <a-result status="error" title="邮箱验证失败">
          <template #subtitle>{{ error }}</template>
          <template #extra>
            <a-button type="primary" @click="goToLogin">返回登录</a-button>
          </template>
        </a-result>
      </div>
      <div v-else class="text-center">
        <a-result status="success" title="邮箱验证成功！">
          <template #subtitle>
            您的账户已成功激活，现在可以登录了。
          </template>
          <template #extra>
            <a-button type="primary" @click="goToLogin">立即登录</a-button>
          </template>
        </a-result>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '../services/apiService';

const loading = ref(true);
const error = ref(null);
const route = useRoute();
const router = useRouter();

onMounted(async () => {
  const token = route.query.token;
  if (!token) {
    error.value = '无效的验证链接，未找到Token。';
    loading.value = false;
    return;
  }

  try {
    await apiClient.get(`/auth/client/verify-email?token=${token}`);
  } catch (err) {
    console.error('Email verification failed:', err);
    if (err.response && err.response.data && err.response.data.message) {
      error.value = err.response.data.message;
    } else {
      error.value = '验证过程中发生未知错误，请稍后重试。';
    }
  } finally {
    loading.value = false;
  }
});

const goToLogin = () => {
  router.push('/login');
};
</script>

<style scoped>
.verification-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--color-bg-1);
}

.verification-container {
  width: 100%;
  max-width: 500px;
  padding: 40px;
  text-align: center;
}
</style> 