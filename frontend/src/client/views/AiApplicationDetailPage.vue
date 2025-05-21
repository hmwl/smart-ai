<template>
  <div class="ai-app-detail-page p-4 md:p-6">
    <a-page-header title="AI 应用详情" @back="goBack" class="page-header-custom">
      <template #subtitle>
        <span v-if="application && !loading">{{ application.name }}</span>
      </template>
      <template #extra>
        <div class="flex items-center gap-2">
          <a-button @click="goBack">返回列表</a-button>
          <a-button type="primary" v-if="canLaunch" @click="launchAppWithConfig">执行应用</a-button>
        </div>
      </template>
    </a-page-header>

    <a-spin :loading="loading" tip="加载应用详情中..." style="width:100%;">
      <div v-if="errorMsg" class="error-display">
        <a-alert type="error" :title="`加载失败: ${errorMsg}`" />
      </div>
      <div v-else-if="application" class="page-content-wrapper">
        <!-- Top Section: Three Columns -->
        <div class="top-section-grid">
          <!-- Left Column: App Info -->
          <div class="app-info-column">
            <a-card class="info-card scrollable-card" :bordered="false" title="应用信息">
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
              <a-divider title-position="left">详细介绍</a-divider>
              <div v-if="application.longDescription" v-html="application.longDescription" class="long-description-content"></div>
              <p v-else>暂无详细介绍。</p>
            </a-card>
          </div>

          <!-- Middle Column: App Config -->
          <div class="app-config-column">
            <a-card 
              v-if="formSchema && formSchema.fields && formSchema.fields.length > 0"
              class="config-card scrollable-card" 
              title="应用配置"
              :bordered="false"
            >
              <DynamicFormRenderer 
                :fields="formSchema.fields"
                v-model:form-model="dynamicFormModel"
                ref="dynamicFormRendererRef"
              />
            </a-card>
            <a-empty v-else description="此应用无需配置" class="empty-config-placeholder"/>
          </div>

          <!-- Right Column: Result Content (Placeholder) -->
          <div class="app-result-column">
            <a-card class="details-card scrollable-card" title="结果内容" :bordered="false">
              <p>此处将显示应用的执行结果。（待实现）</p>
              <!-- Placeholder for future result display components -->
            </a-card>
          </div>
        </div>

        <!-- Bottom Section: App Results Tabs (Placeholder) -->
        <div class="bottom-section-results">
          <a-tabs type="line" class="results-tabs">
            <a-tab-pane key="recommended" title="推荐">
              <p>推荐的应用执行结果将显示在这里。（待实现）</p>
              <!-- Placeholder for recommended results list (e.g., WorkCard components) -->
            </a-tab-pane>
            <a-tab-pane key="latest" title="最新">
              <p>最新的应用执行结果将显示在这里。（待实现）</p>
              <!-- Placeholder for latest results list -->
            </a-tab-pane>
          </a-tabs>
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
import { Message, PageHeader as APageHeader, Spin as ASpin, Alert as AAlert, Card as ACard, Empty as AEmpty, Tag as ATag, Divider as ADivider, Tabs as ATabs, TabPane as ATabPane, Space as ASpace, Button as AButton, Modal } from '@arco-design/web-vue';
import {
  IconApps, IconTag, IconLayers, IconStar, IconBookmark, IconSchedule, IconHistory
} from '@arco-design/web-vue/es/icon';
import DynamicFormRenderer from '../components/DynamicFormRenderer.vue';

const route = useRoute();
const router = useRouter();

// Inject isLoggedIn and openLoginModal from ClientLayout
const isLoggedIn = inject('isLoggedIn');
const openLoginModal = inject('openLoginModal');
const refreshUserData = inject('refreshUserData');

const application = ref(null);
const loading = ref(true);
const errorMsg = ref('');
const formSchema = ref(null);
const dynamicFormModel = ref({});
const dynamicFormRendererRef = ref(null);

const appId = computed(() => route.params.id);

const canLaunch = computed(() => {
  if (!application.value || application.value.status !== 'active') return false;
  // If there's a form, it must be valid (or not exist)
  // This validation check is tricky here. We might need to validate on launch attempt.
  return true; 
});

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
  formSchema.value = null; // Reset schema on new fetch
  try {
    const response = await apiClient.get(`/public/ai-applications/${appId.value}`);
    application.value = response.data;
    if (application.value && application.value.formSchema) {
      formSchema.value = application.value.formSchema;
    } else if (application.value && !application.value.formSchema) {
      // Application exists but has no form schema
      formSchema.value = { fields: [] }; // Default to empty form
    }

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

  let formConfigData = {};
  // Only attempt validation if there are actual form fields defined in the schema
  if (formSchema.value && formSchema.value.fields && formSchema.value.fields.length > 0) {
    if (dynamicFormRendererRef.value) {
      const isValid = await dynamicFormRendererRef.value.validateForm();
      if (!isValid) {
        Message.error('表单配置校验失败，请检查输入。');
        // Form validation errors are typically handled within DynamicFormRenderer or by its validateForm method.
        return; // Stop execution if form is invalid
      }
      // Assuming getFormData() is also exposed if you prefer that over v-model direct usage
      formConfigData = dynamicFormRendererRef.value.getFormData ? dynamicFormRendererRef.value.getFormData() : { ...dynamicFormModel.value };
    } else {
      // This case implies the form schema has fields, but the renderer component isn't mounted/available.
      // This could be a timing issue or an error in conditional rendering of the form.
      Message.warning('表单渲染器尚未准备好或不存在，请稍后再试。');
      return;
    }
  } else {
    // No form fields to validate, proceed with empty formConfigData for the launch API call.
    formConfigData = {};
  }

  const appName = application.value.name;
  const creditsToConsume = application.value.creditsConsumed;

  Modal.confirm({
    title: '确认执行应用',
    content: `执行应用 "${appName}" ${creditsToConsume > 0 ? `将消耗 ${creditsToConsume} 积分` : '免费'}。是否继续？`,
    okText: '确认执行',
    cancelText: '取消',
    onOk: async () => {
      try {
        const response = await apiClient.post(`/auth/client/ai-applications/${appId.value}/launch`, {
          formConfig: formConfigData 
        });
        
        Message.success(response.data.message || `应用 "${appName}" 执行成功！${creditsToConsume > 0 ? `已消耗 ${creditsToConsume} 积分。` : ''}`);
        
        if (refreshUserData) { 
          refreshUserData();
        }

        // TODO: Handle and display results from response.data
        // e.g., if (response.data.result) { /* update some reactive property for display */ }
        console.log('Launch API Response:', response.data);
        
      } catch (error) {
        Message.error(error.response?.data?.message || error.message || '执行应用失败');
        console.error('Error launching application:', error);
      }
    },
    onCancel: () => {
      // User cancelled the operation
    }
  });
};

const launchAppWithConfig = () => {
    launchApp(); // This function will be called by the button
}

onMounted(() => {
  if (appId.value) {
    fetchApplicationDetail();
  }
});

</script>

<style scoped>
.ai-app-detail-page {
  color: var(--color-text-1); /* Adjusted for general theme compatibility */
  min-height: calc(100vh - 100px); /* Ensure page takes available height */
}

.page-header-custom {
  background-color: var(--color-bg-2); /* Use theme variable */
  border-radius: 4px;
  padding: 16px 24px;
  border: 1px solid var(--color-border-2); /* Use theme variable */
  margin-bottom: 20px;
}

.page-header-custom .arco-page-header-title,
.page-header-custom .arco-page-header-subtitle {
  color: var(--color-text-1); /* Use theme variable */
}

.page-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.top-section-grid {
  display: grid;
  grid-template-columns: 380px 1fr 1fr; /* Fixed left, two flexible for middle and right */
  gap: 24px;
  align-items: flex-start; /* Align items to the start of the grid cell */
  /* max-height: calc(70vh - 50px); /* Example max height for the top section */ 
  /* overflow: hidden; /* This will make individual columns scrollable if they overflow */
}

.app-info-column, .app-config-column, .app-result-column {
  display: flex;
  flex-direction: column; 
  /* max-height: calc(70vh - 70px); /* Match top-section-grid's effective content height */
  /* overflow-y: auto; /* Individual column scrolling */
}

.scrollable-card {
  flex-grow: 1; /* Allow card to grow */
  overflow-y: auto; /* Make content within card scrollable */
  max-height: calc(100vh - 200px); /* Adjust as needed, considering header and other elements */
}

.info-card, .details-card, .config-card {
  background-color: var(--color-bg-2); /* Use theme variable */
  border: 1px solid var(--color-border-2); /* Use theme variable */
  border-radius: 8px;
  color: var(--color-text-1); /* Use theme variable */
  /* height: 100%; /* Make cards fill their column height */
}

.details-card .arco-card-header,
.config-card .arco-card-header,
.info-card .arco-card-header {
  border-bottom: 1px solid var(--color-border-3);
}
.details-card .arco-card-title,
.config-card .arco-card-title,
.info-card .arco-card-title {
  color: var(--color-text-1);
}

.cover-image-container {
  width: 100%;
  padding-top: 56.25%; 
  position: relative;
  background-color: var(--color-fill-2); /* Use theme variable */
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
  color: var(--color-text-3);
}

.app-title {
  font-size: 22px; /* Slightly reduced */
  font-weight: 600;
  color: var(--color-text-1);
  margin-bottom: 8px;
}

.app-description-short {
  font-size: 14px;
  color: var(--color-text-2);
  margin-bottom: 16px;
  line-height: 1.6;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 10px; /* Reduced gap */
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px; /* Slightly reduced */
  color: var(--color-text-2);
}
.info-item strong {
  color: var(--color-text-1);
}
.info-icon {
  color: var(--primary-6); /* Use theme primary color */
  font-size: 15px; /* Slightly reduced */
}

.long-description-content {
  line-height: 1.7;
  font-size: 14px;
  color: var(--color-text-2);
}
.long-description-content :deep(p) {
  margin-bottom: 1em;
}
.long-description-content :deep(h1, h2, h3) {
  color: var(--color-text-1);
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

.empty-config-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px; /* Give it some height */
  background-color: var(--color-bg-2);
  border: 1px solid var(--color-border-2);
  border-radius: 8px;
}

.error-display {
  padding: 24px;
}

.arco-space-item {
  margin: 0;
}

/* Remove fixed height for config-card if it exists, let content define it or use column properties */
/* .config-card { */
  /* margin-top: 24px; /* If it's in its own column, this might not be needed */
/* } */

.bottom-section-results {
  margin-top: 24px;
  border: 1px solid var(--color-border-2);
  border-radius: 8px;
  background-color: var(--color-bg-2);
  padding: 16px;
}

.results-tabs .arco-tabs-nav::before {
  display: none; /* Remove default bottom border of tabs nav */
}

.results-tabs .arco-tabs-content {
  padding-top: 16px;
}

/* Ensuring cards within columns can scroll if content overflows */
/* .app-info-column .arco-card, 
.app-config-column .arco-card, 
.app-result-column .arco-card {
  height: 100%;
  display: flex;
  flex-direction: column;
} */

/* .app-info-column .arco-card-body, 
.app-config-column .arco-card-body, 
.app-result-column .arco-card-body {
  flex-grow: 1;
  overflow-y: auto;
} */

</style> 