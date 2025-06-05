<template>
  <a-form :model="formModel" :rules="formRules" ref="formRef" layout="vertical">
    <template v-for="field in visibleFields" :key="field.props.field">
      <a-form-item
        :field="field.props.field"
        :class="{ 'has-bottom-widgets': hasBottomWidgets(field) }"
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
            :model-value="String(props.formModel[field.props.field] ?? '')"
            @update:model-value="val => props.formModel[field.props.field] = val"
            :placeholder="field.props.placeholder"
            :disabled="field.props.disabled"
          />
          <a-input-number v-else-if="field.props.inputType === 'integer' || field.props.inputType === 'float'"
            v-model="formModel[field.props.field]"
            :placeholder="field.props.placeholder"
            :min="field.props.min"
            :max="field.props.max"
            :step="field.props.step || (field.props.inputType === 'integer' ? 1 : 0.01)"
            :disabled="field.props.disabled"
          />
          <a-input-number
            v-else-if="field.props.inputType === 'randomInt'"
            v-model="props.formModel[field.props.field]"
            :placeholder="field.props.placeholder"
            :min="field.props.min"
            :max="field.props.max"
            :step="field.props.step || 1"
            :disabled="field.props.disabled"
          >
            <template #append>
              <a-tooltip content="点击生成随机数">
                <icon-sync style="cursor:pointer;" @click="generateRandomInt(field)" />
              </a-tooltip>
            </template>
          </a-input-number>
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
            :multiple="field.props.multiple"
            :loading="field.loadingOptions"
            :disabled="field.props.disabled"
            allow-clear
          >
            <a-option
              v-for="opt in field.runtimeTransformedOptions"
              :key="opt.value"
              :value="opt.value"
              :disabled="opt.disabled"
            >
              <span style="display: flex; align-items: center;">
                <span :style="opt.disabled ? 'color: #bfbfbf;' : ''">{{ opt.label }}</span>
                <a-tooltip v-if="opt.description || opt.disabled">
                  <icon-question-circle style="margin-left: 6px; color: var(--color-text-3); font-size: 14px; vertical-align: middle;" />
                  <template #content>
                    <div v-if="opt.description">{{ opt.description }}</div>
                    <div v-if="opt.disabled" style="color: #bfbfbf;">该选项未开放</div>
                  </template>
                </a-tooltip>
              </span>
            </a-option>
          </a-select>
        </template>
        <template v-else-if="field.type === 'radio'">
          <a-radio-group v-model="formModel[field.props.field]" :disabled="field.props.disabled">
            <a-radio v-for="opt in field.runtimeTransformedOptions" :key="opt.value" :value="opt.value" :disabled="opt.disabled">
              <span :style="opt.disabled ? 'color: #bfbfbf;' : ''">{{ opt.label }}</span>
              <a-tooltip v-if="opt.description || opt.disabled">
                <icon-question-circle style="margin-left: 4px; color: var(--color-text-3); font-size: 14px; vertical-align: middle;" />
                <template #content>
                  <div v-if="opt.description">{{ opt.description }}</div>
                  <div v-if="opt.disabled" style="color: #bfbfbf;">该选项未开放</div>
                </template>
              </a-tooltip>
            </a-radio>
          </a-radio-group>
        </template>
        <template v-else-if="field.type === 'checkbox'">
          <a-checkbox-group v-model="formModel[field.props.field]" :disabled="field.props.disabled">
            <a-checkbox v-for="opt in field.runtimeTransformedOptions" :key="opt.value" :value="opt.value" :disabled="opt.disabled">
              <span :style="opt.disabled ? 'color: #bfbfbf;' : ''">{{ opt.label }}</span>
              <a-tooltip v-if="opt.description || opt.disabled">
                <icon-question-circle style="margin-left: 4px; color: var(--color-text-3); font-size: 14px; vertical-align: middle;" />
                <template #content>
                  <div v-if="opt.description">{{ opt.description }}</div>
                  <div v-if="opt.disabled" style="color: #bfbfbf;">该选项未开放</div>
                </template>
              </a-tooltip>
            </a-checkbox>
          </a-checkbox-group>
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
            :action="getUploadUrl(field.props.action)"
            :file-list="formModel[field.props.field] || []"
            :accept="field.props.accept"
            :multiple="field.props.multiple"
            :limit="field.props.multiple ? field.props.limit : 1"
            :list-type="field.props.listType || 'text'"
            :drag="field.props.drag"
            :auto-upload="false"
            :placeholder="field.props.placeholder || '点击或拖拽文件上传'"
            :headers="getUploadHeaders()"
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
                        <span class="text-xs w-18">{{ field.props.gradientStart }}</span>
                      </div>
                      <div style="flex:1;" class="flex items-center gap-2">
                        <span>结束色</span>
                        <a-color-picker v-model="field.props.gradientEnd" style="width: 60px;" />
                        <span class="text-xs w-18">{{ field.props.gradientEnd }}</span>
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
              <div style="display: flex; align-items: center; gap: 12px; cursor: pointer;border-radius: 4px;background-image: linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee),linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee);background-size: 16px 16px;background-position: 0 0, 8px 8px;background-color: #fff;" @click="initCache">
                <div :style="getColorPreviewStyle(field.props, formModel[field.props.field])" style="width: 80px; height: 32px; border-radius: 4px;"></div>
              </div>
            </a-popover>
          </div>
        </template>
        <template v-else-if="field.type === 'canvas-board'">
          <div class="canvas-board-container" :style="{ position: 'relative', width: '100%' }">
            <CanvasBoard
              v-model="formModel[field.props.field]"
              :placeholder="field.props.placeholder"
              :is-mask="field.props.isMask"
              :mask-opacity="field.props.maskOpacity"
              :width="field.props.width"
              :height="field.props.height"
              :max-width="field.props.maxWidth || 2048"
              :max-height="field.props.maxHeight || 2048"
              :action="field.props.action"
              :widget-list="widgetList"
              :widget-usages="field.props.widgetUsages"
              @widget-click="(widget) => onWidgetButtonClick(widget, field)"
            />
          </div>
        </template>
        <template v-else>
          <span style="color: red;">未知或不支持的组件类型: {{ field.type }}</span>
        </template>

        <!-- 为所有字段类型渲染挂件按钮 -->
        <template v-if="field.props.widgetUsages && field.props.widgetUsages.length > 0">
          <div
            v-for="(usage, index) in field.props.widgetUsages"
            :key="index"
            class="widget-button"
            :class="[usage.position || 'topRight']"
            :style="getWidgetButtonStyle(usage.position, index, field.props.widgetUsages)"
            :title="usage.alias || getWidgetNameById(usage.widgetId)"
            @click="onWidgetButtonClick(usage, field)"
          >
            {{ usage.alias || getWidgetNameById(usage.widgetId) }}
            <span v-if="getWidgetCreditsById(usage.widgetId) > 0" style="font-size: 10px;">({{ getWidgetCreditsById(usage.widgetId) }}分)</span>
            <span v-else-if="getWidgetCreditsById(usage.widgetId) === 0" style="font-size: 10px;">(免费)</span>
          </div>
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
  Switch as ASwitch, Upload as AUpload, Button as AButton, Message, Slider as ASlider,
  Modal
} from '@arco-design/web-vue';
import { IconUpload, IconSync } from '@arco-design/web-vue/es/icon';
import clientApiService from '@/client/services/apiService'; // Ensure this path is correct
import CanvasBoard from '@/admin/components/form-builder/CanvasBoard.vue';

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
  allowedEnumOptionIds: {
    type: Object, // Set
    default: () => new Set()
  },
  // 新增：挂件列表
  widgetList: {
    type: Array,
    default: () => []
  }
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

const platformFieldOptionsCache = new Map();

// Helper function to construct correct upload URL
const getUploadUrl = (actionValue) => {
  if (!actionValue) {
    return '/api/files/form-upload/general_uploads';
  }

  // Handle legacy action values - convert old full paths to subpaths
  if (actionValue === '/api/files/upload') {
    actionValue = 'general_uploads';
  }

  // Check if action is still a complete URL path or just a subPath
  if (actionValue.startsWith('/api/')) {
    // Action is a complete URL path, use it directly
    return actionValue;
  } else {
    // Action is a subPath, construct the full URL
    return `/api/files/form-upload/${actionValue}`;
  }
};

// Helper function to get upload headers with authentication
const getUploadHeaders = () => {
  const token = localStorage.getItem('clientAccessToken');
  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

const fetchEnumOptionsForField = async (field) => {
  if (field.config?.dataSourceType === 'enum' && field.config?.enumTypeId) {
    // 平台字段：先查缓存，无则请求
    if (String(field.config.enumTypeId).startsWith('platform_')) {
      const parts = String(field.config.enumTypeId).split('_');
      if (parts.length >= 3) {
        const platformId = parts[1];
        const fieldKey = parts.slice(2).join('_');
        const cacheKey = `${platformId}_${fieldKey}`;
        let options = platformFieldOptionsCache.get(cacheKey);
        if (!options) {
          try {
            const res = await clientApiService.getPlatformFieldOptions(platformId, fieldKey);
            if (Array.isArray(res.data)) {
              options = res.data;
              platformFieldOptionsCache.set(cacheKey, options);
            } else {
              options = [];
            }
          } catch (e) {
            field.runtimeTransformedOptions = [];
            return;
          }
        }
        field.config.platformFieldOptions = options; // 也同步到 config
        const allowedIds = field.config.enumOptionIds || [];
        let filtered = options;
        if (Array.isArray(allowedIds) && allowedIds.length > 0) {
          filtered = options.filter(opt => allowedIds.includes(opt.key));
        }
        field.runtimeTransformedOptions = filtered.map(opt => ({
          label: opt.value,
          value: opt.key,
          description: opt.description || '',
          disabled: props.allowedEnumOptionIds.size > 0 && !props.allowedEnumOptionIds.has(opt.key)
        }));
        return;
      }
    }
    // 普通枚举管理
    if (enumOptionsCache.has(field.config.enumTypeId)) {
      const allowedIds = field.config.enumOptionIds || [];
      let cached = enumOptionsCache.get(field.config.enumTypeId);
      if (Array.isArray(allowedIds) && allowedIds.length > 0) {
        cached = cached.filter(opt => allowedIds.includes(opt.value));
      }
      field.runtimeTransformedOptions = cached.map(opt => ({
        ...opt,
        disabled: false
      }));
      return;
    }
    field.loadingOptions = true;
    try {
      const response = await clientApiService.getEnumConfigsByType(field.config.enumTypeId);
      if (Array.isArray(response.data)) {
        const allowedIds = field.config.enumOptionIds || [];
        let filtered = response.data;
        if (Array.isArray(allowedIds) && allowedIds.length > 0) {
          filtered = response.data.filter(opt => allowedIds.includes(opt._id));
        }
        field.runtimeTransformedOptions = filtered.map(opt => ({
          label: opt.translation || opt.name, // 优先使用 translation，fallback 到 name
          value: opt._id,
          description: opt.description || '',
          disabled: false
        }));
        enumOptionsCache.set(field.config.enumTypeId, response.data.map(opt => ({
          label: opt.translation || opt.name, // 优先使用 translation，fallback 到 name
          value: opt._id,
          description: opt.description || '',
        })));
      } else {
        field.runtimeTransformedOptions = [];
      }
    } catch (e) {
      field.runtimeTransformedOptions = [];
    } finally {
      field.loadingOptions = false;
    }
  } else if (field.config?.dataSourceType === 'manual' && field.props?.options) {
    field.runtimeTransformedOptions = field.props.options.map(opt => ({ ...opt, description: opt.description || '', disabled: false }));
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

// 生成随机整数/数组
function generateRandomInt(field) {
  const min = typeof field.props.min === 'number' ? field.props.min : 0;
  const max = typeof field.props.max === 'number' ? field.props.max : 100;
  const step = typeof field.props.step === 'number' ? field.props.step : 1;
  const range = Math.floor((max - min) / step) + 1;
  const result = min + Math.floor(Math.random() * range) * step;
  // 保持类型与 integer 一致，赋值为数字
  props.formModel[field.props.field] = result;
}

function onWidgetButtonClick(usage, field) {
  const widgetId = usage.widgetId;
  const widgetInfo = props.widgetList.find(w => w._id === widgetId);

  if (!widgetInfo) {
    Message.error('找不到挂件信息！');
    return;
  }

  const displayName = usage.alias || widgetInfo.name;
  const credits = widgetInfo.creditsConsumed === undefined ? null : widgetInfo.creditsConsumed; // Handle if creditsConsumed is not present

  let confirmContent = `确定要执行挂件 "${displayName}" 吗？`;
  if (credits !== null && credits > 0) {
    confirmContent += ` 这将消耗 ${credits} 积分。`;
  } else if (credits === 0) {
    confirmContent += ` 此操作免费。`;
  } else {
    // If credits is null or undefined, don't mention cost, or state it's not determined yet.
    // For now, let's assume if not 0 or >0, it's effectively free or cost is not applicable from client view for this action.
  }

  Modal.confirm({
    title: '执行挂件',
    content: confirmContent,
    okText: '确定执行',
    cancelText: '取消',
    onOk: async () => {
      const loadingMsg = Message.loading({ content: `正在执行挂件 "${displayName}"...`, duration: 0 });
      try {
        const payload = {
          currentFieldValue: props.formModel[field.props.field],
          formFieldKey: field.props.field,
          // You can add the full form model if the widget needs more context
          // fullFormModel: { ...props.formModel }
        };

        const response = await clientApiService.post(`/auth/client/widgets/${widgetId}/execute`, payload);
        
        // Assuming response.data directly contains the backend's JSON response
        if (response.data && response.data.success) {
          Message.success(response.data.message || `挂件 "${displayName}" 执行成功！`);
          if (response.data.updatedFieldValue !== undefined) {
            const newFormModel = { ...props.formModel };
            newFormModel[field.props.field] = response.data.updatedFieldValue;
            emit('update:formModel', newFormModel);
          }
          // TODO: Consider injecting and calling a global user credit refresh function here
          // e.g., const refreshUserData = inject('refreshUserData', null); if (refreshUserData) refreshUserData();
        } else {
          Message.error(response.data?.message || `挂件 "${displayName}" 执行失败。`);
        }
      } catch (error) {
        Message.error(error.response?.data?.message || error.message || `执行挂件 "${displayName}" 时发生错误。`);
        console.error(`Error executing widget ${widgetId}:`, error);
      } finally {
        loadingMsg.close();
      }
    },
    onCancel: () => {
      Message.info('已取消执行挂件。');
    }
  });
}

function getWidgetNameById(widgetId) {
  // 如果没有提供 widgetId，返回默认文本
  if (!widgetId) return '功能按钮';

  // 如果提供了 widgetList 并且找到了对应的 widget，动态获取其名称
  if (props.widgetList && Array.isArray(props.widgetList)) {
    const found = props.widgetList.find(w => (w._id === widgetId) || (w.id === widgetId));
    if (found) {
      // 动态读取挂件的 name 值（注意：这里不使用 alias，alias 在调用处处理）
      return found.name || found.displayName || '功能按钮';
    }
  }

  // 默认返回中文文本
  return '功能按钮';
}

function getWidgetCreditsById(widgetId) {
  if (!widgetId || !props.widgetList) return null;
  const widget = props.widgetList.find(w => w._id === widgetId);
  return widget ? widget.creditsConsumed : null;
}

// 检查字段是否包含下方挂件
function hasBottomWidgets(field) {
  if (!field.props.widgetUsages || !Array.isArray(field.props.widgetUsages)) {
    return false;
  }

  return field.props.widgetUsages.some(usage =>
    usage.position === 'bottomLeftSide' ||
    usage.position === 'bottomCenter' ||
    usage.position === 'bottomRightSide'
  );
}

// 计算挂件按钮的动态样式，避免多个挂件重叠
function getWidgetButtonStyle(position, index, allUsages) {
  if (!position || !allUsages) return {};

  // 计算当前位置的挂件在同一位置中的索引
  let positionIndex = 0;
  for (let i = 0; i < index; i++) {
    if (allUsages[i].position === position) {
      positionIndex++;
    }
  }

  const buttonWidth = 80; // 估算按钮宽度
  const buttonHeight = 28; // 估算按钮高度
  const gap = 8; // 按钮间距

  let offsetX = 0;
  let offsetY = 0;

  // 根据位置和索引计算偏移量
  switch (position) {
    case 'topLeft':
    case 'bottomLeft':
      // 左侧位置：垂直排列
      offsetY = positionIndex * (buttonHeight + gap);
      break;

    case 'topRight':
    case 'bottomRight':
      // 右侧位置：垂直排列
      offsetY = positionIndex * (buttonHeight + gap);
      break;

    case 'bottomLeftSide':
      // 下方左侧：水平排列
      offsetX = positionIndex * (buttonWidth + gap);
      break;

    case 'bottomCenter':
      // 下方中间：水平排列，居中对齐
      const samePositionCount = allUsages.filter(usage => usage.position === position).length;
      const totalWidth = samePositionCount * buttonWidth + (samePositionCount - 1) * gap;
      const startOffset = -(totalWidth / 2) + (buttonWidth / 2);
      offsetX = startOffset + positionIndex * (buttonWidth + gap);
      break;

    case 'bottomRightSide':
      // 下方右侧：水平排列，从右向左
      offsetX = -positionIndex * (buttonWidth + gap);
      break;
  }

  return {
    '--widget-offset-x': `${offsetX}px`,
    '--widget-offset-y': `${offsetY}px`,
    transform: position === 'bottomCenter'
      ? `translateX(calc(-50% + ${offsetX}px))`
      : undefined
  };
}
</script>

<style scoped>
/* Add any specific styles for your dynamic form renderer here */

/* Canvas Board Widget Buttons */
.widget-button {
  position: absolute;
  z-index: 10;
  background-color: var(--color-primary-light-1);
  color: var(--color-white);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.15);
  border: 1px solid var(--color-primary-light-3);
}

.widget-button:hover {
  background-color: var(--color-primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.2);
}

/* Position classes - 对应FormBuilder中的位置选项 */
/* 使用CSS变量来支持动态偏移，避免多个挂件重叠 */
.widget-button.topLeft {
  top: calc(38px + var(--widget-offset-y, 0px));
  left: calc(8px + var(--widget-offset-x, 0px));
}

.widget-button.topRight {
  top: calc(38px + var(--widget-offset-y, 0px));
  right: calc(8px + var(--widget-offset-x, 0px));
}

.widget-button.bottomLeft {
  bottom: calc(8px + var(--widget-offset-y, 0px));
  left: calc(8px + var(--widget-offset-x, 0px));
}

.widget-button.bottomRight {
  bottom: calc(8px + var(--widget-offset-y, 0px));
  right: calc(8px + var(--widget-offset-x, 0px));
}

/* 正下方的三个位置 */
.widget-button.bottomLeftSide {
  bottom: calc(-32px - var(--widget-offset-y, 0px));
  left: calc(0px + var(--widget-offset-x, 0px));
}

.widget-button.bottomCenter {
  bottom: calc(-32px - var(--widget-offset-y, 0px));
  left: 50%;
  /* transform 在 getWidgetButtonStyle 中动态设置 */
}

.widget-button.bottomRightSide {
  bottom: calc(-32px - var(--widget-offset-y, 0px));
  right: calc(0px + var(--widget-offset-x, 0px));
}

/* 确保包含挂件的表单项容器有正确的定位和空间 */
.arco-form-item {
  position: relative;
}

/* 为包含下方挂件的表单项添加额外的底部边距 */
.arco-form-item:has(.widget-button.bottomLeftSide),
.arco-form-item:has(.widget-button.bottomCenter),
.arco-form-item:has(.widget-button.bottomRightSide) {
  margin-bottom: 48px; /* 增加底部边距以容纳下方挂件 */
}

/* 兼容性：如果浏览器不支持:has选择器，使用类名 */
.arco-form-item.has-bottom-widgets {
  margin-bottom: 48px;
}

/* 确保画板容器有正确的定位 */
.canvas-board-container {
  position: relative;
  width: 100%;
  display: inline-block;
}

/* 确保表单控件容器有正确的定位 */
.arco-form-item-wrapper {
  position: relative;
}

.arco-form-item-label-col > label {
  min-height: 1em;
}
</style>