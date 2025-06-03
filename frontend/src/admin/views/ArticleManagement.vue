<template>
  <div>
    <!-- Header: Back button and Title -->
    <div class="flex justify-between items-center mb-4">
        <a-page-header :title="`管理列表: ${pageTitle || pageId}`" @back="goBack" class="!pb-0 !ml-[-24px]">
             <template #subtitle>
                <span class="text-gray-500">集合页面 ID: {{ pageId }}</span>
            </template>
        </a-page-header>
       <a-space>
         <!-- Search Input -->
         <a-input-search 
             v-model="searchTerm" 
             placeholder="搜索文章标题" 
             allow-clear
             style="width: 200px;"
             :disabled="!pageId" 
          />
         <!-- Status Filter -->
         <a-select v-model="selectedStatus" placeholder="按状态筛选" allow-clear style="width: 150px;" :disabled="!pageId">
           <a-option value="published">已发布</a-option>
           <a-option value="draft">草稿</a-option>
         </a-select>
         <!-- Action Buttons -->
        <a-button type="primary" @click="openCreateModal" :disabled="!pageId">
             <template #icon><icon-plus /></template> 添加文章
        </a-button>
        <a-button @click="refreshArticles" :loading="isLoading" :disabled="!pageId">
          <template #icon><icon-refresh /></template> 刷新
        </a-button>
      </a-space>
    </div>

    <!-- Article Table -->
    <a-spin :loading="isLoading" tip="加载文章列表中..." class="w-full">
       <a-table
        :data="filteredArticles"
        :pagination="pagination" 
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        row-key="_id"
        stripe
        :scroll="{ x: 'max-content' }" 
      >
        <template #columns>
          <a-table-column title="ID" data-index="_id" :width="180">
            <template #cell="{ record }">
              {{ record._id }}
            </template>
          </a-table-column>
           <a-table-column title="标题" data-index="title" :sortable="{ sortDirections: ['ascend', 'descend'] }" :width="300"></a-table-column>
           <a-table-column title="Slug" data-index="slug" :sortable="{ sortDirections: ['ascend', 'descend'] }" :width="200">
            <template #cell="{ record }">
                 <a-link :href="`/articles/${record.slug}`" target="_blank" title="查看页面">
                    {{ record.slug }} <icon-launch />
                 </a-link>
             </template>
           </a-table-column>
           <a-table-column title="作者" data-index="author" :width="120" :sortable="{ sortDirections: ['ascend', 'descend'] }"></a-table-column>
            <a-table-column title="状态" data-index="status" :width="100" :sortable="{ sortDirections: ['ascend', 'descend'] }">
              <template #cell="{ record }">
                <a-tag :color="record.status === 'active' ? 'green' : 'orange'">
                  {{ record.status === 'active' ? '已发布' : '草稿' }}
                </a-tag>
              </template>
           </a-table-column>
           <a-table-column title="发布日期" data-index="publishDate" :width="200" :sortable="{ sortDirections: ['ascend', 'descend'] }">
             <template #cell="{ record }">
                {{ record.publishDate ? formatDateCN(record.publishDate) : '-' }}
             </template>
           </a-table-column>
            <a-table-column title="创建时间" data-index="createdAt" :width="200" :sortable="{ sortDirections: ['ascend', 'descend'] }">
             <template #cell="{ record }">
                {{ formatDateCN(record.createdAt) }}
             </template>
           </a-table-column>
           <a-table-column title="操作" :width="150" fixed="right">
             <template #cell="{ record }">
                <a-button type="text" status="warning" size="mini" @click="editArticle(record)">编辑</a-button>
                <a-button type="text" status="danger" size="mini" @click="confirmDeleteArticle(record)">删除</a-button>
             </template>
           </a-table-column>
        </template>
      </a-table>
    </a-spin>

    <!-- Create/Edit Article Modal -->
    <a-modal
      :visible="modalVisible"
      :title="isEditMode ? '编辑文章：' + currentArticle?.title : '创建新文章'"
      @ok="handleSubmit"
      @cancel="handleCancel"
      :ok-text="isEditMode ? '更新文章' : '创建文章'"
      :confirm-loading="isSubmitting"
      unmount-on-close
      width="900px" 
      :body-style="{ 'max-height': '70vh', 'overflow-y': 'auto' }" 
    >
      <a-form ref="articleFormRef" :model="articleForm" layout="vertical">
        <a-form-item field="title" label="文章标题" :rules="[{ required: true, message: '请输入文章标题' }]" validate-trigger="blur">
          <a-input v-model="articleForm.title" placeholder="输入标题" />
        </a-form-item>

        <a-form-item field="slug" label="唯一标识符 (Slug)" :rules="[{ pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: 'Slug只能包含小写字母、数字和连字符(-)' }]" validate-trigger="blur">
          <a-input v-model="articleForm.slug" placeholder="留空则自动生成" />
        </a-form-item>

        <a-form-item field="excerpt" label="文章摘要">
          <a-textarea v-model="articleForm.excerpt" placeholder="输入文章摘要 (可选)" :auto-size="{minRows:2,maxRows:5}"/>
        </a-form-item>

         <a-row :gutter="16">
             <a-col :span="8">
                <a-form-item field="author" label="作者">
                    <a-input v-model="articleForm.author" placeholder="默认为 Admin" />
                </a-form-item>
             </a-col>
             <a-col :span="8">
                <a-form-item field="status" label="状态" :rules="[{ required: true, message: '请选择状态' }]" validate-trigger="change">
                    <a-select v-model="articleForm.status" placeholder="选择状态">
                        <a-option value="published">Published (发布)</a-option>
                        <a-option value="draft">Draft (草稿)</a-option>
                    </a-select>
                </a-form-item>
            </a-col>
             <a-col :span="8">
                <a-form-item field="publishDate" label="发布日期 (可选)">
                    <a-date-picker v-model="articleForm.publishDate" show-time format="YYYY-MM-DD HH:mm" style="width: 100%;" />
                 </a-form-item>
            </a-col>
        </a-row>
        <a-form-item field="content" label="文章内容" :rules="[{ required: true, message: '请输入文章内容' }]" validate-trigger="blur">
           <div>
               <QuillEditor 
                    v-model:content="articleForm.content"
                    contentType="html" 
                    theme="snow" 
                    :options="editorOptions"
                    style="height: 500px;" 
                />
            </div>
        </a-form-item>
      </a-form>
    </a-modal>

  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import {
    Message, Modal, Table as ATable, TableColumn as ATableColumn, Spin as ASpin, Tag as ATag,
    Button as AButton, Space as ASpace, Form as AForm, FormItem as AFormItem, Input as AInput, Textarea as ATextarea,
    Select as ASelect, Option as AOption, Row as ARow, Col as ACol, PageHeader as APageHeader,
    DatePicker as ADatePicker, InputSearch as AInputSearch
} from '@arco-design/web-vue';
import { IconRefresh, IconPlus, IconLaunch } from '@arco-design/web-vue/es/icon';
import { debounce } from 'lodash-es';
import apiService from '@/admin/services/apiService';
import { formatDateCN } from '@/admin/utils/date';

// Get pageId from route props
const props = defineProps({
  pageId: {
    type: String,
    required: true
  }
});

const router = useRouter();
const route = useRoute();

const articles = ref([]);
const isLoading = ref(false);
const pageTitle = ref(''); // To store parent page title

// Modal State
const modalVisible = ref(false);
const isEditMode = ref(false);
const currentArticle = ref(null);
const articleFormRef = ref(null);
const articleForm = ref({});
const isSubmitting = ref(false);

// Filters state
const searchTerm = ref('');
const selectedStatus = ref(undefined); // Filter state for status

// Page Selection
const selectedPageId = ref(null);
const collectionPages = ref([]);
const isPagesLoading = ref(false);

const pagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [10, 15, 20, 50, 100],
});

// Quill Editor options (can share or redefine)
const editorOptions = {
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ 'header': 1 }, { 'header': 2 }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'direction': 'rtl' }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'font': [] }],
      [{ 'align': [] }],
      ['clean'],
      ['link', 'image', 'video']
    ]
  },
  placeholder: '在此输入文章内容...',
  theme: 'snow'
};

// Helper to get initial form values
const getInitialArticleForm = () => ({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    author: '', 
    status: 'draft', // Default to draft
    publishDate: new Date() // Default to current date and time
});

// Fetch parent page title (optional but nice)
const fetchPageTitle = async () => {
    if (!props.pageId) return;
    try {
        const response = await apiService.get(`/pages/${props.pageId}`);
        pageTitle.value = response.data.name || '未知页面';
    } catch (error) {
        console.error('Error fetching page title:', error);
        pageTitle.value = '加载页面标题失败'; // Keep a fallback
    }
};

// Fetch Collection Pages
const fetchCollectionPages = async () => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) return;
    try {
        const response = await fetch('/api/pages', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (response.ok) {
            const data = await response.json();
            collectionPages.value = data;
        } else {
            console.error('Failed to fetch collection pages');
        }
    } catch (error) {
        console.error('Error fetching collection pages:', error);
    }
};

// Fetch articles for the current page
const fetchArticles = async () => {
  if (!props.pageId) {
    articles.value = [];
    pagination.total = 0;
    isLoading.value = false;
    return;
  }
  isLoading.value = true;
  try {
    const params = {
      page: pagination.current,
      limit: pagination.pageSize,
      // query: searchTerm.value || undefined, // If backend supports generic search for articles
      // status: selectedStatus.value || undefined,
    };
    const response = await apiService.get(`/pages/${props.pageId}/articles`, { params });
    if (response.data && response.data.data) { // Assuming paginated response
      articles.value = response.data.data;
      pagination.total = response.data.totalRecords;
    } else {
      articles.value = response.data || []; // Fallback for non-paginated
      pagination.total = response.data?.length || 0;
    }
  } catch (error) {
    Message.error(`获取文章列表失败: ${error.response?.data?.message || error.message}`);
    articles.value = [];
    pagination.total = 0;
  } finally {
    isLoading.value = false;
  }
};

// Filtered articles based on search term AND status filter (for the current page)
const filteredArticles = computed(() => {
  return articles.value.filter(article => {
    const term = searchTerm.value.toLowerCase().trim();
    const statusFilter = selectedStatus.value;

    const matchesSearch = !term || article.title.toLowerCase().includes(term);
    
    // --- Revision: Map frontend filter value to backend status value for matching ---
    let matchesStatus = true; // Default to true if no filter is applied
    if (statusFilter && statusFilter !== '') { // Check if a filter is actually selected
        if (statusFilter === 'published') {
            matchesStatus = article.status === 'active';
        } else if (statusFilter === 'draft') {
            matchesStatus = article.status === 'disabled';
        } else {
            // This case should ideally not be reached if select options are fixed
            matchesStatus = article.status === statusFilter; 
        }
    }
    // --- End Revision ---
    
    return matchesSearch && matchesStatus;
  });
});

// Refresh articles and clear search/filters
const refreshArticles = () => {
  if (!props.pageId) return;
  searchTerm.value = '';
  selectedStatus.value = undefined;
  pagination.current = 1; // Reset to first page
  fetchArticles();
};

const handlePageChange = (page) => {
  pagination.current = page;
  fetchArticles();
};

const handlePageSizeChange = (pageSize) => {
  pagination.pageSize = pageSize;
  pagination.current = 1; // Reset to first page
  fetchArticles();
};

// Watcher for pageId prop changes (if the component might be reused without unmounting)
watch(() => props.pageId, (newPageId, oldPageId) => {
  if (newPageId && newPageId !== oldPageId) {
    searchTerm.value = ''; // Clear search when page changes
    selectedStatus.value = undefined; // Clear status filter when page changes
    pageTitle.value = ''; // Reset title
    fetchPageTitle();
    fetchArticles();
  } else if (!newPageId) {
    articles.value = []; // Clear articles if pageId becomes null/undefined
    pageTitle.value = '';
  }
});

// --- Modal Logic ---
const openCreateModal = () => {
    // Ensure we use props.pageId when creating
    if (!props.pageId) {
        Message.warning('无法确定当前页面，无法创建文章。');
        return;
    }
    articleForm.value = getInitialArticleForm();
    isEditMode.value = false;
    currentArticle.value = null;
    modalVisible.value = true;
    articleFormRef.value?.clearValidate();
};

const editArticle = (article) => {
    currentArticle.value = article;
    articleForm.value = {
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        content: article.content,
        author: article.author,
        status: article.status === 'active' ? 'published' : 'draft',
        publishDate: article.publishDate ? new Date(article.publishDate) : null
    };
    isEditMode.value = true;
    modalVisible.value = true;
    articleFormRef.value?.clearValidate();
};

const handleCancel = () => {
    modalVisible.value = false;
};

const handleSubmit = async () => {
    const isValid = await articleFormRef.value?.validate();
    if (isValid) { // If validation fails (returns an error object)
        const firstErrorField = Object.keys(isValid)[0];
        if (firstErrorField && isValid[firstErrorField][0] && isValid[firstErrorField][0].message) {
             Message.error(`表单验证失败: ${isValid[firstErrorField][0].message}`);
        }
        if(firstErrorField) articleFormRef.value?.scrollToField(firstErrorField); 
        return false;
    }

    isSubmitting.value = true;
    let payload = { 
        ...articleForm.value,
        page: props.pageId // Ensure pageId is included
    };

    // If slug is empty, backend should generate it, so send undefined or remove it.
    if (payload.slug === '') {
        delete payload.slug; // Or set to undefined, depending on backend handling
    }

    // Remove _id from payload for creation
    if (!isEditMode.value) {
        delete payload._id;
    }

    try {
        let response;
        if (isEditMode.value && currentArticle.value?._id) {
            response = await apiService.put(`/articles/${currentArticle.value._id}`, payload);
        } else {
            response = await apiService.post('/articles', payload);
        }

        Message.success(`文章 ${isEditMode.value ? '更新' : '创建'}成功`);
        modalVisible.value = false;
        await fetchArticles();
    } catch (error) {
        console.error('Error submitting article:', error);
        // Specific error handling for 409 (e.g. duplicate slug)
        if (error.response && error.response.status === 409) {
            Message.error(`操作失败: ${error.response.data.message || '文章标识符(slug)可能已存在'}`);
        } else if (error.response && error.response.status === 400 && error.response.data.errors) {
            const errorMessages = error.response.data.errors.map(e => e.msg).join('; ');
            Message.error(`表单验证失败: ${errorMessages}`);
        } else if (!error.response) {
            Message.error('操作失败，请检查网络连接。');
        } else {
            Message.error(error.response?.data?.message || error.message || '提交文章时发生未知错误');
        }
        return false; // Keep modal open if API call fails
    } finally {
        isSubmitting.value = false;
    }
};

// --- Delete Article Logic ---
const confirmDeleteArticle = (article) => {
    Modal.confirm({
        title: '确认删除',
        content: `确定要删除文章 " ${article.title} " 吗？此操作不可撤销。`,
        okText: '确认删除',
        cancelText: '取消',
        onOk: async () => {
            try {
                await apiService.delete(`/articles/${article._id}`);
                Message.success(`文章 " ${article.title} " 删除成功`);
                    await fetchArticles();
                } catch (error) {
                    console.error('Error deleting article:', error);
                if (!error.response) {
                    Message.error('删除文章失败，请检查网络。');
                }
            }
        }
    });
};

// --- Navigation ---
const goBack = () => {
    router.push({ name: 'PageManagement' }); // Go back to the pages list
};

onMounted(() => {
  // Fetch data based on initial props.pageId
  if (props.pageId) {
      fetchPageTitle(); 
      fetchArticles(); 
  } else {
      console.warn('ArticleManagement mounted without a pageId prop.');
      // Optionally redirect or show an error message
  }
});
</script>

<style scoped>
/* Add specific styles if needed */
.arco-table-cell .arco-btn-text {
  padding-left: 2px;
  padding-right: 2px;
}
.arco-page-header {
    padding-left: 0; /* Adjust header padding */
    padding-right: 0;
    padding-top: 0;
}
/* Ensure Quill editor has proper height */
:deep(.ql-editor) {
    min-height: 450px; /* Adjust height as needed */
}
</style> 