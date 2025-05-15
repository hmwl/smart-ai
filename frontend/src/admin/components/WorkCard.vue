<template>
  <a-card hoverable class="work-card transition-shadow duration-200 ease-in-out hover:shadow-lg">
    <template #cover>
      <div
        class="work-thumbnail-wrapper bg-[var(--color-fill-2)]"
        :style="{
          height: '204px',
          overflow: work.type === 'image' && work.sourceUrl ? 'hidden' : 'visible',
          position: 'relative',
          display: work.type === 'image' && work.sourceUrl ? 'block' : 'flex',
          alignItems: work.type === 'image' && work.sourceUrl ? 'stretch' : 'center',
          justifyContent: work.type === 'image' && work.sourceUrl ? 'flex-start' : 'center',
          backgroundColor: (work.type !== 'image' || !work.sourceUrl) ? 'var(--color-fill-1)' : 'transparent'
        }"
      >
        <img
          v-if="work.type === 'image' && work.sourceUrl"
          :alt="work.title || 'work image'"
          :src="fullSourceUrl"
          class="work-thumbnail block"
          :style="{
            width: '100%',
            height: 'calc(204px + 40px)',
            transform: 'translateY(-20px)',
            objectFit: 'cover'
          }"
        />
        <div v-else-if="work.type === 'video'" class="work-media-placeholder flex flex-col items-center justify-center w-full h-full p-4 box-border text-center text-[var(--color-text-2)]">
          <icon-video-camera class="text-5xl mb-2.5" />
          <video class="work-video-preview max-w-full w-full block mt-2.5 max-h-[calc(100%-48px-20px)]" v-if="alwaysShowPlayer" :src="fullSourceUrl" controls muted></video>
        </div>
        <div v-else-if="work.type === 'audio'" class="work-media-placeholder flex flex-col items-center justify-center w-full h-full p-4 box-border text-center text-[var(--color-text-2)]">
          <icon-voice class="text-5xl mb-2.5" />
          <audio class="work-audio-preview max-w-full w-full block mt-2.5 max-h-[calc(100%-48px-20px)]" v-if="alwaysShowPlayer" :src="fullSourceUrl" controls muted></audio>
        </div>
        <div v-else-if="work.type === 'model'" class="work-media-placeholder flex flex-col items-center justify-center w-full h-full p-4 box-border text-center text-[var(--color-text-2)]">
          <icon-codepen class="text-5xl mb-2.5" />
          <span class="mt-2 text-sm">GLB Model</span>
        </div>
        <div v-else class="work-media-placeholder flex flex-col items-center justify-center w-full h-full p-4 box-border text-center text-[var(--color-text-2)]">
            <icon-file class="text-5xl mb-2.5" />
            <span class="mt-2 text-sm">{{ work.type }}</span>
        </div>

        <div v-if="fullSourceUrl && (work.type === 'image' || work.type === 'video' || work.type === 'audio')" class="type-badge absolute top-2 right-2 bg-black/70 text-white py-0.5 px-1.5 rounded text-[10px] uppercase">
          {{ work.type === 'image' ? '图片' : work.type === 'video' ? '视频' : '音频' }}
        </div>
      </div>
    </template>
    <a-card-meta>
      <template #avatar>
        <div
          v-if="work.creator"
          class="flex items-center text-[var(--color-text-1)]" 
        >
          <a-avatar :size="24" class="mr-2" :image-url="work.creator.profilePicture">
            {{ work.creator.username?.substring(0,1).toUpperCase() }}
          </a-avatar>
          <a-typography-text :style="{ color: 'var(--color-text-1)' }"> {{ work.creator.username }}</a-typography-text>
        </div>
        <div v-else class="flex items-center text-[var(--color-text-1)]">
            <a-avatar :size="24" class="mr-2">?</a-avatar>
            <a-typography-text :style="{ color: 'var(--color-text-1)' }">未知用户</a-typography-text>
        </div>
      </template>
      <template #title>
        <a-typography-paragraph :ellipsis="{ rows: 1, showTooltip: true }" class="mb-0">
          {{ work.title || '未命名作品' }}
        </a-typography-paragraph>
      </template>
      <template #description>
        <a-typography-paragraph :ellipsis="{ rows: 2, showTooltip: true }" type="secondary" class="text-xs">
          {{ work.prompt || '-' }}
        </a-typography-paragraph>
        <div class="tags-list mt-2 mb-2 min-h-[22px]">
            <a-tag v-for="tag in (work.tags || []).slice(0,3)" :key="tag" size="small" color="blue" class="mr-1 mb-1">{{ tag }}</a-tag>
            <a-tag v-if="(work.tags || []).length > 3" size="small" class="mr-1 mb-1">...</a-tag>
        </div>
        <a-typography-paragraph :ellipsis="{ rows: 1, showTooltip: true }" class="text-xs mb-0 flex justify-between">
          <p class="text-xs">ID: {{ work._id.slice(-6) }}</p>
          <p class="text-xs">时间: {{ formatDate(work.createdAt) }}</p>
        </a-typography-paragraph>
      </template>
    </a-card-meta>
    <template #actions>
      <a-tooltip content="查看详情" v-if="props.showDetailsButton">
        <span class="icon-hover inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-100 ease-linear cursor-pointer text-[var(--color-text-2)] hover:bg-[var(--color-fill-2)]" @click="emitDetails"><icon-eye class="text-base" /></span>
      </a-tooltip>
      <a-tooltip content="编辑" v-if="props.showEditButton">
        <span class="icon-hover inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-100 ease-linear cursor-pointer text-[var(--color-text-2)] hover:bg-[var(--color-fill-2)]" @click.stop="emitEdit"><icon-edit class="text-base" /></span>
      </a-tooltip>
      <a-popconfirm
        v-if="props.showDeleteButton"
        content="确定删除此作品吗？此操作不可恢复。"
        @ok="emitDelete"
      >
        <span class="icon-hover danger-icon inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-100 ease-linear cursor-pointer text-[var(--color-text-2)] hover:bg-[var(--color-fill-2)]"><icon-delete class="text-base text-[rgb(var(--danger-6))] group-hover:text-[rgb(var(--danger-6))] hover:bg-[var(--color-danger-light-1)]" /></span>
      </a-popconfirm>
      <a-popconfirm
        v-if="props.showDeleteFromCategoryButton"
        :content="`确定要从分类中移除作品吗？`"
        @ok="emitDeleteFromCategory"
      >
        <span class="icon-hover danger-icon inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-100 ease-linear cursor-pointer text-[var(--color-text-2)] hover:bg-[var(--color-fill-2)]"><icon-delete class="text-base text-[rgb(var(--danger-6))] group-hover:text-[rgb(var(--danger-6))] hover:bg-[var(--color-danger-light-1)]" /></span>
      </a-popconfirm>
    </template>
  </a-card>
</template>

<script setup>
import { computed } from 'vue';
import { Card as ACard, CardMeta as ACardMeta, Avatar as AAvatar, TypographyParagraph as ATypographyParagraph, TypographyText as ATypographyText, Tag as ATag, Tooltip as ATooltip } from '@arco-design/web-vue';
import { IconVideoCamera, IconVoice, IconCodepen, IconFile, IconEye, IconEdit, IconDelete } from '@arco-design/web-vue/es/icon';

const props = defineProps({
  work: {
    type: Object,
    required: true,
  },
  alwaysShowPlayer: {
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
  showDeleteButton: {
    type: Boolean, 
    default: true 
  },
  showDeleteFromCategoryButton: {
    type: Boolean, 
    default: false 
  }
});

const emit = defineEmits(['details', 'edit', 'delete', 'deleteFromCategory']);

const fullSourceUrl = computed(() => {
  if (!props.work.sourceUrl) return '';
  if (props.work.sourceUrl.startsWith('http://') || props.work.sourceUrl.startsWith('https://') || props.work.sourceUrl.startsWith('blob:')) {
    return props.work.sourceUrl;
  }

  let backendOrigin = '';
  if (import.meta.env.DEV) {
    backendOrigin = 'http://localhost:3000';
  } else {
    backendOrigin = window.location.origin;
  }

  const path = props.work.sourceUrl.startsWith('/') ? props.work.sourceUrl : `/${props.work.sourceUrl}`;
  return `${backendOrigin}${path}`;
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
  return date.toLocaleDateString();
};

const emitDetails = () => emit('details', props.work);
const emitEdit = () => emit('edit', props.work);
const emitDelete = () => emit('delete', props.work._id);
const emitDeleteFromCategory = () => emit('deleteFromCategory', props.work._id);

</script>

<style scoped>
/* Most styles have been migrated to Tailwind classes in the template. */
/* Keeping :deep styles as they are behavior-related or complex to convert directly to Tailwind without HTML structure changes. */

/* Ensure meta title and description are not clickable if card meta itself has @click */
/* This is a behavioral style. If issues arise, structure inside a-card-meta might need changes for direct Tailwind class application. */
:deep(.arco-card-meta-title > .arco-typography),
:deep(.arco-card-meta-description > .arco-typography) {
  pointer-events: none;
}

/* Specific hover for danger icon actions, Tailwind's group-hover might be an alternative if structure allows */
.icon-hover.danger-icon:hover .arco-icon {
   color: rgb(var(--danger-6)); /* Keep icon color danger on hover */
}
.icon-hover.danger-icon:hover {
   background-color: var(--color-danger-light-1); /* Ensure parent hover style for danger icons */
}

</style> 