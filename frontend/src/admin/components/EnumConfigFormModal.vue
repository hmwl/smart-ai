<template>
  <a-modal
    :visible="visible"
    :title="modalTitle"
    width="700px"
    :esc-to-close="false"
    :mask-closable="false"
    @ok="handleSubmit"
    @cancel="handleCancel"
    :ok-loading="formLoading"
    :ok-text="isEdit ? '更新配置' : '添加配置'"
    cancel-text="取消"
  >
    <a-form
      ref="configFormRef"
      :model="formState"
      :rules="formRules"
      layout="vertical"
    >
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item field="platform" label="所属平台" required>
            <a-select
              v-model="formState.platform"
              placeholder="请选择平台"
              :disabled="isEdit && props.recordData?.usageCount > 0"
              @change="handlePlatformChange"
            >
              <a-option v-for="platform in localPlatformTypes" :key="platform" :value="platform">
                {{ platform }}
              </a-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item field="enumType" label="枚举类型" required>
            <a-select
              v-model="formState.enumType"
              placeholder="请选择枚举类型"
              :loading="loadingEnumTypesForForm"
              :disabled="!formState.platform || (isEdit && props.recordData?.usageCount > 0)"
              show-search
              :filter-option="filterEnumTypeOption"
            >
              <a-option v-for="type in availableEnumTypes" :key="type._id" :value="type._id">
                {{ type.name }}
              </a-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item field="name" label="配置名称" required>
        <a-input v-model="formState.name" placeholder="请输入配置名称 (例如: gpt-4, dark-theme)" />
      </a-form-item>

      <a-form-item field="translation" label="翻译/显示名称" required>
        <a-input v-model="formState.translation" placeholder="请输入翻译或用户界面显示的名称" />
      </a-form-item>

      <a-form-item field="description" label="描述信息">
        <a-textarea v-model="formState.description" placeholder="请输入描述信息 (可选)" :auto-size="{minRows:2,maxRows:5}"/>
      </a-form-item>
      
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item field="status" label="状态">
            <a-select v-model="formState.status" placeholder="选择状态" :disabled="isEdit && props.recordData?.usageCount > 0">
              <a-option value="active">Active (有效)</a-option>
              <a-option value="inactive">Inactive (无效)</a-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive, watch, computed, nextTick } from 'vue';
import { Message } from '@arco-design/web-vue';
import { IconQuestionCircle } from '@arco-design/web-vue/es/icon';
import apiService from '@/admin/services/apiService';

const props = defineProps({
  visible: Boolean,
  isEdit: Boolean,
  recordData: {
    type: Object,
    default: null
  },
  platformTypes: { // All platform types passed from parent
    type: Array,
    default: () => []
  },
  enumTypes: { // All enum types passed from parent (for all platforms)
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:visible', 'success']);

const localVisible = ref(props.visible);
const localPlatformTypes = ref(props.platformTypes);
const allEnumTypes = ref(props.enumTypes); // All types from parent

const formLoading = ref(false);
const loadingEnumTypesForForm = ref(false); // For loading types specific to selected platform

const configFormRef = ref(null);
const initialFormState = () => ({
  name: '',
  enumType: undefined, // Store ID
  translation: '',
  description: '',
  platform: undefined,
  status: 'active',
});
const formState = reactive(initialFormState());

const formRules = {
  name: [{ required: true, message: '配置名称不能为空' }],
  enumType: [{ required: true, message: '请选择枚举类型' }],
  platform: [{ required: true, message: '请选择平台' }],
  translation: [{ required: true, message: '翻译/显示名称不能为空' }],
};

const modalTitle = computed(() => (props.isEdit ? '编辑枚举配置' : '添加枚举配置'));

// Filter enum types based on the selected platform in the form
const availableEnumTypes = computed(() => {
  if (!formState.platform) {
    return [];
  }
  return allEnumTypes.value.filter(type => type.platform === formState.platform && type.status === 'active');
});

const filterEnumTypeOption = (inputValue, option) => {
  return option.children[0].children.toLowerCase().includes(inputValue.toLowerCase());
};

const resetForm = () => {
  configFormRef.value?.resetFields();
  Object.assign(formState, initialFormState());
};

const handlePlatformChange = (selectedPlatform) => {
  // When platform changes, reset the enumType selection
  // as the available enumTypes will change.
  formState.enumType = undefined; 
  // Potentially trigger fetching enum types if they were not all passed down or need refresh
  // For now, assumes 'allEnumTypes' prop has all necessary active types.
};


watch(() => props.visible, (newVal) => {
  localVisible.value = newVal;
  if (newVal) {
    localPlatformTypes.value = props.platformTypes;
    allEnumTypes.value = props.enumTypes; // Update with latest from parent
    resetForm();
    if (props.isEdit && props.recordData) {
      nextTick(() => { // Ensure form is rendered before setting values
        Object.assign(formState, {
          ...props.recordData,
          enumType: props.recordData.enumType?._id || props.recordData.enumType // Handle populated or ID
        });
      });
    }
  }
});

watch(() => props.platformTypes, (newVal) => {
    localPlatformTypes.value = newVal;
});

watch(() => props.enumTypes, (newVal) => {
    allEnumTypes.value = newVal;
});


const handleSubmit = async () => {
  const valid = await configFormRef.value?.validate();
  if (valid) {
    const firstErrorField = Object.keys(valid)[0];
    if (firstErrorField && configFormRef.value?.scrollToField) {
      configFormRef.value.scrollToField(firstErrorField);
    }
    return false;
  }

  formLoading.value = true;
  try {
    const payload = { ...formState };
    const submitPayload = payload; 

    if (props.isEdit) {
      await apiService.updateEnumConfig(props.recordData._id, submitPayload);
      Message.success('配置更新成功');
    } else {
      await apiService.createEnumConfig(submitPayload);
      Message.success('配置添加成功');
    }
    emit('success');
    emit('update:visible', false);
  } catch (error) {
    Message.error((props.isEdit ? '更新' : '添加') + '配置失败: ' + (error.response?.data?.message || error.message));
  } finally {
    formLoading.value = false;
  }
};

const handleCancel = () => {
  emit('update:visible', false);
};

</script>

<style scoped>
/* Add any specific styles for the modal here */
</style>
