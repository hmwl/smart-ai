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
         <!-- Status Filter -->
         <a-select v-model="selectedStatus" placeholder="按状态筛选" allow-clear style="width: 150px;" :disabled="!pageId">
           <a-option value="published">已发布</a-option>
           <a-option value="draft">草稿</a-option>
         </a-select>
         <!-- Search Input -->
         <a-input-search 
             v-model="searchTerm" 
             placeholder="搜索文章标题" 
             allow-clear
             style="width: 200px;"
             :disabled="!pageId" 
          />
         <!-- Action Buttons -->
        <a-button type="primary" @click="openCreateModal" :disabled="!pageId">
             <template #icon><icon-plus /></template> 创建文章
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
        :pagination="{ pageSize: 15 }" 
        row-key="_id"
        stripe
        :scroll="{ x: 1200 }" 
      >
        <template #columns>
          <a-table-column title="ID" data-index="_id" :width="180">
            <template #cell="{ record }">
              {{ record._id }}
            </template>
          </a-table-column>
           <a-table-column title="标题" data-index="title" :sortable="{ sortDirections: ['ascend', 'descend'] }" :width="300"></a-table-column>
           <a-table-column title="Slug" data-index="slug" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
                 <a :href="`/articles/${record.slug}`" target="_blank" title="查看页面">
                    {{ record.slug }} <icon-launch />
                 </a>
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
           <a-table-column title="发布日期" data-index="publishDate" :width="180" :sortable="{ sortDirections: ['ascend', 'descend'] }">
             <template #cell="{ record }">
                {{ record.publishDate ? formatDate(record.publishDate) : '-' }}
             </template>
           </a-table-column>
            <a-table-column title="创建时间" data-index="createdAt" :width="180" :sortable="{ sortDirections: ['ascend', 'descend'] }">
             <template #cell="{ record }">
                {{ formatDate(record.createdAt) }}
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
      v-model:visible="modalVisible"
      :title="isEditMode ? `编辑文章: ${currentArticle?.title}` : '创建新文章'"
      @ok="handleSubmit"
      @cancel="handleCancel"
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
import { ref, onMounted, computed, watch } from 'vue';
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

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Fetch parent page title (optional but nice)
const fetchPageTitle = async () => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) return; // Skip if no token
    try {
        const response = await fetch(`/api/pages/${props.pageId}`, {
             headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (response.ok) {
            const data = await response.json();
            pageTitle.value = data.name || '未知页面';
        } else {
             console.error('Failed to fetch page title');
        }
    } catch (error) {
        console.error('Error fetching page title:', error);
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

// Fetch articles for the selected page (using props.pageId)
const fetchArticles = async () => {
  if (!props.pageId) return; // Don't fetch if pageId isn't available
  isLoading.value = true;
  const accessToken = localStorage.getItem('accessToken');
  // Basic auth check
  const userInfoString = localStorage.getItem('userInfo');
  let isAdmin = false;
   if (userInfoString) {
      try { isAdmin = JSON.parse(userInfoString).isAdmin; } catch (e) { /* ignore */ }
  }
  if (!accessToken || !isAdmin) {
      Message.error('未授权或非管理员。');
      isLoading.value = false;
      localStorage.clear(); window.location.reload(); // Or redirect to login
      return;
  }

  try {
    const response = await fetch(`/api/articles?pageId=${props.pageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: '无法解析错误信息' }));
      if (response.status === 401 || response.status === 403) {
        Message.error(`认证失败或无权限 (${response.status})。`);
        localStorage.clear(); window.location.reload();
      } else {
        throw new Error(`获取文章列表失败: ${response.status} - ${errorData.message || '未知错误'}`);
      }
      return;
    }
    const data = await response.json();
    articles.value = data;
  } catch (error) {
    console.error('Error fetching articles:', error);
    Message.error(error.message || '加载文章列表时出错');
    articles.value = [];
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

// Refresh articles for current page and clear search/filter
const refreshArticles = () => {
    if (!props.pageId) return;
    searchTerm.value = '';
    selectedStatus.value = undefined;
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
    const validationResult = await articleFormRef.value?.validate();
    if (validationResult) return false;

    isSubmitting.value = true;
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
        Message.error('认证令牌丢失');
        isSubmitting.value = false;
        localStorage.clear(); window.location.reload();
        return false;
    }

    let url = '/api/articles';
    let method = 'POST';
    // Add pageId for creation
    const payload = {
        ...articleForm.value,
        ...( !isEditMode.value && { page: props.pageId } ) 
    };

    // --- Revision: Map frontend status to backend status ---
    if (payload.status === 'published') {
        payload.status = 'active';
    } else if (payload.status === 'draft') {
        payload.status = 'disabled';
    } else {
        // Fallback or error if status is unexpected, though select should prevent this
        payload.status = 'disabled'; // Default to disabled if somehow invalid
    }
    // --- End Revision ---

    // Ensure publishDate is formatted correctly or null
    if (payload.publishDate) {
        // Try converting the string/object from date picker to a Date object
        const date = new Date(payload.publishDate);
        // Check if the conversion resulted in a valid date
        if (!isNaN(date.getTime())) {
            payload.publishDate = date.toISOString();
        } else {
            // If the string from picker was invalid, set to null
            console.warn('Invalid date value received from date picker:', payload.publishDate);
            payload.publishDate = null;
        }
    } else {
        payload.publishDate = null; // Ensure it's null if empty
    }

    if (isEditMode.value) {
        url = `/api/articles/${currentArticle.value._id}`;
        method = 'PUT';
    }

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '无法解析错误信息' }));
            let errorMessage = `${isEditMode.value ? '更新' : '创建'}文章失败: ${response.status}`;
            if (errorData.message) errorMessage += ` - ${errorData.message.replace('创建文章验证失败: ','').replace('更新文章验证失败: ','')}`;
            if (response.status === 401 || response.status === 403) errorMessage = `无权限 (${response.status})。`;
            // Handle 409 conflict if title uniqueness is enforced later
            throw new Error(errorMessage);
        }
        Message.success(`文章 ${isEditMode.value ? '更新' : '创建'}成功！`);
        await fetchArticles();
        modalVisible.value = false;
        return true;
    } catch (error) {
        console.error(`Error ${isEditMode.value ? 'updating' : 'creating'} article:`, error);
        Message.error(error.message || `处理文章时发生错误`);
        return false;
    } finally {
        isSubmitting.value = false;
    }
};

// --- Delete Article Logic ---
const confirmDeleteArticle = (article) => {
    Modal.confirm({
        title: '确认删除',
        content: `您确定要删除文章 "${article.title}" 吗？`, // Simpler message
        okText: '确认删除',
        cancelText: '取消',
        okButtonProps: { status: 'danger' },
        onOk: async () => {
           return new Promise(async (resolve, reject) => {
                const accessToken = localStorage.getItem('accessToken');
                if (!accessToken) { Message.error('认证令牌丢失'); reject(new Error('No token')); return; }
                try {
                    const response = await fetch(`/api/articles/${article._id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    if (!response.ok) {
                       const errorData = await response.json().catch(() => ({ message: '无法解析错误信息' }));
                       let errorMessage = `删除文章失败: ${response.status}`;
                       if (errorData.message) errorMessage += ` - ${errorData.message}`;
                       if (response.status === 401 || response.status === 403) errorMessage = `无权限 (${response.status})。`;
                       throw new Error(errorMessage);
                    }
                    Message.success(`文章 "${article.title}" 已删除。`);
                    await fetchArticles();
                    resolve(true);
                } catch (error) {
                    console.error('Error deleting article:', error);
                    Message.error(error.message || '删除文章时发生错误');
                    reject(error);
                }
           });
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