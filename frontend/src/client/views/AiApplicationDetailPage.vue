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
              <!-- 任务状态显示 -->
              <div v-if="isTaskRunning" class="task-status-section">
                <a-alert
                  :type="taskStatus === 'failed' ? 'error' : 'info'"
                  :title="`任务状态: ${getStatusText(taskStatus)}`"
                  :description="getTaskDescription()"
                  show-icon
                  closable
                  @close="isTaskRunning = false"
                />

                <!-- 进度条 -->
                <div v-if="taskProgress && taskProgress.percentage" class="task-progress">
                  <a-progress
                    :percent="taskProgress.percentage"
                    :status="taskStatus === 'failed' ? 'danger' : 'normal'"
                  />
                  <div class="progress-text">
                    {{ taskProgress.text_message || `步骤 ${taskProgress.current_step}/${taskProgress.total_steps}` }}
                  </div>
                </div>

                <!-- 取消按钮 -->
                <a-button
                  v-if="['pending', 'running'].includes(taskStatus)"
                  type="outline"
                  status="warning"
                  @click="cancelCurrentTask"
                  class="w-full mt-2"
                >
                  取消任务
                </a-button>
              </div>

              <!-- 生成按钮 -->
              <a-button
                type="primary"
                v-if="canLaunch && !isTaskRunning"
                @click="launchAppWithConfig"
                class="w-full"
              >
                立即生成（{{ discountedCredits > 0 ? discountedCredits : '限时免费' }}）
              </a-button>
            </a-card>
            <a-empty v-else description="此应用无需配置" class="empty-config-placeholder"/>
          </div>

          <!-- Right Column: Result Content -->
          <div class="app-result-column">
            <a-card class="details-card scrollable-card" title="结果内容" :bordered="false">
              <!-- 任务结果显示 -->
              <div v-if="taskResults && hasValidResults" class="task-results">
                <div class="result-header">
                  <a-tag color="green">任务完成</a-tag>
                  <span class="result-time">{{ new Date().toLocaleString() }}</span>
                </div>

                <!-- 根据结果类型显示不同内容 -->
                <div class="result-content">
                  <!-- 图片结果 -->
                  <div v-if="taskResults.images && taskResults.images.length > 0" class="result-images">
                    <div v-for="(image, index) in taskResults.images" :key="index" class="result-image">
                      <img
                        :src="getImageUrl(image.url || image.downloadUrl)"
                        :alt="`结果图片 ${index + 1}`"
                        @error="handleImageError"
                      />
                      <div class="image-info">
                        <span class="filename">{{ image.filename }}</span>
                        <a :href="image.downloadUrl || image.url" target="_blank" class="download-link">
                          <icon-download /> 下载
                        </a>
                      </div>
                    </div>
                  </div>

                  <!-- 视频结果 -->
                  <div v-if="taskResults.videos && taskResults.videos.length > 0" class="result-videos">
                    <div v-for="(video, index) in taskResults.videos" :key="index" class="result-video">
                      <video
                        :src="getImageUrl(video.url || video.downloadUrl)"
                        controls
                        :alt="`结果视频 ${index + 1}`"
                      />
                      <div class="video-info">
                        <span class="filename">{{ video.filename }}</span>
                        <a :href="video.downloadUrl || video.url" target="_blank" class="download-link">
                          <icon-download /> 下载
                        </a>
                      </div>
                    </div>
                  </div>

                  <!-- 文本结果 -->
                  <div v-if="taskResults.texts && taskResults.texts.length > 0" class="result-texts">
                    <div v-for="(text, index) in taskResults.texts" :key="index" class="result-text">
                      <pre>{{ text.content }}</pre>
                    </div>
                  </div>

                  <!-- 原始JSON结果（调试用） -->
                  <div v-if="taskResults && typeof taskResults === 'object'" class="result-json">
                    <a-collapse>
                      <a-collapse-item header="查看原始数据" key="raw">
                        <pre>{{ JSON.stringify(taskResults, null, 2) }}</pre>
                      </a-collapse-item>
                    </a-collapse>
                  </div>
                </div>
              </div>

              <!-- 无结果时的占位符 -->
              <div v-else-if="!isTaskRunning" class="no-results">
                <a-empty description="暂无生成结果">
                  <template #image>
                    <icon-apps style="font-size: 64px; color: var(--color-text-3);" />
                  </template>
                </a-empty>
              </div>

              <!-- 任务运行中的占位符 -->
              <div v-else class="task-running">
                <a-spin :size="32">
                  <div class="running-text">任务执行中，请稍候...</div>
                </a-spin>
              </div>
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
import { ref, onMounted, computed, inject, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient, { getStaticAssetBaseUrl } from '../services/apiService';
import taskService from '../services/taskService';
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

// 任务状态管理
const currentTask = ref(null);
const taskStatus = ref(null);
const taskProgress = ref(null);
const isTaskRunning = ref(false);
const taskResults = ref(null);

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

// 判断是否有有效的结果数据
const hasValidResults = computed(() => {
  if (!taskResults.value) return false;

  // 检查是否有图片、视频或文本结果
  const hasImages = taskResults.value.images && taskResults.value.images.length > 0;
  const hasVideos = taskResults.value.videos && taskResults.value.videos.length > 0;
  const hasTexts = taskResults.value.texts && taskResults.value.texts.length > 0;

  return hasImages || hasVideos || hasTexts;
});

const getImageUrl = (imagePath) => {
  if (!imagePath) return '';

  // 如果是完整URL（如ComfyUI的API地址），直接返回
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // 如果是相对路径（如应用封面图），拼接静态资源基础URL
  const staticAssetBase = getStaticAssetBaseUrl();
  const path = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
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
      const finalLoadingMsg = Message.loading('正在提交任务，请稍候...');
      try {
        // 打印最终提交的表单数据
        console.log('最终提交的表单数据:', JSON.stringify(processedFormConfigData, null, 2));

        // 使用新的任务服务提交任务
        const result = await taskService.submitTask(appId.value, processedFormConfigData);

        if (result.success) {
          currentTask.value = {
            promptId: result.promptId,
            taskId: result.taskId,
            status: result.status,
            applicationName: appName
          };

          isTaskRunning.value = true;
          taskStatus.value = result.status;

          Message.success(`任务已成功提交！${result.creditsConsumed > 0 ? `已消耗 ${result.creditsConsumed} 积分。` : ''}`);

          if (refreshUserData) refreshUserData();

          // 开始监听任务状态
          startTaskMonitoring(result.promptId);
        }

      } catch (error) {
        Message.error(error.message || '提交任务失败');
        console.error('Error submitting task:', error);
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

// 状态文本辅助函数
const getStatusText = (status) => {
  const statusMap = {
    'pending': '等待中',
    'running': '执行中',
    'completed': '已完成',
    'failed': '失败',
    'cancelled': '已取消'
  };
  return statusMap[status] || status;
};

const getTaskDescription = () => {
  if (!currentTask.value) return '';

  let description = `应用: ${currentTask.value.applicationName}`;

  if (taskProgress.value) {
    if (taskProgress.value.current_node_type) {
      description += ` | 当前节点: ${taskProgress.value.current_node_type}`;
    }
    if (taskProgress.value.current_step && taskProgress.value.total_steps) {
      description += ` | 进度: ${taskProgress.value.current_step}/${taskProgress.value.total_steps}`;
    }
  }

  return description;
};

// 图片加载错误处理
const handleImageError = (event) => {
  console.error('图片加载失败:', event.target.src);
  Message.error('图片加载失败，请检查网络连接或图片地址');
};

// 任务监听相关函数
const startTaskMonitoring = (promptId) => {
  // 使用轮询监控任务状态
  pollTaskStatus(promptId);
};

// 移除WebSocket相关的handleTaskUpdate函数，改为在轮询中处理状态更新

const pollTaskStatus = async (promptId) => {
  try {
    const finalStatus = await taskService.pollTaskUntilComplete(promptId, {
      maxAttempts: 120,
      interval: 3000, // 使用较短的轮询间隔以提供更好的用户体验
      onProgress: (status) => {
        // 更新任务状态和进度
        taskStatus.value = status.status;
        taskProgress.value = status.progress;

        // 显示队列信息
        if (status.queueInfo && status.queueInfo.position) {
          Message.info(`任务在队列中排第 ${status.queueInfo.position} 位`);
        }

        // 如果状态更新中包含输出数据，直接使用
        if (status.output_data) {
          taskResults.value = status.output_data;
        }
      }
    });

    // 轮询完成后处理最终结果
    isTaskRunning.value = false;

    if (finalStatus.status === 'completed') {
      Message.success('任务执行完成！');

      if (finalStatus.output_data) {
        taskResults.value = finalStatus.output_data;
      } else {
        // 添加短暂延迟，确保后端状态已更新
        setTimeout(async () => {
          await loadTaskResults(promptId);
        }, 2000);
      }
    } else if (finalStatus.status === 'failed') {
      Message.error(finalStatus.errorMessage || '任务执行失败');
    }

    // 清除当前任务引用
    currentTask.value = null;

  } catch (error) {
    console.error('轮询任务状态失败:', error);
    Message.error('任务状态查询失败');
    isTaskRunning.value = false;
    currentTask.value = null;
  }
};

const loadTaskResults = async (promptId, retryCount = 0) => {
  try {
    const result = await taskService.getTaskResult(promptId);
    if (result.success) {
      // 处理不同格式的结果数据
      let processedData = result.data;

      // 如果数据是标准格式（包含images数组），直接使用
      if (processedData && processedData.images) {
        taskResults.value = processedData;
      }
      // 如果数据是ComfyUI历史格式，需要转换
      else if (processedData && typeof processedData === 'object') {
        taskResults.value = processComfyUIHistoryData(processedData, promptId);
      }
      // 其他情况，保持原样
      else {
        taskResults.value = processedData;
      }

      Message.success('任务结果已加载');
    }
  } catch (error) {
    console.error('加载任务结果失败:', error);

    // 如果是任务尚未完成的错误，且重试次数少于3次，则重试
    if (error.message && error.message.includes('任务尚未完成') && retryCount < 3) {
      console.log(`任务可能刚完成，${3 - retryCount}秒后重试...`);
      setTimeout(() => {
        loadTaskResults(promptId, retryCount + 1);
      }, 3000);
    } else {
      Message.error('加载任务结果失败');
    }
  }
};

// 处理ComfyUI历史数据格式
const processComfyUIHistoryData = (historyData, promptId) => {
  const result = {
    images: [],
    videos: [],
    texts: [],
    raw_outputs: historyData
  };

  // 查找对应的任务数据
  const taskData = historyData[promptId];
  if (!taskData || !taskData.outputs) {
    return result;
  }

  // 遍历输出节点
  Object.keys(taskData.outputs).forEach(nodeId => {
    const nodeOutput = taskData.outputs[nodeId];

    // 处理图片
    if (nodeOutput.images && Array.isArray(nodeOutput.images)) {
      nodeOutput.images.forEach(image => {
        const proxyUrl = buildProxyUrl(promptId, nodeId, image);
        const downloadUrl = buildDownloadUrl(promptId, nodeId, image);

        result.images.push({
          nodeId: nodeId,
          filename: image.filename,
          subfolder: image.subfolder || '',
          type: image.type || 'temp',
          url: proxyUrl,
          downloadUrl: downloadUrl,
          original: image
        });
      });
    }

    // 处理视频
    if (nodeOutput.videos && Array.isArray(nodeOutput.videos)) {
      nodeOutput.videos.forEach(video => {
        const proxyUrl = buildProxyUrl(promptId, nodeId, video);
        const downloadUrl = buildDownloadUrl(promptId, nodeId, video);

        result.videos.push({
          nodeId: nodeId,
          filename: video.filename,
          subfolder: video.subfolder || '',
          type: video.type || 'temp',
          url: proxyUrl,
          downloadUrl: downloadUrl,
          original: video
        });
      });
    }
  });

  return result;
};

// 构建代理URL
const buildProxyUrl = (promptId, nodeId, fileInfo) => {
  const { filename, subfolder = '', type = 'temp' } = fileInfo;
  const params = new URLSearchParams({
    subfolder: subfolder,
    type: type
  });
  return `/api/proxy/${promptId}/${nodeId}/${filename}?${params.toString()}`;
};

// 构建下载URL
const buildDownloadUrl = (promptId, nodeId, fileInfo) => {
  const { filename, subfolder = '', type = 'temp' } = fileInfo;
  const params = new URLSearchParams({
    subfolder: subfolder,
    type: type
  });
  return `/api/proxy/download/${promptId}/${nodeId}/${filename}?${params.toString()}`;
};

const cancelCurrentTask = async () => {
  if (!currentTask.value) return;

  try {
    const result = await taskService.cancelTask(currentTask.value.promptId);
    if (result.success) {
      isTaskRunning.value = false;
      taskStatus.value = 'cancelled';
      Message.success('任务已取消');

      // 清除当前任务引用
      currentTask.value = null;
    }
  } catch (error) {
    console.error('取消任务失败:', error);
    Message.error('取消任务失败');
  }
};

onMounted(() => {
  if (appId.value) {
    fetchApplicationDetail();
    fetchWidgetList();
  }
});

onUnmounted(() => {
  // 清理任务相关状态
  if (currentTask.value) {
    currentTask.value = null;
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

/* 任务状态相关样式 */
.task-status-section {
  margin-bottom: 16px;
}

.task-progress {
  margin-top: 12px;
}

.progress-text {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-3);
  text-align: center;
}

.task-results {
  padding: 16px 0;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border-2);
}

.result-time {
  font-size: 12px;
  color: var(--color-text-3);
}

.result-content {
  margin-top: 16px;
}

.result-images {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.result-image {
  border: 1px solid var(--color-border-2);
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-bg-1);
}

.result-image img {
  width: 100%;
  height: auto;
  display: block;
}

.image-info {
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-bg-2);
}

.filename {
  font-size: 12px;
  color: var(--color-text-2);
  flex: 1;
  margin-right: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.download-link {
  font-size: 12px;
  color: var(--color-primary-6);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.download-link:hover {
  color: var(--color-primary-5);
}

.result-videos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.result-video {
  border: 1px solid var(--color-border-2);
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-bg-1);
}

.result-video video {
  width: 100%;
  height: auto;
  display: block;
}

.video-info {
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-bg-2);
}

.result-texts {
  margin-top: 16px;
}

.result-text pre,
.result-json pre {
  background: var(--color-bg-3);
  padding: 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.no-results,
.task-running {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  flex-direction: column;
}

.running-text {
  margin-top: 16px;
  color: var(--color-text-2);
}
</style>