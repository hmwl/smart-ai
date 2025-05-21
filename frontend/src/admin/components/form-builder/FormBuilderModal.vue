<template>
  <a-modal
    :visible="visible"
    title="表单设计器"
    @cancel="handleCancel"
    @ok="handleOk"
    :width="1200"
    :footer="true" 
    :mask-closable="false"
    :body-style="{ padding: '0px' }"
  >
    <template #footer>
      <a-button @click="handleCancel">取消</a-button>
      <a-button type="primary" @click="handleSave">保存</a-button>
    </template>
    <FormBuilder 
      v-if="visible" 
      :application-id="applicationId" 
      :platform-type="props.platformType"
      ref="formBuilderRef"
      @save-success="handleSaveSuccess"
    />
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue';
import FormBuilder from './FormBuilder.vue';
import { Message } from '@arco-design/web-vue';

const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  applicationId: {
    type: String,
    default: null,
  },
  platformType: {
    type: String,
    default: null,
  }
});

const emit = defineEmits(['update:visible', 'save']);

const formBuilderRef = ref(null);

const handleCancel = () => {
  emit('update:visible', false);
};

const handleOk = async () => {
  // This will be triggered by the custom save button now
  // if (formBuilderRef.value) {
  //   await formBuilderRef.value.saveForm();
  // }
  // emit('update:visible', false);
};

const handleSave = async () => {
  if (formBuilderRef.value) {
    try {
      await formBuilderRef.value.saveForm();
      // Success message will be handled by FormBuilder itself or here upon successful save event
    } catch (error) {
      // Error message already handled in FormBuilder
    }
  }
};

const handleSaveSuccess = () => {
  Message.success('表单配置保存成功！');
  emit('update:visible', false);
  emit('save'); // Notify parent that save was successful
};

watch(() => props.visible, (newVal) => {
  if (newVal && props.applicationId) {
    // Modal is now visible, potentially load initial form config if needed
    // This could also be handled within FormBuilder's onMounted or a specific load method
  }
});

</script>

<style scoped>
/* Minimal styling, as the modal itself provides structure */
</style> 