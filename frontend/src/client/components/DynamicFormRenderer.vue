<template>
  <a-form :model="formModel" :rules="formRules" ref="formRef" layout="vertical">
    <template v-for="field in visibleFields" :key="field.props.field">
      <a-form-item
        :field="field.props.field"
      >
        <template #label>
          <span>
            {{ field.props.label }}
            <a-tooltip v-if="field.props.description">
              <icon-question-circle />
              <template #content>{{ field.props.description }}</template>
            </a-tooltip>
          </span>
        </template>
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
        <template v-else-if="field.type === 'color-picker'">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <a-popover
              v-model:popup-visible="field._colorPickerVisible"
              position="right"
              trigger="click"
              :arrow="false"
            >
              <template #content>
                <div style="min-width: 360px; max-width: 400px;">
                  <div style="margin-bottom: 18px;">
                    <a-radio-group v-model="field.props.colorType">
                      <a-radio value="solid">纯色</a-radio>
                      <a-radio value="gradient">渐变</a-radio>
                    </a-radio-group>
                  </div>
                  <div v-if="field.props.colorType === 'solid'" class="flex items-center gap-2">
                    <a-color-picker v-model="formModel[field.props.field]" style="width: 60px;" />{{ formModel[field.props.field] }}
                  </div>
                  <div v-else>
                    <div style="display: flex; gap: 8px; align-items: center; width: 100%; justify-content: space-between; margin-bottom: 18px;">
                      <div style="flex:1;" class="flex items-center gap-2">
                        <span>起始色</span>
                        <a-color-picker v-model="field.props.gradientStart" style="width: 60px;" />
                        <span class="text-xs w-14">{{ field.props.gradientStart }}</span>
                      </div>
                      <div style="flex:1;" class="flex items-center gap-2">
                        <span>结束色</span>
                        <a-color-picker v-model="field.props.gradientEnd" style="width: 60px;" />
                        <span class="text-xs w-14">{{ field.props.gradientEnd }}</span>
                      </div>
                    </div>
                    <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 12px;">
                      <div style="flex:1;">
                        <span style="font-size: 13px;">起始色占比</span>
                        <a-slider v-model="field.props.gradientStartPercent" :min="0" :max="100" :step="1" style="width: 120px; margin-left: 8px;" />
                        <span style="margin-left: 18px;">{{ field.props.gradientStartPercent ?? 0 }}%</span>
                      </div>
                      <div style="flex:1;">
                        <span style="font-size: 13px;">结束色占比</span>
                        <a-slider v-model="field.props.gradientEndPercent" :min="0" :max="100" :step="1" style="width: 120px; margin-left: 8px;" />
                        <span style="margin-left: 18px;">{{ field.props.gradientEndPercent ?? 100 }}%</span>
                      </div>
                    </div>
                    <div style="margin-bottom: 18px;">
                      <a-radio-group v-model="field.props.gradientType">
                        <a-radio value="linear">线性渐变</a-radio>
                        <a-radio value="radial">径向渐变</a-radio>
                        <a-radio value="conic">角度渐变</a-radio>
                      </a-radio-group>
                    </div>
                    <div v-if="field.props.gradientType === 'linear'" style="margin-bottom: 8px;">
                      <span>方向 (角度)</span>
                      <a-slider v-model="field.props.gradientAngle" :min="0" :max="360" :step="1" style="width: 180px; display: inline-block; margin-left: 8px;" />
                      <span style="margin-left: 8px;">{{ field.props.gradientAngle || 0 }}°</span>
                    </div>
                    <div v-if="field.props.gradientType === 'radial'" style="margin-bottom: 8px;">
                      <div>
                        <span>中心位置 X</span>
                        <a-slider v-model="field.props.radialX" :min="0" :max="100" :step="1" style="width: 120px; display: inline-block; margin-left: 8px;" />
                        <span style="margin-left: 8px;">{{ field.props.radialX !== undefined ? field.props.radialX : 50 }}%</span>
                      </div>
                      <div>
                        <span>中心位置 Y</span>
                        <a-slider v-model="field.props.radialY" :min="0" :max="100" :step="1" style="width: 120px; display: inline-block; margin-left: 8px;" />
                        <span style="margin-left: 8px;">{{ field.props.radialY !== undefined ? field.props.radialY : 50 }}%</span>
                      </div>
                    </div>
                    <div v-if="field.props.gradientType === 'conic'" style="margin-bottom: 8px;">
                      <span>旋转角度</span>
                      <a-slider v-model="field.props.conicAngle" :min="0" :max="360" :step="1" style="width: 180px; display: inline-block; margin-left: 8px;" />
                      <span style="margin-left: 8px;">{{ field.props.conicAngle || 0 }}°</span>
                    </div>
                  </div>
                </div>
              </template>
              <div style="display: flex; align-items: center; gap: 12px; cursor: pointer;" @click="initCache">
                <div :style="getColorPreviewStyle(field.props, formModel[field.props.field])" style="width: 80px; height: 32px; border-radius: 4px;"></div>
              </div>
            </a-popover>
          </div>
        </template>
        <template v-else>
          <span style="color: red;">未知或不支持的组件类型: {{ field.type }}</span>
        </template>
      </a-form-item>
    </template>
  </a-form>
</template>

<script setup>
import { ref, watchEffect, defineProps, defineEmits, computed, watch, nextTick } from 'vue';
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

// ====== 表单初始数据缓存与重置机制 ======
const initialFormModel = ref(null);

// 初始化缓存（弹窗打开或颜色块点击时调用）
const initCache = () => {
  initialFormModel.value = JSON.parse(JSON.stringify(props.formModel));
};

// 还原表单（取消时调用）
const resetForm = () => {
  if (initialFormModel.value) {
    emit('update:formModel', JSON.parse(JSON.stringify(initialFormModel.value)));
  }
};

// 清空缓存（确定、取消、关闭、刷新时调用）
const clearCache = () => {
  initialFormModel.value = null;
};

// ====== END ======

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
  getFormData: () => props.formModel,
  initCache,
  resetForm,
  clearCache,
});

const getColorPreviewStyle = (props, solidValue) => {
  if (props.colorType === 'solid') {
    return { background: solidValue || props.solidColor || '#1677ff' };
  } else if (props.colorType === 'gradient') {
    // 兼容起止色占比
    const startPercent = typeof props.gradientStartPercent === 'number' ? props.gradientStartPercent : 0;
    const endPercent = typeof props.gradientEndPercent === 'number' ? props.gradientEndPercent : 100;
    if (props.gradientType === 'linear') {
      const angle = typeof props.gradientAngle === 'number' ? props.gradientAngle : 0;
      return { background: `linear-gradient(${angle}deg, ${props.gradientStart || '#1677ff'} ${startPercent}%, ${props.gradientEnd || '#ff4d4f'} ${endPercent}%)` };
    } else if (props.gradientType === 'radial') {
      const x = typeof props.radialX === 'number' ? props.radialX : 50;
      const y = typeof props.radialY === 'number' ? props.radialY : 50;
      return { background: `radial-gradient(circle at ${x}% ${y}%, ${props.gradientStart || '#1677ff'} ${startPercent}%, ${props.gradientEnd || '#ff4d4f'} ${endPercent}%)` };
    } else if (props.gradientType === 'conic') {
      const angle = typeof props.conicAngle === 'number' ? props.conicAngle : 0;
      return { background: `conic-gradient(from ${angle}deg, ${props.gradientStart || '#1677ff'} ${startPercent}%, ${props.gradientEnd || '#ff4d4f'} ${endPercent}%)` };
    }
  }
  return { background: '#1677ff' };
};

// 初始化 gradientStartPercent/gradientEndPercent
watchEffect(() => {
  for (const field of props.fields) {
    if (field.type === 'color-picker' && field.props.colorType === 'gradient') {
      if (typeof field.props.gradientStartPercent !== 'number') field.props.gradientStartPercent = 0;
      if (typeof field.props.gradientEndPercent !== 'number') field.props.gradientEndPercent = 100;
    }
  }
});

</script>

<style scoped>
/* Add any specific styles for your dynamic form renderer here */
.arco-form-item-label-col > label { /* Example to ensure labels are visible if they become empty */
  min-height: 1em; 
}
</style>