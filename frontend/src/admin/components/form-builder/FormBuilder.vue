<template>
  <div class="form-builder-wrapper">
    <!-- ComfyUI Specific Header -->
    <div v-if="isComfyUI" class="comfyui-header">
      <a-upload
        action="/api/placeholder-upload-endpoint" 
        :show-file-list="false"
        accept=".json" 
        @success="handleComfyUIJsonUpload"
        @error="handleComfyUIJsonError"
      >
        <a-button type="primary">
          <template #icon><icon-upload /></template> 上传 ComfyUI JSON
        </a-button>
      </a-upload>
      <div class="comfyui-outputs">
        <a-input v-model="comfyUIOutputNodeId" placeholder="输出节点ID" style="width: 150px;" />
        <a-select v-model="comfyUIOutputType" placeholder="输出类型" style="width: 150px;">
          <a-option value="image">图片</a-option>
          <a-option value="audio">音频</a-option>
          <a-option value="video">视频</a-option>
          <a-option value="text">文字</a-option>
          <a-option value="3d">3D</a-option>
          <a-option value="custom">自定义</a-option>
        </a-select>
        <a-input v-if="comfyUIOutputType === 'custom'" v-model="comfyUICustomOutputKey" placeholder="自定义输出Key" style="width: 150px;" />
      </div>
    </div>

    <div class="form-builder-container" :class="{ 'with-comfyui-header': isComfyUI }">
      <div class="palette">
        <h3 class="panel-title">组件</h3>
        <draggable
          class="draggable-list"
          :list="availableComponents"
          :group="{ name: 'form-elements', pull: 'clone', put: false }"
          item-key="type"
          :clone="cloneComponent"
          @end="onDragEndPalette"
        >
          <template #item="{ element }">
            <div class="palette-item">
              <icon-drag-arrow class="drag-handle" /> 
              {{ element.label }}
            </div>
          </template>
        </draggable>
      </div>

      <div class="canvas">
        <h3 class="panel-title">表单预览【{{ props.applicationName || '未命名应用' }} ({{ props.applicationId || 'N/A' }})】</h3>
        <draggable
          class="form-drop-zone"
          :list="formFields"
          group="form-elements"
          item-key="id"
          @add="onDropToCanvas"
          @update="onUpdateCanvas"
        >
          <template #item="{ element, index }">
            <div 
              class="form-field-wrapper"
              :class="{ 'selected': selectedField && selectedField.id === element.id }"
              @click="selectField(element)"
            >
              <div class="canvas-field-label-container">
                <label v-if="element.props && (element.props.label || element.props.nodeId)" class="canvas-field-label">
                  <span v-if="element.props.label">
                    {{ element.props.label }}
                    <a-tooltip v-if="element.props.description">
                      <icon-question-circle />
                      <template #content>{{ element.props.description }}</template>
                    </a-tooltip>
                  </span>
                  <span v-if="element.props.nodeId" class="canvas-field-node-id">
                    (ID: {{ element.props.nodeId }} {{ element.props.key ? `[${element.props.key}]` : '' }})
                  </span>
                  <span v-if="element.props.required && element.props.label" class="canvas-field-required-indicator">*</span>
                </label>
                <component 
                  :is="getVueComponent(element.type)" 
                  v-bind="element.props"
                  :disabled="true" 
                  class="form-field-preview"
                  :options="(element.type === 'radio' || element.type === 'checkbox') && element.config.dataSourceType === 'enum' && element.runtimeAvailableEnumOptions && element.config.enumOptionIds ? element.runtimeAvailableEnumOptions.filter(conf => element.config.enumOptionIds.includes(conf._id)).map(conf => ({ label: conf.translation || conf.name, value: conf._id })) : element.props.options"
                  :model-value="element.type === 'switch' ? (element.props.defaultValue === element.props.checkedValue) : element.props.defaultValue"
                />
              </div>
              <div class="field-actions">
                <a-button type="text" size="mini" status="danger" @click.stop="removeField(index)"><icon-delete /></a-button>
              </div>
            </div>
          </template>
        </draggable>
        <div v-if="!formFields.length" class="empty-canvas-placeholder">
          从左侧拖拽组件到此处
        </div>
      </div>

      <div class="properties">
        <h3 class="panel-title">属性设置</h3>
        <div v-if="selectedField" class="properties-content">
          <h4>{{ selectedField.config.label }} ({{ selectedField.type }})</h4>
          <a-form :model="selectedField.props" layout="vertical">
            <a-form-item label="节点ID" tooltip="节点标识，用于对接或逻辑处理">
              <a-input v-model="selectedField.props.nodeId" placeholder="请输入节点ID" />
            </a-form-item>
            <a-form-item v-if="isComfyUI" label="Key (唯一标识)" required>
              <a-input v-model="selectedField.props.key" placeholder="请输入唯一Key（如：prompt、steps）" />
            </a-form-item>
            <a-form-item>
              <template #label>
                <span>标签文字<a-tooltip v-if="selectedField.props.description"><icon-question-circle /><template #content>{{selectedField.props.description}}</template></a-tooltip></span>
              </template>
              <a-input v-model="selectedField.props.label" />
            </a-form-item>
            <a-form-item label="占位提示">
              <a-input v-model="selectedField.props.placeholder" />
            </a-form-item>
            <a-form-item label="说明">
              <a-input v-model="selectedField.props.description" placeholder="可填写该字段的说明" />
            </a-form-item>

            <!-- Input Specific Properties -->
            <template v-if="selectedField.type === 'input'">
              <a-divider>输入框设置</a-divider>
              <a-form-item label="默认值">
                <a-input v-model="selectedField.props.defaultValue" />
              </a-form-item>
              <a-form-item label="类型">
                <a-select v-model="selectedField.props.inputType">
                  <a-option value="string">字符串</a-option>
                  <a-option value="integer">整数</a-option>
                  <a-option value="float">小数</a-option>
                </a-select>
              </a-form-item>
              <a-form-item v-if="selectedField.props.inputType === 'integer' || selectedField.props.inputType === 'float'" label="最小值">
                <a-input-number v-model="selectedField.props.min" :step="selectedField.props.inputType === 'integer' ? 1 : 0.01" />
              </a-form-item>
              <a-form-item v-if="selectedField.props.inputType === 'integer' || selectedField.props.inputType === 'float'" label="最大值">
                <a-input-number v-model="selectedField.props.max" :step="selectedField.props.inputType === 'integer' ? 1 : 0.01" />
              </a-form-item>
              <a-form-item v-if="selectedField.props.inputType === 'integer' || selectedField.props.inputType === 'float'" label="步幅">
                <a-input-number v-model="selectedField.props.step" :step="selectedField.props.inputType === 'integer' ? 1 : 0.01" />
              </a-form-item>
            </template>

            <!-- Textarea Specific Properties -->
            <template v-if="selectedField.type === 'textarea'">
              <a-divider>多行文本框设置</a-divider>
              <a-form-item label="默认值">
                <a-input v-model="selectedField.props.defaultValue" />
              </a-form-item>
            </template>

            <!-- Slider Specific Properties -->
            <template v-if="selectedField.type === 'slider'">
              <a-divider>滑竿设置</a-divider>
              <a-form-item label="默认值">
                <a-input-number v-model="selectedField.props.defaultValue" />
              </a-form-item>
              <a-form-item label="最小值">
                <a-input-number v-model="selectedField.props.min" />
              </a-form-item>
              <a-form-item label="最大值">
                <a-input-number v-model="selectedField.props.max" />
              </a-form-item>
              <a-form-item label="步幅">
                <a-input-number v-model="selectedField.props.step" />
              </a-form-item>
            </template>

            <!-- Checkbox Group Specific Properties -->
            <template v-if="selectedField.type === 'checkbox'">
              <a-divider>复选框组设置</a-divider>
              <a-form-item label="数据来源">
                <a-select v-model="selectedField.config.dataSourceType" placeholder="选择数据来源">
                  <a-option value="manual">手动输入</a-option>
                  <a-option value="enum">枚举数据</a-option>
                </a-select>
              </a-form-item>
              <div v-if="selectedField.config.dataSourceType === 'manual'">
                <a-form-item label="选项">
                  <div class="manual-options-container">
                    <div v-for="(option, index) in selectedField.props.options" :key="index" class="option-editor-block">
                      <div class="flex items-center justify-between"><strong class="option-editor-title">选项 {{ index + 1 }}</strong><a-button type="text" status="danger" @click="removeOption(selectedField, index)"><icon-minus-circle /> 删除</a-button></div>
                      <a-input v-model="option.label" placeholder="显示文本 (例如：是)" />
                      <a-input v-model="option.value" placeholder="选项值 (例如：yes)" />
                    </div>
                  </div>
                </a-form-item>
                <a-button type="dashed" @click="addOption(selectedField)" style="width:100%; margin-bottom: 20px;"><icon-plus /> 添加选项</a-button>
              </div>
              <div v-if="selectedField.config.dataSourceType === 'enum'">
                <a-form-item label="选择枚举类型">
                  <a-select 
                    v-model="selectedField.config.enumTypeId"
                    placeholder="选择一个枚举类型"
                    :loading="loadingEnumTypes"
                    show-search
                    allow-clear
                    @focus="fetchEnumTypes" 
                    @change="onEnumTypeChange(selectedField)" 
                  >
                    <a-option v-for="enumType in availableEnumTypes" :key="enumType._id" :value="enumType._id">
                      {{ enumType.name }} ({{ enumType.platform }})
                    </a-option>
                  </a-select>
                </a-form-item>
                <a-form-item v-if="selectedField.config.enumTypeId" label="选择枚举值 (可多选)">
                  <a-select
                    v-model="selectedField.config.enumOptionIds"
                    placeholder="选择一个或多个枚举值"
                    :loading="loadingEnumConfigsForType"
                    multiple
                    show-search
                    allow-clear
                    :max-tag-count="3"
                  >
                    <a-option v-for="enumConf in enumConfigsOfSelectedType" :key="enumConf._id" :value="enumConf._id">
                      {{ enumConf.translation }} ({{ enumConf.name }})
                    </a-option>
                  </a-select>
                </a-form-item>
              </div>
              <a-form-item label="默认选中项">
                <a-checkbox-group v-model="selectedField.props.defaultValue">
                  <a-checkbox 
                    v-for="option in getOptionsForDefaultValue(selectedField)" 
                    :key="option.idValue" 
                    :value="option.idValue"
                  >
                    {{ option.displayLabel }}
                  </a-checkbox>
                </a-checkbox-group>
              </a-form-item>
            </template>

            <!-- Radio Group Specific Properties -->
            <template v-if="selectedField.type === 'radio'">
              <a-divider>单选框组设置</a-divider>
              <a-form-item label="数据来源">
                <a-select v-model="selectedField.config.dataSourceType" placeholder="选择数据来源">
                  <a-option value="manual">手动输入</a-option>
                  <a-option value="enum">枚举数据</a-option>
                </a-select>
              </a-form-item>
              <div v-if="selectedField.config.dataSourceType === 'manual'">
                <a-form-item label="选项">
                  <div class="manual-options-container">
                    <div v-for="(option, index) in selectedField.props.options" :key="index" class="option-editor-block">
                      <div class="flex items-center justify-between"><strong class="option-editor-title">选项 {{ index + 1 }}</strong><a-button type="text" status="danger" @click="removeOption(selectedField, index)"><icon-minus-circle /> 删除</a-button></div>
                      <a-input v-model="option.label" placeholder="显示文本 (例如：是)" />
                      <a-input v-model="option.value" placeholder="选项值 (例如：yes)" />
                    </div>
                  </div>
                </a-form-item>
                <a-button type="dashed" @click="addOption(selectedField)" style="width:100%; margin-bottom: 20px;"><icon-plus /> 添加选项</a-button>
              </div>
              <div v-if="selectedField.config.dataSourceType === 'enum'">
                <a-form-item label="选择枚举类型">
                  <a-select 
                    v-model="selectedField.config.enumTypeId"
                    placeholder="选择一个枚举类型"
                    :loading="loadingEnumTypes"
                    show-search
                    allow-clear
                    @focus="fetchEnumTypes" 
                    @change="onEnumTypeChange(selectedField)" 
                  >
                    <a-option v-for="enumType in availableEnumTypes" :key="enumType._id" :value="enumType._id">
                      {{ enumType.name }} ({{ enumType.platform }})
                    </a-option>
                  </a-select>
                </a-form-item>
                <a-form-item v-if="selectedField.config.enumTypeId" label="选择枚举值 (可多选)">
                  <a-select
                    v-model="selectedField.config.enumOptionIds"
                    placeholder="选择一个或多个枚举值"
                    :loading="loadingEnumConfigsForType"
                    multiple
                    show-search
                    allow-clear
                    :max-tag-count="3"
                  >
                    <a-option v-for="enumConf in enumConfigsOfSelectedType" :key="enumConf._id" :value="enumConf._id">
                      {{ enumConf.translation }} ({{ enumConf.name }})
                    </a-option>
                  </a-select>
                </a-form-item>
              </div>
              <a-form-item label="默认选中项">
                <a-radio-group v-model="selectedField.props.defaultValue">
                  <a-radio 
                    v-for="option in getOptionsForDefaultValue(selectedField)" 
                    :key="option.idValue" 
                    :value="option.idValue"
                  >
                    {{ option.displayLabel }}
                  </a-radio>
                </a-radio-group>
                 <a-button 
                    type="text" 
                    size="mini" 
                    v-if="selectedField.props.defaultValue !== undefined"
                    @click="selectedField.props.defaultValue = undefined"
                    style="margin-left: 10px;"
                  >
                    清除默认值
                </a-button>
              </a-form-item>
            </template>

            <!-- Select Specific Properties -->
            <template v-if="selectedField.type === 'select'">
              <a-divider>下拉框设置</a-divider>
              <a-form-item label="数据来源">
                <a-select v-model="selectedField.config.dataSourceType" placeholder="选择数据来源">
                  <a-option value="manual">手动输入</a-option>
                  <a-option value="enum">枚举数据</a-option>
                </a-select>
              </a-form-item>
              <div v-if="selectedField.config.dataSourceType === 'manual'">
                <a-form-item label="选项">
                  <div class="manual-options-container">
                    <div v-for="(option, index) in selectedField.props.options" :key="index" class="option-editor-block">
                      <div class="flex items-center justify-between"><strong class="option-editor-title">选项 {{ index + 1 }}</strong><a-button type="text" status="danger" @click="removeOption(selectedField, index)"><icon-minus-circle /> 删除</a-button></div>
                      <a-input v-model="option.label" placeholder="显示文本 (例如：是)" />
                      <a-input v-model="option.value" placeholder="选项值 (例如：yes)" />
                    </div>
                  </div>
                </a-form-item>
                <a-button type="dashed" @click="addOption(selectedField)" style="width:100%; margin-bottom: 20px;"><icon-plus /> 添加选项</a-button>
              </div>
              <div v-if="selectedField.config.dataSourceType === 'enum'">
                <a-form-item label="选择枚举类型">
                  <a-select 
                    v-model="selectedField.config.enumTypeId"
                    placeholder="选择一个枚举类型"
                    :loading="loadingEnumTypes"
                    show-search
                    allow-clear
                    @focus="fetchEnumTypes" 
                    @change="onEnumTypeChange(selectedField)" 
                  >
                    <a-option v-for="enumType in availableEnumTypes" :key="enumType._id" :value="enumType._id">
                      {{ enumType.name }} ({{ enumType.platform }})
                    </a-option>
                  </a-select>
                </a-form-item>
                <a-form-item v-if="selectedField.config.enumTypeId" label="选择枚举值 (可多选)">
                  <a-select
                    v-model="selectedField.config.enumOptionIds"
                    placeholder="选择一个或多个枚举值"
                    :loading="loadingEnumConfigsForType"
                    multiple
                    show-search
                    allow-clear
                    :max-tag-count="3"
                  >
                    <a-option v-for="enumConf in enumConfigsOfSelectedType" :key="enumConf._id" :value="enumConf._id">
                      {{ enumConf.translation }} ({{ enumConf.name }})
                    </a-option>
                  </a-select>
                </a-form-item>
              </div>
              <a-form-item label="默认选中项">
                <a-checkbox-group v-model="selectedField.props.defaultValue">
                  <a-checkbox 
                    v-for="option in getOptionsForDefaultValue(selectedField)" 
                    :key="option.idValue" 
                    :value="option.idValue"
                  >
                    {{ option.displayLabel }}
                  </a-checkbox>
                </a-checkbox-group>
              </a-form-item>
            </template>

            <!-- Slider Specific Properties -->
            <template v-if="selectedField.type === 'slider'">
              <a-divider>滑竿设置</a-divider>
              <a-form-item label="默认值">
                <a-input-number v-model="selectedField.props.defaultValue" />
              </a-form-item>
              <a-form-item label="最小值">
                <a-input-number v-model="selectedField.props.min" />
              </a-form-item>
              <a-form-item label="最大值">
                <a-input-number v-model="selectedField.props.max" />
              </a-form-item>
              <a-form-item label="步幅">
                <a-input-number v-model="selectedField.props.step" />
              </a-form-item>
            </template>

            <!-- Switch Specific Properties -->
            <template v-if="selectedField.type === 'switch'">
              <a-divider>开关设置</a-divider>
              <a-form-item label="选中状态的值" tooltip="开关打开时，字段实际代表的值">
                <a-input :model-value="String(selectedField.props.checkedValue ?? '')" @update:model-value="val => selectedField.props.checkedValue = val" placeholder="例如：true, 1, 'on'" />
              </a-form-item>
              <a-form-item label="未选中状态的值" tooltip="开关关闭时，字段实际代表的值">
                <a-input :model-value="String(selectedField.props.uncheckedValue ?? '')" @update:model-value="val => selectedField.props.uncheckedValue = val" placeholder="例如：false, 0, 'off'" />
              </a-form-item>
              <a-form-item label="默认状态">
                <a-radio-group v-model="selectedField.props.defaultValue">
                  <a-radio :value="selectedField.props.checkedValue">选中</a-radio>
                  <a-radio :value="selectedField.props.uncheckedValue">未选中</a-radio>
                </a-radio-group>
              </a-form-item>
            </template>

            <!-- Upload Specific Properties -->
            <template v-if="selectedField.type === 'upload'">
              <a-divider>上传设置</a-divider>
              <a-form-item label="默认值">
                <a-input v-model="selectedField.props.defaultValue" placeholder="可填写默认文件URL或文件名" />
              </a-form-item>
              <a-form-item label="存储地址" tooltip="实际文件上传的后端接口URL">
                <a-input v-model="selectedField.props.action" />
              </a-form-item>
              <a-form-item label="接受文件类型" tooltip="例如: image/*, .pdf, .doc">
                <a-input v-model="selectedField.props.accept" placeholder="image/*, .png, .jpg"/>
              </a-form-item>
              <a-form-item label="列表类型">
                <a-select v-model="selectedField.props.listType">
                  <a-option value="text">文本</a-option>
                  <a-option value="picture">图片</a-option>
                  <a-option value="picture-card">卡片</a-option>
                </a-select>
              </a-form-item>
              <a-form-item label="是否多选">
                <a-switch v-model="selectedField.props.multiple" />
              </a-form-item>
              <a-form-item v-if="selectedField.props.multiple" label="数量限制">
                <a-input-number v-model="selectedField.props.limit" :min="1" />
              </a-form-item>
              <a-form-item label="拖拽上传">
                <a-switch v-model="selectedField.props.drag" />
              </a-form-item>
              <a-form-item label="自动上传">
                <a-switch v-model="selectedField.props.autoUpload" />
              </a-form-item>
              <a-form-item label="占位提示">
                <a-input v-model="selectedField.props.placeholder" />
              </a-form-item>
            </template>

            <!-- Color Picker Specific Properties -->
            <template v-if="selectedField.type === 'color-picker'">
              <a-divider>颜色选择器设置</a-divider>
              <a-form-item label="默认值">
                <div v-if="selectedField.props.colorType === 'solid'">
                  <a-color-picker v-model="selectedField.props.defaultValue" style="width: 60px;" />
                </div>
                <div v-else>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <span>起始色</span>
                    <a-color-picker v-model="selectedField.props.gradientStart" style="width: 60px;" />
                    <span>结束色</span>
                    <a-color-picker v-model="selectedField.props.gradientEnd" style="width: 60px;" />
                  </div>
                </div>
              </a-form-item>
              <a-form-item label="颜色类型">
                <a-radio-group v-model="selectedField.props.colorType">
                  <a-radio value="solid">纯色</a-radio>
                  <a-radio value="gradient">渐变</a-radio>
                </a-radio-group>
              </a-form-item>
              <a-form-item v-if="selectedField.props.colorType === 'gradient'" label="渐变类型">
                <a-radio-group v-model="selectedField.props.gradientType">
                  <a-radio value="linear">线性渐变</a-radio>
                  <a-radio value="radial">径向渐变</a-radio>
                  <a-radio value="conic">角度渐变</a-radio>
                </a-radio-group>
              </a-form-item>
              <!-- 渐变起止色占比设置（所有渐变类型都显示） -->
              <a-form-item v-if="selectedField.props.colorType === 'gradient'" label="起始色占比">
                <a-slider v-model="selectedField.props.gradientStartPercent" :min="0" :max="100" :step="1" style="width: 180px;" />
                <span style="margin-left: 8px;">{{ selectedField.props.gradientStartPercent ?? 0 }}%</span>
              </a-form-item>
              <a-form-item v-if="selectedField.props.colorType === 'gradient'" label="结束色占比">
                <a-slider v-model="selectedField.props.gradientEndPercent" :min="0" :max="100" :step="1" style="width: 180px;" />
                <span style="margin-left: 8px;">{{ selectedField.props.gradientEndPercent ?? 100 }}%</span>
              </a-form-item>
              <!-- 线性渐变方向（角度滑竿） -->
              <a-form-item v-if="selectedField.props.colorType === 'gradient' && selectedField.props.gradientType === 'linear'" label="方向 (角度)">
                <a-slider v-model="selectedField.props.gradientAngle" :min="0" :max="360" :step="1" style="width: 180px;" />
                <span style="margin-left: 8px;">{{ selectedField.props.gradientAngle || 0 }}°</span>
              </a-form-item>
              <!-- 径向渐变位置 -->
              <a-form-item v-if="selectedField.props.colorType === 'gradient' && selectedField.props.gradientType === 'radial'" label="中心位置 X">
                <a-slider v-model="selectedField.props.radialX" :min="0" :max="100" :step="1" style="width: 180px;" />
                <span style="margin-left: 8px;">{{ selectedField.props.radialX !== undefined ? selectedField.props.radialX : 50 }}%</span>
              </a-form-item>
              <a-form-item v-if="selectedField.props.colorType === 'gradient' && selectedField.props.gradientType === 'radial'" label="中心位置 Y">
                <a-slider v-model="selectedField.props.radialY" :min="0" :max="100" :step="1" style="width: 180px;" />
                <span style="margin-left: 8px;">{{ selectedField.props.radialY !== undefined ? selectedField.props.radialY : 50 }}%</span>
              </a-form-item>
              <!-- 角度渐变 -->
              <a-form-item v-if="selectedField.props.colorType === 'gradient' && selectedField.props.gradientType === 'conic'" label="旋转角度">
                <a-slider v-model="selectedField.props.conicAngle" :min="0" :max="360" :step="1" style="width: 180px;" />
                <span style="margin-left: 8px;">{{ selectedField.props.conicAngle || 0 }}°</span>
              </a-form-item>
              <a-form-item label="预览">
                <div style="display: flex; align-items: center; gap: 12px; cursor: pointer;border-radius: 4px;background-image: linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee),linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee);background-size: 16px 16px;background-position: 0 0, 8px 8px;background-color: #fff;" @click="initCache">
                  <div :style="getColorPreviewStyle(selectedField.props)" style="width: 80px; height: 32px; border-radius: 4px; border: 1px solid #eee;"></div>
                </div>
              </a-form-item>
            </template>

            <!-- Conditional Logic Section -->
            <template v-if="canHaveConditionalLogic(selectedField.type)">
              <a-divider>条件逻辑</a-divider>
              <a-form-item label="启用条件显示">
                <a-switch v-model="selectedField.config.enableConditionalLogic" @change="onEnableConditionalLogicChange(selectedField)"/>
              </a-form-item>

              <div v-if="selectedField.config.enableConditionalLogic">
                <div v-for="(rule, index) in selectedField.config.conditionalLogicRules" :key="index" class="conditional-rule-block">
                  <h5 class="rule-title">规则 {{ index + 1 }} 
                    <a-button type="text" status="danger" size="mini" @click="removeConditionalRule(selectedField, index)" v-if="selectedField.config.conditionalLogicRules.length > 1">
                      <icon-delete/> 删除规则
                    </a-button>
                  </h5>
                  <a-form-item label="触发组件">
                    <a-select 
                      v-model="rule.triggerFieldId" 
                      placeholder="选择触发组件"
                      @change="() => onTriggerFieldChange(rule)"
                    >
                      <a-option 
                        v-for="field in formFields.filter(f => f.id !== selectedField.id && canBeTrigger(f.type))" 
                        :key="field.id" 
                        :value="field.id"
                      >
                        {{ field.props.label || field.type }} {{ field.props.nodeId ? `(ID: ${field.props.nodeId.substring(0, 6)})` : `(pid: ${field.id.substring(0, 6)})` }} {{ field.props.key ? `[${field.props.key}]` : '' }}
                      </a-option>
                    </a-select>
                  </a-form-item>
                  <a-form-item label="条件">
                    <a-select v-model="rule.conditionType" placeholder="选择条件类型">
                      <a-option value="equals">等于</a-option>
                      <a-option value="not_equals">不等于</a-option>
                      <template v-if="getTriggerFieldType(rule.triggerFieldId) === 'checkbox'">
                        <a-option value="contains">包含 (复选框)</a-option>
                        <a-option value="not_contains">不包含 (复选框)</a-option>
                      </template>
                    </a-select>
                  </a-form-item>
                  <a-form-item label="目标值">
                    <template v-if="isTriggerSelectRadioOrCheckbox(rule.triggerFieldId)">
                      <a-select v-model="rule.conditionValue" placeholder="选择目标值">
                        <a-option 
                          v-for="opt in getTriggerFieldOptions(rule.triggerFieldId)" 
                          :key="opt.idValue" 
                          :value="opt.idValue"
                        >
                          {{ opt.displayLabel }} (值: {{ opt.idValue }})
                        </a-option>
                      </a-select>
                    </template>
                    <template v-else-if="getTriggerFieldType(rule.triggerFieldId) === 'switch'">
                       <a-select v-model="rule.conditionValue" placeholder="选择目标状态">
                          <a-option :value="getTriggerFieldSwitchValues(rule.triggerFieldId).checked">
                              选中 ({{ String(getTriggerFieldSwitchValues(rule.triggerFieldId).checked) }})
                          </a-option>
                          <a-option :value="getTriggerFieldSwitchValues(rule.triggerFieldId).unchecked">
                              未选中 ({{ String(getTriggerFieldSwitchValues(rule.triggerFieldId).unchecked) }})
                          </a-option>
                      </a-select>
                    </template>
                    <template v-else>
                      <a-input v-model="rule.conditionValue" placeholder="输入触发条件的值" />
                    </template>
                  </a-form-item>
                  <p class="conditional-logic-summary">
                    当 "<strong>{{ getFieldLabelById(rule.triggerFieldId) }}</strong>" 
                    <strong>{{ getConditionText(rule.conditionType) }}</strong> 
                    "<strong>{{ getDisplayConditionValue(rule) }}</strong>" 时, 
                    当前组件将 <strong>{{ getConditionalLogicActionText(selectedField.config.conditionalLogicVisibilityAction, selectedField.config.conditionalLogicRequiredAction) }}</strong>.
                  </p>
                </div>

                <a-button type="dashed" @click="addConditionalRule(selectedField)" style="margin-bottom: 10px;">
                  <template #icon><icon-plus/></template> 添加规则
                </a-button>

                <a-form-item label="逻辑关系 (多规则时)" v-if="selectedField.config.conditionalLogicRules.length > 1">
                  <a-radio-group v-model="selectedField.config.conditionalLogicOperator">
                    <a-radio value="AND">AND (所有规则满足)</a-radio>
                    <a-radio value="OR">OR (任一规则满足)</a-radio>
                  </a-radio-group>
                </a-form-item>

                <a-divider>最终操作</a-divider>

                <a-form-item label="是否显示组件">
                  <a-radio-group v-model="selectedField.config.conditionalLogicVisibilityAction" @change="onVisibilityActionChange">
                    <a-radio value="show">是 (显示)</a-radio>
                    <a-radio value="hide">否 (隐藏)</a-radio>
                    <a-radio value="none">不改变</a-radio>
                  </a-radio-group>
                </a-form-item>

                <a-form-item label="是否设为必填">
                  <a-radio-group 
                    v-model="selectedField.config.conditionalLogicRequiredAction" 
                    :disabled="selectedField.config.conditionalLogicVisibilityAction === 'hide'"
                  >
                    <a-radio value="setRequired">是 (必填)</a-radio>
                    <a-radio value="setOptional">否 (非必填)</a-radio>
                    <a-radio value="none">不改变</a-radio>
                  </a-radio-group>
                </a-form-item>
              </div>
            </template>

          </a-form>
        </div>
        <div v-else class="empty-properties-placeholder">
          选中一个组件以编辑其属性
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineExpose, defineProps, defineEmits, computed, watchEffect } from 'vue';
import draggable from 'vuedraggable';
import { 
    Input as AInput,
    Textarea as ATextarea,
    CheckboxGroup as ACheckboxGroup, 
    RadioGroup as ARadioGroup, 
    Select as ASelect,
    Switch as ASwitch,
    Upload as AUpload,
    Form as AForm,
    FormItem as AFormItem,
    Button as AButton,
    Message,
    Divider,
    Slider as ASlider,
    ColorPicker as AColorPicker
} from '@arco-design/web-vue';
import {
  IconDragArrow, IconDelete, IconPlus, IconMinusCircle,
  IconUpload
} from '@arco-design/web-vue/es/icon';
import { v4 as uuidv4 } from 'uuid';
import apiService from '@/admin/services/apiService';

const props = defineProps({
  applicationId: String,
  platformType: String,
  applicationName: String,
});

const emit = defineEmits(['save-success']);

const isComfyUI = computed(() => props.platformType === 'ComfyUI');

const availableComponents = ref([
  { type: 'input', label: '输入框', icon: 'icon-edit', defaultProps: { label: '输入框', placeholder: '请输入...', defaultValue: '', inputType: 'string' } },
  { type: 'textarea', label: '多行文本框', icon: 'icon-file', defaultProps: { label: '多行文本框', placeholder: '请输入文本...', autoSize: { minRows: 3, maxRows: 5 }, defaultValue: '' } },
  { type: 'slider', label: '滑竿', icon: 'icon-sliders', defaultProps: { label: '滑竿', min: 0, max: 100, step: 1, defaultValue: 0 } },
  { type: 'checkbox', label: '复选框组', icon: 'icon-check-square', defaultProps: { label: '复选框', options: [{label: '选项1', value: '1'}, {label: '选项2', value: '2'}], defaultValue: []}, config: { dataSourceType: 'manual' } },
  { type: 'radio', label: '单选框组', icon: 'icon-radio', defaultProps: { label: '单选框', options: [{label: '选项A', value: 'A'}, {label: '选项B', value: 'B'}], defaultValue: undefined }, config: { dataSourceType: 'manual' } },
  { type: 'select', label: '下拉选择框', icon: 'icon-select', defaultProps: { label: '下拉选择', placeholder: '请选择...', options: [{label: '选项X', value: 'X'}, {label: '选项Y', value: 'Y'}], multiple: false, defaultValue: undefined }, config: { dataSourceType: 'manual' } },
  { type: 'switch', label: '开关', icon: 'icon-switch', defaultProps: { label: '开关', checkedValue: true, uncheckedValue: false, defaultValue: false } },
  { 
    type: 'upload', 
    label: '上传',
    icon: 'icon-upload', 
    defaultProps: { 
      label: '上传文件', 
      action: '/api/files/upload', // Default placeholder upload URL
      accept: '', // e.g., 'image/*,.pdf'
      multiple: false,
      limit: 1,
      listType: 'text', // 'text', 'picture', 'picture-card'
      drag: false,
      autoUpload: true,
      placeholder: '点击或拖拽文件上传'
    }
  },
  { type: 'color-picker', label: '颜色选择器', icon: 'icon-palette', defaultProps: {
    label: '颜色选择器',
    colorType: 'solid', // solid/gradient
    solidColor: '#1677ff',
    gradientType: 'linear', // linear/radial
    gradientDirection: 'to right', // 线性方向
    gradientStart: '#1677ff',
    gradientEnd: '#ff4d4f',
    description: '',
    defaultValue: '#1677ff',
  } },
]);

const formFields = ref([]);
const selectedField = ref(null);
const loadingEnumConfigs = ref(false);
const availableEnumConfigs = ref([]);

// New state for improved enum handling
const availableEnumTypes = ref([]);
const enumConfigsOfSelectedType = ref([]);
const loadingEnumTypes = ref(false);
const loadingEnumConfigsForType = ref(false);

// ComfyUI specific state
const comfyUIJsonFile = ref(null);
const comfyUIOutputNodeId = ref('');
const comfyUIOutputType = ref(undefined);
const comfyUICustomOutputKey = ref('');

// Map component types to actual Vue components
const vueComponentMap = {
  input: AInput,
  textarea: ATextarea,
  checkbox: ACheckboxGroup,
  radio: ARadioGroup,
  select: ASelect,
  switch: ASwitch,
  upload: AUpload,
  slider: ASlider,
};

const getVueComponent = (type) => {
  return vueComponentMap[type] || AInput; // Default to AInput if not found
};

const cloneComponent = (original) => {
  return {
    id: uuidv4(), 
    type: original.type,
    props: { 
      ...original.defaultProps, 
      field: `field_${uuidv4().substring(0,8)}`, 
      required: false,
      nodeId: '', // Initialize nodeId
      key: (original.props && typeof original.props.key !== 'undefined') ? original.props.key : '', // 兼容 palette 拖拽
      // 修复 color-picker 渐变属性初始值（全量）
      ...(original.type === 'color-picker' ? {
        colorType: 'solid',
        gradientType: 'linear',
        gradientAngle: 0,
        radialX: 50,
        radialY: 50,
        conicAngle: 0,
        gradientStart: '#1677ff',
        gradientEnd: '#ff4d4f',
        gradientStartPercent: 0,
        gradientEndPercent: 100,
      } : {}),
    }, 
    config: {
      ...(original.config || {}),
      label: original.label,
      dataSourceType: original.config?.dataSourceType || (original.type === 'select' || original.type === 'radio' || original.type === 'checkbox' ? 'manual' : undefined),
      enumTypeId: undefined, 
      enumOptionIds: [],   
      enableConditionalLogic: false,
      conditionalLogicRules: [
        {
          triggerFieldId: undefined,
          conditionType: undefined,
          conditionValue: '',
        }
      ],
      conditionalLogicOperator: 'AND',
      conditionalLogicVisibilityAction: 'show',
      conditionalLogicRequiredAction: 'none',
    }, 
  };
};

const onDragEndPalette = (event) => {
};

const onDropToCanvas = (event) => {
  // `vuedraggable` handles adding the item to `formFields` array automatically
  // The new item is at event.newIndex
  const newField = formFields.value[event.newIndex];
  if (newField) {
    selectField(newField);
  }
};

const onUpdateCanvas = (event) => {
  // This event is triggered when items are reordered within the canvas
};

const selectField = async (field) => {
  selectedField.value = field;
  if (field.config.dataSourceType === 'enum' && (field.type === 'select' || field.type === 'radio' || field.type === 'checkbox')) {
    await fetchEnumTypes();
    if (field.config.enumTypeId) {
      const selectedType = availableEnumTypes.value.find(t => t._id === field.config.enumTypeId);
      if (selectedType?.isPlatformField && Array.isArray(field.config.platformFieldOptions)) {
        // 平台枚举，直接用 config.platformFieldOptions
        field.runtimeAvailableEnumOptions = field.config.platformFieldOptions.map(opt => ({
          _id: opt.key,
          name: opt.value,
          translation: opt.value,
        }));
        enumConfigsOfSelectedType.value = field.runtimeAvailableEnumOptions;
      } else {
        // 原有逻辑
      loadingEnumConfigsForType.value = true;
      try {
        const response = await apiService.getEnumConfigs({ enumTypeId: field.config.enumTypeId, status: 'active', limit: 500 });
        const specificEnumConfigs = response.data?.data || [];
          field.runtimeAvailableEnumOptions = specificEnumConfigs;
          enumConfigsOfSelectedType.value = specificEnumConfigs;
      } catch (error) {
        Message.error(`加载枚举类型 "${field.config.enumTypeId}" 的配置项失败: ` + (error.response?.data?.message || error.message));
        field.runtimeAvailableEnumOptions = [];
        enumConfigsOfSelectedType.value = [];
      } finally {
        loadingEnumConfigsForType.value = false;
        }
      }
    } else {
      field.runtimeAvailableEnumOptions = [];
      enumConfigsOfSelectedType.value = [];
    }
  }
};

const removeField = (index) => {
  if (selectedField.value && formFields.value[index] && selectedField.value.id === formFields.value[index].id) {
    selectedField.value = null;
  }
  formFields.value.splice(index, 1);
};

const addOption = (field) => {
  if (!field.props.options) {
    field.props.options = [];
  }
  field.props.options.push({ label: '新选项', value: `new_value_${field.props.options.length + 1}` });
};

const removeOption = (field, optionIndex) => {
  field.props.options.splice(optionIndex, 1);
};

// New function to fetch Enum Types
const fetchEnumTypes = async () => {
  loadingEnumTypes.value = true;
  try {
    // 1. 获取枚举类型
    const enumRes = await apiService.getEnumTypes({ limit: 500, status: 'active' });
    let enumTypes = [];
    if (enumRes.data && Array.isArray(enumRes.data)) {
      enumTypes = enumRes.data;
    } else if (enumRes.data && enumRes.data.data) {
      enumTypes = enumRes.data.data;
    }

    // 2. 获取平台字段
    let platformFieldTypes = [];
    try {
      const platformRes = await apiService.getPlatforms && await apiService.getPlatforms();
      if (platformRes && platformRes.data && Array.isArray(platformRes.data)) {
        platformRes.data.forEach(platform => {
          (platform.configFields || []).forEach(field => {
            if (["select", "multiSelect"].includes(field.type)) {
              platformFieldTypes.push({
                _id: `platform_${platform._id}_${field.key}`,
                name: `${platform.name} - ${field.label}`,
                platform: platform.name,
                type: field.type,
                options: field.options,
                isPlatformField: true, // 标记来源
                platformId: platform._id,
                fieldKey: field.key,
              });
            }
          });
        });
      }
    } catch (e) {
      // 平台接口失败不影响主流程
    }

    // 3. 合并
    availableEnumTypes.value = [
      ...enumTypes.map(t => ({ ...t, isPlatformField: false })),
      ...platformFieldTypes
    ];
  } catch (error) {
    Message.error('加载枚举类型/平台字段失败: ' + (error.response?.data?.message || error.message));
    availableEnumTypes.value = [];
  } finally {
    loadingEnumTypes.value = false;
  }
};

// New function to fetch Enum Configs for a selected Enum Type
const fetchEnumConfigsForSelectedType = async (typeId) => {
  if (!typeId) {
    enumConfigsOfSelectedType.value = [];
    return;
  }
  loadingEnumConfigsForType.value = true;
  try {
    const response = await apiService.getEnumConfigs({ enumTypeId: typeId, status: 'active', limit: 500 });
    if (response.data && response.data.data) {
      enumConfigsOfSelectedType.value = response.data.data;
    } else {
      enumConfigsOfSelectedType.value = [];
    }
  } catch (error) {
    Message.error(`加载枚举类型 "${typeId}" 的配置项失败: ` + (error.response?.data?.message || error.message));
    enumConfigsOfSelectedType.value = [];
  } finally {
    loadingEnumConfigsForType.value = false;
  }
};

// Handler for when Enum Type changes in properties panel
const onEnumTypeChange = async (field) => {
  if (field && field.config) {
    field.config.enumOptionIds = []; 
    field.runtimeAvailableEnumOptions = []; // Clear stored runtime options
    enumConfigsOfSelectedType.value = []; 
    const selectedType = availableEnumTypes.value.find(t => t._id === field.config.enumTypeId);
    if (selectedType?.isPlatformField) {
      // 平台字段，直接用 options
      const options = selectedType.options || [];
      field.runtimeAvailableEnumOptions = options.map(opt => ({
        _id: opt.key,
        name: opt.value,
        translation: opt.value,
      }));
      enumConfigsOfSelectedType.value = field.runtimeAvailableEnumOptions;
    } else if (field.config.enumTypeId) {
      // 原有逻辑：枚举类型
      loadingEnumConfigsForType.value = true;
      try {
        const response = await apiService.getEnumConfigs({ enumTypeId: field.config.enumTypeId, status: 'active', limit: 500 });
        const specificEnumConfigs = response.data?.data || [];
        field.runtimeAvailableEnumOptions = specificEnumConfigs; // Store on the field
        enumConfigsOfSelectedType.value = specificEnumConfigs; // For the property panel dropdown
      } catch (error) {
        Message.error(`加载枚举类型 "${field.config.enumTypeId}" 的配置项失败: ` + (error.response?.data?.message || error.message));
        field.runtimeAvailableEnumOptions = [];
        enumConfigsOfSelectedType.value = [];
      } finally {
        loadingEnumConfigsForType.value = false;
      }
    }
  }
};

const saveForm = async () => {
  if (!props.applicationId) {
    Message.error('应用ID缺失，无法保存表单。');
    throw new Error('应用ID缺失，无法保存表单。')
  }
  try {
    const schemaToSave = {
      fields: formFields.value.map(field => {
        // 检查是否平台字段枚举
        let extraConfig = {};
        if (
          field.config.dataSourceType === 'enum' &&
          typeof field.config.enumTypeId === 'string' &&
          field.config.enumTypeId.startsWith('platform_') &&
          Array.isArray(field.runtimeAvailableEnumOptions)
        ) {
          // 保存 options 到 config
          extraConfig.platformFieldOptions = field.runtimeAvailableEnumOptions.map(opt => ({
            key: opt._id,
            value: opt.translation || opt.name
          }));
        }
        return {
        id: field.id, // Component ID
        type: field.type,
        props: {
          label: field.props.label, // 标签名称
          placeholder: field.props.placeholder, // 占位提示
          required: field.props.required, // 是否必填
          options: field.props.options, // For select, radio, checkbox (manual mode)
          field: field.props.field, // unique field name / key
          autoSize: field.props.autoSize, // for textarea
          action: field.props.action,
          accept: field.props.accept,
          multiple: field.props.multiple,
          limit: field.props.limit,
          listType: field.props.listType,
          drag: field.props.drag,
          autoUpload: field.props.autoUpload,
          checkedValue: field.props.checkedValue, // For switch
          uncheckedValue: field.props.uncheckedValue, // For switch
          nodeId: field.props.nodeId, // Save nodeId
          defaultValue: field.props.defaultValue, // For switch default state, but also for other types later
          key: field.props.key, // ComfyUI专用唯一key
          inputType: field.props.inputType, // input 类型
          min: field.props.min, // input/slider 最小值
          max: field.props.max, // input/slider 最大值
          step: field.props.step, // input/slider 步幅
          description: field.props.description, // 说明字段
          ...(field.type === 'color-picker' ? {
            colorType: field.props.colorType ?? 'solid',
            gradientType: field.props.gradientType ?? 'linear',
            gradientAngle: field.props.gradientAngle ?? 0,
            radialX: field.props.radialX ?? 50,
            radialY: field.props.radialY ?? 50,
            conicAngle: field.props.conicAngle ?? 0,
            gradientStart: field.props.gradientStart ?? '#1677ff',
            gradientEnd: field.props.gradientEnd ?? '#ff4d4f',
            gradientStartPercent: field.props.gradientStartPercent ?? 0,
            gradientEndPercent: field.props.gradientEndPercent ?? 100,
          } : {}),
        },
        config: {
          label: field.config.label, // Original component type label for reference
          dataSourceType: field.config.dataSourceType, // manual or enum
          enumTypeId: field.config.enumTypeId, // NEW: Save enum type ID
          enumOptionIds: field.config.enumOptionIds, // NEW: Save selected enum option IDs
          enableConditionalLogic: field.config.enableConditionalLogic,
          conditionalLogicRules: field.config.conditionalLogicRules,
          conditionalLogicOperator: field.config.conditionalLogicOperator,
          conditionalLogicVisibilityAction: field.config.conditionalLogicVisibilityAction,
          conditionalLogicRequiredAction: field.config.conditionalLogicRequiredAction,
            ...extraConfig
        }
        };
      }),
    };

    if (isComfyUI.value) {
      schemaToSave.comfyUIConfig = {
        outputNodeId: comfyUIOutputNodeId.value,
        outputType: comfyUIOutputType.value,
        customOutputKey: comfyUIOutputType.value === 'custom' ? comfyUICustomOutputKey.value : undefined,
        // We are not saving the uploaded JSON file itself in this schema,
        // The backend should handle the JSON file upload separately if needed when it's uploaded.
        // Or, if the JSON content needs to be part of this save, it should be read and included.
      };
    }

    const payload = {
      applicationId: props.applicationId,
      formSchema: schemaToSave, 
    };
    
    // Replace with actual API call
    await apiService.saveAppFormConfig(payload); // Actual API call
    
    // Simulating API call
    // await new Promise(resolve => setTimeout(resolve, 1000)); 
    
    emit('save-success');
  } catch (error) {
    Message.error('保存表单配置失败: ' + (error.response?.data?.message || error.message));
    console.error('Error saving form:', error);
    throw error; // Re-throw to be caught by modal
  }
};

const loadForm = async () => {
  if (!props.applicationId) return;
  try {
    const response = await apiService.getAppFormConfig(props.applicationId);
    const loadedSchema = response.data;

    if (loadedSchema && (Array.isArray(loadedSchema.fields) || Object.keys(loadedSchema).length === 0)) {
      let fieldsToProcess = loadedSchema.fields || [];
      
      // Asynchronously fetch runtimeAvailableEnumOptions for all enum fields first
      const enumFieldsPromises = fieldsToProcess
        .filter(field => field.config?.dataSourceType === 'enum' && field.config?.enumTypeId)
        .map(async (field) => {
          if (typeof field.config.enumTypeId === 'string' && field.config.enumTypeId.startsWith('platform_') && Array.isArray(field.config.platformFieldOptions)) {
            field.runtimeAvailableEnumOptions = field.config.platformFieldOptions.map(opt => ({
              _id: opt.key,
              name: opt.value,
              translation: opt.value,
            }));
          } else {
          try {
            const enumResponse = await apiService.getEnumConfigs({ enumTypeId: field.config.enumTypeId, status: 'active', limit: 500 });
            field.runtimeAvailableEnumOptions = enumResponse.data?.data || [];
          } catch (error) {
            console.error(`Failed to load enum configs for field ${field.id} (typeId: ${field.config.enumTypeId}) during form load:`, error);
              field.runtimeAvailableEnumOptions = [];
          }
          }
          return field;
        });
      
      const processedEnumFields = await Promise.all(enumFieldsPromises);
      // Create a map for quick lookup after async operations
      const fieldMap = new Map(processedEnumFields.map(f => [f.id, f]));

      // Update formFields.value with potentially modified fields (that now have runtimeAvailableEnumOptions)
      formFields.value = fieldsToProcess.map(originalField => fieldMap.get(originalField.id) || originalField);

      if (isComfyUI.value && loadedSchema.comfyUIConfig) {
        comfyUIOutputNodeId.value = loadedSchema.comfyUIConfig.outputNodeId || '';
        comfyUIOutputType.value = loadedSchema.comfyUIConfig.outputType || undefined;
        comfyUICustomOutputKey.value = loadedSchema.comfyUIConfig.customOutputKey || '';
      }

      formFields.value.forEach(field => {
        if (!field.config) {
          const componentDefinition = availableComponents.value.find(c => c.type === field.type);
          field.config = { 
            ...(componentDefinition?.config || {}),
            label: field.props?.label || componentDefinition?.label || field.type, 
            dataSourceType: componentDefinition?.config?.dataSourceType || (field.type === 'select' || field.type === 'radio' || field.type === 'checkbox' ? 'manual' : undefined),
            enumTypeId: undefined, 
            enumOptionIds: [],   
            enableConditionalLogic: false,
            conditionalLogicRules: [{ triggerFieldId: undefined, conditionType: undefined, conditionValue: '' }],
            conditionalLogicOperator: 'AND',
            conditionalLogicVisibilityAction: 'show',
            conditionalLogicRequiredAction: 'none',
          };
        } else {
          if (typeof field.config.enableConditionalLogic !== 'boolean') {
            field.config.enableConditionalLogic = false;
          }
          if (field.config.enumTypeId === undefined) {
            field.config.enumTypeId = null; 
          }
          if (!Array.isArray(field.config.enumOptionIds)) {
            field.config.enumOptionIds = [];
          }
          if (field.config.hasOwnProperty('enumConfigId')) {
            delete field.config.enumConfigId;
          }
          if (!Array.isArray(field.config.conditionalLogicRules) || field.config.conditionalLogicRules.length === 0) {
            field.config.conditionalLogicRules = [{ 
              triggerFieldId: undefined, 
              conditionType: undefined, 
              conditionValue: '' 
            }];
          } else {
            field.config.conditionalLogicRules.forEach(rule => {
              if (rule.triggerFieldId === undefined) rule.triggerFieldId = undefined; 
              if (rule.conditionType === undefined) rule.conditionType = undefined;
              if (rule.conditionValue === undefined) rule.conditionValue = '';
            });
          }
          if (field.config.conditionalLogicOperator !== 'AND' && field.config.conditionalLogicOperator !== 'OR') {
            field.config.conditionalLogicOperator = 'AND';
          }
          if (field.config.conditionalLogicVisibilityAction !== 'show' && field.config.conditionalLogicVisibilityAction !== 'hide') {
            field.config.conditionalLogicVisibilityAction = 'show';
          }
          if (field.config.conditionalLogicRequiredAction !== 'none' && field.config.conditionalLogicRequiredAction !== 'setRequired' && field.config.conditionalLogicRequiredAction !== 'setOptional') {
            field.config.conditionalLogicRequiredAction = 'none';
          }
          if (field.type === 'switch') {
            if (field.props.checkedValue === undefined) field.props.checkedValue = true;
            if (field.props.uncheckedValue === undefined) field.props.uncheckedValue = false;
            if (field.props.defaultValue === undefined) field.props.defaultValue = field.props.uncheckedValue; // Default to unchecked state's value
          }
          if (field.type === 'radio' && Array.isArray(field.props.defaultValue)) {
            // Radio defaultValue should not be an array
            field.props.defaultValue = field.props.defaultValue.length > 0 ? field.props.defaultValue[0] : undefined;
          }
          if (field.type === 'checkbox' && !Array.isArray(field.props.defaultValue)) {
            // Checkbox defaultValue should always be an array
            field.props.defaultValue = field.props.defaultValue !== undefined && field.props.defaultValue !== null ? [field.props.defaultValue] : [];
          }
          if (field.type === 'color-picker') {
            if (!('colorType' in field.props)) field.props.colorType = 'solid';
            if (!('gradientType' in field.props)) field.props.gradientType = 'linear';
            if (!('gradientAngle' in field.props)) field.props.gradientAngle = 0;
            if (!('radialX' in field.props)) field.props.radialX = 50;
            if (!('radialY' in field.props)) field.props.radialY = 50;
            if (!('conicAngle' in field.props)) field.props.conicAngle = 0;
            if (!('gradientStart' in field.props)) field.props.gradientStart = '#1677ff';
            if (!('gradientEnd' in field.props)) field.props.gradientEnd = '#ff4d4f';
            if (!('gradientStartPercent' in field.props)) field.props.gradientStartPercent = 0;
            if (!('gradientEndPercent' in field.props)) field.props.gradientEndPercent = 100;
          }
        }
        if (field.config.conditionalLogic && typeof field.config.conditionalLogic === 'object' && !Array.isArray(field.config.conditionalLogic)) {
          delete field.config.conditionalLogic;
        }
        // Ensure runtimeAvailableEnumOptions is an array if not populated by async call (e.g. not an enum field)
        if (!Array.isArray(field.runtimeAvailableEnumOptions)) {
            field.runtimeAvailableEnumOptions = [];
        }
      });
    } else {
      formFields.value = [];
      if (isComfyUI.value) {
        comfyUIOutputNodeId.value = '';
        comfyUIOutputType.value = undefined;
        comfyUICustomOutputKey.value = '';
      }
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      formFields.value = []; 
      if (isComfyUI.value) {
        comfyUIOutputNodeId.value = '';
        comfyUIOutputType.value = undefined;
        comfyUICustomOutputKey.value = '';
      }
    } else {
      Message.error('加载表单配置失败: ' + (error.response?.data?.message || error.message));
      formFields.value = [];
      if (isComfyUI.value) {
          comfyUIOutputNodeId.value = '';
          comfyUIOutputType.value = undefined;
          comfyUICustomOutputKey.value = '';
      }
    }
  }
};

// ComfyUI JSON Upload Handlers
const handleComfyUIJsonUpload = (response, fileItem) => {
  // Assuming the backend processes the JSON and maybe returns a path or status
  // For now, just log and store the file ref if needed for other processing
  Message.success(`${fileItem.file.name} 上传成功 (模拟).`);
  comfyUIJsonFile.value = fileItem.file; // Store the original file object
  // If the backend returns data from the JSON, you might process it here.
  // e.g., extract node IDs for a dropdown, etc.
};

const handleComfyUIJsonError = (error, fileItem) => {
  Message.error(`${fileItem.file.name} 上传失败 (模拟).`);
  console.error('ComfyUI JSON Upload Error:', error);
};

onMounted(() => {
  // Load existing form configuration if applicationId is present
  loadForm();
  fetchEnumTypes(); // Fetch enum types when component mounts, for the properties panel.
});

// Expose methods to parent component (e.g., the modal)
defineExpose({
  saveForm,
  loadForm, // Could be called by parent if appId changes after mount
});

const canHaveConditionalLogic = (type) => {
  // Define which component types can have conditional logic applied TO them
  // For now, let's say all components can have conditional visibility
  return true; 
};

const canBeTrigger = (type) => {
  // Define which component types can BE a trigger
  return ['select', 'radio', 'checkbox', 'switch'].includes(type);
};

const onEnableConditionalLogicChange = (field) => {
  if (!field.config.enableConditionalLogic) {
    // Reset conditional logic if disabled
    field.config.conditionalLogicRules = [
      {
        triggerFieldId: undefined,
        conditionType: undefined,
        conditionValue: '',
      }
    ];
    field.config.conditionalLogicOperator = 'AND';
    field.config.conditionalLogicVisibilityAction = 'show';
    field.config.conditionalLogicRequiredAction = 'none';
  } else if (field.config.conditionalLogicRules.length === 0) {
    // If enabled and no rules, add a default one
    addConditionalRule(field);
  }
};

const addConditionalRule = (field) => {
  if (!field.config.conditionalLogicRules) {
    field.config.conditionalLogicRules = [];
  }
  field.config.conditionalLogicRules.push({
    triggerFieldId: undefined,
    conditionType: undefined,
    conditionValue: '',
  });
};

const removeConditionalRule = (field, index) => {
  field.config.conditionalLogicRules.splice(index, 1);
  if (field.config.conditionalLogicRules.length === 0) {
     // Optionally disable conditional logic or leave it for user to add a new rule
     // For now, we'll allow it to be empty, meaning no conditions apply.
  }
};

const getTriggerFieldType = (fieldId) => {
  if (!fieldId) return null;
  const field = formFields.value.find(f => f.id === fieldId);
  return field ? field.type : null;
};

const isTriggerSelectRadioOrCheckbox = (fieldId) => {
  const type = getTriggerFieldType(fieldId);
  return type === 'select' || type === 'radio' || type === 'checkbox';
};

const getTriggerFieldOptions = (fieldId) => {
  if (!fieldId) return [];
  const field = formFields.value.find(f => f.id === fieldId);
  if (!field) return [];

  if (field.config?.dataSourceType === 'enum') {
    if (Array.isArray(field.runtimeAvailableEnumOptions)) {
      return field.runtimeAvailableEnumOptions.map(conf => ({ 
        displayLabel: conf.translation || conf.name, 
        idValue: conf._id
      }));
    }
    return []; 
  }

  // For 'manual' dataSourceType or other types with props.options
  if (field.props && Array.isArray(field.props.options)) {
    // Normalize manual options to the same structure
    return field.props.options.map(opt => ({
      displayLabel: opt.label,
      idValue: opt.value
    }));
  }
  return [];
};

const getTriggerFieldSwitchValues = (fieldId) => {
  const field = formFields.value.find(f => f.id === fieldId);
  if (field && field.type === 'switch') {
    return {
      checked: field.props.checkedValue !== undefined ? field.props.checkedValue : true,
      unchecked: field.props.uncheckedValue !== undefined ? field.props.uncheckedValue : false,
    };
  }
  return { checked: true, unchecked: false }; // Fallback
};

const onTriggerFieldChange = (rule) => {
  // Reset conditionValue when trigger field changes, as options/type might differ
  rule.conditionValue = undefined; 
  rule.conditionType = undefined; // Also reset condition type
};

const getDisplayConditionValue = (rule) => {
  if (rule.triggerFieldId && isTriggerSelectRadioOrCheckbox(rule.triggerFieldId)) {
    const options = getTriggerFieldOptions(rule.triggerFieldId);
    const foundOpt = options.find(o => o.idValue == rule.conditionValue); // Compare with idValue
    return foundOpt ? `${foundOpt.displayLabel} (${rule.conditionValue})` : rule.conditionValue;
  }
  if (rule.triggerFieldId && getTriggerFieldType(rule.triggerFieldId) === 'switch') {
    const switchValues = getTriggerFieldSwitchValues(rule.triggerFieldId);
    if (rule.conditionValue === switchValues.checked) return `选中 (${String(switchValues.checked)})`;
    if (rule.conditionValue === switchValues.unchecked) return `未选中 (${String(switchValues.unchecked)})`;
  }
  return rule.conditionValue;
};

const getFieldLabelById = (fieldId) => {
  if (!fieldId) return '[未选择触发组件]';
  const field = formFields.value.find(f => f.id === fieldId);
  return field ? (field.props.label || field.type) : '[未知组件]';
};

const getConditionText = (conditionType) => {
  const map = {
    equals: '等于',
    not_equals: '不等于',
    contains: '包含',
    not_contains: '不包含',
  };
  return map[conditionType] || '[未知条件]';
};

const getConditionalLogicActionText = (visibilityAction, requiredAction) => {
  let parts = [];
  if (visibilityAction === 'show') parts.push('显示');
  else if (visibilityAction === 'hide') parts.push('隐藏');
  // else: if 'none', don't mention visibility or state 'visibility unchanged' explicitly if desired

  if (requiredAction === 'setRequired') parts.push('设为必填');
  else if (requiredAction === 'setOptional') parts.push('设为非必填');
  // else: if 'none', don't mention required status or state 'required status unchanged'

  if (parts.length === 0) return '无操作';
  return parts.join('，同时'); // Example: "显示，同时设为必填"
};

const onVisibilityActionChange = () => {
  if (selectedField.value?.config?.conditionalLogicVisibilityAction === 'hide') {
    // If hiding, the required status becomes less relevant or should be forced to 'setOptional' or 'none'
    // Forcing it to 'none' (no change to required status from this rule) might be safest if DynamicFormRenderer handles hidden+required correctly.
    // Or, force to 'setOptional' to be explicit.
    // Let's choose 'none' for now, assuming renderer will treat hidden fields as not-required for validation purposes.
    // selectedField.value.config.conditionalLogicRequiredAction = 'none'; 
    // User can still explicitly set it, but the :disabled binding handles the UI cue.
    // No explicit programmatic change here, rely on :disabled and renderer logic.
  }
};

// Helper to get options for the default value select/radio/checkbox controls
const getOptionsForDefaultValue = (field) => {
  if (!field) return [];
  if (field.config?.dataSourceType === 'manual') {
    return (field.props?.options || []).map(opt => ({
      displayLabel: opt.label,
      idValue: opt.value
    }));
  }
  if (field.config?.dataSourceType === 'enum') {
    if (typeof field.config.enumTypeId === 'string' && field.config.enumTypeId.startsWith('platform_') && Array.isArray(field.config.platformFieldOptions) && Array.isArray(field.config.enumOptionIds)) {
      return field.config.platformFieldOptions
        .filter(opt => field.config.enumOptionIds.includes(opt.key))
        .map(opt => ({ displayLabel: opt.value, idValue: opt.key }));
    }
    if (Array.isArray(field.runtimeAvailableEnumOptions) && Array.isArray(field.config.enumOptionIds)) {
      return field.runtimeAvailableEnumOptions
        .filter(conf => field.config.enumOptionIds.includes(conf._id))
        .map(conf => ({ 
          displayLabel: conf.translation || conf.name, 
          idValue: conf._id 
        }));
    }
  }
  return [];
};

// Handle change of select's multiple prop to reset defaultValue type
const onSelectMultipleChange = (field) => {
  if (field.type === 'select') {
    if (field.props.multiple) {
      // Changed to multiple: if defaultValue is not array, make it an empty array or wrap it
      if (!Array.isArray(field.props.defaultValue)) {
        field.props.defaultValue = field.props.defaultValue !== undefined && field.props.defaultValue !== null ? [field.props.defaultValue] : [];
      }
    } else {
      // Changed to single: if defaultValue is array, take first or undefined
      if (Array.isArray(field.props.defaultValue)) {
        field.props.defaultValue = field.props.defaultValue.length > 0 ? field.props.defaultValue[0] : undefined;
      }
    }
  }
};

const getColorPreviewStyle = (props) => {
  if (props.colorType === 'solid') {
    return { background: props.defaultValue || props.solidColor || '#1677ff' };
  } else if (props.colorType === 'gradient') {
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

// 在属性面板渲染前，确保 color-picker 所有渐变属性有默认值
watchEffect(() => {
  if (selectedField.value && selectedField.value.type === 'color-picker') {
    const props = selectedField.value.props;
    if (!('colorType' in props)) props.colorType = 'solid';
    if (!('gradientType' in props)) props.gradientType = 'linear';
    if (typeof props.gradientAngle !== 'number') props.gradientAngle = 0;
    if (typeof props.radialX !== 'number') props.radialX = 50;
    if (typeof props.radialY !== 'number') props.radialY = 50;
    if (typeof props.conicAngle !== 'number') props.conicAngle = 0;
    if (!('gradientStart' in props)) props.gradientStart = '#1677ff';
    if (!('gradientEnd' in props)) props.gradientEnd = '#ff4d4f';
    if (typeof props.gradientStartPercent !== 'number') props.gradientStartPercent = 0;
    if (typeof props.gradientEndPercent !== 'number') props.gradientEndPercent = 100;
  }
});

</script>

<style scoped>
.form-builder-wrapper {
  display: flex;
  flex-direction: column;
  height: 75vh; /* Adjusted height to make space for potential header */
}

.comfyui-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border-2);
  background-color: var(--color-bg-2);
}

.comfyui-outputs {
  display: flex;
  gap: 10px;
}

.form-builder-container {
  display: flex;
  flex-grow: 1; /* Allow container to fill remaining space */
  /* height: 70vh; */ /* Original height, now controlled by wrapper */
  border: 1px solid var(--color-border-2);
  background-color: var(--color-bg-1);
}

.palette, .canvas, .properties {
  padding: 12px;
  box-sizing: border-box;
  overflow-y: auto;
}

.palette {
  width: 220px;
  border-right: 1px solid var(--color-border-2);
  background-color: var(--color-bg-2);
}

.canvas {
  flex-grow: 1;
  border-right: 1px solid var(--color-border-2);
  padding: 15px;
}

.properties {
  width: 300px;
  background-color: var(--color-bg-2);
}

.panel-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 12px;
  color: var(--color-text-1);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border-3);
}

.palette-item {
  padding: 8px 10px;
  margin-bottom: 8px;
  border: 1px solid var(--color-border-2);
  border-radius: 4px;
  background-color: var(--color-bg-1);
  cursor: grab;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.palette-item:hover {
  border-color: rgb(var(--primary-6));
  background-color: var(--color-primary-light-1);
}
.drag-handle {
  cursor: grab;
  color: var(--color-text-3);
}

.form-drop-zone {
  min-height: calc(100% - 40px); /* Adjust if panel title height changes */
  /* min-height: calc(70vh - 80px); */ /* Original calculation */
  border: 1px dashed var(--color-border-3);
  border-radius: 4px;
  padding: 10px;
  background-color: var(--color-bg-1);
}

.form-field-wrapper {
  padding: 10px;
  margin-bottom: 8px;
  border: 1px solid var(--color-border-3);
  border-radius: 4px;
  background-color: var(--color-fill-2);
  cursor: pointer;
  position: relative;
}

.form-field-wrapper.selected {
  border-color: rgb(var(--primary-6));
  box-shadow: 0 0 0 2px rgba(var(--primary-6), 0.2);
}

.form-field-preview {
  pointer-events: none; /* Make the preview non-interactive */
  width: 100%;
}

/* Specific style for switch preview to not take full width */
.form-field-preview.arco-switch {
  width: auto;
}

.field-actions {
  position: absolute;
  top: 2px;
  right: 2px;
  display: none;
}
.form-field-wrapper:hover .field-actions {
  display: block;
}

.empty-canvas-placeholder, .empty-properties-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: var(--color-text-3);
  font-size: 14px;
}

.properties-content {
  padding-top: 10px;
}
.properties-content h4 {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 10px;
  color: var(--color-text-1);
}

.manual-options-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 0;
  margin-bottom: -20px;
}

.option-editor-block {
  display: flex;
  flex-direction: column;
  gap: 8px /* Gap between items within a block */;
  padding: 12px;
  border: 1px solid var(--color-border-2);
  border-radius: 4px;
  margin-bottom: 12px /* Gap between option blocks */;
  background-color: var(--color-fill-1);
  width: 100%; /* Make each block take full width of its container */
  box-sizing: border-box; /* Ensure padding and border don't add to width */
}

.option-editor-title {
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--color-text-2);
}

.option-editor-actions {
  margin-top: 4px;
  align-self: flex-end;
}

.canvas-field-label-container {
  display: flex;
  flex-direction: column; 
  gap: 4px; 
  /* margin-bottom: 4px; */ /* Optional: if more space needed below the entire block */
}

.canvas-field-label {
  font-size: 13px;
  color: var(--color-text-2);
  display: block; 
}

.canvas-field-node-id { /* Style for Node ID in canvas label */
  font-size: 0.9em;
  color: var(--color-text-3);
  margin-left: 4px;
}

.canvas-field-required-indicator {
  color: rgb(var(--danger-6)); /* Using Arco variable for danger color */
  margin-left: 2px;
}

.conditional-rule-block {
  border: 1px solid var(--color-border-2);
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 4px;
  background-color: var(--color-fill-1);
}

.rule-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-2);
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.conditional-logic-summary {
  font-size: 12px;
  color: var(--color-text-2);
  background-color: var(--color-fill-1);
  padding: 8px;
  border-radius: 4px;
  margin-top: 8px;
  line-height: 1.6;
}
</style> 