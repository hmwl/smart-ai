<template>
  <div class="inspiration-gallery-page p-4 md:p-6">
    <a-page-header title="灵感画廊" class="mb-4 site-page-header-responsive">
      <template #subtitle>
        <p>探索由 AI 生成的艺术作品和创意灵感。</p>
      </template>
    </a-page-header>

    <div class="gallery-content">
      <!-- Placeholder for gallery items -->
      <a-empty description="灵感画廊正在建设中，敬请期待！" />
    </div>
  </div>
</template>

<script setup>
import { PageHeader as APageHeader, Empty as AEmpty } from '@arco-design/web-vue';

// Future logic for fetching and displaying gallery items will go here.
</script>

<style scoped>
.inspiration-gallery-page {
  color: #fff;
}

.site-page-header-responsive {
  background-color: var(--custom-bg-secondary);
  border-radius: 4px;
  padding: 16px 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.gallery-content {
  margin-top: 20px;
  text-align: center;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mb-4 {
  margin-bottom: 1rem;
}
</style>