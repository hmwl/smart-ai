<template>
  <div class="creation-history-page p-4 md:p-6">
    <a-page-header title="创作历史" class="mb-4 site-page-header-responsive">
      <template #subtitle>
        <p>查看您的AI创作历史记录。</p>
      </template>
    </a-page-header>

    <a-spin :loading="loading" tip="加载历史记录中..." class="w-full">
      <div v-if="!loading && creations.length === 0" class="empty-state mt-6">
        <a-empty description="暂无创作历史记录" />
      </div>
      <a-list
        v-else
        :data="creations"
        class="creation-list"
      >
        <template #item="{ item }">
          <a-list-item class="creation-list-item">
            <a-card class="creation-card">
              <template #title>
                <div class="creation-title">{{ item.title || '未命名创作' }}</div>
              </template>
              <div class="creation-content">
                <p>{{ item.content || '无内容' }}</p>
              </div>
              <div class="creation-meta">
                <div class="creation-date">创建时间: {{ formatDate(item.createdAt) }}</div>
                <div class="creation-app">使用应用: {{ item.appName || '未知应用' }}</div>
              </div>
              <div class="creation-actions">
                <a-button type="text" size="small">查看详情</a-button>
                <a-button type="text" size="small">编辑</a-button>
                <a-button type="text" status="danger" size="small">删除</a-button>
              </div>
            </a-card>
          </a-list-item>
        </template>
      </a-list>
    </a-spin>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiClient from '../services/apiService';
import {
  Message,
  List as AList,
  ListItem as AListItem,
  Card as ACard,
  Spin as ASpin,
  Empty as AEmpty,
  Button as AButton,
  PageHeader as APageHeader
} from '@arco-design/web-vue';

const creations = ref([]);
const loading = ref(false);

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

const fetchCreationHistory = async () => {
  loading.value = true;
  try {
    // 这里是模拟数据，实际应该从API获取
    // const response = await apiClient.get('/auth/client/creation-history');
    // creations.value = response.data;

    // 暂时使用模拟数据
    setTimeout(() => {
      creations.value = []; // 空数组，显示暂无数据
      loading.value = false;
    }, 1000);
  } catch (error) {
    console.error('Error fetching creation history:', error);
    Message.error('获取创作历史失败: ' + (error.response?.data?.message || error.message));
    creations.value = [];
  } finally {
    // loading.value = false; // 在setTimeout中已设置
  }
};

onMounted(() => {
  fetchCreationHistory();
});
</script>

<style scoped>
.creation-history-page {
  color: #fff;
}

.site-page-header-responsive {
  background-color: var(--custom-bg-secondary);
  border-radius: 4px;
  padding: 16px 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.creation-list {
  margin-top: 20px;
}

.creation-list-item {
  margin-bottom: 16px;
}

.creation-card {
  background-color: var(--custom-bg-secondary);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.creation-title {
  color: #fff;
  font-weight: 600;
}

.creation-content {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 16px;
}

.creation-meta {
  display: flex;
  justify-content: space-between;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9em;
  margin-bottom: 12px;
}

.creation-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}
</style>