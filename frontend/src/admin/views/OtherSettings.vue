<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">其他设置</h2>
      <a-space>
        <a-button type="primary" disabled>
          <template #icon><icon-save /></template> 保存
        </a-button>
      </a-space>
    </div>
    <a-form layout="vertical" style="max-width: 500px;">
      <a-form-item label="账户cookie时效">
        <a-input-group compact>
          <a-input-number v-model="cookieExpire.value" min="1" style="width: 120px" />
          <a-select v-model="cookieExpire.unit" style="width: 80px">
            <a-option value="h">小时</a-option>
            <a-option value="d">天</a-option>
          </a-select>
        </a-input-group>
        <div class="text-xs text-gray-400 mt-1">天为自然时间23:59:59后时效</div>
      </a-form-item>
    </a-form>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import { IconSave } from '@arco-design/web-vue/es/icon';
const cookieExpire = ref({ value: 1, unit: 'd' });
</script> 