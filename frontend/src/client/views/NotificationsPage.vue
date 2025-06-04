<template>
  <div class="notifications-page p-4 md:p-6">
    <a-page-header title="消息中心" class="mb-4 site-page-header-responsive">
      <template #subtitle>
        <p>平台与账户相关的所有通知、公告、活动等消息都在这里统一管理。</p>
      </template>
    </a-page-header>
    <a-tabs v-model:active-key="activeTab" class="mb-4" @change="handleTabChange">
      <a-tab-pane key="all" :title="`全部${tabUnread.all ? ' (' + tabUnread.all + ')' : ''}`" />
      <a-tab-pane key="platform" :title="`平台${tabUnread.platform ? ' (' + tabUnread.platform + ')' : ''}`" />
      <a-tab-pane key="account" :title="`账户${tabUnread.account ? ' (' + tabUnread.account + ')' : ''}`" />
    </a-tabs>
    <div class="gap-2 flex items-center">
        <a-checkbox v-model="selectAll" @change="toggleSelectAll">全选</a-checkbox>
        <a-button size="small" @click="markRead" class="ml-2">标记已读</a-button>
        <a-button size="small" @click="markUnread" class="ml-2">标记未读</a-button>
    </div>
    <div v-if="!loading && messages.length === 0" class="empty-state mt-6">
      <a-empty description="暂无消息" />
    </div>
    <a-list
      v-else
      :data="messages"
      :bordered="false"
      :pagination-props="pagination"
    >
      <template #item="{ item, index }">
        <a-list-item class="list-demo-item" action-layout="vertical">
          <a-card class="notification-card" :hoverable="true" :bordered="false">
            <div class="font-bold text-base mb-3 flex items-center gap-2">
              <a-checkbox v-model="selectedRowKeys" :value="item._id" />
              <a-tag :color="getTypeColor(item.type)" size="small">{{ getTypeLabel(item.type) }}</a-tag>
              <div class="flex items-center justify-between w-full">
                <h6 class="text-xl">{{ item.title }}</h6>
                <a-tag size="small" >未读</a-tag>
              </div>
            </div>
            <div class="text-sm text-gray-500 mb-2 summary-ellipsis">{{ item.summary || '-' }}</div>
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-6">
                <span class="text-xs">[{{ getCategoryLabel(item) }}] {{ item.publisher }}</span>
                <span class="text-xs text-gray-400">{{ formatDateShort(item.createdAt) }}</span>
              </div>
              <a-button type="text" size="mini" @click="viewDetail(item)">查看详情</a-button>
            </div>
          </a-card>
        </a-list-item>
        </template>
    </a-list>
    <a-modal v-model:visible="detailVisible" title="公告详情" width="750px" :footer="null" :body-style="{height: '600px', overflow: 'auto', padding: '24px'}">
      <div v-if="currentDetail">
        <div class="flex items-center gap-4 mb-2 justify-center">
          <a-tag :color="getTypeColor(currentDetail.type)" size="small">{{ getTypeLabel(currentDetail.type) }}</a-tag>
          <span class="font-bold text-lg">{{ currentDetail.title }}</span>
        </div>
        <div class="flex items-center gap-6 text-xs text-gray-500 mb-4 justify-center border-b border-gray-500/10 pb-4">
          <span>[{{ getCategoryLabel(currentDetail) }}] {{ currentDetail.publisher }}</span>
          <span>{{ formatDateShort(currentDetail.createdAt) }}</span>
        </div>
        <div class="prose" v-html="currentDetail.content" />
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import apiService from '../services/apiService';
import { Tag as ATag, Empty as AEmpty, Spin as ASpin, PageHeader as APageHeader, Tabs as ATabs, TabPane as ATabPane, Button as AButton, Checkbox as ACheckbox, Table as ATable, List as AList, Card as ACard } from '@arco-design/web-vue';

const activeTab = ref('all');
const tabUnread = ref({ all: 0, platform: 0, account: 0 });
const messages = ref([]);
const selectedRowKeys = ref([]);
const selectAll = ref(false);
const detailVisible = ref(false);
const currentDetail = ref(null);
const pagination = ref({ current: 1, pageSize: 10, total: 0 });
const loading = ref(false);

const loadUnread = async () => {
  const res = await apiService.fetchUnreadCount();
  tabUnread.value = res.data || { all: 0, platform: 0, account: 0 };
};

const loadMessages = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.value.current,
      pageSize: pagination.value.pageSize,
      category: activeTab.value === 'all' ? undefined : activeTab.value,
      status: 'active',
    };
    const res = await apiService.fetchNotifications(params);
    const now = new Date();
    messages.value = (res.data.list || []).filter(item => {
      return (!item.effectiveAt || new Date(item.effectiveAt) <= now);
    });
    pagination.value.total = res.data.total || 0;
    selectedRowKeys.value = [];
    selectAll.value = false;
  } finally {
    loading.value = false;
  }
};

const handleTabChange = (key) => {
  activeTab.value = key;
  pagination.value.current = 1;
  loadMessages();
  loadUnread();
};

const handlePageChange = (page) => {
  pagination.value.current = page;
  loadMessages();
};

const toggleSelectAll = () => {
  if (selectAll.value) {
    selectedRowKeys.value = messages.value.map(m => m._id);
  } else {
    selectedRowKeys.value = [];
  }
};
const onSelectChange = (keys) => {
  selectedRowKeys.value = keys;
  selectAll.value = keys.length === messages.value.length;
};
const markRead = async () => {
  if (!selectedRowKeys.value.length) return;
  await apiService.markNotificationsRead(selectedRowKeys.value);
  loadMessages();
};
const markUnread = async () => {
  if (!selectedRowKeys.value.length) return;
  await apiService.markNotificationsUnread(selectedRowKeys.value);
  loadMessages();
};
const viewDetail = (record) => {
  currentDetail.value = record;
  detailVisible.value = true;
};

const formatDateShort = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  } catch (e) {
    return dateString;
  }
};

const getCategoryLabel = (record) => {
  if (['notice', 'notice2', 'activity', 'promotion'].includes(record.type)) return '平台';
  if (record.type === 'other') return '账户';
  return '其他';
};
const getCategoryColor = (record) => {
  if (['notice', 'notice2', 'activity', 'promotion'].includes(record.type)) return 'arcoblue';
  if (record.type === 'other') return 'gold';
  return 'gray';
};
const typeMap = {
  notice: '公告',
  notice2: '通知',
  activity: '活动',
  promotion: '促销',
  other: '其他'
};
const typeColors = {
  notice: 'arcoblue',
  notice2: 'cyan',
  activity: 'green',
  promotion: 'orange',
  other: 'gray'
};
const getTypeLabel = (type) => typeMap[type] || type;
const getTypeColor = (type) => typeColors[type] || 'gray';

onMounted(() => {
  loadMessages();
  loadUnread();
});
</script>

<style scoped>
.notifications-page {
  min-height: calc(100vh - 60px);
  color: #fff;
}
.site-page-header-responsive {
  background-color: rgba(35, 40, 49, 0.5);
  border-radius: 4px;
  padding: 16px 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}
.summary-ellipsis {
  display: -webkit-box;
  text-indent: 2em;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  white-space: normal;
  min-height: 1.5em;
}
:deep(.ql-align-center) { text-align: center; }
:deep(.ql-align-right) { text-align: right; }
:deep(.ql-align-justify) { text-align: justify; }
</style> 