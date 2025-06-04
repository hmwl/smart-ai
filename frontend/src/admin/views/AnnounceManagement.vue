<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">公告管理</h2>
      <a-space>
        <a-input-search v-model="filterTitle" placeholder="搜索标题" allow-clear style="width: 180px;" />
        <a-select v-model="filterPublisher" placeholder="发布人" allow-clear style="width: 140px;" :options="adminUsers" />
        <a-range-picker v-model="filterCreatedAt" style="width: 260px;" format="YYYY-MM-DD" />
        <a-select v-model="filterType" placeholder="类型" allow-clear style="width: 120px;" :options="typeOptions" />
        <a-select v-model="filterStatus" placeholder="状态" allow-clear style="width: 120px;" :options="statusOptions" />
        <a-select v-model="filterPopup" placeholder="弹窗" allow-clear style="width: 100px;">
          <a-option :value="true">是</a-option>
          <a-option :value="false">否</a-option>
        </a-select>
        <a-button type="primary" @click="openCreateModal">
          <template #icon><icon-plus /></template> 新建公告
        </a-button>
        <a-button @click="refreshAnnouncements" :loading="isLoading">
          <template #icon><icon-refresh /></template> 刷新
        </a-button>
      </a-space>
    </div>
    <a-spin :loading="isLoading" tip="加载公告列表中..." class="w-full">
      <a-table
        :data="filteredAnnouncements"
        :pagination="pagination"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        row-key="_id"
        stripe
        :scroll="{ x: 'max-content' }"
      >
        <template #columns>
          <a-table-column title="ID" data-index="_id" :width="120" />
          <a-table-column title="标题" data-index="title" :width="200" :sortable="{ sortDirections: ['ascend', 'descend'] }"/>
          <a-table-column title="类型" :width="100" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              <a-tag
                :color="typeOptions.find(opt => opt.value === record.type)?.tagColor"
                bordered
              >
                {{ typeOptions.find(opt => opt.value === record.type)?.label || record.type }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="状态" :width="100" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              <template v-if="record.status === 'draft'">
                <a-tag :color="statusOptions[0].tagColor" :fill="true">
                  {{ statusOptions[0].label }}
                </a-tag>
              </template>
              <template v-else>
                <a-tag
                  :color="(record.effectiveAt && new Date() < new Date(record.effectiveAt)) ? statusOptions[1].tagColor : statusOptions[2].tagColor"
                  :fill="true"
                >
                  {{ (record.effectiveAt && new Date() < new Date(record.effectiveAt)) ? statusOptions[1].label : statusOptions[2].label }}
                </a-tag>
              </template>
            </template>
          </a-table-column>
          <a-table-column title="是否弹窗" :width="110" align="center" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              <template v-if="record.isPopup">
                <template v-if="record.popupDays === 0">一次</template>
                <template v-else>{{ record.popupDays }}天</template>
              </template>
              <template v-else>否</template>
            </template>
          </a-table-column>
          <a-table-column title="已读" data-index="readStats" :width="100" align="center" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              <span>{{ record.readCount || 0 }}</span>
            </template>
          </a-table-column>
          <a-table-column title="发布人" data-index="publisher" :width="120" :sortable="{ sortDirections: ['ascend', 'descend'] }" />
          <a-table-column title="创建时间" data-index="createdAt" :width="200" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">{{ formatDateCN(record.createdAt) }}</template>
          </a-table-column>
          <a-table-column title="生效时间" data-index="effectiveAt" :width="200" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              <template v-if="record.status === 'draft'">-</template>
              <template v-else>{{ formatDateCN(record.effectiveAt) }}</template>
            </template>
          </a-table-column>
          <a-table-column title="修改时间" data-index="updatedAt" :width="200" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">{{ formatDateCN(record.updatedAt) }}</template>
          </a-table-column>
          <a-table-column title="操作" :width="150" fixed="right">
            <template #cell="{ record }">
              <a-button type="text" size="mini" @click="editAnnouncement(record)">编辑</a-button>
              <a-popconfirm
                content="确定要删除该公告吗？"
                @ok="deleteAnnouncement(record)"
              >
                <a-button type="text" status="danger" size="mini">删除</a-button>
              </a-popconfirm>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-spin>
    <!-- 公告创建/编辑弹窗，左右布局 -->
    <a-modal
      :visible="showCreateModal"
      :title="isEditMode ? '编辑公告：' + form.title : '创建公告'"
      @ok="handleSave"
      @cancel="closeModal"
      :ok-text="isEditMode ? '更新公告' : '创建公告'"
      :confirm-loading="isSubmitting"
      unmount-on-close
      width="900px"
      :body-style="{ 'max-height': '75vh', 'overflow-y': 'auto' }"
    >
      <a-form :model="form" layout="vertical" ref="formRef" :rules="formRules">
        <a-row :gutter="24">
          <a-col :span="24">
            <a-row :gutter="24">
              <a-col :span="16">
                <a-form-item field="title" label="公告标题" required>
                  <a-input v-model="form.title" placeholder="请输入标题" />
                </a-form-item>
              </a-col>
              <a-col :span="4">
                <a-form-item field="type" label="公告类型" required>
                  <a-select v-model="form.type" placeholder="请选择类型" :options="typeOptions" />
                </a-form-item>
              </a-col>
              <a-col :span="4">
                <a-form-item field="publisher" label="发布人" required>
                  <a-select v-model="form.publisher" placeholder="请选择发布人" allow-clear :options="adminUsers" />
                </a-form-item>
              </a-col>
            </a-row>
          </a-col>
          <a-col :span="24">
            <a-form-item label="概要" tooltip="概要将显示在公告列表中，可选">
              <a-textarea v-model="form.summary" placeholder="请输入概要（可选）" :auto-size="{ minRows: 3, maxRows: 6 }"/>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item field="content" label="内容" required>
              <div>
                <QuillEditor theme="snow" v-model:content="form.content" contentType="html" toolbar="full" style="min-height: 350px;" />
              </div>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
      <template #footer>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; width: 100%;">
          <div style="display: flex; gap: 12px; align-items: flex-end;">
            <a-form layout="inline" :model="form" style="margin-bottom: 0;">
              <a-form-item style="margin-bottom: 0;" :label-col-style="{padding: 0}">
                <a-select v-model="form.publishType" style="width: 110px;">
                  <a-option value="draft">草稿</a-option>
                  <a-option value="immediate">立即发布</a-option>
                  <a-option value="scheduled">定时发布</a-option>
                </a-select>
              </a-form-item>
              <a-form-item v-if="form.publishType === 'scheduled'" field="effectiveAt" required style="margin-bottom: 0;" :label-col-style="{padding: 0}">
                <a-date-picker v-model="form.effectiveAt" show-time format="YYYY-MM-DD HH:mm:ss" style="width: 200px;" />
              </a-form-item>
              <a-form-item label="弹窗" style="margin-bottom: 0;">
                <a-switch v-model="form.isPopup" />
              </a-form-item>
              <a-form-item v-if="form.isPopup" label="周期" style="margin-bottom: 0;" tooltip="弹窗的周期，一次表示只弹窗一次，1天表示每天弹窗一次，以此类推（用户已读后，当天不再弹窗）">
                <a-select v-model="form.popupDays" style="width: 80px;">
                  <a-option :value="0">一次</a-option>
                  <a-option :value="1">1天</a-option>
                  <a-option :value="3">3天</a-option>
                  <a-option :value="7">7天</a-option>
                  <a-option :value="14">14天</a-option>
                  <a-option :value="30">30天</a-option>
                </a-select>
              </a-form-item>
            </a-form>
          </div>
          <div>
            <a-button @click="closeModal" style="margin-right: 12px;">取消</a-button>
            <a-button type="primary" @click="handleSave" :loading="isSubmitting">{{ isEditMode ? '更新公告' : '创建公告' }}</a-button>
          </div>
        </div>
      </template>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import { IconRefresh, IconPlus } from '@arco-design/web-vue/es/icon';
import apiService from '../services/apiService';
import { formatDateCN } from '@/admin/utils/date';
import { QuillEditor } from '@vueup/vue-quill';
import '@vueup/vue-quill/dist/vue-quill.snow.css';

const isLoading = ref(false);
const isSubmitting = ref(false);
const showCreateModal = ref(false);
const isEditMode = ref(false);
const announcements = ref([]);
const adminUsers = ref([]);
const pagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [10, 15, 20, 50, 100],
});
const filterType = ref();
const filterStatus = ref();
const filterPopup = ref();
const filterTitle = ref();
const filterPublisher = ref();
const filterCreatedAt = ref();
const formRef = ref();
const form = ref({
  title: '',
  type: '',
  summary: '',
  content: '',
  publishType: 'draft',
  isPopup: false,
  popupDays: 0,
  publisher: '',
  effectiveAt: null
});
const formRules = {
  title: [{ required: true, message: '请输入标题' }],
  type: [{ required: true, message: '请选择类型' }],
  content: [
    { required: true, message: '请输入内容' },
    {
      validator: (value, callback) => {
        if (!value || !value.replace(/<(.|\n)*?>/g, '').trim()) {
          callback('请输入内容');
        } else {
          callback();
        }
      }
    }
  ],
  publisher: [{ required: true, message: '请选择发布人' }],
  effectiveAt: [
    {
      validator: (value, callback) => {
        if (form.value.publishType === 'scheduled' && !value) {
          callback('请选择定时发布时间');
        } else {
          callback();
        }
      }
    }
  ]
};
let editingId = null;

const typeOptions = [
  { label: '公告', value: 'notice', tagColor: 'arcoblue' },
  { label: '通知', value: 'notice2', tagColor: 'cyan' },
  { label: '活动', value: 'activity', tagColor: 'green' },
  { label: '促销', value: 'promotion', tagColor: 'orange' },
  { label: '其他', value: 'other', tagColor: 'gray' }
];
const statusOptions = [
  { label: '草稿', value: 'draft', tagColor: 'gray', tagType: 'fill' },
  { label: '待生效', value: 'pending', tagColor: 'arcoblue', tagType: 'fill' },
  { label: '已生效', value: 'active', tagColor: 'green', tagType: 'fill' }
];

const fetchAnnouncements = async () => {
  isLoading.value = true;
  try {
    const params = {
      page: pagination.current,
      pageSize: pagination.pageSize,
      type: filterType.value,
      status: filterStatus.value,
      isPopup: filterPopup.value,
      title: filterTitle.value,
      publisher: filterPublisher.value,
    };
    // 处理创建时间区间
    if (filterCreatedAt.value && filterCreatedAt.value.length === 2) {
      params.createdAtStart = filterCreatedAt.value[0];
      params.createdAtEnd = filterCreatedAt.value[1];
    }
    // 只传递有值的参数
    Object.keys(params).forEach(key => {
      if (params[key] === undefined || params[key] === null || params[key] === '') {
        delete params[key];
      }
    });
    const res = await apiService.getAnnouncements(params);
    announcements.value = res.data.list || [];
    pagination.total = res.data.total || 0;
  } finally {
    isLoading.value = false;
  }
};

const fetchAdminUsers = async () => {
  const res = await apiService.get('/users', { params: { status: 'active', isAdmin: true, page: 1, limit: 100 } });
  adminUsers.value = (res.data.data || []).map(u => ({ label: u.username, value: u.username }));
};

const filteredAnnouncements = computed(() => {
  return announcements.value.filter(item => {
    const typeOk = !filterType.value || item.type === filterType.value;
    const statusOk = !filterStatus.value || item.status === filterStatus.value;
    const popupOk = filterPopup.value === undefined || filterPopup.value === null || item.isPopup === filterPopup.value;
    const titleOk = !filterTitle.value || item.title?.toLowerCase().includes(filterTitle.value.toLowerCase());
    const publisherOk = !filterPublisher.value || item.publisher === filterPublisher.value;
    let createdAtOk = true;
    if (filterCreatedAt.value && filterCreatedAt.value.length === 2) {
      const [start, end] = filterCreatedAt.value;
      const created = new Date(item.createdAt);
      createdAtOk = (!start || created >= new Date(start)) && (!end || created <= new Date(end + 'T23:59:59'));
    }
    return typeOk && statusOk && popupOk && titleOk && publisherOk && createdAtOk;
  });
});

const refreshAnnouncements = () => {
  pagination.current = 1;
  fetchAnnouncements();
};

const handlePageChange = (page) => {
  pagination.current = page;
  fetchAnnouncements();
};

const handlePageSizeChange = (pageSize) => {
  pagination.pageSize = pageSize;
  pagination.current = 1;
  fetchAnnouncements();
};

const openCreateModal = () => {
  // 获取当前登录用户名
  let currentUser = null;
  try {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    currentUser = userInfo?.username;
  } catch {}
  form.value = {
    title: '',
    type: '',
    summary: '',
    content: '',
    publishType: 'draft',
    isPopup: false,
    popupDays: 0,
    publisher: (adminUsers.value.find(u => u.value === currentUser) ? currentUser : ''),
    effectiveAt: null
  };
  isEditMode.value = false;
  editingId = null;
  showCreateModal.value = true;
};

const closeModal = () => {
  showCreateModal.value = false;
  isEditMode.value = false;
  editingId = null;
};

const handleSave = async () => {
  const validationResult = await formRef.value?.validate();
  if (validationResult) {
    // 可选：滚动到第一个错误项
    const firstErrorField = Object.keys(validationResult)[0];
    if (firstErrorField && formRef.value?.scrollToField) {
      formRef.value.scrollToField(firstErrorField);
    }
    return false;
  }
  isSubmitting.value = true;
  try {
    const payload = { ...form.value };
    // 新增：根据 publishType 设置 status
    if (payload.publishType === 'draft') {
      payload.status = 'draft';
      payload.effectiveAt = null;
    } else if (payload.publishType === 'immediate') {
      payload.status = 'active';
      payload.effectiveAt = new Date().toISOString();
    } else if (payload.publishType === 'scheduled') {
      payload.status = 'pending';
      // effectiveAt 已由表单选择
    }
    if (isEditMode.value && editingId) {
      await apiService.updateAnnouncement(editingId, payload);
      Message.success('公告已更新');
    } else {
      await apiService.createAnnouncement(payload);
      Message.success('公告已创建');
    }
    closeModal();
    await fetchAnnouncements();
  } finally {
    isSubmitting.value = false;
  }
};

const editAnnouncement = (record) => {
  isEditMode.value = true;
  editingId = record._id;
  form.value = { ...record };
  showCreateModal.value = true;
};

const deleteAnnouncement = async (record) => {
  await apiService.deleteAnnouncement(record._id);
  Message.success('公告已删除');
  await fetchAnnouncements();
};

// 监听筛选条件变化，自动请求后端
watch([
  filterType,
  filterStatus,
  filterPopup,
  filterTitle,
  filterPublisher,
  filterCreatedAt
], () => {
  pagination.current = 1;
  fetchAnnouncements();
});

onMounted(() => {
  fetchAnnouncements();
  fetchAdminUsers();
});
</script>

<style scoped>
:deep(.ql-editor) {
  min-height: 300px;
}
</style> 