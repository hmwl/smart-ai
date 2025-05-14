<template>
  <div class="all-works-page">
    <!-- New Header mimicking ApplicationManagement.vue -->
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">所有作品</h2>
      <a-space>
        <a-input-search 
          placeholder="搜索作品..." 
          style="width: 240px;" 
          v-model="searchTerm" 
          @search="onSearch" 
          @clear="onSearch()" 
          allow-clear 
        />
        <a-button type="primary" @click="showCreateWorkModal = true">
          <template #icon><icon-plus /></template> 添加作品
        </a-button>
        <a-button @click="refreshWorks" :loading="worksLoading">
          <template #icon><icon-refresh /></template> 刷新
        </a-button>
      </a-space>
    </div>

    <!-- Main Content Area -->
    <div>
      <a-spin :loading="worksLoading" style="width: 100%;">
        <div v-if="works.length > 0" class="works-grid">
          <div v-for="work in works" :key="work._id" class="work-card-wrapper">
            <WorkCard 
              :work="work" 
              @details="handleShowDetails"
              @edit="handleEditWork" 
              @delete="handleDeleteWorkConfirm" 
            />
          </div>
        </div>
        <a-empty v-else description="暂无作品数据，尝试调整筛选或添加新作品。" />
        <a-pagination 
            v-if="pagination.total > pagination.pageSize"
            :total="pagination.total"
            :current="pagination.current"
            :page-size="pagination.pageSize"
            show-total
            show-jumper
            show-page-size
            :page-size-options="[10, 20, 50, 100]"
            @change="handlePageChange"
            @page-size-change="handlePageSizeChange"
            style="margin-top: 20px; text-align: right;" 
        />
      </a-spin>
    </div>

    <WorkDetailModal 
      v-model:visible="detailModalVisible" 
      :work="selectedWork"
    />

    <!-- Create/Edit Work Modal (Simplified for now) -->
    <a-modal v-model:visible="showCreateWorkModal" :title="editWorkId ? '编辑作品' : '添加新作品'" @ok="handleSaveWork" @cancel="closeCreateWorkModal" :width="600">
      <a-form :model="workForm" ref="workFormRef" layout="vertical">
        <a-form-item field="title" label="标题">
          <a-input v-model="workForm.title" placeholder="请输入作品标题" />
        </a-form-item>
        <a-form-item field="type" label="类型" required>
          <a-select v-model="workForm.type" placeholder="请选择作品类型">
            <a-option value="image">图片</a-option>
            <a-option value="video">视频</a-option>
            <a-option value="audio">音频</a-option>
            <a-option value="model">3D模型</a-option>
          </a-select>
        </a-form-item>
        <a-form-item field="prompt" label="提示词">
          <a-textarea v-model="workForm.prompt" placeholder="请输入提示词" :auto-size="{minRows:3,maxRows:5}"/>
        </a-form-item>
        <a-form-item field="tags" label="标签 (逗号分隔)">
          <a-input v-model="workForm.tags" placeholder="例如：风景,科幻,未来感" />
        </a-form-item>
        <a-form-item field="status" label="市场状态">
            <a-radio-group v-model="workForm.status">
                <a-radio value="private">私有 (不展示)</a-radio>
                <a-radio value="public_market">公开 (市场展示)</a-radio>
            </a-radio-group>
        </a-form-item>
        <a-form-item field="workFile" label="作品文件" v-if="!editWorkId || workForm.replaceFile">
          <a-upload
            :custom-request="handleCustomRequest"
            :show-file-list="true"
            :limit="1"
            @change="handleFileChange"
            v-model:file-list="workForm.fileList"
          >
            <template #upload-button>
              <a-button type="primary">
                <template #icon><icon-upload /></template>
                点击上传文件
              </a-button>
            </template>
          </a-upload>
        </a-form-item>
        <a-form-item v-if="editWorkId && workForm.sourceUrl && !workForm.replaceFile">
            <p>当前文件: <a :href="workForm.sourceUrl" target="_blank">{{ workForm.sourceUrl.split('/').pop() }}</a></p>
            <a-checkbox v-model="workForm.replaceFile">替换文件</a-checkbox>
        </a-form-item>
      </a-form>
    </a-modal>

  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { 
    PageHeader as APageHeader, InputSearch as AInputSearch, Spin as ASpin, Empty as AEmpty, 
    Pagination as APagination, Message, Modal as AModal, Form as AForm, FormItem as AFormItem,
    Input as AInput, Textarea as ATextarea, Select as ASelect, Option as AOption, Button as AButton,
    Upload as AUpload, Grid as AGrid, GridItem as AGridItem, Space as ASpace,
    RadioGroup as ARadioGroup, Radio as ARadio, Checkbox as ACheckbox, Popconfirm
} from '@arco-design/web-vue';
import { IconPlus, IconUpload, IconRefresh } from '@arco-design/web-vue/es/icon';
import WorkCard from '../components/WorkCard.vue';
import WorkDetailModal from '../components/WorkDetailModal.vue';
import apiService from '../services/apiService'; // Added

const works = ref([]);
const worksLoading = ref(false);
const searchTerm = ref('');

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const detailModalVisible = ref(false);
const selectedWork = ref(null);

const showCreateWorkModal = ref(false);
const workFormRef = ref(null);
const workForm = reactive({
  title: '',
  type: '',
  prompt: '',
  tags: '', // Comma-separated string
  status: 'private',
  workFile: null, 
  fileList: [],
  sourceUrl: null, // for edit mode to show current file
  replaceFile: false, // for edit mode
});
const editWorkId = ref(null);

const fetchWorks = async () => {
  worksLoading.value = true;
  try {
    const params = {
      page: pagination.current,
      limit: pagination.pageSize,
      search: searchTerm.value || undefined,
      // status: 'public_market' // Or filter as needed
    };
    const response = await apiService.getWorks(params);
    works.value = response.data.works;
    pagination.total = response.data.totalWorks;
  } catch (error) {
    Message.error('获取作品列表失败: ' + (error.response?.data?.message || error.message));
    console.error('Error fetching works:', error);
  } finally {
    worksLoading.value = false;
  }
};

onMounted(() => {
  fetchWorks();
});

const onSearch = () => {
  pagination.current = 1;
  fetchWorks();
};

const refreshWorks = () => {
  searchTerm.value = ''; // Clear search term on refresh
  pagination.current = 1;
  fetchWorks();
  Message.success('数据已刷新');
};

const handlePageChange = (page) => {
  pagination.current = page;
  fetchWorks();
};

const handlePageSizeChange = (pageSize) => {
  pagination.pageSize = pageSize;
  pagination.current = 1; 
  fetchWorks();
};

const handleShowDetails = (work) => {
  selectedWork.value = work;
  detailModalVisible.value = true;
};

const handleEditWork = (work) => {
  editWorkId.value = work._id;
  workForm.title = work.title;
  workForm.type = work.type;
  workForm.prompt = work.prompt;
  workForm.tags = work.tags ? work.tags.join(',') : '';
  workForm.status = work.status;
  workForm.sourceUrl = work.sourceUrl; 
  workForm.replaceFile = false; 
  workForm.workFile = null; 
  workForm.fileList = [];
  showCreateWorkModal.value = true;
};

const handleDeleteWorkConfirm = (workId) => {
    Modal.confirm({
        title: '确认删除',
        content: '您确定要删除这个作品吗？此操作不可撤销。',
        onOk: async () => {
            try {
                await apiService.deleteWork(workId);
                Message.success('作品删除成功');
                fetchWorks(); // Refresh the list
            } catch (error) {
                Message.error('删除作品失败: ' + (error.response?.data?.message || error.message));
            }
        },
    });
};

const closeCreateWorkModal = () => {
  showCreateWorkModal.value = false;
  editWorkId.value = null;
  workFormRef.value?.resetFields(); // Reset form validation and fields
  workForm.title = '';
  workForm.type = '';
  workForm.prompt = '';
  workForm.tags = '';
  workForm.status = 'private';
  workForm.workFile = null;
  workForm.fileList = [];
  workForm.sourceUrl = null;
  workForm.replaceFile = false;
};

const handleFileChange = (fileList) => {
  // For custom request, we mainly manage the file object ourselves
  if (fileList.length > 0) {
      workForm.workFile = fileList[0].file; // Store the raw file object
  } else {
      workForm.workFile = null;
  }
  workForm.fileList = fileList; // Keep fileList for UI display in <a-upload>
};

// This is for a-upload customRequest. We don't actually upload here, but prepare the file.
const handleCustomRequest = (options) => {
    const { file, onSuccess, onError } = options;
    // We handle the upload in handleSaveWork. For custom-request, you can just call onSuccess.
    // This is a bit of a hack for a-upload if we don't want it to upload immediately.
    // Alternatively, don't use custom-request and manage file input manually.
    workForm.workFile = file; // Ensure file is captured
    onSuccess(); // Pretend it uploaded successfully to update UI state
    return {
        abort() { console.log('upload aborted'); }
    };
};

const handleSaveWork = async () => {
  const isValid = await workFormRef.value?.validate();
  if (isValid) { // isValid will be an object of errors if any, undefined if ok
    const firstErrorKey = Object.keys(isValid)[0];
    const firstErrorMessage = isValid[firstErrorKey]?.[0]?.message;
    Message.error(firstErrorMessage || '请修正表单错误');
    return;
  }

  const formData = new FormData();
  formData.append('title', workForm.title || '');
  formData.append('type', workForm.type);
  formData.append('prompt', workForm.prompt || '');
  if (workForm.tags) {
      // Backend expects tags as a JSON string array
      formData.append('tags', JSON.stringify(workForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag)));
  } else {
      formData.append('tags', JSON.stringify([]));
  }
  formData.append('status', workForm.status);
  
  // Only append file if it's a new work or if replaceFile is checked for an existing work
  if (workForm.workFile && (!editWorkId.value || workForm.replaceFile)) {
    formData.append('workFile', workForm.workFile);
  }

  try {
    worksLoading.value = true;
    if (editWorkId.value) {
      await apiService.updateWork(editWorkId.value, formData);
      Message.success('作品更新成功');
    } else {
      if (!workForm.workFile) {
          Message.error('请上传作品文件');
          worksLoading.value = false;
          return;
      }
      await apiService.createWork(formData);
      Message.success('作品添加成功');
    }
    closeCreateWorkModal();
    fetchWorks();
  } catch (error) {
    Message.error('保存作品失败: ' + (error.response?.data?.message || error.message));
    console.error('Error saving work:', error);
  } finally {
    worksLoading.value = false;
  }
};

</script>

<style scoped>
.all-works-page {
  /* Styles for the page */
  display: flex;
  flex-direction: column;
  height: 100%; /* Make sure the page takes full height if it's inside a flex container */
}

/* Ensure the content area below the new header can scroll if needed */
.px-4.pb-4 {
  flex-grow: 1;
  overflow-y: auto; /* Allow content to scroll */
}

.works-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); 
    gap: 20px;
}

.work-card-wrapper {
    /* If specific wrapper styles are needed, add them here */
    /* For now, it primarily serves as a structural element like in InspirationMarketPage */
}
</style> 