<template>
  <div class="ai-app-detail-page p-4 md:p-6">
    <a-page-header title="AI 应用详情" @back="goBack" class="page-header-custom">
      <template #subtitle>
        <span v-if="application && !loading">{{ application.name }}</span>
      </template>
      <template #extra>
        <div class="flex items-center gap-2">
          <a-button @click="goBack">返回列表</a-button>
          <a-button type="primary" v-if="application && application.status === 'active'" @click="launchApp">执行应用</a-button>
        </div>
      </template>
    </a-page-header>

    <a-spin :loading="loading" tip="加载应用详情中..." style="width:100%;">
      <div v-if="errorMsg" class="error-display">
        <a-alert type="error" :title="`加载失败: ${errorMsg}`" />
      </div>
      <div v-else-if="application" class="content-grid">
        <!-- Left Column: Cover Image & Basic Info -->
        <div class="left-column">
          <a-card class="info-card" :bordered="false">
            <div class="cover-image-container">
              <img v-if="application.coverImageUrl" :src="getImageUrl(application.coverImageUrl)" :alt="application.name" class="cover-image" />
              <div v-else class="cover-image-placeholder">
                <icon-apps :style="{ fontSize: '64px' }" />
              </div>
            </div>
            <h1 class="app-title">{{ application.name }}</h1>
            <p class="app-description-short">{{ application.description || '暂无简介' }}</p>
            
            <a-divider />
            
            <div class="info-section">
              <div class="info-item">
                <icon-tag class="info-icon"/> <strong>类型:</strong> 
                <a-tag v-if="application.type" color="blue" size="small">{{ application.type.name }}</a-tag>
                <span v-else>未知</span>
              </div>
              <div class="info-item">
                <icon-layers class="info-icon"/> <strong>状态:</strong> 
                <a-tag :color="application.status === 'active' ? 'green' : 'red'" size="small">
                  {{ application.status === 'active' ? '激活' : '禁用' }}
                </a-tag>
              </div>
              <div class="info-item">
                <icon-star class="info-icon"/> <strong>所需积分:</strong> 
                <a-tag v-if="application.creditsConsumed === 0" color="green" size="small">免费</a-tag>
                <span v-else>{{ application.creditsConsumed }} 积分</span>
              </div>
              <div class="info-item" v-if="application.tags && application.tags.length > 0">
                <icon-bookmark class="info-icon"/> <strong>标签:</strong> 
                <a-space wrap>
                  <a-tag v-for="tag in application.tags" :key="tag" color="cyan" size="small">{{ tag }}</a-tag>
                </a-space>
              </div>
              <div class="info-item">
                <icon-schedule class="info-icon"/> <strong>创建时间:</strong> {{ formatDate(application.createdAt) }}
              </div>
               <div class="info-item" v-if="application.updatedAt && application.createdAt !== application.updatedAt">
                 <icon-history class="info-icon"/> <strong>最后更新:</strong> {{ formatDate(application.updatedAt) }}
               </div>
            </div>
          </a-card>
        </div>

        <!-- Right Column: Detailed Description & APIs -->
        <div class="right-column">
          <a-card class="details-card" title="详细介绍" :bordered="false">
            <div v-if="application.longDescription" v-html="application.longDescription" class="long-description-content"></div>
            <p v-else>暂无详细介绍。</p>
          </a-card>
        </div>
      </div>
      <a-empty v-else-if="!loading && !errorMsg" description="未找到应用数据" />
    </a-spin>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient, { getStaticAssetBaseUrl } from '../services/apiService';
import { Message, PageHeader as APageHeader, Spin as ASpin, Alert as AAlert, Card as ACard, Empty as AEmpty, Tag as ATag, Divider as ADivider, List as AList, ListItem as AListItem, ListItemMeta as AListItemMeta, Space as ASpace, Button as AButton, Modal } from '@arco-design/web-vue';
import {
  IconApps, IconTag, IconLayers, IconStar, IconBookmark, IconSchedule, IconHistory
} from '@arco-design/web-vue/es/icon';

const route = useRoute();
const router = useRouter();

// Inject isLoggedIn and openLoginModal from ClientLayout
const isLoggedIn = inject('isLoggedIn');
const openLoginModal = inject('openLoginModal');
const refreshUserData = inject('refreshUserData');

const application = ref(null);
const loading = ref(true);
const errorMsg = ref('');

const appId = computed(() => route.params.id);

const getImageUrl = (relativePath) => {
  if (!relativePath) return '';
  const staticAssetBase = getStaticAssetBaseUrl();
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${staticAssetBase}${path}`;
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
};

const fetchApplicationDetail = async () => {
  loading.value = true;
  errorMsg.value = '';
  try {
    const response = await apiClient.get(`/public/ai-applications/${appId.value}`);
    application.value = response.data;
    if (!application.value) {
        errorMsg.value = "应用数据为空或未找到。";
    }
  } catch (err) {
    console.error(`Error fetching AI application detail for ID ${appId.value}:`, err);
    errorMsg.value = err.response?.data?.message || err.message || '获取应用详情失败';
    application.value = null;
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push({ name: 'AiApplicationsList' }); // Navigate back to the list page using the correct route name
};

const launchApp = async () => {
  if (!isLoggedIn.value) {
    if (openLoginModal) {
      openLoginModal();
    }
    return;
  }

  if (!application.value) return;

  const appName = application.value.name;
  const creditsToConsume = application.value.creditsConsumed;

  Modal.confirm({
    title: '确认执行应用',
    content: `执行应用 "${appName}" 将消耗 ${creditsToConsume} 积分。是否继续？`,
    okText: '确认执行',
    cancelText: '取消',
    onOk: async () => {
      try {
        // Assuming apiClient is already set up to handle auth and base URL
        // The backend endpoint would be POST /api/auth/client/ai-applications/:id/launch
        const response = await apiClient.post(`/auth/client/ai-applications/${appId.value}/launch`);
        
        Message.success(response.data.message || `应用 "${appName}" 执行成功！已消耗 ${creditsToConsume} 积分。`);
        
        if (refreshUserData) { 
          refreshUserData();
        }

        // Log ComfyUI /users data if present in response
        if (response.data && response.data.comfyuiUsersData) {
        }
        
      } catch (error) {
        Message.error(error.response?.data?.message || error.message || '执行应用失败');
      }
    },
    onCancel: () => {
      Message.info('已取消执行应用');
    }
  });
};

onMounted(() => {
  if (appId.value) {
    fetchApplicationDetail();
  }
});

</script>

<style scoped>
.ai-app-detail-page {
  color: #fff;
}

.page-header-custom {
  background-color: var(--custom-bg-secondary);
  border-radius: 4px;
  padding: 16px 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.page-header-custom .arco-page-header-title,
.page-header-custom .arco-page-header-subtitle {
  color: var(--dark-text-primary);
}

.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); /* Responsive columns */
  gap: 24px;
  padding: 24px;
}

.left-column, .right-column {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

@media (min-width: 992px) { /* Larger screens */
  .content-grid {
    grid-template-columns: 360px 1fr; /* Fixed left column, flexible right */
  }
}

.info-card, .details-card {
  background-color: var(--dark-bg-secondary);
  border: 1px solid var(--dark-border-color);
  border-radius: 8px;
  padding: 20px;
  color: var(--dark-text-primary);
}

.details-card .arco-card-header {
  border-bottom: 1px solid var(--dark-border-color);
}
.details-card .arco-card-title {
  color: var(--dark-text-primary);
}

.cover-image-container {
  width: 100%;
  padding-top: 56.25%; /* 16:9 aspect ratio */
  position: relative;
  background-color: var(--dark-bg-tertiary);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 20px;
}

.cover-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-image-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dark-text-secondary);
}

.app-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--dark-text-primary);
  margin-bottom: 8px;
}

.app-description-short {
  font-size: 14px;
  color: var(--dark-text-secondary);
  margin-bottom: 16px;
  line-height: 1.6;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--dark-text-secondary);
}
.info-item strong {
  color: var(--dark-text-primary);
}
.info-icon {
  color: var(--dark-accent-color);
  font-size: 16px;
}

.long-description-content {
  line-height: 1.7;
  color: var(--dark-text-secondary);
}
.long-description-content :deep(p) {
  margin-bottom: 1em;
}
.long-description-content :deep(h1, h2, h3) {
  color: var(--dark-text-primary);
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

.error-display {
  padding: 24px;
}

.arco-space-item {
  margin: 0;
}

</style> 