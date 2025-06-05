<template>
  <div class="ai-app-detail-page p-4 md:p-6">

    <a-spin :loading="loading" tip="加载应用详情中..." style="width:100%;">
      <div v-if="errorMsg" class="error-display">
        <a-alert type="error" :title="`加载失败: ${errorMsg}`" />
      </div>
      <div v-else-if="application" class="page-content-wrapper">
        <!-- Top Section: Three Columns -->
        <div class="top-section-grid">
          <!-- Left Column: App Info -->
          <div class="app-info-column">
            <a-card class="info-card scrollable-card" :bordered="false" title="应用信息" @click="goBack">
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
                  <div>
                    <template v-if="application.activePromotion">
                      <template v-if="discountedCredits === 0">
                        <a-tag color="green" size="small"><icon-fire /> 限时免费</a-tag>
                      </template>
                      <template v-else>
                        <a-tag color="red" size="small"><icon-fire /> {{ discountedCredits }} 积分</a-tag>
                      </template>
                      <span v-if="originalCreditsDisplay > 0 && originalCreditsDisplay !== discountedCredits" style="text-decoration: line-through; margin-left: 8px;">{{ originalCreditsDisplay }} 积分</span>
                      <!-- Display promotion deadline -->
                      <div v-if="promotionDeadlineText" class="promotion-dates" style="font-size: 12px; color: var(--color-text-3);">
                        {{ promotionDeadlineText }}
                      </div>
                    </template>
                    <template v-else>
                      <a-tag v-if="originalCreditsDisplay === 0" color="green" size="small">免费</a-tag>
                      <span v-else>{{ originalCreditsDisplay }} 积分</span>
                    </template>
                  </div>
                </div>
                <div class="info-item" v-if="application.tags && application.tags.length > 0">
                  <icon-bookmark class="info-icon"/> <strong>标签:</strong>
                  <a-space wrap>
                    <a-tag v-for="tag in application.tags" :key="tag" color="cyan" size="small">{{ tag }}</a-tag>
                  </a-space>
                </div>
                <div class="info-item">
                  <icon-schedule class="info-icon"/> <strong>创建时间:</strong> {{ formatDateCN(application.createdAt) }}
                </div>
                <div class="info-item" v-if="application.updatedAt && application.createdAt !== application.updatedAt">
                  <icon-history class="info-icon"/> <strong>最后更新:</strong> {{ formatDateCN(application.updatedAt) }}
                </div>
              </div>
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
                :allowed-enum-option-ids="allowedEnumOptionIds"
                :widget-list="widgetList"
                class=""
              />
              <a-button type="primary" v-if="canLaunch" @click="launchAppWithConfig" class="w-full">立即生成（{{ discountedCredits > 0 ? discountedCredits : '限时免费' }}）</a-button>
            </a-card>
            <a-empty v-else description="此应用无需配置" class="empty-config-placeholder"/>
          </div>

          <!-- Right Column: Result Content (Placeholder) -->
          <div class="app-result-column">
            <a-card class="details-card scrollable-card" title="结果内容" :bordered="false">
              <p>此处将显示应用的生成结果。（待实现）</p>
              <!-- Placeholder for future result display components -->
            </a-card>
          </div>
        </div>

        <!-- Bottom Section: App Results Tabs (Placeholder) -->
        <div class="bottom-section-results">
          <a-tabs type="line" class="results-tabs">
            <a-tab-pane key="recommended" title="推荐">
              <p>推荐的应用生成结果将显示在这里。（待实现）</p>
              <!-- Placeholder for recommended results list (e.g., WorkCard components) -->
            </a-tab-pane>
            <a-tab-pane key="latest" title="最新">
              <p>最新的应用生成结果将显示在这里。（待实现）</p>
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
  IconApps, IconTag, IconLayers, IconStar, IconBookmark, IconSchedule, IconHistory,
  IconFire
} from '@arco-design/web-vue/es/icon';
import DynamicFormRenderer from '../components/DynamicFormRenderer.vue';
import { formatDateCN } from '@/client/utils/date';

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
const widgetList = ref([]);

const appId = computed(() => route.params.id);

const originalCreditsDisplay = computed(() => {
  if (application.value) {
    return application.value.creditsConsumed;
  }
  return 0;
});

const discountedCredits = computed(() => {
  if (!application.value) {
    return 0;
  }
  const originalCredits = application.value.creditsConsumed;
  let finalCredits = originalCredits;

  if (application.value.activePromotion) {
    const promo = application.value.activePromotion;
    if (promo.discountType === 'percentage' && promo.discountValue !== null) {
      finalCredits = Math.max(0, Math.round(originalCredits * (1 - parseFloat(promo.discountValue) / 100)));
    } else if (promo.discountType === 'fixed_reduction' && promo.discountValue !== null) {
      finalCredits = Math.max(0, originalCredits - parseInt(promo.discountValue, 10));
    }
  }
  return finalCredits;
});

const promotionDeadlineText = computed(() => {
  if (!application.value || !application.value.activePromotion || !application.value.activePromotion.endDate) {
    return '';
  }

  const endDate = new Date(application.value.activePromotion.endDate);
  const now = new Date();

  // Normalize to midnight to compare dates only
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const promotionEndDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
  const daysRemaining = Math.round((promotionEndDay - today) / oneDay);

  if (daysRemaining < 0) { // Promotion has ended
    return ''; // Or perhaps "活动已结束" if we want to show that
  }

  if (daysRemaining === 0) {
    return "活动仅最后一天";
  }

  if (daysRemaining <= 7) {
    return `活动仅剩 ${daysRemaining} 天`;
  }

  return `活动截止至 ${endDate.getFullYear()}-${('0' + (endDate.getMonth() + 1)).slice(-2)}-${('0' + endDate.getDate()).slice(-2)}`;
});

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

const allowedEnumOptionIds = computed(() => {
  const set = new Set();
  if (application.value && Array.isArray(application.value.apis)) {
    application.value.apis.forEach(api => {
      if (api.config && typeof api.config === 'object') {
        Object.values(api.config).forEach(val => {
          if (Array.isArray(val)) {
            val.forEach(id => set.add(id));
          }
        });
      }
    });
  }
  return set;
});

const fetchApplicationDetail = async () => {
  loading.value = true;
  errorMsg.value = '';
  formSchema.value = null; // Reset schema on new fetch
  try {
    const response = await apiClient.get(`/auth/client/ai-applications/${appId.value}`);
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

const fetchWidgetList = async () => {
  try {
    const response = await apiClient.getAIWidgets({ status: 'enabled' });
    widgetList.value = response.data?.list || [];
  } catch (err) {
    console.error('Error fetching widget list:', err);
    widgetList.value = [];
  }
};

const goBack = () => {
  router.push({ name: 'AiApplicationsList' }); // Navigate back to the list page using the correct route name
};

// Helper function to convert base64 to Blob (can be moved to a utils file)
async function base64ToBlob(base64, type = 'application/octet-stream') {
  const base64WithoutPrefix = base64.startsWith('data:') ? base64.split(',')[1] : base64;
  if (!base64WithoutPrefix) return null; // Handle empty or invalid base64 string
  try {
    const byteCharacters = atob(base64WithoutPrefix);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type });
  } catch (e) {
    console.error('Error in atob (base64ToBlob):', e);
    return null;
  }
}

// New helper to upload a single base64 file
async function uploadBase64AsFile(base64Data, fieldSchema, uploadType, defaultSubpath = 'general_uploads') {
  if (!base64Data || !base64Data.startsWith('data:image')) {
    return base64Data; // Not a base64 image, return as is (might be an existing URL)
  }

  let uploadUrl;
  let actionValue = fieldSchema?.props?.action || defaultSubpath;

  // Handle legacy action values - convert old full paths to subpaths
  if (actionValue === '/api/files/upload') {
    actionValue = 'general_uploads'; // Convert legacy path to subpath
  }

  // Check if action is still a complete URL path or just a subPath
  if (actionValue.startsWith('/api/')) {
    // Action is a complete URL path, but we need to remove /api since apiClient already has it as baseURL
    uploadUrl = actionValue.substring(4); // Remove '/api' prefix
  } else {
    // Action is a subPath, construct the relative URL (apiClient will add /api)
    uploadUrl = `/files/form-upload/${actionValue}`;
  }

  const blob = await base64ToBlob(base64Data, base64Data.substring(base64Data.indexOf(':') + 1, base64Data.indexOf(';')));
  if (!blob) {
    Message.error(`生成 ${uploadType} 文件内容失败，无法上传。`);
    throw new Error(`Failed to convert base64 to Blob for ${uploadType}`);
  }

  const formData = new FormData();
  const fileExtension = blob.type.split('/')[1] || 'png';
  formData.append('file', blob, `${uploadType}-${Date.now()}.${fileExtension}`);
  formData.append('type', uploadType);

  try {
    // Debug: Check if user token exists
    const token = localStorage.getItem('clientAccessToken');

    // Using apiClient.post assuming it handles FormData and auth correctly.
    // If apiClient is a simple wrapper around axios, this should work.
    // If it stringifies body by default, direct fetch or a custom apiClient method for FormData might be needed.
    const response = await apiClient.post(uploadUrl, formData, {
      headers: {
        // Axios might set Content-Type automatically for FormData
        // 'Content-Type': 'multipart/form-data', // Usually not needed for Axios with FormData
      }
    });
    // Assuming apiClient throws for non-2xx or response structure is { data: { filePath: '...'} }
    const result = response.data;
    if (result && result.filePath) {
      return result.filePath;
    }
    throw new Error(result?.message || `${uploadType} upload succeeded but no filePath returned.`);
  } catch (error) {
    Message.error(`上传 ${fieldSchema?.props?.label || uploadType} 图片失败: ${error.response?.data?.message || error.message}`);
    console.error(`Error uploading ${uploadType}:`, error);
    throw error;
  }
}

// New helper to upload a regular file
async function uploadFile(file, fieldSchema) {

  // Check if file is valid
  if (!file || (typeof file !== 'object') || !(file instanceof File)) {
    throw new Error('Invalid file object provided to uploadFile');
  }

  let uploadUrl;
  let actionValue = fieldSchema?.props?.action || 'general_uploads';

  // Handle legacy action values - convert old full paths to subpaths
  if (actionValue === '/api/files/upload') {
    actionValue = 'general_uploads';
  }

  // Check if action is still a complete URL path or just a subPath
  if (actionValue.startsWith('/api/')) {
    // Action is a complete URL path, but we need to remove /api since apiClient already has it as baseURL
    uploadUrl = actionValue.substring(4); // Remove '/api' prefix
  } else {
    // Action is a subPath, construct the relative URL (apiClient will add /api)
    uploadUrl = `/files/form-upload/${actionValue}`;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'user_upload');
  try {
    const response = await apiClient.post(uploadUrl, formData, {
      headers: {
        // Content-Type will be set automatically for FormData
      }
    });

    const result = response.data;
    if (result && result.filePath) {
      return result.filePath;
    }
    throw new Error(result?.message || 'File upload succeeded but no filePath returned.');
  } catch (error) {
    Message.error(`上传文件失败: ${error.response?.data?.message || error.message}`);
    console.error('Error uploading file:', error);
    throw error;
  }
}

const launchApp = async () => {
  if (!isLoggedIn.value) {
    if (openLoginModal) openLoginModal();
    return;
  }
  if (!application.value) return;

  let formIsValid = true;
  if (formSchema.value && formSchema.value.fields && formSchema.value.fields.length > 0) {
    if (dynamicFormRendererRef.value) {
      formIsValid = await dynamicFormRendererRef.value.validateForm();
      if (!formIsValid) {
        Message.error('存在必填项未填写或格式不正确，请检查。');
        return;
      }
    }
  }

  // Deep clone the form model to avoid mutating original state during processing
  const processedFormConfigData = JSON.parse(JSON.stringify(dynamicFormModel.value));
  let uploadsProcessedSuccessfully = true;
  const loadingUploadMsg = Message.loading('正在处理表单数据并上传文件...');

  try {
    if (formSchema.value && formSchema.value.fields) {
      for (const field of formSchema.value.fields) {
        const fieldKey = field.props?.field;

        if (fieldKey && processedFormConfigData.hasOwnProperty(fieldKey)) {
          let fieldValue = processedFormConfigData[fieldKey];

          if (typeof fieldValue === 'string' && fieldValue.startsWith('data:image')) { // Handles direct base64 (e.g. canvas drawing)
            Message.info(`正在上传 ${field.props.label || '画板内容'}...`);
            // Use proper subpath, don't pass old URL values as defaultSubpath
            const defaultSubpathForCanvas = 'app_canvas_files';
            processedFormConfigData[fieldKey] = await uploadBase64AsFile(fieldValue, field, 'canvas', defaultSubpathForCanvas);
          } else if (typeof fieldValue === 'string') {
            try {
              const parsedValue = JSON.parse(fieldValue);
              if (parsedValue && parsedValue.type === 'mask_data') {
                Message.info(`正在上传 ${field.props.label || '蒙版数据'}...`);
                // Use proper subpath, don't pass old URL values as defaultSubpath
                const defaultSubpathForMask = 'app_mask_files';

                const originalPath = await uploadBase64AsFile(parsedValue.original, field, 'mask_original', defaultSubpathForMask);
                const maskPath = await uploadBase64AsFile(parsedValue.mask, field, 'mask_drawing', defaultSubpathForMask);

                processedFormConfigData[fieldKey] = JSON.stringify({ original: originalPath, mask: maskPath });
              }
            } catch (e) {
              // Not a JSON string from our mask_data, or not our specific type, leave as is
            }
          } else if (Array.isArray(fieldValue)) {

            if (field.type === 'upload' || field.componentName === 'upload') {
              // Handle upload component files
              const uploadedFiles = [];
              for (const fileItem of fieldValue) {
                // Get the actual File object - try different approaches for ArcoDesign
                let actualFile = fileItem?.originFileObj || fileItem?.file;

                // Check if actualFile is a valid File object, not just truthy
                const isValidFile = actualFile && actualFile instanceof File;

                // If we don't have a valid File object but have a blob URL, try to fetch it
                if (!isValidFile && fileItem?.url && fileItem.url.startsWith('blob:')) {
                  try {
                    const response = await fetch(fileItem.url);
                    const blob = response.ok ? await response.blob() : null;
                    if (blob) {
                      // Create a File object from the blob
                      actualFile = new File([blob], fileItem.name || 'upload-file', {
                        type: blob.type || 'application/octet-stream'
                      });
                    }
                  } catch (error) {
                    console.error(`LaunchApp debug - Failed to fetch blob:`, error);
                  }
                }

                if (actualFile && actualFile instanceof File && fileItem?.status !== 'done') {
                  // This is a file object that needs to be uploaded
                  Message.info(`正在上传文件 ${fileItem.name}...`);
                  const uploadedPath = await uploadFile(actualFile, field);
                  uploadedFiles.push({
                    name: fileItem.name,
                    url: uploadedPath,
                    status: 'done',
                    uid: fileItem.uid
                  });
                } else if (fileItem?.url && fileItem?.status === 'done') {
                  // This is already uploaded or has a URL
                  uploadedFiles.push(fileItem);
                } else {
                  console.warn(`LaunchApp debug - Skipping file item (no valid file found):`, fileItem);
                  console.warn(`LaunchApp debug - actualFile:`, actualFile);
                  console.warn(`LaunchApp debug - actualFile instanceof File:`, actualFile instanceof File);
                  console.warn(`LaunchApp debug - fileItem.status:`, fileItem?.status);
                }
              }
              processedFormConfigData[fieldKey] = uploadedFiles;
            }
          }
        }
      }
    }
  } catch (uploadError) {
    uploadsProcessedSuccessfully = false;
    // Error message already shown by uploadBase64AsFile
    // loadingUploadMsg.close(); // Close loading message if an upload fails
    // return; // Stop if any upload fails
  } finally {
    if(typeof loadingUploadMsg.close === 'function') loadingUploadMsg.close();
  }

  if (!uploadsProcessedSuccessfully) {
    Message.error('部分文件上传失败，请重试。');
    return;
  }

  const appName = application.value.name;
  const originalCreditsToConsume = application.value.creditsConsumed;
  let finalCreditsToDisplay = originalCreditsToConsume; // Default to original
  if (application.value.activePromotion) {
    // ... (discount logic remains the same)
    const promo = application.value.activePromotion;
    if (promo.discountType === 'percentage' && promo.discountValue !== null) {
      finalCreditsToDisplay = Math.max(0, Math.round(originalCreditsToConsume * (1 - parseFloat(promo.discountValue) / 100)));
    } else if (promo.discountType === 'fixed_reduction' && promo.discountValue !== null) {
      finalCreditsToDisplay = Math.max(0, originalCreditsToConsume - parseInt(promo.discountValue, 10));
    }
  }

  Modal.confirm({
    title: '确认生成',
    content: `执行应用 "${appName}" ${finalCreditsToDisplay > 0 ? `将消耗 ${finalCreditsToDisplay} 积分` : '免费'}${application.value.activePromotion ? ' (已应用优惠)' : ''}。是否继续？`,
    okText: '确认生成',
    cancelText: '取消',
    onOk: async () => {
      const finalLoadingMsg = Message.loading('正在执行应用，请稍候...');
      try {
        // 打印最终提交的表单数据
        console.log('最终提交的表单数据:', JSON.stringify(processedFormConfigData, null, 2));

        const response = await apiClient.post(`/auth/client/ai-applications/${appId.value}/launch`, {
          formConfig: processedFormConfigData // Use the processed data with filePaths
        });

        const actualCreditsConsumed = response.data.creditsConsumed;
        Message.success(response.data.message || `应用 "${appName}" 执行成功！${actualCreditsConsumed > 0 ? `已消耗 ${actualCreditsConsumed} 积分。` : ''}`);

        if (refreshUserData) refreshUserData();

      } catch (error) {
        Message.error(error.response?.data?.message || error.message || '执行应用失败');
        console.error('Error launching application:', error);
      } finally {
        if(typeof finalLoadingMsg.close === 'function') finalLoadingMsg.close();
      }
    },
    onCancel: () => {}
  });
};

const launchAppWithConfig = () => {
  launchApp();
}

onMounted(() => {
  if (appId.value) {
    fetchApplicationDetail();
    fetchWidgetList();
  }
});

</script>

<style scoped>
.ai-app-detail-page {
  color: var(--color-text-1);
  min-height: calc(100vh - 100px);
}

.page-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.top-section-grid {
  display: grid;
  grid-template-columns: 350px 380px 1fr;
  gap: 24px;
  align-items: flex-start;
}

.app-info-column, .app-config-column, .app-result-column {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.scrollable-card {
  flex-grow: 1;
  overflow-y: auto;
  max-height: calc(100vh - 200px);
}

.info-card, .details-card, .config-card {
  background-color: var(--color-bg-2);
  border: 1px solid var(--color-border-2);
  border-radius: 8px;
  color: var(--color-text-1);
  display: flex;
  flex-direction: column;
}

:deep(.config-card .arco-card-body){
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
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
  background-color: var(--color-fill-2);
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
  font-size: 22px;
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
  gap: 10px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-2);
}
.info-item strong {
  color: var(--color-text-1);
}
.info-icon {
  color: var(--primary-6);
  font-size: 15px;
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
  height: 200px;
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

.bottom-section-results {
  margin-top: 24px;
  border: 1px solid var(--color-border-2);
  border-radius: 8px;
  background-color: var(--color-bg-2);
  padding: 16px;
}

.results-tabs .arco-tabs-nav::before {
  display: none;
}

.results-tabs .arco-tabs-content {
  padding-top: 16px;
}
</style>