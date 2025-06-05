<template>
  <div>
    <!-- 工具栏 -->
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">AI挂件管理</h2>
      <a-space>
        <a-input-search
          v-model="searchName"
          placeholder="搜索挂件名称"
          allow-clear
          style="width: 200px;"
          @input="onSearchInput"
          @clear="onSearch"
        />
        <a-select
          v-model="searchPlatform"
          :options="platformOptions"
          placeholder="所属平台"
          allow-clear
          style="width: 160px;"
          @change="onSearch"
        />
        <a-select
          v-model="searchStatus"
          :options="statusOptions"
          placeholder="状态"
          allow-clear
          style="width: 120px;"
          @change="onSearch"
        />
        <a-select
          v-model="searchCredits"
          :options="creditsOptions"
          placeholder="按积分筛选"
          allow-clear
          style="width: 140px;"
          @change="onSearch"
        />
        <a-button type="primary" @click="openCreate">
          <template #icon><IconPlus /></template> 添加 AI 挂件
        </a-button>
        <a-button @click="fetchList" :loading="loading">
          <template #icon><IconRefresh /></template> 刷新
        </a-button>
      </a-space>
    </div>
    <a-spin :loading="loading" tip="加载挂件..." class="w-full">
      <a-table
        :columns="columns"
        :data="list"
        :pagination="pagination"
        row-key="_id"
        stripe
        :scroll="{ x: 'max-content' }"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
      >
        <template #status="{ record }">
          <a-tag :color="record.status === 'enabled' ? 'green' : 'red'">{{ record.status === 'enabled' ? '启用' : '禁用' }}</a-tag>
        </template>
        <template #platform="{ record }">
          <a-tag v-if="record.platform?.name" :color="getPlatformColor(record.platform.name)">{{ record.platform.name }}</a-tag>
          <span v-else>-</span>
        </template>
        <template #apiCount="{ record }">
          {{ record.apis?.length || 0 }}
        </template>
        <template #usageCount="{ record }">
          <a-tag color="arcoblue" v-if="typeof record.usageCount === 'number'">{{ record.usageCount }}</a-tag>
          <span v-else>-</span>
        </template>
        <template #creditsConsumed="{ record }">
          <a-tag v-if="record.creditsConsumed === 0" color="green">免费</a-tag>
          <span v-else>{{ record.creditsConsumed }}</span>
        </template>
        <template #createdAt="{ record }">
          {{ formatDateCN(record.createdAt) }}
        </template>
        <template #updatedAt="{ record }">
          {{ formatDateCN(record.updatedAt) }}
        </template>
        <template #actions="{ record }">
          <a-space>
            <a-button type="text" status="warning" size="mini" @click="openEdit(record)">编辑</a-button>
            <a-tooltip v-if="record.usageCount && record.usageCount > 0" :content="`该挂件被 ${record.usageCount} 个表单字段使用，无法删除`">
              <a-button type="text" status="danger" size="mini" disabled>删除</a-button>
            </a-tooltip>
            <a-popconfirm
              v-else
              content="确定删除该挂件？"
              ok-text="确定"
              cancel-text="取消"
              @ok="deleteWidget(record._id)"
            >
              <a-button type="text" status="danger" size="mini">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-spin>
    <a-modal
      v-model:visible="formVisible"
      :title="isEditing ? '编辑 AI 挂件：' + form.name : '创建 AI 挂件'"
      width="600px"
      :on-before-ok="onSubmit"
      @cancel="formVisible=false"
      :ok-text="isEditing ? '更新 AI 挂件' : '创建 AI 挂件'"
      cancel-text="取消"
      unmount-on-close
    >
      <a-form :model="form" :rules="rules" ref="formRef" layout="vertical">
        <a-form-item label="挂件名称" field="name" required>
          <a-input v-model="form.name" placeholder="请输入挂件名称" allow-clear />
        </a-form-item>
        <a-form-item label="挂件简介" field="description">
          <a-input v-model="form.description" placeholder="请输入简介" allow-clear />
        </a-form-item>
        <a-form-item label="所属平台类型" field="platformType" required>
          <a-select v-model="form.platformType" placeholder="请选择平台类型" :options="platformOptions" allow-clear @change="onPlatformChange" />
        </a-form-item>
        <a-form-item label="关联API" field="apis" required>
          <a-select v-model="form.apis" placeholder="请选择关联API" :options="filteredApiOptions" multiple allow-clear />
        </a-form-item>
        <a-form-item label="所需积分" field="creditsConsumed" required>
          <a-input-number
            v-model="form.creditsConsumed"
            placeholder="输入所需积分，0表示免费"
            :min="0"
            :precision="0"
            style="width: 100%;"
          />
        </a-form-item>
        <a-form-item label="状态" field="status" required>
          <a-select v-model="form.status" placeholder="请选择状态">
            <a-option value="enabled">启用 (enabled)</a-option>
            <a-option value="disabled" :disabled="isEditing && form._id && form.usageCount > 0">
              禁用 (disabled)
              <span v-if="isEditing && form._id && form.usageCount > 0" class="text-xs text-gray-500 ml-1">
                (被{{form.usageCount}}个表单字段使用)
              </span>
            </a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { Message, Tooltip as ATooltip } from '@arco-design/web-vue';
import { IconPlus, IconRefresh } from '@arco-design/web-vue/es/icon';
import apiService from '@/admin/services/apiService';
import { formatDateCN } from '@/admin/utils/date';

const list = ref([]);
const total = ref(0);
const loading = ref(false);
const pagination = reactive({
  current: 1,
  pageSize: 20,
  showTotal: true,
  total: 0,
  showJumper: true,
  showPageSize: true,
  pageSizeOptions: [10, 20, 50, 100],
});

const searchName = ref('');
const searchPlatform = ref('');
const searchStatus = ref('');
const searchCredits = ref(undefined);
const platformOptions = ref([]);
const statusOptions = [
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' },
];
const creditsOptions = [
  { label: '全部', value: undefined },
  { label: '免费', value: 'free' },
  { label: '付费', value: 'paid' },
];
const allApiOptions = ref([]); // [{label, value, platformType}]

const columns = [
  { title: 'ID', dataIndex: '_id', width: 120 },
  { title: '挂件名称', dataIndex: 'name', width: 200, sortable: { sortDirections: ['ascend', 'descend'] } },
  { title: '挂件简介', dataIndex: 'description', width: 200 },
  { title: '所属平台', dataIndex: 'platform', slotName: 'platform', width: 120 },
  { title: 'API数', dataIndex: 'apiCount', slotName: 'apiCount', width: 120, align: 'center', sortable: { sortDirections: ['ascend', 'descend'] } },
  { title: '使用数', dataIndex: 'usageCount', slotName: 'usageCount', width: 120, align: 'center', sortable: { sortDirections: ['ascend', 'descend'] }  },
  { title: '所需积分', dataIndex: 'creditsConsumed', slotName: 'creditsConsumed', width: 120, align: 'center', sortable: { sortDirections: ['ascend', 'descend'] }  },
  { title: '状态', dataIndex: 'status', slotName: 'status', width: 120, align: 'center', sortable: { sortDirections: ['ascend', 'descend'] }  },
  { title: '创建时间', dataIndex: 'createdAt', slotName: 'createdAt', width: 200, sortable: { sortDirections: ['ascend', 'descend'] }  },
  { title: '更新时间', dataIndex: 'updatedAt', slotName: 'updatedAt', width: 200, sortable: { sortDirections: ['ascend', 'descend'] }  },
  { title: '操作', dataIndex: 'actions', slotName: 'actions', width: 160, fixed: 'right', align: 'center' },
];

const formVisible = ref(false);
const isEditing = ref(false);
const formRef = ref();
const form = reactive({
  name: '',
  description: '',
  platformType: '', // 平台类型ID
  apis: [],
  status: 'enabled',
  usageCount: 0,
  creditsConsumed: 0,
});

const rules = {
  name: [{ required: true, message: '请输入挂件名称' }],
  platformType: [{ required: true, message: '请选择平台类型' }],
  apis: [{ required: true, type: 'array', min: 1, message: '请至少选择一个关联API' }],
  creditsConsumed: [
    { required: true, message: '请输入所需积分' },
    { type: 'number', message: '所需积分必须是数字' },
    { validator: (value, callback) => {
        if (value < 0) {
          callback('所需积分不能为负数');
        } else if (!Number.isInteger(value)) {
          callback('所需积分必须是整数');
        } else {
          callback();
        }
      }
    }
  ],
  status: [{ required: true, message: '请选择状态' }],
};

// 只显示当前平台类型下的API
const filteredApiOptions = computed(() => {
  if (!form.platformType) return [];
  const selectedPlatform = platformOptions.value.find(p => p.value === form.platformType);
  const platformName = selectedPlatform ? selectedPlatform.label : '';
  return allApiOptions.value.filter(api => api.platformType === platformName);
});

async function fetchList() {
  loading.value = true;
  try {
    const params = {
      page: pagination.current,
      pageSize: pagination.pageSize,
      name: searchName.value,
      platform: searchPlatform.value,
      status: searchStatus.value,
      creditsFilter: searchCredits.value,
    };
    const res = await apiService.getAIWidgets(params);
    list.value = res.data.list;
    total.value = res.data.total;
    pagination.total = res.data.total;
  } catch (e) {
    Message.error('获取挂件列表失败');
  } finally {
    loading.value = false;
  }
}

async function fetchPlatforms() {
  const res = await apiService.getPlatforms();
  platformOptions.value = (res.data?.data || res.data || []).map(p => ({ label: p.name, value: p._id }));
}

async function fetchApis() {
  const res = await apiService.getApiEntries();
  allApiOptions.value = (res.data?.data || res.data || []).map(a => ({
    label: `${a.platformName} (${a.apiUrl})`,
    value: a._id || a.id,
    platformType: a.platformType || a.platformName || '',
  }));
}

function openCreate() {
  isEditing.value = false;
  Object.assign(form, { name: '', description: '', platformType: '', apis: [], status: 'enabled', usageCount: 0, _id: null, creditsConsumed: 0 });
  formVisible.value = true;
}
function openEdit(row) {
  isEditing.value = true;
  Object.assign(form, {
    ...row,
    platformType: row.platform?._id || row.platform,
    apis: (row.apis || []).map(a => a._id || a),
    status: row.status || 'enabled',
    usageCount: row.usageCount || 0,
    _id: row._id,
    creditsConsumed: row.creditsConsumed === undefined ? 0 : Number(row.creditsConsumed),
  });
  formVisible.value = true;
}

function onPlatformChange() {
  form.apis = [];
}

async function onSubmit() {
  let validationErrors;
  try {
    validationErrors = await formRef.value.validate();
  } catch (e) {
    Message.error('表单校验函数执行出错，请联系管理员。');
    return false; // 阻止弹窗关闭
  }

  if (validationErrors && Object.keys(validationErrors).length > 0) {
    try {
      const firstErrorField = Object.keys(validationErrors)[0];
      if (firstErrorField && formRef.value?.scrollToField) {
        formRef.value.scrollToField(firstErrorField);
      }
    } catch (focusError) {}
    return false; // 阻止弹窗关闭
  }

  // 处理platform字段
  let data = { ...form };
  if (data.platformType) {
    const selectedPlatform = platformOptions.value.find(p => p.value === data.platformType);
    if (selectedPlatform) {
      data.platform = selectedPlatform.value;
    }
  }
  delete data.platformType;
  // 处理apis字段
  if (data.apis) {
    data.apis = Array.isArray(data.apis) ? data.apis : [data.apis];
    data.apis = data.apis.filter(apiId => apiId && typeof apiId === 'string' && apiId.length > 0);
  } else {
    data.apis = [];
  }
  // 确保platform是字符串
  if (Array.isArray(data.platform)) {
    data.platform = data.platform[0];
  }
  // 确保apis中的每个元素都是字符串
  if (data.apis && data.apis.length > 0) {
    data.apis = data.apis.map(api => Array.isArray(api) ? api[0] : api);
  }
  try {
    if (isEditing.value) {
      await apiService.updateAIWidget(form._id, data);
      Message.success('编辑成功');
    } else {
      await apiService.createAIWidget(data);
      Message.success('新建成功');
    }
    formVisible.value = false;
    fetchList();
    return true;
  } catch (e) {
    Message.error('保存失败');
    return false; // 阻止弹窗关闭
  }
}

async function deleteWidget(id) {
  try {
    await apiService.deleteAIWidget(id);
    Message.success('删除成功');
    fetchList();
  } catch (e) {
    Message.error('删除失败');
  }
}

function onSearch() {
  pagination.current = 1;
  fetchList();
}

function onSearchInput() {
  pagination.current = 1;
  fetchList();
}

function handlePageChange(page) {
  pagination.current = page;
  fetchList();
}

function handlePageSizeChange(pageSize) {
  pagination.pageSize = pageSize;
  pagination.current = 1;
  fetchList();
}

function getPlatformColor(platform) {
  const colors = {
    OpenAI: 'arcoblue',
    ComfyUI: 'green',
    StabilityAI: 'orangered',
    Midjourney: 'purple',
    DallE: 'pinkpurple',
    Custom: 'gray'
  };
  return colors[platform] || 'blue';
}

onMounted(() => {
  fetchPlatforms();
  fetchApis();
  fetchList();
});
</script>

<style scoped>
.form-btns {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}
</style> 