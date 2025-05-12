<template>
  <router-view />
</template>

<script setup>
// No specific script needed for the root App.vue if it's just a router-view wrapper
</script>

<style>
/* 自定义变量 - 可用于自定义组件样式 */
:root {
  --custom-bg-primary: #171a21; /* 深色背景 */
  --custom-bg-secondary: #232831; /* 次要背景 */
  --custom-accent-color: #007bff; /* 主题色 */
  --custom-accent-hover: #0056b3; /* 主题色悬停 */
}

/* 基础样式 */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: var(--custom-bg-primary);
}

/* 自定义组件样式 */
.site-page-header-responsive, .site-page-header {
  background-color: var(--custom-bg-secondary);
  border-radius: 4px;
  padding: 16px 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 自定义卡片样式 */
.custom-card {
  background-color: var(--custom-bg-secondary);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 自定义按钮样式 */
.custom-primary-button {
  background-color: var(--custom-accent-color);
  color: white;
}
.custom-primary-button:hover {
  background-color: var(--custom-accent-hover);
}
</style>