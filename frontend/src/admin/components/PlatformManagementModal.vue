<template>
  <a-modal
    v-model:visible="internalVisible"
    title="平台管理"
    width="800px"
    @cancel="handleCancel"
    :footer="null" 
    unmount-on-close
  >
    <div class="mb-4 w-full flex justify-end">
      <a-button type="primary" @click="openAddModal">
        <template #icon><icon-plus /></template> 添加平台
      </a-button>
    </div>
    <a-spin :loading="loading" tip="加载平台列表中..." class="w-full">
      <a-table
        :columns="columns"
        :data="platforms"
        :pagination="false" 
        row-key="_id"
        size="small"
        :scroll="{ x: 'max-content'}"
      >
        <template #status="{ record }">
          <a-tag :color="record.status === 'active' ? 'green' : 'orangered'">
            {{ record.status === 'active' ? '有效' : '无效' }}
          </a-tag>
        </template>
        <template #apiUsageCount="{ record }">
          <a-tag :color="record.apiUsageCount > 0 ? 'blue' : 'default'">{{ record.apiUsageCount }}</a-tag>
        </template>
        <template #enumTypeUsageCount="{ record }">
          <a-tag :color="record.enumTypeUsageCount > 0 ? 'purple' : 'default'">{{ record.enumTypeUsageCount }}</a-tag>
        </template>
        <template #totalUsageCount="{ record }">
          <a-tag :color="record.totalUsageCount > 0 ? 'red' : 'green'">{{ record.totalUsageCount }}</a-tag>
        </template>
        <template #createdAt="{ record }">
          {{ formatDateCN(record.createdAt) }}
        </template>
        <template #updatedAt="{ record }">
          {{ formatDateCN(record.updatedAt) }}
        </template>
        <template #actions="{ record }">
          <a-space>
            <a-button type="text" size="mini" status="warning" @click="openEditModal(record)">
              编辑
            </a-button>
            <a-tooltip 
              v-if="record.totalUsageCount > 0" 
              :content="`该平台正在被使用，无法删除。API使用数: ${record.apiUsageCount}, 枚举类型使用数: ${record.enumTypeUsageCount}`"
            >
              <a-button type="text" size="mini" status="danger" disabled>
                删除
              </a-button>
            </a-tooltip>
            <a-popconfirm
              v-else
              content="确定删除此平台吗？此操作不可恢复。"
              type="warning"
              @ok="handleDelete(record._id)"
            >
              <a-button type="text" size="mini" status="danger">
                删除
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-spin>

    <!-- Add/Edit Platform Modal -->
    <a-modal
      v-model:visible="formModalVisible"
      :title="isEditMode ? '编辑平台' : '添加平台'"
      @ok="handleSubmitForm"
      @cancel="closeFormModal"
      :confirm-loading="formLoading"
      unmount-on-close
      width="900px"
    >
      <a-form ref="platformFormRef" :model="platformForm" :rules="rules" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item field="name" label="平台名称" tooltip="平台名称将作为枚举类型前缀使用">
              <a-input v-model="platformForm.name" placeholder="请输入平台名称，例如：OpenAI" />
              <template #extra>
                <div>添加平台后，请在服务端代码添加平台配置文件
                <a-popconfirm
                  trigger="click"
                  ok-text="知道了"
                  :cancel-button-props="{ style: { display: 'none' } }"
                >
                  <template #content>
                    <div style="white-space: pre-line; font-size: 13px; line-height: 1.7;">
                      1. 在本页面添加平台后，需在服务端 <code>/services/platforms</code> 目录下添加对应的 Service 文件（如 <code>openaiService.js</code>）；<br>
                      2. 服务文件名需以 <code>Service.js</code> 结尾，平台名称需与文件名（去掉 <code>Service.js</code> 后首字母大写）一致，例如 <code>openaiService.js</code> → <code>OpenAI</code>；<br>
                      3. 服务端会自动加载该目录下所有 Service 文件，无需手动修改其他后端代码；<br>
                      4. 平台名称建议与实际业务平台保持一致，避免重名；<br>
                      5. 修改服务文件后请重启服务端以生效；<br>
                      6. 对应平台的业务逻辑请都在对应<code>Service.js</code>文件中实现。<br><br>
                      如有疑问请联系管理员
                    </div>
                  </template>
                  <a-link style="margin-left: 8px; font-size: 12px;">操作帮助</a-link>
                </a-popconfirm>
              </div>
              </template>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item field="status" label="状态">
              <a-select 
                v-model="platformForm.status" 
                placeholder="选择状态"
                :disabled="isEditMode && currentPlatform && currentPlatform.totalUsageCount > 0"
              >
                <a-option value="active">有效</a-option>
                <a-option value="inactive">无效</a-option>
              </a-select>
              <template #extra v-if="isEditMode && currentPlatform && currentPlatform.totalUsageCount > 0">
                 <span class="text-xs text-gray-500">该平台正在被使用，无法禁用。API使用数: {{ currentPlatform.apiUsageCount }}, 枚举类型使用数: {{ currentPlatform.enumTypeUsageCount }}</span>
              </template>
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 配置字段管理 -->
        <a-divider>配置字段定义</a-divider>
        <div class="mb-4">
          <a-button type="outline" @click="addConfigField" size="small">
            <template #icon><icon-plus /></template>
            添加配置字段
          </a-button>
          <span class="text-xs text-gray-500 ml-2">这些字段将在创建API时作为表单字段使用</span>
        </div>

        <div v-if="platformForm.configFields && platformForm.configFields.length > 0" class="space-y-4">
          <div 
            v-for="(field, index) in platformForm.configFields" 
            :key="index"
            class="border border-gray-200 rounded-lg p-4 bg-gray-50"
          >
            <div class="flex justify-between items-center mb-3">
              <h4 class="text-sm font-medium text-gray-700">配置字段 {{ index + 1 }}</h4>
              <a-button 
                type="text" 
                status="danger" 
                size="mini"
                @click="removeConfigField(index)"
              >
                <template #icon><icon-delete /></template>
                删除
              </a-button>
            </div>
            
            <a-row :gutter="12">
              <a-col :span="8">
                <a-form-item :field="`configFields.${index}.key`" label="字段Key" size="small">
                  <a-input 
                    v-model="field.key" 
                    placeholder="例如：apiKey" 
                    :rules="[{ required: true, message: 'Key不能为空' }]"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item :field="`configFields.${index}.label`" label="字段标签" size="small">
                  <a-input 
                    v-model="field.label" 
                    placeholder="例如：API密钥" 
                    :rules="[{ required: true, message: '标签不能为空' }]"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item :field="`configFields.${index}.type`" label="字段类型" size="small">
                  <a-select v-model="field.type" @change="onFieldTypeChange(field, index)">
                    <a-option value="text">文本</a-option>
                    <a-option value="select">下拉选择</a-option>
                    <a-option value="multiSelect">多选</a-option>
                  </a-select>
                </a-form-item>
              </a-col>
            </a-row>

            <a-row :gutter="12">
              <a-col :span="8">
                <a-form-item :field="`configFields.${index}.defaultValue`" label="默认值" size="small">
                  <a-input 
                    v-if="field.type === 'text'"
                    v-model="field.defaultValue" 
                    placeholder="可选的默认值" 
                  />
                  <a-select
                    v-else-if="field.type === 'select'"
                    v-model="field.defaultValue"
                    placeholder="选择默认值"
                    allow-clear
                  >
                    <a-option 
                      v-for="option in field.options" 
                      :key="option.key" 
                      :value="option.key"
                    >
                      {{ option.value }}({{ option.key }})
                    </a-option>
                  </a-select>
                  <a-select
                    v-else-if="field.type === 'multiSelect'"
                    v-model="field.defaultValue"
                    placeholder="选择默认值"
                    multiple
                    allow-clear
                  >
                    <a-option 
                      v-for="option in field.options" 
                      :key="option.key" 
                      :value="option.key"
                    >
                      {{ option.value }}({{ option.key }})
                    </a-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item :field="`configFields.${index}.placeholder`" label="占位符" size="small">
                  <a-input 
                    v-model="field.placeholder" 
                    placeholder="输入提示文本" 
                  />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="是否必填" size="small">
                  <a-switch v-model="field.required" />
                </a-form-item>
              </a-col>
            </a-row>

            <!-- 下拉选项配置 -->
            <div v-if="field.type === 'select' || field.type === 'multiSelect'" class="mt-3">
              <a-form-item :label="`${field.type === 'multiSelect' ? '多选' : '下拉'}选项`" size="small">
                <div class="space-y-2">
                  <div 
                    v-for="(option, optionIndex) in field.options" 
                    :key="optionIndex"
                    class="flex items-center space-x-2"
                  >
                    <a-input 
                      v-model="option.key" 
                      placeholder="选项Key" 
                      size="small"
                      class="flex-1"
                    />
                    <a-input 
                      v-model="option.value" 
                      placeholder="选项显示值" 
                      size="small"
                      class="flex-1"
                    />
                    <a-input 
                      v-model="option.description" 
                      placeholder="选项说明（可选）" 
                      size="small"
                      class="flex-1"
                      style="margin-top: 4px;"
                    />
                    <a-button 
                      type="text" 
                      status="danger" 
                      size="mini"
                      @click="removeOption(field, optionIndex)"
                    >
                      <template #icon><icon-minus /></template>
                    </a-button>
                  </div>
                  <a-button 
                    type="outline" 
                    size="small"
                    @click="addOption(field)"
                  >
                    <template #icon><icon-plus /></template>
                    添加选项
                  </a-button>
                </div>
              </a-form-item>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-8 text-gray-500">
          <p>暂无配置字段，点击上方按钮添加</p>
        </div>
      </a-form>
    </a-modal>
  </a-modal>
</template>

<script setup>
import { ref, watch, reactive, onMounted } from 'vue';
import { Message, Modal as AModal, Popconfirm as APopconfirm } from '@arco-design/web-vue';
import { IconPlus, IconDelete, IconMinus } from '@arco-design/web-vue/es/icon';
import apiService from '@/admin/services/apiService';
import { formatDateCN } from '@/admin/utils/date';

const props = defineProps({
  visible: Boolean,
});

const emit = defineEmits(['update:visible', 'success']);

const internalVisible = ref(false);
const platforms = ref([]);
const loading = ref(false);

const formModalVisible = ref(false);
const isEditMode = ref(false);
const formLoading = ref(false);
const platformFormRef = ref(null);
const currentPlatform = ref(null);
const platformForm = reactive({
  _id: null,
  name: '',
  status: 'active',
  configFields: [],
});

const rules = {
  name: [{ required: true, message: '平台名称不能为空' }],
  status: [{ required: true, message: '状态不能为空' }],
};

const columns = [
  { title: 'ID', dataIndex: '_id', key: '_id', width: 180, ellipsis: true, tooltip: true },
  { title: '平台名称', dataIndex: 'name', key: 'name', width: 150, ellipsis: true, tooltip: true },
  { title: 'API使用数', dataIndex: 'apiUsageCount', key: 'apiUsageCount', slotName: 'apiUsageCount', width: 100, align: 'center' },
  { title: '枚举使用数', dataIndex: 'enumTypeUsageCount', key: 'enumTypeUsageCount', slotName: 'enumTypeUsageCount', width: 120, align: 'center' },
  { title: '总使用数', dataIndex: 'totalUsageCount', key: 'totalUsageCount', slotName: 'totalUsageCount', width: 100, align: 'center' },
  { title: '状态', key: 'status', slotName: 'status', width: 100, align: 'center' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', slotName: 'createdAt', width: 200 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', slotName: 'updatedAt', width: 200 },
  { title: '操作', key: 'actions', slotName: 'actions', width: 120, align: 'center', fixed: 'right' },
];

watch(() => props.visible, (val) => {
  internalVisible.value = val;
  if (val) {
    fetchPlatforms();
  }
});

const fetchPlatforms = async () => {
  loading.value = true;
  try {
    const response = await apiService.getPlatforms(); // Assumes this method exists
    platforms.value = response.data || [];
  } catch (error) {
    Message.error('获取平台列表失败: ' + (error.response?.data?.message || error.message));
    platforms.value = [];
  } finally {
    loading.value = false;
  }
};

const openAddModal = () => {
  isEditMode.value = false;
  currentPlatform.value = null;
  platformForm._id = null;
  platformForm.name = '';
  platformForm.status = 'active';
  platformForm.configFields = [];
  formModalVisible.value = true;
};

const openEditModal = (record) => {
  isEditMode.value = true;
  currentPlatform.value = record;
  platformForm._id = record._id;
  platformForm.name = record.name;
  platformForm.status = record.status;
  platformForm.configFields = record.configFields || [];
  formModalVisible.value = true;
};

const closeFormModal = () => {
  formModalVisible.value = false;
  platformFormRef.value?.clearValidate();
};

const handleSubmitForm = async () => {
  const isValid = await platformFormRef.value?.validate();
  if (isValid) return;

  formLoading.value = true;
  try {
    if (isEditMode.value) {
      await apiService.updatePlatform(platformForm._id, { 
        name: platformForm.name,
        status: platformForm.status,
        configFields: platformForm.configFields
      });
      Message.success('平台更新成功');
    } else {
      await apiService.createPlatform({ 
        name: platformForm.name, 
        status: platformForm.status,
        configFields: platformForm.configFields
      });
      Message.success('平台添加成功');
    }
    closeFormModal();
    fetchPlatforms();
    emit('success'); // Notify parent to refresh dependent data, e.g., platform types list
  } catch (error) {
    Message.error('操作失败: ' + (error.response?.data?.message || error.message));
  } finally {
    formLoading.value = false;
  }
};

const handleDelete = async (id) => {
  try {
    await apiService.deletePlatform(id);
    Message.success('平台删除成功');
    fetchPlatforms();
    emit('success');
  } catch (error) {
    Message.error('删除失败: ' + (error.response?.data?.message || error.message));
  }
};

const handleCancel = () => {
  emit('update:visible', false);
};

const addConfigField = () => {
  platformForm.configFields.push({
    key: '',
    label: '',
    type: 'text',
    defaultValue: '',
    placeholder: '',
    required: false,
    options: [],
  });
};

const removeConfigField = (index) => {
  platformForm.configFields.splice(index, 1);
};

const onFieldTypeChange = (field, index) => {
  // 重置默认值
  if (field.type === 'multiSelect') {
    field.defaultValue = [];
  } else {
    field.defaultValue = '';
  }
  
  // 如果切换到非选择类型，清空选项
  if (field.type === 'text') {
    field.options = [];
  } else if (field.options.length === 0) {
    // 如果切换到选择类型且没有选项，添加一个空选项
    field.options = [{ key: '', value: '' }];
  }
};

const addOption = (field) => {
  field.options.push({ key: '', value: '', description: '' });
};

const removeOption = (field, index) => {
  field.options.splice(index, 1);
};

onMounted(() => {
  if (props.visible) {
    fetchPlatforms();
  }
});

</script>

<style scoped>
:deep(code) {
  background-color: #f0f0f0;
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 12px;
}
</style> 