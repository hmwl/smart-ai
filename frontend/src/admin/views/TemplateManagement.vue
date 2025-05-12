<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">模板管理</h2>
       <a-space>
        <a-input-search 
            v-model="searchTerm" 
            placeholder="搜索模板名称" 
            allow-clear
            style="width: 250px;"
         />
         <a-select v-model="selectedType" placeholder="按类型筛选" allow-clear style="width: 150px;">
          <a-option value="single">单页模板</a-option>
          <a-option value="list">列表模板</a-option>
          <a-option value="item">内容模板</a-option>
        </a-select>
        <a-button type="primary" @click="openCreateModal">
             <template #icon><icon-plus /></template> 创建模板
        </a-button>
        <a-button @click="refreshTemplates" :loading="isLoading">
          <template #icon><icon-refresh /></template> 刷新
        </a-button>
      </a-space>
    </div>

    <a-spin :loading="isLoading" tip="加载模板列表中..." class="w-full">
       <a-table :data="filteredTemplates" :pagination="{ pageSize: 10 }" row-key="_id" stripe :scroll="{ x: 1000 }">
        <template #columns>
          <a-table-column title="ID" data-index="_id" :width="180">
            <template #cell="{ record }">
              {{ record._id }}
            </template>
          </a-table-column>
           <a-table-column title="名称" data-index="name" :width="200" :sortable="{ sortDirections: ['ascend', 'descend'] }"></a-table-column>
           <a-table-column title="类型" data-index="type" :width="150">
                <template #cell="{ record }">
                     <a-tag :color="record.type === 'single' ? 'blue' : (record.type === 'list' ? 'green' : 'purple')">
                        {{ { single: '单页模板', list: '列表模板', item: '内容模板' }[record.type] || record.type }}
                     </a-tag>
                 </template>
           </a-table-column>
           <a-table-column title="使用数" data-index="usageCount" :width="90" align="center" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              <a-tag color="purple" v-if="typeof record.usageCount === 'number'">{{ record.usageCount }}</a-tag>
              <span v-else>-</span>
            </template>
          </a-table-column>
           <a-table-column title="创建时间" data-index="createdAt" :width="180" :sortable="{ sortDirections: ['ascend', 'descend'] }">
             <template #cell="{ record }">
                {{ formatDate(record.createdAt) }}
             </template>
           </a-table-column>
           <a-table-column title="操作" :width="150" fixed="right">
             <template #cell="{ record }">
                <a-button type="text" status="warning" size="mini" @click="editTemplate(record)">编辑</a-button>
                <a-tooltip v-if="record.usageCount && record.usageCount > 0" :content="`该模板被 ${record.usageCount} 个页面使用，无法删除`">
                  <a-button type="text" status="danger" size="mini" disabled>删除</a-button>
                </a-tooltip>
                <a-button v-else type="text" status="danger" size="mini" @click="confirmDeleteTemplate(record)">删除</a-button>
             </template>
           </a-table-column>
        </template>
      </a-table>
    </a-spin>

    <!-- Create/Edit Template Modal -->
    <a-modal
      v-model:visible="modalVisible"
      :title="isEditMode ? `编辑模板: ${currentTemplate?.name}` : '创建新模板'"
      @ok="handleSubmit"
      @cancel="handleCancel"
      :confirm-loading="isSubmitting"
      unmount-on-close
      width="900px" 
      :body-style="{ 'max-height': '75vh', 'overflow-y': 'auto' }"
    >
      <a-form ref="templateFormRef" :model="templateForm" layout="vertical">
         <a-row :gutter="16">
            <a-col :span="12">
                <a-form-item field="name" label="模板名称" :rules="[{ required: true, message: '请输入模板名称' }]" validate-trigger="blur">
                    <a-input v-model="templateForm.name" placeholder="例如: 标准文章页" />
                </a-form-item>
            </a-col>
             <a-col :span="12">
                 <a-form-item field="type" label="模板类型" :rules="[{ required: true, message: '请选择模板类型' }]" validate-trigger="change">
                    <a-select v-model="templateForm.type" placeholder="选择模板适用的页面类型">
                        <a-option value="single">单页模板 (Single Page)</a-option>
                        <a-option value="list">列表模板 (Collection List)</a-option>
                        <a-option value="item">内容模板 (Collection Item)</a-option>
                    </a-select>
                </a-form-item>
            </a-col>
        </a-row>
        
        <a-form-item field="content" label="模板内容 (HTML/Vue Template)" :rules="[{ required: true, message: '请输入模板内容' }]"
          validate-trigger="blur">
             <a-textarea 
                v-model="templateForm.content" 
                placeholder="输入 HTML 或 Vue 模板代码。使用 {{ expression }} 插入数据。"
                :auto-size="{ minRows: 15, maxRows: 25 }" 
             />
        </a-form-item>

        <!-- Help Tooltip -->
        <div class="mt-1 text-sm text-gray-500 flex items-center">
          <a-tooltip position="right">
             <template #content>
              <div class="tooltip-content">
                <h4 class="font-semibold mb-1">可用字段说明 (基于类型: {{ { single: '单页', list: '列表', item: '内容' }[templateForm.type] || '未知' }})</h4>
                <ul class="list-none p-0 m-0">
                  <li v-for="field in availableFields" :key="field.key" class="mb-1">
                     <code class="px-1 rounded text-xs">{{ '{' + '{ ' + field.key + ' }' + '}' }}</code> - <span>{{ field.desc }}</span>
                  </li>
                </ul>
              </div>
            </template>
            <icon-info-circle class="cursor-help mr-1" />
             <span>查看可用字段</span>
          </a-tooltip>
        </div>

      </a-form>
    </a-modal>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { 
    Message, Modal, Spin as ASpin, Button as AButton, Select as ASelect, 
    Option as AOption, Space as ASpace, Form as AForm, FormItem as AFormItem, 
    Input as AInput, 
    Textarea as ATextarea,
    Table as ATable, TableColumn as ATableColumn,
    Tag as ATag, Row as ARow, Col as ACol, Divider as ADivider,
    Tooltip as ATooltip,
    InputSearch as AInputSearch
} from '@arco-design/web-vue';
import { IconRefresh, IconPlus, IconInfoCircle } from '@arco-design/web-vue/es/icon';
import { debounce } from 'lodash-es';

const templates = ref([]);
const isLoading = ref(false);
const searchTerm = ref('');
const selectedType = ref(undefined);

// Modal State
const modalVisible = ref(false);
const isEditMode = ref(false);
const currentTemplate = ref(null);
const templateFormRef = ref(null);
const templateForm = ref({});
const isSubmitting = ref(false);

// Filtered templates based on search term AND type filter
const filteredTemplates = computed(() => {
  return templates.value.filter(template => {
    const term = searchTerm.value.toLowerCase().trim();
    const typeFilter = selectedType.value;

    const matchesSearch = !term || template.name.toLowerCase().includes(term);
    // Treat undefined AND empty string as "no filter"
    const matchesType = typeFilter === undefined || typeFilter === '' || template.type === typeFilter;

    return matchesSearch && matchesType;
  });
});

// Helper to get initial form values
const getInitialTemplateForm = () => ({
    name: '',
    type: 'single',
    content: '',
    // fields: [] // Removed fields
});

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Fetch templates function
const fetchTemplates = async () => {
  isLoading.value = true;
  const accessToken = localStorage.getItem('accessToken');
  // TODO: Add proper auth check
  if (!accessToken) { Message.error('未认证'); isLoading.value = false; return; }

  try {
    const response = await fetch('/api/templates', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error(`获取模板列表失败: ${response.status}`);
    templates.value = await response.json();
  } catch (error) {
    Message.error(error.message);
    templates.value = []; 
  } finally {
    isLoading.value = false;
  }
};

// Refresh templates and clear search/filter
const refreshTemplates = () => {
    searchTerm.value = '';
    selectedType.value = undefined;
    fetchTemplates();
};

// --- Modal Logic --- 
const openCreateModal = () => {
    templateForm.value = getInitialTemplateForm();
    isEditMode.value = false;
    currentTemplate.value = null;
    modalVisible.value = true;
    templateFormRef.value?.clearValidate();
};

const editTemplate = (template) => {
    currentTemplate.value = template;
    templateForm.value = { 
        _id: template._id,
        name: template.name,
        type: template.type,
        content: template.content || ''
     }; 
    isEditMode.value = true;
    modalVisible.value = true;
    templateFormRef.value?.clearValidate();
};

const handleCancel = () => {
    modalVisible.value = false;
};

const handleSubmit = async () => {
    const validationResult = await templateFormRef.value?.validate();
    if (validationResult) return false;
    isSubmitting.value = true;
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) { Message.error('认证令牌丢失'); isSubmitting.value = false; return false; }

    let url = '/api/templates';
    let method = 'POST';
    const payload = { ...templateForm.value }; 
    // Removed field filtering
    // payload.fields = payload.fields?.filter(f => f.name && f.description);

    if (isEditMode.value) {
        url = `/api/templates/${currentTemplate.value._id}`;
        method = 'PUT';
    }

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload) // Payload no longer contains 'fields'
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '无法解析错误信息' }));
             let errorMessage = `${isEditMode.value ? '更新' : '创建'}失败: ${response.status}`;
             if (errorData.message) {
                 if (response.status === 409) errorMessage = `模板名称 '${payload.name}' 已存在`;
                 else errorMessage += ` - ${errorData.message.replace(/^.+验证失败: /, '')}`;
             }
            throw new Error(errorMessage);
        }
        Message.success(`模板 ${isEditMode.value ? '更新' : '创建'}成功！`);
        await fetchTemplates();
        modalVisible.value = false;
        return true;
    } catch (error) {
        Message.error(error.message);
        return false;
    } finally {
        isSubmitting.value = false;
    }
};

// --- Delete Logic --- 
const confirmDeleteTemplate = (template) => {
    Modal.confirm({
        title: '确认删除',
        content: `确定要删除模板 "${template.name}" 吗？此操作不可恢复，且如果页面正在使用此模板，可能导致显示错误。`, 
        okText: '确认删除',
        cancelText: '取消',
        okButtonProps: { status: 'danger' },
        onOk: async () => {
           return new Promise(async (resolve, reject) => {
                const accessToken = localStorage.getItem('accessToken');
                if (!accessToken) { Message.error('认证令牌丢失'); reject(new Error('No token')); return; }
                 try {
                    const response = await fetch(`/api/templates/${template._id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                     if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ message: '无法解析错误信息' }));
                        let errorMessage = `删除失败: ${response.status}`;
                        if (errorData.message) errorMessage += ` - ${errorData.message}`; 
                        throw new Error(errorMessage);
                    }
                     Message.success(`模板 "${template.name}" 已删除。`);
                    await fetchTemplates();
                    resolve(true);
                } catch (error) {
                    Message.error(error.message || '删除时发生错误');
                    reject(error);
                }
           });
        }
    });
};

// --- Computed property for available fields based on type ---
const availableFields = computed(() => {
  const type = templateForm.value.type;
  const fields = [
      // Common fields (available in most contexts, adjust as needed)
      // { key: 'site.name', desc: '网站名称' },
  ];

  if (type === 'single') {
    fields.push(
      { key: 'page.name', desc: '页面名称' },
      { key: 'page.content', desc: '页面内容 (HTML)' },
      { key: 'page.createdAt', desc: '页面创建时间' },
      { key: 'page.updatedAt', desc: '页面更新时间' },
      // Potentially add SEO fields if defined on Page model
      // { key: 'page.seoTitle', desc: 'SEO 标题' },
      // { key: 'page.seoDescription', desc: 'SEO 描述' },
    );
  } else if (type === 'list') {
    fields.push(
      { key: 'page.name', desc: '列表页名称' },
      { key: 'page.content', desc: '列表页描述 (HTML)' },
      { key: 'articles', desc: '文章对象数组 (用于 v-for="article in articles")' },
      { key: '  article.title', desc: '文章标题 (在循环内)' },
      { key: '  article.author', desc: '文章作者 (在循环内)' },
      { key: '  article.publishDate', desc: '文章发布日期 (在循环内)' },
      { key: '  article._id', desc: '文章ID (用于链接, 在循环内)' },
      { key: '  article.slug', desc: '文章的唯一标识符 (用于链接, 在循环内, 需要添加)' }, // Placeholder, need to add slug
      { key: '  article.excerpt', desc: '文章摘要 (需要添加)' }, // Placeholder, need to add excerpt
    );
  } else if (type === 'item') {
    fields.push(
      { key: 'article.title', desc: '文章标题' },
      { key: 'article.content', desc: '文章内容 (HTML)' },
      { key: 'article.author', desc: '文章作者' },
      { key: 'article.publishDate', desc: '文章发布日期' },
      { key: 'article.createdAt', desc: '文章创建时间' },
      { key: 'article.updatedAt', desc: '文章更新时间' },
      { key: 'page.name', desc: '所属页面名称' },
      { key: 'page.route', desc: '所属页面路径' },
      // { key: 'article.category', desc: '文章分类 (需要添加)' },
      // { key: 'article.tags', desc: '文章标签数组 (需要添加)' },
    );
  }

  return fields;
});

// --- Lifecycle Hook ---
onMounted(() => {
  fetchTemplates();
});

</script>

<style scoped>
.tooltip-content {
  max-width: 350px; /* Adjust as needed */
  padding: 8px 12px;
  border-radius: 4px;
}

.tooltip-content ul {
  margin-top: 4px;
}

.mt-1 {
  margin-top: 0.25rem; /* 4px */
}
.mr-1 {
    margin-right: 0.25rem; /* 4px */
}

.cursor-help {
  cursor: help;
}

/* Add styles if needed */
.space-x-2 > * + * {
  margin-left: 0.5rem; /* Equivalent to space-x-2 */
}

/* Remove Quill-specific styles */
/*
:deep(.ql-toolbar.ql-snow) {
    position: sticky;
    top: 0;
    background-color: #f9f9f9;
    z-index: 10; 
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
}

:deep(.ql-container.ql-snow) {
    min-height: 300px; 
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
}
*/

/* CKEditor height adjustment */
:deep(.ck-editor__editable) {
    min-height: 300px;
}

/* Ensure editor fits well within modal */
:deep(.ck.ck-editor) {
    margin-bottom: 1rem; /* Add some space below editor */
}

/* Add styles for editor loading state */
.editor-loading {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 300px; /* Match editor height */
    border: 1px dashed #dcdcdc;
    border-radius: 4px;
}

/* Ensure CKEditor container has border if needed */
.editor-container :deep(.ck.ck-editor) {
     border: 1px solid #dcdcdc;
     border-radius: 4px;
}
</style> 