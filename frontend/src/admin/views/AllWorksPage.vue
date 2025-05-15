<template>
  <div class="all-works-page p-4">
    <div class="flex flex-wrap justify-between items-center gap-4 mb-4">
      <h2 class="text-xl font-semibold whitespace-nowrap">所有作品</h2>
      <a-space wrap class="flex-grow justify-end">
        <a-input-search 
          placeholder="搜索标题/提示词"
          style="width: 200px;" 
          v-model="searchTerm" 
          @search="onFilterChange" 
          @clear="onFilterChange" 
          allow-clear 
        />
        <a-select 
          v-model="selectedType" 
          placeholder="类型"
          allow-clear
          style="width: 120px;"
          @change="onFilterChange"
        >
          <a-option value="image">图片</a-option>
          <a-option value="video">视频</a-option>
          <a-option value="audio">音频</a-option>
          <a-option value="model">3D模型</a-option>
        </a-select>
        <a-select 
          v-model="selectedFilterTags" 
          placeholder="筛选标签"
          multiple
          allow-clear
          style="width: 200px;"
          @change="onFilterChange"
          :loading="tagsLoading"
          :options="predefinedTagsOptionsForFilter"
        >
        </a-select>
        <a-select 
          v-model="selectedCreatorId" 
          placeholder="创作者"
          allow-clear
          show-search
          :filter-option="(inputValue, option) => option.children[0].children.toLowerCase().includes(inputValue.toLowerCase())"
          style="width: 150px;"
          @change="onFilterChange"
          :loading="creatorsLoading"
        >
          <a-option v-for="creator in creatorsList" :key="creator._id" :value="creator._id">
            {{ creator.username }}
          </a-option>
        </a-select>
        <a-range-picker 
          v-model="dateRange" 
          style="width: 240px;" 
          @change="onFilterChange"
        />
        <a-select 
          v-model="selectedStatus" 
          placeholder="状态"
          allow-clear
          style="width: 120px;"
          @change="onFilterChange"
        >
          <a-option value="private">私有</a-option>
          <a-option value="public_market">公开</a-option>
        </a-select>
        <a-button type="primary" @click="showCreateWorkModal = true">
          <template #icon><icon-plus /></template> 添加作品
        </a-button>
        <a-button @click="refreshWorksAndFilters" :loading="worksLoading">
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
        <a-form-item field="title" label="标题" :rules="[{required: true, message: '请输入作品标题'}]">
          <a-input v-model="workForm.title" placeholder="请输入作品标题" />
        </a-form-item>
        <a-form-item field="type" label="类型" :rules="[{required: true, message: '请选择作品类型'}]">
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
        <a-form-item field="tags" label="标签">
          <a-select
            v-model="workForm.tags"
            :options="predefinedTagsOptionsForForm"
            placeholder="选择或输入标签后按回车创建"
            multiple
            allow-create
            allow-clear
            @change="handleWorkFormTagsChange" 
          />
        </a-form-item>
        <a-form-item field="status" label="展示状态" tooltip="私有作品不展示在市场上">
            <a-radio-group v-model="workForm.status">
                <a-radio value="private">私有</a-radio>
                <a-radio value="public_market">公开</a-radio>
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
import { ref, onMounted, reactive, watch, computed } from 'vue';
import { 
    InputSearch as AInputSearch, Spin as ASpin, Empty as AEmpty, 
    Pagination as APagination, Message, Modal, Form as AForm, FormItem as AFormItem,
    Input as AInput, Textarea as ATextarea, Select as ASelect, Option as AOption, Button as AButton,
    Upload as AUpload, Space as ASpace, RangePicker as ARangePicker,
    RadioGroup as ARadioGroup, Radio as ARadio, Checkbox as ACheckbox,
    InputTag as AInputTag
} from '@arco-design/web-vue';
import { IconPlus, IconUpload, IconRefresh } from '@arco-design/web-vue/es/icon';
import WorkCard from '../components/WorkCard.vue';
import WorkDetailModal from '../components/WorkDetailModal.vue';
import apiService from '../services/apiService';
import { debounce } from 'lodash-es';

const works = ref([]);
const worksLoading = ref(false);
const searchTerm = ref('');

// Filter states
const selectedType = ref('');
const selectedFilterTags = ref([]);
const selectedCreatorId = ref('');
const dateRange = ref([]);
const selectedStatus = ref('');

const creatorsList = ref([]);
const creatorsLoading = ref(false);
const predefinedTagsList = ref([]);
const tagsLoading = ref(false);

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
  tags: [],
  status: 'private',
  workFile: null, 
  fileList: [],
  sourceUrl: null, 
  replaceFile: false,
});
const editWorkId = ref(null);

const fetchCreators = async () => {
  creatorsLoading.value = true;
  try {
    const response = await apiService.get('/users');
    creatorsList.value = response.data.map(user => ({ _id: user._id, username: user.username }));
  } catch (error) {
    Message.error('获取创作者列表失败: ' + (error.response?.data?.message || error.message));
  } finally {
    creatorsLoading.value = false;
  }
};

const fetchTags = async () => {
  tagsLoading.value = true;
  try {
    const response = await apiService.get('/tags');
    predefinedTagsList.value = response.data;
  } catch (error) {
    Message.error('获取标签列表失败: ' + (error.response?.data?.message || error.message));
  } finally {
    tagsLoading.value = false;
  }
};

const fetchWorks = async () => {
  worksLoading.value = true;
  try {
    const params = {
      page: pagination.current,
      limit: pagination.pageSize,
      search: searchTerm.value || undefined,
      type: selectedType.value || undefined,
      tags: selectedFilterTags.value && selectedFilterTags.value.length > 0 ? selectedFilterTags.value.join(',') : undefined,
      creator: selectedCreatorId.value || undefined,
      status: selectedStatus.value || undefined,
      startDate: dateRange.value?.[0] ? new Date(dateRange.value[0]).toISOString() : undefined,
      endDate: dateRange.value?.[1] ? new Date(dateRange.value[1]).toISOString() : undefined,
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
  fetchCreators();
  fetchTags();
});

const onFilterChange = () => {
  pagination.current = 1;
  fetchWorks();
};

const debouncedFilterChange = debounce(onFilterChange, 500);

watch([searchTerm, selectedType, selectedFilterTags, selectedCreatorId, dateRange, selectedStatus], onFilterChange, { deep: true });

const refreshWorksAndFilters = () => {
  searchTerm.value = '';
  selectedType.value = '';
  selectedFilterTags.value = [];
  selectedCreatorId.value = '';
  dateRange.value = [];
  selectedStatus.value = '';
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
  // Ensure workForm.tags is an array of strings for a-select multiple
  workForm.tags = work.tags ? [...work.tags] : []; 
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
                fetchWorks();
                fetchTags();
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
  workForm.tags = [];
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

// Handler for a-input-tag changes in the form if needed, e.g., to normalize input
const handleWorkFormTagsChange = (currentTags) => {
  // Optional: normalize tags, e.g., to lowercase, trim spaces, if not handled by component
  // workForm.tags = currentTags.map(tag => typeof tag === 'string' ? tag.trim().toLowerCase() : tag);
  // a-input-tag with unique-value and allow-create usually handles this well.
};

const handleSaveWork = async () => {
  const formValidationResult = await workFormRef.value?.validate();
  if (formValidationResult) { 
    const firstErrorKey = Object.keys(formValidationResult)[0];
    const firstErrorMessage = formValidationResult[firstErrorKey]?.[0]?.message;
    Message.error(firstErrorMessage || '请修正表单错误');
    return;
  }

  // Normalize and ensure all tags in workForm.tags are registered in the backend
  const currentWorkTags = [...new Set(workForm.tags.map(tag => 
    (typeof tag === 'string' ? tag.trim().toLowerCase() : String(tag.value || tag.label || tag).trim().toLowerCase())
  ).filter(t => t))];
  
  workForm.tags = currentWorkTags; // Update form with normalized tags

  if (currentWorkTags.length > 0) {
    try {
      // Check which tags are new
      const existingTagNames = predefinedTagsList.value.map(t => t.name.toLowerCase());
      const newTagNamesToCreate = currentWorkTags.filter(tName => !existingTagNames.includes(tName));

      if (newTagNamesToCreate.length > 0) {
        const creationPromises = newTagNamesToCreate.map(tagName => 
          apiService.post('/tags', { name: tagName })
        );
        const creationResults = await Promise.allSettled(creationPromises);
        
        let allNewTagsRegistered = true;
        creationResults.forEach(result => {
          if (result.status === 'rejected') {
            allNewTagsRegistered = false;
            console.error('Failed to create tag:', result.reason);
            Message.error(`注册标签 "${result.reason?.config?.data ? JSON.parse(result.reason.config.data).name : '某个'}" 失败: ${result.reason?.response?.data?.message || result.reason?.message}`);
          } else if (result.value.status === 200) { // Tag already existed
             // Optionally update predefinedTagsList if it doesn't contain this tag (e.g. due to race condition or cache)
             if (!predefinedTagsList.value.find(t => t.name === result.value.data.tag.name)) {
                predefinedTagsList.value.push(result.value.data.tag);
             }
          } else if (result.value.status === 201) { // New tag created
            predefinedTagsList.value.push(result.value.data); // Add newly created tag to our list
          }
        });

        if (!allNewTagsRegistered) {
          Message.warning('部分新标签未能成功注册，请检查或稍后重试。');
          // Decide if you want to proceed with saving the work or not
          // For now, we will proceed with successfully registered/existing tags.
        }
      }
    } catch (tagError) {
      Message.error('处理标签时出错: ' + tagError.message);
      // Decide if you want to stop work submission
      // return; 
    }
  }

  const formData = new FormData();
  formData.append('title', workForm.title || '');
  formData.append('type', workForm.type);
  formData.append('prompt', workForm.prompt || '');
  
  // Backend expects tags as a JSON string array of tag names
  formData.append('tags', JSON.stringify(workForm.tags)); 
  
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
    fetchTags();
  } catch (error) {
    Message.error('保存作品失败: ' + (error.response?.data?.message || error.message));
    console.error('Error saving work:', error);
  } finally {
    worksLoading.value = false;
  }
};

// Computed property for <a-select> filter options
const predefinedTagsOptionsForFilter = computed(() => 
  predefinedTagsList.value.map(tag => ({ label: tag.name, value: tag.name }))
);

// Computed property for <a-input-tag> options in the form
const predefinedTagsOptionsForForm = computed(() => 
  predefinedTagsList.value.map(tag => ({ label: tag.name, value: tag.name }))
);

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