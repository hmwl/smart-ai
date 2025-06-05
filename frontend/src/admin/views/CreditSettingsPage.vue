<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">积分设置</h2>
      <!-- Action buttons can go here if needed in the future -->
      <a-space>
        <a-button type="primary" @click="saveCreditSettings" :loading="isSettingsSaving">
          <template #icon><icon-save /></template> 保存配置
        </a-button>
      </a-space>
    </div>

    <!-- Credits Configuration Card -->
    <a-card class="settings-content-card">
      <a-spin :loading="isSettingsLoading" tip="加载配置中...">
        <a-form :model="creditSettingsForm" layout="vertical" @submit="saveCreditSettings">
          <a-form-item field="initialCredits" label="用户初始积分" :rules="[{ required: true, message: '请输入初始积分'}]">
            <a-input-number v-model="creditSettingsForm.initialCredits" placeholder="例如: 100" :min="0" style="width: 100%;"/>
          </a-form-item>
          <a-form-item field="exchangeRate" label="兑换比率 (1元 = X积分)" :rules="[{ required: true, message: '请输入兑换比率'}]">
            <a-input-number v-model="creditSettingsForm.exchangeRate" placeholder="例如: 100" :min="0.01" :precision="2" style="width: 100%;"/>
          </a-form-item>
          <a-form-item field="paymentPlatforms" label="启用支付平台">
            <a-checkbox-group v-model="creditSettingsForm.paymentPlatforms">
              <a-checkbox value="wechat">微信支付</a-checkbox>
              <a-checkbox value="alipay">支付宝</a-checkbox>
              <a-checkbox value="unionpay">云闪付</a-checkbox>
              <a-checkbox value="unifiedpay">融合支付</a-checkbox>
            </a-checkbox-group>
          </a-form-item>
          <a-form-item>
            <a-button type="primary" html-type="submit" :loading="isSettingsSaving">
              <template #icon><icon-save /></template> 保存配置
            </a-button>
          </a-form-item>
        </a-form>
      </a-spin>
    </a-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import {
  Message,
  Spin as ASpin,
  Button as AButton,
  InputNumber as AInputNumber,
  Form as AForm,
  FormItem as AFormItem,
  Card as ACard,
  CheckboxGroup as ACheckboxGroup,
  Checkbox as ACheckbox,
  Row as ARow,
  Col as ACol,
  Alert as AAlert // Keep AAlert if you want to use it elsewhere, or remove if not needed
} from '@arco-design/web-vue';
import apiService from '../services/apiService'; // Assuming this exists

// State for Credit Settings
const creditSettingsForm = reactive({
  _id: null, // To store the ID of the settings document
  initialCredits: 0,
  exchangeRate: 100,
  paymentPlatforms: [],
});
const isSettingsLoading = ref(false);
const isSettingsSaving = ref(false);

// --- Credit Settings Functions ---
const fetchCreditSettings = async () => {
  isSettingsLoading.value = true;
  try {
    const response = await apiService.get('/credit-settings');
    if (response.data) {
      Object.assign(creditSettingsForm, response.data);
    }
  } catch (error) {
    Message.error('加载积分配置失败: ' + (error.response?.data?.message || error.message));
  } finally {
    isSettingsLoading.value = false;
  }
};

const saveCreditSettings = async () => {
  isSettingsSaving.value = true;
  try {
    const payload = { ...creditSettingsForm };
    await apiService.put('/credit-settings', payload);
    Message.success('积分配置保存成功！');
    fetchCreditSettings(); // Refresh settings after save
  } catch (error) {
    Message.error('保存积分配置失败: ' + (error.response?.data?.message || error.message));
  } finally {
    isSettingsSaving.value = false;
  }
};

onMounted(() => {
  fetchCreditSettings(); // Fetch settings on mount
});

</script>

<style scoped>
/* Add any specific styles if needed */
.settings-content-card .arco-card-body {
  padding-top: 16px; /* Add some padding if card title is removed */
}
.settings-content-card {
    margin-top: 0; /* Remove top margin if it's the main content block */
}
</style> 