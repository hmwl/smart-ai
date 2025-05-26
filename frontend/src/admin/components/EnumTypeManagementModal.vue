<template>
  <a-modal
    :visible="visible"
    title="枚举类型管理"
    width="800px"
    :esc-to-close="false"
    :mask-closable="false"
    @ok="handleOk"
    @cancel="handleCancel"
    :ok-loading="formLoading"
    ok-text="关闭"
    :hide-cancel="true"
    :modal-style="{ maxWidth: '90vw' }"
    body-style="max-height: 70vh; overflow-y: auto;"
  >
    <a-row :gutter="16" style="margin-bottom: 16px;">
      <a-col :span="24" style="text-align: right;">
        <a-button type="primary" @click="openAddTypeForm">
          <template #icon><icon-plus /></template>添加类型
        </a-button>
      </a-col>
    </a-row>

    <a-table
      :columns="columns"
      :data="enumTypes"
      :loading="loading"
      :pagination="false"
      row-key="_id"
      size="small"
      :scroll="{ x: 'max-content' }"
    >
      <template #platform="{ record }">
        <a-tag :color="getPlatformColor(record.platform)">{{ record.platform }}</a-tag>
      </template>
      <template #usageCount="{ record }">
        <a-tag :color="record.usageCount > 0 ? 'blue' : 'default'">
          {{ record.usageCount || 0 }}
        </a-tag>
      </template>
      <template #status="{ record }">
        <a-tag :color="record.status === 'active' ? 'green' : 'orangered'">
          {{ record.status === 'active' ? '启用' : '禁用' }}
        </a-tag>
      </template>
      <template #createdAt="{ record }">
        {{ formatDateCN(record.createdAt) }}
      </template>
      <template #updatedAt="{ record }">
        {{ formatDateCN(record.updatedAt) }}
      </template>
      <template #actions="{ record }">
        <a-space>
          <a-button type="text" status="warning" size="mini" @click="openEditTypeForm(record)">
            编辑
          </a-button>
          <a-tooltip v-if="record.usageCount && record.usageCount > 0" :content="`此类型已被 ${record.usageCount} 个配置使用，无法删除`">
            <a-button type="text" status="danger" size="mini" disabled>
              删除
            </a-button>
          </a-tooltip>
          <a-button v-else type="text" status="danger" size="mini" @click="confirmDeleteType(record)">
            删除
          </a-button>
        </a-space>
      </template>
    </a-table>
  </a-modal>

  <!-- 添加/编辑类型的弹窗 -->
  <a-modal
    :visible="formVisible"
    :title="isEditMode ? '编辑类型' : '添加新类型'"
    width="600px"
    :esc-to-close="false"
    :mask-closable="false"
    @ok="handleSubmitTypeForm"
    @cancel="closeTypeForm"
    :ok-loading="formLoading"
    :ok-text="isEditMode ? '更新类型' : '添加类型'"
    cancel-text="取消"
  >
    <a-form
      ref="typeFormRef"
      :model="typeForm"
      :rules="typeFormRules"
      layout="vertical"
    >
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item field="name" label="类型名称" required>
            <a-input v-model="typeForm.name" placeholder="请输入类型名称 (例如: Model, Style)" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item field="platform" label="所属平台" required>
            <a-select v-model="typeForm.platform" placeholder="请选择平台">
              <a-option v-for="platform in localPlatformTypes" :key="platform" :value="platform">
                {{ platform }}
              </a-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
      <a-row :gutter="16">
         <a-col :span="12">
          <a-form-item field="status" label="状态">
            <a-select v-model="typeForm.status" placeholder="选择状态">
              <a-option value="active">Active (启用)</a-option>
              <a-option value="inactive" :disabled="isEditMode && typeForm.usageCount > 0">
                Inactive (禁用)
                <span v-if="isEditMode && typeForm.usageCount > 0" class="text-xs text-gray-500 ml-1">
                  (被 {{ typeForm.usageCount }} 个配置使用)
                </span>
              </a-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive, watch, onMounted, nextTick } from 'vue';
import { Message, Modal, Tooltip as ATooltip } from '@arco-design/web-vue';
import { IconPlus, IconEdit, IconDelete } from '@arco-design/web-vue/es/icon';
import apiService from '@/admin/services/apiService';
import { formatDateCN } from '@/admin/utils/date';

const props = defineProps({
  visible: Boolean,
  platformTypes: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:visible', 'success']);

const localVisible = ref(props.visible);
const localPlatformTypes = ref(props.platformTypes);

const enumTypes = ref([]);
const loading = ref(false);
const formLoading = ref(false);
const isEditMode = ref(false);
const currentEditTypeId = ref(null);
const formVisible = ref(false); // To control the visibility of the add/edit form

const typeFormRef = ref(null);
const typeForm = reactive({
  name: '',
  platform: undefined,
  status: 'active',
  usageCount: 0
});

const typeFormRules = {
  name: [{ required: true, message: '类型名称不能为空' }],
  platform: [{ required: true, message: '请选择平台' }],
};

const columns = [
  { title: 'ID', dataIndex: '_id', key: '_id', width: 90, ellipsis: true, tooltip: true },
  { title: '类型名称', dataIndex: 'name', key: 'name', width: 120, ellipsis: true, tooltip: true },
  { title: '平台', key: 'platform', slotName: 'platform', width: 120 },
  { title: '使用数', key: 'usageCount', slotName: 'usageCount', width: 90, align: 'center' },
  { title: '状态', key: 'status', slotName: 'status', width: 90 },
  { title: '创建时间', key: 'createdAt', slotName: 'createdAt', width: 200 },
  { title: '更新时间', key: 'updatedAt', slotName: 'updatedAt', width: 200 },
  { title: '操作', key: 'actions', slotName: 'actions', width: 120, fixed: 'right' },
];

const fetchEnumTypes = async () => {
  loading.value = true;
  try {
    const response = await apiService.getEnumTypes(); // Assuming no pagination for types within modal
    if (response.data && Array.isArray(response.data)) {
      enumTypes.value = response.data;
    } else {
      enumTypes.value = [];
    }
  } catch (error) {
    Message.error('获取枚举类型列表失败: ' + (error.response?.data?.message || error.message));
    enumTypes.value = [];
  } finally {
    loading.value = false;
  }
};

const resetTypeForm = () => {
  typeFormRef.value?.resetFields();
  typeForm.name = '';
  typeForm.platform = undefined;
  typeForm.status = 'active';
  typeForm.usageCount = 0;
  isEditMode.value = false;
  currentEditTypeId.value = null;
};

const openAddTypeForm = () => {
  resetTypeForm();
  formVisible.value = true;
};

const openEditTypeForm = (record) => {
  resetTypeForm();
  isEditMode.value = true;
  currentEditTypeId.value = record._id;
  typeForm.name = record.name;
  typeForm.platform = record.platform;
  typeForm.status = record.status;
  typeForm.usageCount = record.usageCount || 0;
  formVisible.value = true;
};

const closeTypeForm = () => {
  formVisible.value = false;
  resetTypeForm();
};

const handleSubmitTypeForm = async () => {
  const valid = await typeFormRef.value?.validate();
  if (valid) return;

  formLoading.value = true;
  try {
    if (isEditMode.value) {
      await apiService.updateEnumType(currentEditTypeId.value, typeForm);
      Message.success('类型更新成功');
    } else {
      await apiService.createEnumType(typeForm);
      Message.success('类型添加成功');
    }
    closeTypeForm();
    fetchEnumTypes(); // Refresh list
    emit('success'); // Notify parent component
  } catch (error) {
    Message.error((isEditMode.value ? '更新' : '添加') + '类型失败: ' + (error.response?.data?.message || error.message));
  } finally {
    formLoading.value = false;
  }
};

const confirmDeleteType = (record) => {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除类型 " ${record.name} " 吗？此操作不可撤销。`,
    okText: '确认删除',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      await handleDeleteType(record._id, record.usageCount); // Pass necessary params
    }
  });
};

const handleDeleteType = async (id, usageCount) => {
  if (usageCount > 0) {
    Message.error('此类型已被配置使用，无法删除。请先修改或删除相关配置。');
    return;
  }
  try {
    await apiService.deleteEnumType(id);
    Message.success('删除成功');
    fetchEnumTypes(); // Refresh list
    emit('success'); // Notify parent
  } catch (error) {
    Message.error('删除失败: ' + (error.response?.data?.message || error.message));
  }
};

const handleOk = () => {
  emit('update:visible', false);
};

const handleCancel = () => {
    emit('update:visible', false);
};

const getPlatformColor = (platform) => {
  const colors = { OpenAI: 'arcoblue', ComfyUI: 'green', StabilityAI: 'orangered', Midjourney: 'purple', DallE: 'pinkpurple', Custom: 'gray' };
  return colors[platform] || 'blue';
};


watch(() => props.visible, (newVal) => {
  localVisible.value = newVal;
  if (newVal) {
    // When modal becomes visible, refresh platform types and enum types
    localPlatformTypes.value = props.platformTypes;
    fetchEnumTypes();
    // Ensure form is hidden initially when modal opens, unless an edit was pending
    if (!isEditMode.value) { 
        closeTypeForm();
    }
  } else {
    // When modal hides, reset form state if it was visible
    if (formVisible.value) {
        closeTypeForm();
    }
  }
});

watch(() => props.platformTypes, (newVal) => {
    localPlatformTypes.value = newVal;
});

onMounted(() => {
  if (localVisible.value) {
    localPlatformTypes.value = props.platformTypes;
    fetchEnumTypes();
  }
});

</script>

<style scoped>
/* Add any specific styles for the modal here */
</style>
