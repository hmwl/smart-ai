<template>
  <a-form :model="formModel" :rules="formRules" ref="formRef" layout="vertical">
    <template v-for="field in visibleFields" :key="field.props.field">
      <a-form-item
        :field="field.props.field"
        :label="field.props.label"
        :tooltip="field.props.tooltip" 
        :help="field.props.helpText"
        :hide-label="!field.props.label" 
      >
        <!-- Conditional rendering for each field type -->
        <template v-if="field.type === 'input'">
          <a-input v-if="!field.props.inputType || field.props.inputType === 'string'"
            v-model="formModel[field.props.field]"
            :placeholder="field.props.placeholder"
            :disabled="field.props.disabled"
          />
          <a-input-number v-else
            v-model="formModel[field.props.field]"
            :placeholder="field.props.placeholder"
            :min="field.props.min"
            :max="field.props.max"
            :step="field.props.step || (field.props.inputType === 'integer' ? 1 : 0.01)"
            :disabled="field.props.disabled"
          />
        </template>
        <template v-else-if="field.type === 'slider'">
          <a-row align="middle" style="width:100%;">
            <a-col :span="22">
              <a-slider
                v-model="formModel[field.props.field]"
                :min="field.props.min !== undefined ? field.props.min : 0"
                :max="field.props.max !== undefined ? field.props.max : 100"
                :step="field.props.step !== undefined ? field.props.step : 1"
                :disabled="field.props.disabled"
                style="width:100%;"
              />
            </a-col>
            <a-col :span="2" style="padding-left:10px;">
              <span style="font-size:13px;">{{ formModel[field.props.field] }}</span>
            </a-col>
          </a-row>
        </template>
        <template v-else-if="field.type === 'textarea'">
          <a-textarea v-model="formModel[field.props.field]" :placeholder="field.props.placeholder" :auto-size="field.props.autoSize" :disabled="field.props.disabled"/>
        </template>
        <template v-else-if="field.type === 'select'">
          <a-select
            v-model="formModel[field.props.field]"
            :placeholder="field.props.placeholder"
            :options="field.runtimeTransformedOptions" 
            :multiple="field.props.multiple"
            :loading="field.loadingOptions" 
            :disabled="field.props.disabled"
            allow-clear
          />
        </template>
        <template v-else-if="field.type === 'radio'">
          <a-radio-group
            v-model="formModel[field.props.field]"
            :options="field.runtimeTransformedOptions"
            :disabled="field.props.disabled"
          />
        </template>
        <template v-else-if="field.type === 'checkbox'">
          <a-checkbox-group
            v-model="formModel[field.props.field]"
            :options="field.runtimeTransformedOptions"
            :disabled="field.props.disabled"
          />
        </template>
        <template v-else-if="field.type === 'switch'">
          <a-switch 
            v-model="formModel[field.props.field]" 
            :checked-value="field.props.checkedValue !== undefined ? field.props.checkedValue : true" 
            :unchecked-value="field.props.uncheckedValue !== undefined ? field.props.uncheckedValue : false" 
            :disabled="field.props.disabled"
          />
        </template>
        <template v-else-if="field.type === 'upload'">
          <a-upload
            :action="field.props.action || '/api/files/upload'" 
            :file-list="formModel[field.props.field] || []"
            :accept="field.props.accept"
            :multiple="field.props.multiple"
            :limit="field.props.multiple ? field.props.limit : 1"
            :list-type="field.props.listType || 'text'"
            :drag="field.props.drag"
            :auto-upload="field.props.autoUpload !== undefined ? field.props.autoUpload : true"
            :placeholder="field.props.placeholder || '点击或拖拽文件上传'"
            @change="(fileList, fileItem) => handleUploadChange(fileList, fileItem, field.props.field)"
            @success="(fileItem) => handleUploadSuccess(fileItem, field.props.field)"
            @error="(fileItem) => handleUploadError(fileItem, field.props.field)"
            :disabled="field.props.disabled"
          >
            <template v-if="field.props.listType !== 'picture-card' && field.props.listType !== 'picture' && !field.props.drag">
                <a-button :disabled="field.props.disabled">
                    <template #icon><icon-upload /></template>
                    {{ field.props.placeholder || '选择文件' }}
                </a-button>
            </template>
             <template v-else-if="field.props.drag && field.props.listType !== 'picture-card' && field.props.listType !== 'picture'">
                <div style="padding: 20px; border: 1px dashed #d9d9d9; border-radius: 4px; text-align: center;">
                    <icon-upload :style="{fontSize: '24px', marginBottom: '10px'}" /><br/>
                    {{ field.props.placeholder || '点击或拖拽文件到此区域上传' }}
                </div>
            </template>
          </a-upload>
        </template>
        <template v-else>
          <span style="color: red;">未知或不支持的组件类型: {{ field.type }}</span>
        </template>
      </a-form-item>
    </template>
  </a-form>
</template>

<script setup>
import { ref, watchEffect, defineProps, defineEmits, computed } from 'vue';
import {
  Form as AForm, FormItem as AFormItem, Input as AInput, Textarea as ATextarea,
  Select as ASelect, RadioGroup as ARadioGroup, CheckboxGroup as ACheckboxGroup,
  Switch as ASwitch, Upload as AUpload, Button as AButton, Message, Slider as ASlider
} from '@arco-design/web-vue';
import { IconUpload } from '@arco-design/web-vue/es/icon';
import clientApiService from '@/client/services/apiService'; // Ensure this path is correct

const props = defineProps({
  fields: {
    type: Array,
    required: true,
    default: () => []
  },
  formModel: {
    type: Object,
    required: true,
    default: () => ({})
  },
  // Add any other props like layout, etc., if needed
});

const emit = defineEmits(['update:formModel']);

const internalFields = ref([]);

// 顶部加缓存
const enumOptionsCache = new Map();

// Function to fetch enum options for a field
const fetchEnumOptionsForField = async (field) => {
  if (field.config?.dataSourceType === 'enum' && field.config?.enumTypeId) {
    if (enumOptionsCache.has(field.config.enumTypeId)) {
      field.runtimeTransformedOptions = enumOptionsCache.get(field.config.enumTypeId);
      return;
    }
    field.loadingOptions = true;
    try {
      const response = await clientApiService.getEnumConfigsByType(field.config.enumTypeId);
      const options = (response.data || []).map(conf => ({
        label: conf.translation || conf.name,
        value: conf._id,
      }));
      field.runtimeTransformedOptions = options;
      enumOptionsCache.set(field.config.enumTypeId, options);
    } catch (error) {
      Message.error(`Failed to load options for field ${field.props.label || field.props.field}: ${error.message}`);
      field.runtimeTransformedOptions = [];
    } finally {
      field.loadingOptions = false;
    }
  } else if (field.config?.dataSourceType === 'manual' && field.props?.options) {
    field.runtimeTransformedOptions = field.props.options.map(opt => ({ ...opt }));
  } else {
    field.runtimeTransformedOptions = [];
  }
};

watchEffect(async () => {
  const newModel = { ...props.formModel };
  const processedFields = [];

  for (const field of props.fields) {
    const newField = JSON.parse(JSON.stringify(field)); // Deep clone to avoid mutating prop
    newField.loadingOptions = false; // Initialize loading state

    // Initialize formModel with default values if not already present
    if (!(newField.props.field in newModel)) {
      if (newField.props.defaultValue !== undefined) {
        // inputType 为 integer/float 时转为 number
        if (newField.type === 'input' && newField.props.inputType && newField.props.inputType !== 'string') {
          const n = Number(newField.props.defaultValue);
          newModel[newField.props.field] = Number.isNaN(n) ? undefined : n;
        } else if (newField.type === 'slider') {
          const n = Number(newField.props.defaultValue);
          newModel[newField.props.field] = Number.isNaN(n) ? undefined : n;
        } else {
          newModel[newField.props.field] = newField.props.defaultValue;
        }
      } else if (newField.type === 'checkbox') {
        newModel[newField.props.field] = [];
      } else if (newField.type === 'switch') {
        newModel[newField.props.field] = newField.props.uncheckedValue !== undefined ? newField.props.uncheckedValue : false;
      } else if (newField.type === 'upload') {
        newModel[newField.props.field] = [];
      } else {
        newModel[newField.props.field] = undefined;
      }
    }

    // Initialize file list for existing upload fields if necessary (as before)
    if (newField.type === 'upload' && newModel[newField.props.field] && !Array.isArray(newModel[newField.props.field])) {
      // This logic might need adjustment based on how backend returns stored file info
      // For now, assuming it needs to be an array.
      console.warn('Upload field was not an array, re-initializing as empty array. Data might be lost if not handled.');
      newModel[newField.props.field] = [];
    }
    
    await fetchEnumOptionsForField(newField); // Fetch options if needed
    processedFields.push(newField);
  }
  
  internalFields.value = processedFields;
  // Only emit update if the model actually changed to avoid infinite loops
  // A deep comparison might be better if default value logic is complex
  if (JSON.stringify(newModel) !== JSON.stringify(props.formModel)) {
    emit('update:formModel', newModel);
  }
});

const handleUploadChange = (fileList, fileItem, formFieldKey) => {
  const newModel = { ...props.formModel };
  const processedList = fileList.map(f => {
    if (f.response && f.status === 'done') {
      return {
        ...f,
        url: f.response.url || f.url, 
        serverFileId: f.response.fileId 
      };
    }
    return f;
  });
  newModel[formFieldKey] = [...processedList];
  emit('update:formModel', newModel);
};

const handleUploadSuccess = (fileItem, formFieldKey) => {
  Message.success(`${fileItem.name} 上传成功!`);
};

const handleUploadError = (fileItem, formFieldKey) => {
  Message.error(`${fileItem.name} 上传失败.`);
  const newModel = { ...props.formModel };
  newModel[formFieldKey] = (newModel[formFieldKey] || []).filter(f => f.uid !== fileItem.uid);
  emit('update:formModel', newModel);
};

// Helper function for conditional logic (must be defined before visibleFields)
const checkCondition = (triggerFieldId, conditionType, conditionValue) => {
  if (!triggerFieldId || !conditionType) return true; // Or false, depending on desired behavior for incomplete rules

  const triggerFieldDefinition = props.fields.find(f => f.id === triggerFieldId);
  if (!triggerFieldDefinition) return false; // Trigger field not found

  const actualValue = props.formModel[triggerFieldDefinition.props.field];

  switch (conditionType) {
    case 'equals':
      return actualValue === conditionValue;
    case 'not_equals':
      return actualValue !== conditionValue;
    case 'contains': // Primarily for checkbox group
      return Array.isArray(actualValue) && actualValue.includes(conditionValue);
    case 'not_contains': // Primarily for checkbox group
      return Array.isArray(actualValue) && !actualValue.includes(conditionValue);
    // Add other conditions like greater_than, less_than etc. if needed
    default:
      return false;
  }
};

const visibleFields = computed(() => {
  return internalFields.value.filter(field => {
    if (field.config?.enableConditionalLogic && field.config.conditionalLogicRules?.length > 0) {
      const rules = field.config.conditionalLogicRules;
      const operator = field.config.conditionalLogicOperator || 'AND';
      const visibilityAction = field.config.conditionalLogicVisibilityAction || 'show';

      let overallConditionMet;
      if (operator === 'AND') {
        overallConditionMet = rules.every(rule => 
          checkCondition(rule.triggerFieldId, rule.conditionType, rule.conditionValue)
        );
      } else { // OR
        overallConditionMet = rules.some(rule => 
          checkCondition(rule.triggerFieldId, rule.conditionType, rule.conditionValue)
        );
      }

      if (visibilityAction === 'show') return overallConditionMet;
      if (visibilityAction === 'hide') return !overallConditionMet;
      if (visibilityAction === 'none') return true;
    }
    return true;
  });
});

const formRules = computed(() => {
  const rules = {};
  visibleFields.value.forEach(field => {
    if (field.props.field) { // Ensure field key exists
      const fieldRules = [];
      let isActuallyRequired = field.props.required; // Start with static required prop

      // Check conditional logic for required status
      if (field.config?.enableConditionalLogic && field.config.conditionalLogicRules?.length > 0) {
        const rules = field.config.conditionalLogicRules;
        const operator = field.config.conditionalLogicOperator || 'AND';
        const requiredAction = field.config.conditionalLogicRequiredAction;

        let overallConditionMet;
        if (operator === 'AND') {
          overallConditionMet = rules.every(rule => checkCondition(rule.triggerFieldId, rule.conditionType, rule.conditionValue));
        } else { // OR
          overallConditionMet = rules.some(rule => checkCondition(rule.triggerFieldId, rule.conditionType, rule.conditionValue));
        }

        if (overallConditionMet) {
          if (requiredAction === 'setRequired') isActuallyRequired = true;
          else if (requiredAction === 'setOptional') isActuallyRequired = false;
        }
      }

      if (isActuallyRequired) {
        fieldRules.push({ required: true, message: `${field.props.label || '此项'}不能为空` });
      }
      // Add other rules like type, length, pattern etc. based on field.props
      if (field.props.maxLength) {
        fieldRules.push({ maxLength: field.props.maxLength, message: `长度不能超过 ${field.props.maxLength} 个字符` });
      }
      rules[field.props.field] = fieldRules;
    }
  });
  return rules;
});

const formRef = ref(null); // Ref for the <a-form> component

const validateForm = async () => {
  if (formRef.value) {
    const errors = await formRef.value.validate();
    if (errors) {
      return false; // Validation failed
    }
    return true; // Validation passed
  }
  return true; // No form ref, assume valid (or handle as error)
};

// Expose validateForm method to be called from parent
defineExpose({
  validateForm,
  getFormData: () => props.formModel
});

</script>

<style scoped>
/* Add any specific styles for your dynamic form renderer here */
.arco-form-item-label-col > label { /* Example to ensure labels are visible if they become empty */
  min-height: 1em; 
}
</style>