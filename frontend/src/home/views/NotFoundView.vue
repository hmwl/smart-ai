<template>
  <div class="not-found p-10 text-center">
    <h1 class="text-4xl font-bold text-red-600 mb-4">404 - 页面未找到</h1>
    <p class="text-lg text-gray-700 mb-6">抱歉，您访问的页面不存在。</p>
    <router-link to="/">
        <a-button type="primary">返回首页</a-button>
    </router-link>
  </div>
</template>

<script setup>
import { Button as AButton } from '@arco-design/web-vue';
</script>

<style scoped>
.not-found {
    margin-top: 50px;
}
</style> 