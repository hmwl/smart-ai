<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">官网页面管理</h2>
       <a-space>
        <a-input-search 
            v-model="searchTerm" 
            placeholder="搜索页面 (名称或路径)" 
            allow-clear
            style="width: 250px;"
         />
         <a-select v-model="selectedType" placeholder="按类型筛选" allow-clear style="width: 150px;">
          <a-option value="single">单页</a-option>
          <a-option value="collection">集合</a-option>
        </a-select>
        <a-select v-model="selectedStatus" placeholder="按状态筛选" allow-clear style="width: 150px;">
          <a-option value="active">已发布</a-option>
          <a-option value="disabled">禁用</a-option>
        </a-select>
        <a-button type="primary" @click="openCreateModal">
             <template #icon><icon-plus /></template> 创建页面
        </a-button>
        <a-button @click="refreshPages" :loading="isLoading">
          <template #icon><icon-refresh /></template> 刷新
        </a-button>
      </a-space>
    </div>

    <a-spin :loading="isLoading" tip="加载页面列表中..." class="w-full">
       <a-table
        :data="filteredPages"
        :pagination="{ pageSize: 15 }"
        row-key="_id"
        stripe
        :scroll="{ x: 1300 }" 
      >
        <template #columns>
           <a-table-column title="ID" data-index="_id" :width="220" fixed="left">
               <template #cell="{ record }">
                   {{ record._id }}
               </template>
           </a-table-column>
           <a-table-column title="标题" data-index="name" :width="200" :sortable="{ sortDirections: ['ascend', 'descend'] }" ellipsis tooltip></a-table-column>
           <a-table-column title="类型" data-index="type" :width="100" :sortable="{ sortDirections: ['ascend', 'descend'] }">
                <template #cell="{ record }">
                    <a-tag :color="record.type === 'single' ? 'arcoblue' : 'purple'">
                        {{ { single: '单页', collection: '集合' }[record.type] || record.type }}
                    </a-tag>
                </template>
           </a-table-column>
            <a-table-column title="路由/链接" data-index="route" :width="250" :sortable="{ sortDirections: ['ascend', 'descend'] }" ellipsis tooltip>
                 <template #cell="{ record }">
                    <a :href="record.route" target="_blank" class="text-blue-600 hover:underline">{{ record.route }} <icon-launch /></a>
                 </template>
           </a-table-column>
            <a-table-column title="模板" :width="180" ellipsis tooltip>
              <template #cell="{ record }">
                <span v-if="record.type === 'single' && record.templateSingle">{{ record.templateSingle.name }}</span>
                <span v-else-if="record.type === 'collection' && record.templateList">{{ record.templateList.name }}</span>
                <span v-else class="text-gray-400">--</span>
              </template>
            </a-table-column>
            <a-table-column title="状态" data-index="status" :width="100" :sortable="{ sortDirections: ['ascend', 'descend'] }">
              <template #cell="{ record }">
                <a-tag :color="record.status === 'active' ? 'green' : 'red'">
                    {{ record.status === 'active' ? '已发布' : '禁用' }}
                </a-tag>
              </template>
           </a-table-column>
           <a-table-column title="创建时间" data-index="createdAt" :width="180" :sortable="{ sortDirections: ['ascend', 'descend'] }">
             <template #cell="{ record }">
                {{ formatDate(record.createdAt) }}
             </template>
           </a-table-column>
           <a-table-column title="操作" :width="180" fixed="right">
             <template #cell="{ record }">
                <a-button v-if="record.type === 'collection'" type="text" status="success" size="mini" @click="manageList(record)">列表</a-button>
                <a-button type="text" status="warning" size="mini" @click="editPage(record)">编辑</a-button>
                
                <a-tooltip 
                  v-if="record.type === 'collection' && record.articleCount > 0" 
                  :content="`该集合页面包含 ${record.articleCount} 篇文章，无法直接删除。请先清空文章。`"
                >
                  <a-button type="text" status="danger" size="mini" disabled>删除</a-button>
                </a-tooltip>
                <a-button 
                  v-else 
                  type="text" 
                  status="danger" 
                  size="mini" 
                  @click="confirmDeletePage(record)"
                  :disabled="record.route === '/' || record.route === '/index'"
                >
                  <a-tooltip v-if="record.route === '/' || record.route === '/index'" content="首页不允许删除">
                    删除
                  </a-tooltip>
                  <template v-else>删除</template>
                </a-button>
             </template>
           </a-table-column>
        </template>
      </a-table>
    </a-spin>

    <!-- Create/Edit Page Modal -->
    <a-modal
      v-model:visible="modalVisible"
      :title="isEditMode ? `编辑页面: ${currentPage?.name}` : '创建新页面'"
      @ok="handleSubmit"
      @cancel="handleCancel"
      :confirm-loading="isSubmitting"
      unmount-on-close
      width="800px"
      :body-style="{ 'max-height': '75vh', 'overflow-y': 'auto' }"
    >
      <a-form ref="pageFormRef" :model="pageForm" layout="vertical">
        <a-row :gutter="16">
            <a-col :span="12">
                 <a-form-item field="name" label="页面名称" :rules="[{ required: true, message: '请输入页面名称' }]" validate-trigger="blur">
                    <a-input v-model="pageForm.name" placeholder="例如: 关于我们" />
                </a-form-item>
            </a-col>
            <a-col :span="12">
                 <a-form-item field="type" label="页面类型" :rules="[{ required: true, message: '请选择页面类型' }]" validate-trigger="change">
                    <a-select v-model="pageForm.type" placeholder="选择页面类型" @change="handlePageTypeChange" :disabled="isEditMode">
                        <a-option value="single">单页 (Single Page)</a-option>
                        <a-option value="collection">集合 (Collection)</a-option>
                    </a-select>
                </a-form-item>
            </a-col>
        </a-row>
        
        <a-form-item field="route" label="页面路由" :rules="pageRouteRules" validate-trigger="blur">
             <a-input v-model="pageForm.route" placeholder="例如: /about-us (必须以 / 开头)" />
        </a-form-item>
        
         <a-row :gutter="16">
            <a-col :span="12">
                <a-form-item field="status" label="状态" :rules="[{ required: true, message: '请选择状态' }]" validate-trigger="change">
                    <a-select v-model="pageForm.status" placeholder="选择状态">
                        <a-option value="active">Active (发布/启用)</a-option>
                        <a-option value="disabled">Disabled (草稿/禁用)</a-option>
                    </a-select>
                </a-form-item>
            </a-col>
             <a-col :span="12">
                <!-- Placeholder for potential second column item -->
             </a-col>
        </a-row>

        <a-row :gutter="16">
            <!-- Single Page Template -->
            <a-col :span="24" v-if="pageForm.type === 'single'">
                <a-form-item field="templateSingle" label="页面模板 (单页)" :rules="[{ required: true, message: '请选择单页模板' }]" validate-trigger="change">
                    <a-select v-model="pageForm.templateSingle" placeholder="选择单页模板" :loading="isTemplatesLoading">
                        <a-option v-for="tmpl in availableSingleTemplates" :key="tmpl._id" :value="tmpl._id">{{ tmpl.name }}</a-option>
                        <template #empty v-if="!isTemplatesLoading"><a-empty description="没有找到类型为 '单页' 的可用模板。" /></template>
                    </a-select>
                </a-form-item>
            </a-col>

            <!-- Collection Page Templates -->
            <a-col :span="12" v-if="pageForm.type === 'collection'">
                <a-form-item field="templateList" label="列表模板 (集合)" :rules="[{ required: true, message: '请选择列表模板' }]" validate-trigger="change">
                    <a-select v-model="pageForm.templateList" placeholder="选择列表模板" :loading="isTemplatesLoading">
                        <a-option v-for="tmpl in availableListTemplates" :key="tmpl._id" :value="tmpl._id">{{ tmpl.name }}</a-option>
                        <template #empty v-if="!isTemplatesLoading"><a-empty description="没有找到类型为 '列表' 的可用模板。" /></template>
                    </a-select>
                </a-form-item>
            </a-col>
            <a-col :span="12" v-if="pageForm.type === 'collection'">
                <a-form-item field="templateItem" label="内容模板 (集合项)" :rules="[{ required: true, message: '请选择内容模板' }]" validate-trigger="change">
                    <a-select v-model="pageForm.templateItem" placeholder="选择内容模板" :loading="isTemplatesLoading">
                         <a-option v-for="tmpl in availableItemTemplates" :key="tmpl._id" :value="tmpl._id">{{ tmpl.name }}</a-option>
                        <template #empty v-if="!isTemplatesLoading"><a-empty description="没有找到类型为 '内容' 的可用模板。" /></template>
                    </a-select>
                </a-form-item>
            </a-col>
        </a-row>

        <a-form-item v-if="pageForm.type === 'single'" field="content" label="页面内容 (单页)">
            <div> 
              <QuillEditor theme="snow" v-model:content="pageForm.content" contentType="html" toolbar="full"
                style="min-height: 250px;" />
            </div>
        </a-form-item>
         <a-form-item v-if="pageForm.type === 'collection'" field="content" label="集合描述">
           <a-textarea v-model="pageForm.content" placeholder="输入此集合的描述信息（可选，可在模板中显示）" :auto-size="{ minRows: 3, maxRows: 6 }"/>
        </a-form-item>

      </a-form>
    </a-modal>

  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import {
    Message,
    Modal,
    Table as ATable,
    TableColumn as ATableColumn,
    Spin as ASpin,
    Tag as ATag,
    Button as AButton,
    Space as ASpace,
    Form as AForm,
    FormItem as AFormItem,
    Input as AInput,
    Textarea as ATextarea,
    Select as ASelect,
    Option as AOption,
    Row as ARow,
    Col as ACol,
    Link as ALink,
    Popconfirm as APopconfirm,
    Empty as AEmpty,
    InputSearch as AInputSearch
} from '@arco-design/web-vue';
import { IconRefresh, IconPlus, IconLaunch, IconEdit, IconDelete, IconList, IconEye } from '@arco-design/web-vue/es/icon';
import { debounce } from 'lodash-es';
import apiService from '@/admin/services/apiService';

const router = useRouter();

const pages = ref([]);
const isLoading = ref(false);
const searchTerm = ref('');
const selectedType = ref(undefined);
const selectedStatus = ref(undefined);

// Modal State
const modalVisible = ref(false);
const isEditMode = ref(false);
const currentPage = ref(null);
const pageFormRef = ref(null);
const pageForm = ref({});
const isSubmitting = ref(false);

// Template State
const allTemplates = ref([]);
const isTemplatesLoading = ref(false);

// Define pageRouteRules
const pageRouteRules = computed(() => [
  { required: true, message: '请输入页面路由' },
  {
    pattern: /^\/[a-zA-Z0-9\-\/_]*$/,
    message: '路由必须以 / 开头，且只能包含字母、数字、中划线(-)、下划线(_)和斜杠(/)'
  },
  {
    validator: (value, callback) => {
      const condition1_isNonEmptyAndEndsWithSlash = value && value.endsWith('/');
      const condition2_isNotTheRootPath = value !== '/';
      
      const combinedCondition = condition1_isNonEmptyAndEndsWithSlash && condition2_isNotTheRootPath;

      if (combinedCondition) { 
        callback('路由不能以 / 结尾 (除非它是根路径 "/")');
      } else {
        callback();
      }
    }
  }
]);

// Filtered pages based on search term AND filters
const filteredPages = computed(() => {
  return pages.value.filter(page => {
    const term = searchTerm.value.toLowerCase().trim();
    const typeFilter = selectedType.value;
    const statusFilter = selectedStatus.value;

    const matchesSearch = !term || 
                          page.name.toLowerCase().includes(term) ||
                          page.route.toLowerCase().includes(term);

    // Treat undefined AND empty string as "no filter"
    const matchesType = typeFilter === undefined || typeFilter === '' || page.type === typeFilter;
    const matchesStatus = statusFilter === undefined || statusFilter === '' || page.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });
});

// Fetch all templates
const fetchTemplates = async () => {
  isTemplatesLoading.value = true;
  try {
    const response = await apiService.get('/templates', { params: { type: 'page' } });
    allTemplates.value = response.data;
  } catch (error) {
    console.error('Error fetching templates:', error);
    if (!error.response) {
        Message.error('加载模板列表失败，请检查网络连接。');
    }
    allTemplates.value = [];
  } finally {
    isTemplatesLoading.value = false;
  }
};

// Filtered Templates
const availableSingleTemplates = computed(() => allTemplates.value.filter(tmpl => tmpl.type === 'single'));
const availableListTemplates = computed(() => allTemplates.value.filter(tmpl => tmpl.type === 'list'));
const availableItemTemplates = computed(() => allTemplates.value.filter(tmpl => tmpl.type === 'item'));

// Helper to get initial form values including new fields
const getInitialPageForm = () => ({
    name: '',
    type: 'single',
    route: '',
    status: 'active',
    content: '',
    templateSingle: null,
    templateList: null,
    templateItem: null,
});

// Watch for type changes (Simplified: just clear content if switching)
watch(() => pageForm.value.type, (newType, oldType) => {
    if (!modalVisible.value || !oldType || newType === oldType) return; 

    // Clear content when switching type (optional)
    // pageForm.value.content = '';
    
    // No need to clear externalUrl anymore
    // No need to clear route as it's always present
    
    // Trigger validation update might still be useful if rules change based on type (not currently the case)
    pageFormRef.value?.clearValidate(['content']); 
});

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Fetch pages function
const fetchPages = async () => {
  isLoading.value = true;
  try {
    const response = await apiService.get('/pages');
    pages.value = response.data;
  } catch (error) {
    console.error('Error fetching pages:', error);
    if (!error.response) {
        Message.error('获取页面列表失败，请检查网络连接。');
    }
    pages.value = []; // Clear on error
  } finally {
    isLoading.value = false;
  }
};

// Refresh pages and clear search/filters
const refreshPages = () => {
    searchTerm.value = '';
    selectedType.value = undefined;
    selectedStatus.value = undefined;
    fetchPages();
};

// --- Modal Logic ---

const openCreateModal = () => {
    pageForm.value = getInitialPageForm();
    isEditMode.value = false;
    currentPage.value = null;
    modalVisible.value = true;
    pageFormRef.value?.clearValidate();
};

const editPage = (page) => {
    currentPage.value = page;
    pageForm.value = {
        _id: page._id,
        name: page.name,
        type: page.type,
        route: page.route || '/',
        status: page.status,
        content: page.content || '',
        templateSingle: page.templateSingle?._id || null,
        templateList: page.templateList?._id || null,
        templateItem: page.templateItem?._id || null,
    };
    isEditMode.value = true;
    modalVisible.value = true;
    pageFormRef.value?.clearValidate();
};

const handleCancel = () => {
    modalVisible.value = false;
};

const handleSubmit = async () => {
  const isValid = await pageFormRef.value?.validate();
  if (!isValid) {
    isSubmitting.value = true;
    let payload = { ...pageForm.value };

    // Ensure content is handled correctly (Quill gives HTML string directly if contentType is html)
    // If pageForm.content is a Delta object, convert it: payload.content = JSON.stringify(pageForm.value.content);
    // For single page, content is already string (HTML)
    // For collection, content is a description string

    // Remove _id from payload if it's for creation, not needed by backend then
    if (!isEditMode.value) {
      delete payload._id;
    }

    try {
      let response;
      if (isEditMode.value && currentPage.value?._id) {
        response = await apiService.put(`/pages/${currentPage.value._id}`, payload);
      } else {
        response = await apiService.post('/pages', payload);
      }

      Message.success(`页面 ${isEditMode.value ? '更新' : '创建'}成功`);
      modalVisible.value = false;
      await fetchPages();
    } catch (error) {
      console.error('Error submitting page:', error);
      // apiService interceptor should handle most errors.
      // Add specific handling if needed, e.g., for 409 conflict on route name
        if (error.response && error.response.status === 409) {
            Message.error(`操作失败: ${error.response.data.message || '页面路由可能已存在'}`);
        } else if (error.response && error.response.status === 400 && error.response.data.errors) {
            const errorMessages = error.response.data.errors.map(e => e.msg).join('; ');
            Message.error(`表单验证失败: ${errorMessages}`);
        } else if (!error.response) {
            Message.error('操作失败，请检查网络连接。');
        }
    } finally {
      isSubmitting.value = false;
    }
  }
};

// --- Delete Page Logic ---
const confirmDeletePage = (page) => {
  if (page.route === '/' || page.route === '/index') {
    Message.warning('首页不允许删除。');
    return;
  }
  if (page.type === 'collection' && page.articleCount > 0) {
    Message.warning(`该集合页面包含 ${page.articleCount} 篇文章，无法直接删除。请先清空文章。`);
    return;
  }

  Modal.confirm({
    title: '确认删除',
    content: `确定要删除页面 “${page.name}” (路径: ${page.route}) 吗？此操作不可撤销。`,
    okText: '确认删除',
    cancelText: '取消',
    onOk: async () => {
      try {
        await apiService.delete(`/pages/${page._id}`);
        Message.success(`页面 “${page.name}” 删除成功`);
        await fetchPages();
      } catch (error) {
        console.error('Error deleting page:', error);
        if (!error.response) {
            Message.error('删除失败，请检查网络连接。');
        }
      }
    }
  });
};

// Updated manageList to navigate
const manageList = (page) => {
    router.push({ name: 'ArticleManagement', params: { pageId: page._id } });
};

// Reset template selection when page type changes
const handlePageTypeChange = () => {
    // Reset all template fields when type changes
    pageForm.value.templateSingle = null;
    pageForm.value.templateList = null;
    pageForm.value.templateItem = null;
    // Clear validation for template fields if needed
    pageFormRef.value?.clearValidate(['templateSingle', 'templateList', 'templateItem']);
};

onMounted(() => {
  fetchPages();
  fetchTemplates();
});
</script>

<style scoped>
/* Add specific styles if needed */
.arco-table-cell .arco-btn-text {
  padding-left: 2px;
  padding-right: 2px;
}
.arco-form {
    margin-top: 10px;
}
/* Ensure Quill editor has proper height */
:deep(.ql-editor) {
    min-height: 350px;
}
</style> 