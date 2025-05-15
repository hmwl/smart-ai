<template>
  <a-modal
    :visible="visible"
    title="作品详情"
    @ok="handleOk"
    @cancel="handleCancel"
    :width="800"
    :footer="null" 
  >
    <div v-if="work" class="work-detail-layout">
      <div class="media-column">
        <img 
          v-if="work.type === 'image' && work.sourceUrl"
          :src="fullSourceUrl" 
          alt="Work Image" 
          class="detail-media-item"
        />
        <video 
          v-else-if="work.type === 'video' && work.sourceUrl" 
          :src="fullSourceUrl" 
          controls 
          class="detail-media-item"
        ></video>
        <audio 
          v-else-if="work.type === 'audio' && work.sourceUrl" 
          :src="fullSourceUrl" 
          controls 
          class="detail-media-item audio-player"
        ></audio>
        <div v-else-if="work.type === 'model'" class="detail-media-placeholder">
          <icon-codepen :style="{ fontSize: '64px' }"/>
          <p>3D 模型预览区</p>
          <p>(Three.js 画布待集成)</p>
          <p v-if="work.sourceUrl">模型文件: <a :href="fullSourceUrl" target="_blank">下载/查看</a></p>
        </div>
        <div v-else class="detail-media-placeholder">
          <icon-file :style="{ fontSize: '64px' }"/>
          <p>无法预览类型: {{ work.type }}</p>
           <p v-if="work.sourceUrl">源文件: <a :href="fullSourceUrl" target="_blank">下载/查看</a></p>
        </div>
      </div>
      <div class="info-column">
        <a-descriptions :column="1" bordered size="medium">
          <a-descriptions-item label="作品ID">{{ work._id }}</a-descriptions-item>
          <a-descriptions-item label="标题">{{ work.title || '未命名作品' }}</a-descriptions-item>
          <a-descriptions-item label="类型">{{ workTypeDisplay }}</a-descriptions-item>
          <a-descriptions-item label="提示词">
            <a-typography-paragraph 
                :ellipsis="{ expandable: true, rows: 5 }"
                style="white-space: pre-wrap; margin-bottom:0;"
            >
                {{ work.prompt || '-' }}
            </a-typography-paragraph>
          </a-descriptions-item>
          <a-descriptions-item label="标签">
            <span v-if="work.tags && work.tags.length">
              <a-tag v-for="tag in work.tags" :key="tag" color="blue" style="margin-right: 4px; margin-bottom: 4px;">{{ tag }}</a-tag>
            </span>
            <span v-else>-</span>
          </a-descriptions-item>
          <a-descriptions-item label="创作者">
            <div v-if="work.creator" style="display: flex; align-items: center;">
              <a-avatar :size="24" :image-url="work.creator.profilePicture">{{ work.creator.username?.substring(0,1) }}</a-avatar>
              <span style="margin-left: 8px;">{{ work.creator.username }} (ID: {{ work.creator._id }})</span>
            </div>
            <span v-else>-</span>
          </a-descriptions-item>
          <a-descriptions-item label="创作时间">{{ formatDate(work.createdAt) }}</a-descriptions-item>
          <a-descriptions-item label="最后更新">{{ formatDate(work.updatedAt) }}</a-descriptions-item>
          <!-- <a-descriptions-item label="状态">{{ work.status === 'public_market' ? '市场展示中' : '未在市场展示' }}</a-descriptions-item> -->
          <!-- <a-descriptions-item label="源文件">
            <a :href="fullSourceUrl" target="_blank" v-if="work.sourceUrl">{{ fullSourceUrl }}</a>
            <span v-else>-</span>
          </a-descriptions-item> -->
           <a-descriptions-item label="缩略图文件" v-if="work.thumbnailUrl && work.thumbnailUrl !== work.sourceUrl">
            <a :href="fullThumbnailUrl" target="_blank">{{ fullThumbnailUrl }}</a>
          </a-descriptions-item>
          <a-descriptions-item label="原始AI应用" v-if="work.originalApplication">
            {{ work.originalApplication.name || work.originalApplication._id }}
          </a-descriptions-item>
        </a-descriptions>
      </div>
    </div>
    <a-empty v-else description="没有作品数据" />
  </a-modal>
</template>

<script setup>
import { computed } from 'vue';
import { Modal as AModal, Descriptions as ADescriptions, DescriptionsItem as ADescriptionsItem, Avatar as AAvatar, Tag as ATag, TypographyParagraph as ATypographyParagraph, Empty as AEmpty } from '@arco-design/web-vue';
import { IconCodepen, IconFile } from '@arco-design/web-vue/es/icon';
import { getStaticAssetBaseUrl } from '../services/apiService.js';

const API_BASE_URL = getStaticAssetBaseUrl();

const props = defineProps({
  visible: Boolean,
  work: Object,
});

const emit = defineEmits(['update:visible', 'close']);

const getFullUrl = (relativePath) => {
  if (!relativePath) return '';
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://') || relativePath.startsWith('blob:')) {
    return relativePath;
  }
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${baseUrl}${path}`;
};

const fullSourceUrl = computed(() => getFullUrl(props.work?.sourceUrl));
const fullThumbnailUrl = computed(() => getFullUrl(props.work?.thumbnailUrl));

const workTypeDisplay = computed(() => {
  if (!props.work) return '-';
  const typeMap = {
    image: '图片',
    video: '视频',
    audio: '音频',
    model: '3D模型',
  };
  return typeMap[props.work.type] || props.work.type;
});

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

const handleOk = () => {
  emit('update:visible', false);
  emit('close');
};

const handleCancel = () => {
  emit('update:visible', false);
  emit('close');
};

</script>

<style scoped>
.work-detail-layout {
  display: flex;
  gap: 20px;
}

.media-column {
  flex: 1;
  min-width: 300px; /* Ensure it doesn't get too small */
  max-width: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-fill-1);
  border-radius: var(--border-radius-medium);
  overflow: hidden;
}

.detail-media-item {
  max-width: 100%;
  max-height: 500px; /* Limit height of media */
  display: block;
  object-fit: contain;
}
.audio-player {
    width: 100%;
}

.detail-media-placeholder {
  padding: 20px;
  text-align: center;
  color: var(--color-text-3);
}

.info-column {
  flex: 1;
  min-width: 300px;
}

.arco-descriptions-item-label {
    font-weight: bold;
}
</style> 