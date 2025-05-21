<template>
  <div class="ai-applications-page p-4 md:p-6">
    <a-page-header title="AI 应用中心" class="mb-4 site-page-header-responsive">
      <template #subtitle>
        <p>探索并使用我们提供的各类 AI 应用</p>
      </template>
    </a-page-header>

    <a-tabs :active-key="selectedTypeKey" @change="handleTabChange" type="rounded" class="mb-4 type-tabs">
      <a-tab-pane key="all" title="全部"></a-tab-pane>
      <a-tab-pane v-for="type in aiTypes" :key="type._id" :title="type.name"></a-tab-pane>
    </a-tabs>

    <a-spin :loading="loading" tip="正在加载 AI 应用..." class="w-full">
      <div v-if="!loading && applications.length === 0" class="empty-state mt-6">
        <a-empty :description="selectedTypeKey === 'all' ? '暂无可用的 AI 应用' : '该类型下暂无 AI 应用'" />
      </div>
      <a-list
        v-else
        :grid-props="{ gutter: [24, 24], xs: 1, sm: 1, md: 2, lg: 3, xl: 3, xxl:3 }"
        :data="applications"
        class="app-list"
      >
        <template #item="{ item }">
          <a-list-item class="app-list-item">
            <a-card hoverable class="app-card">
              <template #cover>
                <div class="app-card-cover">
                  <img
                    v-if="item.coverImageUrl"
                    :alt="item.name"
                    :src="getImageUrl(item.coverImageUrl)"
                    class="app-cover-image"
                  />
                  <div v-else class="app-cover-placeholder">
                    <icon-apps style="font-size: 48px;"/>
                  </div>
                </div>
              </template>
              <a-card-meta :title="item.name">
                <template #description>
                  <div class="app-description">{{ item.description || '暂无简介' }}</div>
                </template>
              </a-card-meta>
              <div class="app-card-footer">
                <div class="app-info">
                  <a-tag v-if="item.type" :color="getTagColor(item.type.name)" bordered size="small">{{ item.type.name }}</a-tag>
                  <a-tag v-if="item.activePromotion" color="red" bordered size="small">
                    <icon-fire /> {{ item.activePromotion.description }}
                  </a-tag>
                  <a-tag v-if="!item.activePromotion && item.creditsConsumed === 0" color="green" bordered size="small">免费</a-tag>
                  <a-tag v-else-if="!item.activePromotion && item.creditsConsumed > 0" color="gold" bordered size="small">{{ item.creditsConsumed }} 积分</a-tag>
                  <!-- If there is an active promotion, the original price might still be relevant or shown struck-through -->
                  <a-tag v-if="item.activePromotion && item.creditsConsumed > 0" color="gold" bordered size="small" style="text-decoration: line-through;">{{ item.creditsConsumed }} 积分</a-tag>
                </div>
                <div class="flex w-full justify-center mt-8">
                  <a-button type="primary" @click="handleAppClick(item)">查看详情</a-button>
                </div>
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
import { useRouter } from 'vue-router';
import apiClient, { getStaticAssetBaseUrl } from '../services/apiService';
import {
  Message,
  List as AList,
  ListItem as AListItem,
  Card as ACard,
  CardMeta as ACardMeta,
  Spin as ASpin,
  Empty as AEmpty,
  Tag as ATag,
  Button as AButton,
  PageHeader as APageHeader,
  Tabs as ATabs, 
  TabPane as ATabPane
} from '@arco-design/web-vue';
import { IconApps, IconFire } from '@arco-design/web-vue/es/icon';

const applications = ref([]);
const loading = ref(false);
const router = useRouter();

const aiTypes = ref([]);
const selectedTypeKey = ref('all'); // 'all' or type._id

const getImageUrl = (relativePath) => {
  if (!relativePath) return '';
  const staticAssetBase = getStaticAssetBaseUrl();
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${staticAssetBase}${path}`;
};

const fetchAiTypes = async () => {
  try {
    const response = await apiClient.get('/public/ai-types/active'); // Ensure this endpoint exists and is public
    aiTypes.value = response.data || [];
  } catch (error) {
    console.error('Error fetching AI types:', error);
    Message.error('获取 AI 类型失败: ' + (error.response?.data?.message || error.message));
  }
};

const fetchApplications = async () => {
  loading.value = true;
  let apiUrl = '/public/ai-applications/active'; // Base URL for fetching applications
  const params = {};

  if (selectedTypeKey.value !== 'all') {
    // If a specific type is selected, add typeId to params
    // Assumes backend API filters by 'typeId' query parameter
    params.typeId = selectedTypeKey.value; 
  }
  // If selectedTypeKey.value is 'all', no typeId param is sent, so backend returns all active apps.

  try {
    const response = await apiClient.get(apiUrl, { params });
    applications.value = response.data.applications;
  } catch (error) {
    console.error('Error fetching active AI applications:', error);
    Message.error('获取 AI 应用列表失败: ' + (error.response?.data?.message || error.message));
    applications.value = [];
  } finally {
    loading.value = false;
  }
};

const handleTabChange = (key) => {
  selectedTypeKey.value = key;
  fetchApplications(); // Refetch applications for the newly selected type
};

const handleAppClick = (app) => {
  router.push({ name: 'AiApplicationDetail', params: { id: app._id } });
};

// Helper function to assign colors to type tags
const typeColors = ['purple', 'magenta', 'red', 'volcano', 'orange', 'gold', 'lime', 'green', 'cyan', 'blue', 'arcoblue', 'geekblue'];
let typeColorMap = new Map();
let colorIndex = 0;

const getTagColor = (typeName) => {
  if (!typeName) return 'gray';
  if (!typeColorMap.has(typeName)) {
    typeColorMap.set(typeName, typeColors[colorIndex % typeColors.length]);
    colorIndex++;
  }
  return typeColorMap.get(typeName);
};

onMounted(async () => {
  await fetchAiTypes(); // Fetch types first, wait for it to complete
  fetchApplications(); // Then fetch all applications initially (or based on default selectedTypeKey)
});
</script>

<style scoped>
.ai-applications-page {
  min-height: calc(100vh - 60px);
  color: #fff;
}

.site-page-header-responsive {
  background-color: var(--custom-bg-secondary);
  border-radius: 4px;
  padding: 16px 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.type-tabs .arco-tabs-nav-type-card-gutter .arco-tabs-tab {
  background-color: var(--custom-bg-tertiary);
  border-color: var(--dark-border-color);
  color: var(--dark-text-secondary);
}

.type-tabs .arco-tabs-nav-type-card-gutter .arco-tabs-tab-active {
  background-color: var(--custom-accent-color-secondary); /* A slightly different shade for active tab */
  color: var(--custom-accent-color);
  font-weight: bold;
}

.type-tabs .arco-tabs-nav::before {
  /* Remove default bottom border of tabs nav if not desired */
  display: none; 
}

.app-list-item {
  padding: 0 !important;
}

.app-card {
  background-color: var(--custom-bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  transition: box-shadow 0.3s ease, transform 0.3s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.app-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  transform: translateY(-5px);
}

.app-card-cover {
  width: 100%;
  padding-top: 56.25%;
  position: relative;
  background-color: rgba(255, 255, 255, 0.05);
}

.app-cover-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.app-cover-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
}
.app-card .arco-card-meta-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-description {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  margin-bottom: 12px;
}

.app-card-footer {
  margin-top: auto;
  padding-top: 12px; /* Add some space above the footer content */
}

.app-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}
:deep(.arco-list-bordered){
  border: unset!important;
}

/* Ensure button is centered */
.flex.w-full.justify-center.mt-8 {
    margin-top: 1.5rem; /* Adjusted margin for better spacing */
}
</style>