<template>
  <a-card hoverable class="work-card" @mouseover="isHovered = true" @mouseleave="isHovered = false">
    <template #cover>
      <div class="work-thumbnail-wrapper">
        <img 
          v-if="work.type === 'image' && work.sourceUrl"
          :alt="work.title || 'work image'" 
          :src="fullSourceUrl"
          class="work-thumbnail"
        />
        <div v-else-if="work.type === 'video'" class="work-media-placeholder">
          <icon-video-camera :style="{ fontSize: '48px' }"/>
          <video class="work-video-preview" v-if="isHovered || alwaysShowPlayer" :src="fullSourceUrl" controls muted></video>
        </div>
        <div v-else-if="work.type === 'audio'" class="work-media-placeholder">
          <icon-voice :style="{ fontSize: '48px' }"/>
          <audio class="work-audio-preview" v-if="isHovered || alwaysShowPlayer" :src="fullSourceUrl" controls muted></audio>
        </div>
        <div v-else-if="work.type === 'model'" class="work-media-placeholder">
          <icon-codepen :style="{ fontSize: '48px' }"/>
          <span>GLB Model</span> 
          <!-- Placeholder for GLB, actual rendering is complex -->
        </div>
        <div v-else class="work-media-placeholder">
            <icon-file :style="{ fontSize: '48px' }"/>
            <span>{{ work.type }}</span>
        </div>

        <div class="work-thumbnail-overlay" :class="{ visible: isHovered }" @click="emitDetails">
          <div class="overlay-content">
            <p><strong>ID:</strong> {{ work._id.slice(-6) }}</p>
            <p><strong>类型:</strong> {{ workTypeDisplay }}</p>
            <div v-if="work.creator" class="creator-info">
                <a-avatar :size="24" :image-url="work.creator.profilePicture">{{ work.creator.username?.substring(0,1) }}</a-avatar>
                <span style="margin-left: 8px;">{{ work.creator.username }}</span>
            </div>
            <p class="prompt-preview" :title="work.prompt"><strong>提示词:</strong> {{ work.prompt || '-' }}</p>
            <p><strong>创作时间:</strong> {{ formatDate(work.createdAt) }}</p>
          </div>
        </div>
        <div v-if="fullSourceUrl && (work.type === 'image' || work.type === 'video' || work.type === 'audio')" class="type-badge">
          {{ work.type === 'image' ? '图片' : work.type === 'video' ? '视频' : '音频' }}
        </div>
      </div>
    </template>
    <a-card-meta @click="emitDetails">
      <template #title>
        <a-typography-paragraph :ellipsis="{ rows: 1, showTooltip: true }" style="margin-bottom: 0;">
          {{ work.title || '未命名作品' }}
        </a-typography-paragraph>
      </template>
      <template #description>
        <a-typography-paragraph :ellipsis="{ rows: 2, showTooltip: true }" type="secondary" style="font-size: 12px; min-height: 36px;">
          {{ work.prompt || '-' }}
        </a-typography-paragraph>
        <div class="tags-list">
            <a-tag v-for="tag in (work.tags || []).slice(0,3)" :key="tag" size="small" color="blue">{{ tag }}</a-tag>
            <a-tag v-if="(work.tags || []).length > 3" size="small">...</a-tag>
        </div>
      </template>
    </a-card-meta>
    <template #actions>
      <a-tooltip content="查看详情" v-if="props.showDetailsButton">
        <a-button type="text" @click="emitDetails"><icon-eye /></a-button>
      </a-tooltip>
      <a-tooltip content="编辑" v-if="props.showEditButton">
        <a-button type="text" @click.stop="emitEdit"><icon-edit /></a-button>
      </a-tooltip>
      <a-popconfirm 
        v-if="props.showDeleteButton"
        content="确定删除此作品吗？此操作不可恢复。" 
        @ok="emitDelete"
      >
        <a-button type="text" status="danger"><icon-delete /></a-button>
      </a-popconfirm>
      <a-popconfirm
        v-if="props.showDeleteFromCategoryButton"
        :content="`确定要从分类中移除作品吗？`"
        @ok="emitDeleteFromCategory"
      >
        <a-button type="text" status="danger" ><icon-delete /></a-button>
      </a-popconfirm>
    </template>
  </a-card>
</template>

<script setup>
import { ref, computed } from 'vue';
import { Card as ACard, CardMeta as ACardMeta, Avatar as AAvatar, TypographyParagraph as ATypographyParagraph, Tag as ATag, Tooltip as ATooltip, Button as AButton, Popconfirm as APopconfirm } from '@arco-design/web-vue';
import { IconVideoCamera, IconVoice, IconCodepen, IconFile, IconEye, IconEdit, IconDelete } from '@arco-design/web-vue/es/icon';

const API_BASE_URL = 'http://localhost:3000'; // TODO: Consider moving to env variables

const props = defineProps({
  work: {
    type: Object,
    required: true,
  },
  alwaysShowPlayer: { // For audio/video, to show player without hover (e.g. in modal)
    type: Boolean,
    default: false,
  },
  showDetailsButton: { 
    type: Boolean, 
    default: true 
  },
  showEditButton: { 
    type: Boolean, 
    default: true 
  },
  showDeleteButton: { // For deleting the work itself
    type: Boolean, 
    default: true 
  },
  showDeleteFromCategoryButton: { // For removing from a category
    type: Boolean, 
    default: false 
  }
});

const emit = defineEmits(['details', 'edit', 'delete', 'deleteFromCategory']);

const isHovered = ref(false);

const fullSourceUrl = computed(() => {
  if (!props.work.sourceUrl) return '';
  if (props.work.sourceUrl.startsWith('http://') || props.work.sourceUrl.startsWith('https://') || props.work.sourceUrl.startsWith('blob:')) {
    return props.work.sourceUrl;
  }
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const path = props.work.sourceUrl.startsWith('/') ? props.work.sourceUrl : `/${props.work.sourceUrl}`;
  return `${baseUrl}${path}`;
});

const workTypeDisplay = computed(() => {
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
  const date = new Date(dateString);
  return date.toLocaleDateString(); // Or more sophisticated formatting
};

const emitDetails = () => emit('details', props.work);
const emitEdit = () => emit('edit', props.work);
const emitDelete = () => emit('delete', props.work._id);
const emitDeleteFromCategory = () => emit('deleteFromCategory', props.work._id);

</script>

<style scoped>
.work-card {
  cursor: pointer;
  /* width: 280px; Adjust as needed for grid */
}

.work-thumbnail-wrapper {
  width: 100%;
  padding-top: 75%; /* Aspect ratio 4:3, adjust as needed e.g. 56.25% for 16:9 */
  position: relative;
  overflow: hidden;
  background-color: var(--color-fill-2);
}

.work-thumbnail, .work-video-preview, .work-audio-preview {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover; /* 'contain' might be better for some content */
}

.work-media-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-3);
}

.work-thumbnail-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  padding: 10px;
  box-sizing: border-box;
  font-size: 12px;
}

.work-thumbnail-overlay.visible {
  opacity: 1;
}

.overlay-content p {
  margin: 2px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.overlay-content .prompt-preview {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2; /* Show 2 lines for prompt */
    -webkit-box-orient: vertical;
    overflow: hidden;
    max-height: 2.8em; /* Roughly 2 lines */
}

.creator-info {
    display: flex;
    align-items: center;
    margin-top: 4px;
}

.tags-list {
    margin-top: 8px;
    min-height: 22px; /* Ensure consistent height even with no tags */
}

.type-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    background-color: rgba(0,0,0,0.5);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
}

.arco-card-meta-description .arco-typography, .arco-card-meta-title .arco-typography {
    margin-bottom: 0;
}

.work-card :deep(.arco-card-actions:empty),
.work-card :deep(.arco-card-meta-footer:empty) { /* If meta-footer exists and can be empty */
    display: none;
}

.work-card :deep(.arco-card-actions) {
    padding: 8px 12px; /* Adjust padding if needed, or remove if defaults are fine */
}
</style> 