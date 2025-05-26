<template>
  <div v-if="!isModal" class="account-info-page p-4 md:p-6">
    <!-- 当作为页面使用时显示页面标题 -->
    <a-page-header
      title="账户信息"
      class="mb-4 site-page-header"
      @back="() => $router.go(-1)"
    >
      <template #extra>
        <a-space v-if="!isEditMode">
          <a-button type="primary" @click="openTopUpModal">充值</a-button>
          <a-button @click="toggleEditMode(true)">编辑信息</a-button>
        </a-space>
        <div v-else>
          <a-button type="primary" @click="saveAllChanges" :loading="savingAll" style="margin-right: 10px;">保存更改</a-button>
          <a-button @click="cancelEditMode">取消</a-button>
        </div>
      </template>
    </a-page-header>

    <!-- 页面内容 -->
    <div class="account-info-content">

    <a-spin :spinning="loading || paymentConfigLoading" tip="加载中...">
      <div v-if="error" class="error-message">
        <a-alert type="error" :message="error" banner />
      </div>
      <div v-else-if="userData" class="user-details-container">
        <!-- View Mode: Descriptions -->
        <a-descriptions
          v-if="!isEditMode"
          bordered
          :column="{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }"
          class="mb-6"
        >
          <a-descriptions-item label="用户名">{{ userData.username }}</a-descriptions-item>
          <a-descriptions-item label="邮箱">{{ userData.email || '未设置' }}</a-descriptions-item>
          <a-descriptions-item label="昵称">{{ userData.nickname || '未设置' }}</a-descriptions-item>
          <a-descriptions-item label="账户积分"><a-statistic :value="userData.creditsBalance" :precision="0" /></a-descriptions-item>
          <a-descriptions-item label="账户状态">
            <a-tag :color="userData.status === 'active' ? 'green' : 'red'">{{ userData.status === 'active' ? '正常' : '禁用' }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="注册时间">{{ formatDateCN(userData.createdAt) }}</a-descriptions-item>
        </a-descriptions>

        <!-- Edit Mode: Forms -->
        <div v-if="isEditMode" class="edit-mode-forms">
          <a-divider orientation="left">修改昵称</a-divider>
          <div class="form-section nickname-edit-section">
            <a-form :model="editData" layout="vertical" ref="nicknameFormRef">
              <a-form-item field="nickname" label="新昵称" :rules="[{ maxLength: 50, message: '昵称长度不能超过50个字符'}]">
                <a-input v-model="editData.nickname" placeholder="输入新昵称 (留空则清除)" allow-clear />
              </a-form-item>
            </a-form>
          </div>

          <a-divider orientation="left">修改密码</a-divider>
          <div class="form-section password-change-section">
            <a-form :model="editData.passwordFields" layout="vertical" ref="passwordFormRef">
              <a-form-item field="currentPassword" label="当前密码" :rules="[{ required: true, message: '当前密码不能为空' }]">
                <a-input-password v-model="editData.passwordFields.currentPassword" placeholder="输入当前密码" allow-clear />
              </a-form-item>
              <a-form-item field="newPassword" label="新密码" :rules="[{ required: true, message: '新密码不能为空' }, { minLength: 6, message: '新密码长度至少6位' }]">
                <a-input-password v-model="editData.passwordFields.newPassword" placeholder="输入新密码 (至少6位)" allow-clear />
              </a-form-item>
              <a-form-item field="confirmPassword" label="确认新密码" :rules="[{ required: true, message: '确认密码不能为空' }, { validator: validateConfirmPassword }]">
                <a-input-password v-model="editData.passwordFields.confirmPassword" placeholder="再次输入新密码" allow-clear />
              </a-form-item>
            </a-form>
          </div>
        </div>

      </div>
      <a-empty v-else-if="!loading" description="无法加载用户信息" />
    </a-spin>

    <!-- Top-up Modal -->
    <a-modal
      v-model:visible="topUpModalVisible"
      title="账户充值"
      @ok="handleTopUpConfirm"
      @cancel="handleTopUpCancel"
      :ok-loading="topUpSubmitting"
      ok-text="确认充值"
      cancel-text="取消"
      width="600px"
    >
      <a-form :model="topUpForm" layout="vertical" ref="topUpFormRef">
        <a-form-item field="amount" label="充值金额 (CNY)" :rules="[{ required: true, type: 'number', min: 0.01, message: '请输入有效的充值金额'}]">
          <a-input-number v-model="topUpForm.amount" placeholder="请输入充值金额" :precision="2" :min="0.01" style="width: 100%;" />
        </a-form-item>

        <div v-if="paymentConfig.yuanToCreditsRate" class="exchange-rate-info mb-4">
          <p>当前兑换率: 1 CNY = {{ paymentConfig.yuanToCreditsRate }} 积分</p>
          <p v-if="topUpForm.amount > 0">预计可获得: <strong>{{ (topUpForm.amount * paymentConfig.yuanToCreditsRate).toFixed(0) }}</strong> 积分</p>
        </div>

        <a-form-item field="paymentMethod" label="支付方式" :rules="[{ required: true, message: '请选择支付方式'}]">
          <a-radio-group v-if="paymentConfig.paymentMethods && paymentConfig.paymentMethods.length > 0" v-model="topUpForm.paymentMethod">
            <a-radio v-for="method in paymentConfig.paymentMethods" :key="method.key" :value="method.key">
              {{ method.name }}
            </a-radio>
          </a-radio-group>
          <a-empty v-else description="暂无可用的支付方式" />
        </a-form-item>

        <div class="promotion-info mb-4">
          <p><strong>可选优惠活动:</strong></p>
          <a-spin :loading="promotionsLoading" style="width: 100%;">
            <div v-if="!promotionsLoading && availablePromotions.length > 0">
              <div v-for="promo in availablePromotions" :key="promo.id" class="promotion-item">
                <strong>{{ promo.name }}</strong>: {{ promo.displayInfo || promo.description }}
                <div v-if="promo.minAmount > 0"><em>(最低充值 {{ promo.minAmount }} CNY)</em></div>
              </div>
            </div>
            <a-empty v-else-if="!promotionsLoading && availablePromotions.length === 0" description="暂无可用优惠活动" />
          </a-spin>
        </div>

        <!-- 动态结果展示 -->
        <div v-if="selectedPromotion && topUpForm.amount" class="mb-4">
          <template v-if="selectedPromotion.type === 'gradient_discount'">
            <p>应用折扣后实际支付金额：<strong>{{ actualPayAmount }}</strong> CNY</p>
            <p v-if="gradientTiers.length > 0" class="text-sm text-gray-500">
              当前适用折扣：充值
              <template v-for="(tier, index) in gradientTiers" :key="tier.minAmountRMB">
                {{ tier.minAmountRMB }}-{{ tier.maxAmountRMB }}元 {{ tier.discountRate }}折
                <template v-if="index < gradientTiers.length - 1">, </template>
              </template>
            </p>
          </template>
          <template v-else-if="selectedPromotion.type.startsWith('full_reduction_')">
            <p>预计可获得：<strong>{{ estimatedCredits }}</strong> 积分</p>
          </template>
        </div>
      </a-form>
      <!-- 修改按钮文案 -->
      <template #footer>
        <a-button @click="handleTopUpCancel">取消</a-button>
        <a-button type="primary" :loading="topUpSubmitting" @click="handleTopUpConfirm">
          <template v-if="selectedPromotion && selectedPromotion.type === 'gradient_discount' && topUpForm.amount">
            确认支付 ￥{{ actualPayAmount }}
          </template>
          <template v-else>
            确认充值
          </template>
        </a-button>
      </template>
    </a-modal>

    </div>
  </div>

  <!-- 弹窗模式 -->
  <a-modal
    v-else
    v-model:visible="localVisible"
    title="账户信息"
    :footer="false"
    :mask-closable="false"
    :closable="true"
    @cancel="handleModalClose"
    width="700px"
  >
    <div class="modal-content">
      <a-spin :spinning="loading || paymentConfigLoading" tip="加载中...">
        <div v-if="error" class="error-message">
          <a-alert type="error" :message="error" banner />
        </div>
        <div v-else-if="userData" class="user-details-container">
          <!-- View Mode: Descriptions -->
          <a-descriptions
            v-if="!isEditMode"
            bordered
            :column="{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }"
            class="mb-6"
          >
            <a-descriptions-item label="用户名">{{ userData.username }}</a-descriptions-item>
            <a-descriptions-item label="邮箱">{{ userData.email || '未设置' }}</a-descriptions-item>
            <a-descriptions-item label="昵称">{{ userData.nickname || '未设置' }}</a-descriptions-item>
            <a-descriptions-item label="账户积分"><a-statistic :value="userData.creditsBalance" :precision="0" /></a-descriptions-item>
            <a-descriptions-item label="账户状态">
              <a-tag :color="userData.status === 'active' ? 'green' : 'red'">{{ userData.status === 'active' ? '正常' : '禁用' }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="注册时间">{{ formatDateCN(userData.createdAt) }}</a-descriptions-item>
          </a-descriptions>

          <!-- Edit Mode: Forms -->
          <div v-if="isEditMode" class="edit-mode-forms">
            <a-divider orientation="left">修改昵称</a-divider>
            <div class="form-section nickname-edit-section">
              <a-form :model="editData" layout="vertical" ref="nicknameFormRef">
                <a-form-item field="nickname" label="新昵称" :rules="[{ maxLength: 50, message: '昵称长度不能超过50个字符'}]">
                  <a-input v-model="editData.nickname" placeholder="输入新昵称 (留空则清除)" allow-clear />
                </a-form-item>
              </a-form>
            </div>

            <a-divider orientation="left">修改密码</a-divider>
            <div class="form-section password-change-section">
              <a-form :model="editData.passwordFields" layout="vertical" ref="passwordFormRef">
                <a-form-item field="currentPassword" label="当前密码" :rules="[{ required: true, message: '当前密码不能为空' }]">
                  <a-input-password v-model="editData.passwordFields.currentPassword" placeholder="输入当前密码" allow-clear />
                </a-form-item>
                <a-form-item field="newPassword" label="新密码" :rules="[{ required: true, message: '新密码不能为空' }, { minLength: 6, message: '新密码长度至少6位' }]">
                  <a-input-password v-model="editData.passwordFields.newPassword" placeholder="输入新密码 (至少6位)" allow-clear />
                </a-form-item>
                <a-form-item field="confirmPassword" label="确认新密码" :rules="[{ required: true, message: '确认密码不能为空' }, { validator: validateConfirmPassword }]">
                  <a-input-password v-model="editData.passwordFields.confirmPassword" placeholder="再次输入新密码" allow-clear />
                </a-form-item>
              </a-form>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="action-buttons">
            <a-space v-if="!isEditMode">
              <a-button type="primary" @click="openTopUpModal">充值</a-button>
              <a-button @click="toggleEditMode(true)">编辑信息</a-button>
              <a-button @click="handleModalClose">关闭</a-button>
            </a-space>
            <div v-else>
              <a-button type="primary" @click="saveAllChanges" :loading="savingAll" style="margin-right: 10px;">保存更改</a-button>
              <a-button @click="cancelEditMode" style="margin-right: 10px;">取消</a-button>
              <a-button @click="handleModalClose">关闭</a-button>
            </div>
          </div>
        </div>
        <a-empty v-else-if="!loading" description="无法加载用户信息" />
      </a-spin>
    </div>

    <!-- 充值弹窗 - 弹窗模式 -->
    <a-modal
      v-model:visible="topUpModalVisible"
      title="账户充值"
      @ok="handleTopUpConfirm"
      @cancel="handleTopUpCancel"
      :ok-loading="topUpSubmitting"
      ok-text="确认充值"
      cancel-text="取消"
      width="600px"
    >
      <a-form :model="topUpForm" layout="vertical" ref="topUpFormRef">
        <a-form-item field="amount" label="充值金额 (CNY)" :rules="[{ required: true, type: 'number', min: 0.01, message: '请输入有效的充值金额'}]">
          <a-input-number v-model="topUpForm.amount" placeholder="请输入充值金额" :precision="2" :min="0.01" style="width: 100%;" />
        </a-form-item>

        <div v-if="paymentConfig.yuanToCreditsRate" class="exchange-rate-info mb-4">
          <p>当前兑换率: 1 CNY = {{ paymentConfig.yuanToCreditsRate }} 积分</p>
          <p v-if="topUpForm.amount > 0">预计可获得: <strong>{{ (topUpForm.amount * paymentConfig.yuanToCreditsRate).toFixed(0) }}</strong> 积分</p>
        </div>

        <a-form-item field="paymentMethod" label="支付方式" :rules="[{ required: true, message: '请选择支付方式'}]">
          <a-radio-group v-if="paymentConfig.paymentMethods && paymentConfig.paymentMethods.length > 0" v-model="topUpForm.paymentMethod">
            <a-radio v-for="method in paymentConfig.paymentMethods" :key="method.key" :value="method.key">
              {{ method.name }}
            </a-radio>
          </a-radio-group>
          <a-empty v-else description="暂无可用的支付方式" />
        </a-form-item>

        <div class="promotion-info mb-4">
          <p><strong>可选优惠活动:</strong></p>
          <a-spin :loading="promotionsLoading" style="width: 100%;">
            <div v-if="!promotionsLoading && availablePromotions.length > 0">
              <div v-for="promo in availablePromotions" :key="promo.id" class="promotion-item">
                <strong>{{ promo.name }}</strong>: {{ promo.displayInfo || promo.description }}
                <div v-if="promo.minAmount > 0"><em>(最低充值 {{ promo.minAmount }} CNY)</em></div>
              </div>
            </div>
            <a-empty v-else-if="!promotionsLoading && availablePromotions.length === 0" description="暂无可用优惠活动" />
          </a-spin>
        </div>

        <!-- 动态结果展示 -->
        <div v-if="selectedPromotion && topUpForm.amount" class="mb-4">
          <template v-if="selectedPromotion.type === 'gradient_discount'">
            <p>应用折扣后实际支付金额：<strong>{{ actualPayAmount }}</strong> CNY</p>
            <p v-if="gradientTiers.length > 0" class="text-sm text-gray-500">
              当前适用折扣：充值
              <template v-for="(tier, index) in gradientTiers" :key="tier.minAmountRMB">
                {{ tier.minAmountRMB }}-{{ tier.maxAmountRMB }}元 {{ tier.discountRate }}折
                <template v-if="index < gradientTiers.length - 1">, </template>
              </template>
            </p>
          </template>
          <template v-else-if="selectedPromotion.type.startsWith('full_reduction_')">
            <p>预计可获得：<strong>{{ estimatedCredits }}</strong> 积分</p>
          </template>
        </div>
      </a-form>
      <!-- 修改按钮文案 -->
      <template #footer>
        <a-button @click="handleTopUpCancel">取消</a-button>
        <a-button type="primary" :loading="topUpSubmitting" @click="handleTopUpConfirm">
          <template v-if="selectedPromotion && selectedPromotion.type === 'gradient_discount' && topUpForm.amount">
            确认支付 ￥{{ actualPayAmount }}
          </template>
          <template v-else>
            确认充值
          </template>
        </a-button>
      </template>
    </a-modal>
  </a-modal>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed, defineProps, defineEmits } from 'vue';
import apiClient from '../services/apiService';
import {
  Alert as AAlert,
  Button as AButton,
  Descriptions as ADescriptions,
  DescriptionsItem as ADescriptionsItem,
  Divider as ADivider,
  Empty as AEmpty,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputPassword as AInputPassword,
  InputNumber as AInputNumber,
  PageHeader as APageHeader,
  Spin as ASpin,
  Statistic as AStatistic,
  Tag as ATag,
  Message,
  Modal as AModal,
  RadioGroup as ARadioGroup,
  Radio as ARadio,
  Space as ASpace
} from '@arco-design/web-vue';
import { formatDateCN } from '@/client/utils/date';

// 定义 props 和 emits
const props = defineProps({
  // 当作为弹窗使用时，通过 visible 控制显示/隐藏
  visible: {
    type: Boolean,
    default: false
  },
  // 当作为弹窗使用时，可以直接传入用户数据
  userData: {
    type: Object,
    default: null
  },
  // 是否作为弹窗使用
  isModal: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:visible', 'update:userData']);

// 如果作为独立页面使用，则使用内部状态
// 如果作为弹窗使用，则使用 props 传入的数据
const localUserData = ref(null);
const loading = ref(true);
const error = ref(null);

// 本地控制弹窗显示/隐藏
const localVisible = ref(false);

const isEditMode = ref(false);
const savingAll = ref(false);

// 计算属性：根据是否为弹窗模式返回正确的用户数据
const userData = computed({
  get: () => props.isModal ? props.userData : localUserData.value,
  set: (val) => {
    if (props.isModal) {
      emit('update:userData', val);
    } else {
      localUserData.value = val;
    }
  }
});

// Use a single reactive object for all editable fields in edit mode
const editData = reactive({
  nickname: '',
  // email: '', // Placeholder for future email change
  passwordFields: {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  }
});

// Refs for forms to trigger validation/reset
const nicknameFormRef = ref(null);
const passwordFormRef = ref(null);

// Store initial data to revert on cancel
let initialEditData = {};

const fetchUserData = async () => {
  // 如果是弹窗模式且已经有用户数据，则不需要重新获取
  if (props.isModal && props.userData) {
    // 初始化编辑数据
    initEditData(props.userData);
    return;
  }

  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.get('/auth/me');
    if (props.isModal) {
      emit('update:userData', response.data);
    } else {
      localUserData.value = response.data;
    }
    // 初始化编辑数据
    initEditData(response.data);
  } catch (err) {
    console.error("Failed to fetch user data:", err);
    error.value = err.response?.data?.message || '获取用户信息失败，请稍后再试。';
    if (err.response?.status === 401 || err.response?.status === 403) {
        // Handle unauthorized or forbidden access, perhaps redirect to login
        // For now, just display the error.
        error.value = '会话已过期或无效，请重新登录。'
    }
  } finally {
    loading.value = false;
  }
};

// 初始化编辑数据
const initEditData = (data) => {
  if (!data) return;

  Object.assign(editData, {
    nickname: data.nickname || '',
    // email: data.email || '',
    passwordFields: { currentPassword: '', newPassword: '', confirmPassword: '' }
  });
  // Store initial state for cancellation
  initialEditData = JSON.parse(JSON.stringify(editData));
};

const toggleEditMode = (edit) => {
  isEditMode.value = edit;
  if (edit) {
    // When entering edit mode, sync editData with current userData
    Object.assign(editData, {
      nickname: userData.value?.nickname || '',
      // email: userData.value?.email || '',
      passwordFields: { currentPassword: '', newPassword: '', confirmPassword: '' }
    });
    initialEditData = JSON.parse(JSON.stringify(editData));
  } else {
    // Optionally reset forms if needed, though cancelEditMode handles resetting data
    nicknameFormRef.value?.clearValidate();
    passwordFormRef.value?.resetFields(); // Resets password fields to initial (empty)
    passwordFormRef.value?.clearValidate();
  }
};

const cancelEditMode = () => {
  Object.assign(editData, JSON.parse(JSON.stringify(initialEditData))); // Revert to initial state
  toggleEditMode(false);
};

const validateConfirmPassword = (value, cb) => {
  if (value !== editData.passwordFields.newPassword) {
    cb('两次输入的新密码不一致');
  }
  return true;
};

const saveAllChanges = async () => {
  savingAll.value = true;
  let nicknameUpdated = false;
  let passwordChanged = false;

  try {
    // 1. Update Nickname if changed
    if (editData.nickname.trim() !== (userData.value?.nickname || '')) {
      const nicknamePayload = editData.nickname.trim() === '' ? null : editData.nickname.trim();
      await apiClient.patch('/auth/me', { nickname: nicknamePayload });
      userData.value.nickname = nicknamePayload; // Update local userData
      initialEditData.nickname = nicknamePayload; // Update initial data for subsequent cancels
      Message.success('昵称更新成功！');
      nicknameUpdated = true;
    }

    // 2. Change Password if all fields are filled
    const { currentPassword, newPassword, confirmPassword } = editData.passwordFields;
    if (currentPassword && newPassword && confirmPassword) {
      if (newPassword.length < 6) throw new Error('新密码长度至少6位');
      if (newPassword !== confirmPassword) throw new Error('新密码和确认密码不匹配');

      await apiClient.post('/auth/change-password', editData.passwordFields);
      Message.success('密码更新成功！');
      passwordChanged = true;
      // Reset password fields after successful change
      editData.passwordFields.currentPassword = '';
      editData.passwordFields.newPassword = '';
      editData.passwordFields.confirmPassword = '';
      initialEditData.passwordFields = { ...editData.passwordFields }; // Update initial data
      passwordFormRef.value?.clearValidate();
    } else if (currentPassword || newPassword || confirmPassword) {
      // Some password fields are filled but not all - might be an error or user in midst of typing
      // For now, we only submit if all are filled. Or add specific validation trigger.
       Message.info('如需修改密码，请填写所有密码字段。');
    }

    if (!nicknameUpdated && !passwordChanged && !(currentPassword || newPassword || confirmPassword)) {
        Message.info('未检测到任何更改。');
    }

    if(nicknameUpdated || passwordChanged) {
        toggleEditMode(false); // Exit edit mode on successful save of at least one item
    }

  } catch (err) {
    console.error("Failed to save changes:", err);
    Message.error(err.response?.data?.message || err.message || '保存失败，请稍后再试。');
  } finally {
    savingAll.value = false;
  }
};

// --- Top-up Modal State and Logic ---
const topUpModalVisible = ref(false);
const topUpSubmitting = ref(false);
const topUpFormRef = ref(null);
const topUpForm = reactive({
  amount: null, // in CNY
  paymentMethod: '' // e.g., 'alipay', 'wechatpay'
});

const paymentConfig = reactive({
  yuanToCreditsRate: null,
  currencySymbol: 'CNY',
  paymentMethods: [] // e.g., [{ key: 'alipay', name: '支付宝' }]
});
const paymentConfigLoading = ref(false);

// --- Promotions State ---
const availablePromotions = ref([]);
const promotionsLoading = ref(false);

const fetchPaymentConfig = async () => {
  paymentConfigLoading.value = true;
  try {
    // API endpoint to be created: GET /api/public/payment-config
    const response = await apiClient.get('/public/payment-config');
    Object.assign(paymentConfig, response.data);
    if (paymentConfig.paymentMethods && paymentConfig.paymentMethods.length > 0) {
      // Set a default payment method if available
      // topUpForm.paymentMethod = paymentConfig.paymentMethods[0].key;
    }
  } catch (err) {
    console.error("Failed to fetch payment config:", err);
    Message.error(err.response?.data?.message || '获取充值配置失败');
  } finally {
    paymentConfigLoading.value = false;
  }
};

const fetchRechargePromotions = async () => {
  promotionsLoading.value = true;
  try {
    const response = await apiClient.get('/public/recharge-promotions');
    availablePromotions.value = response.data || [];
  } catch (err) {
    console.error("Failed to fetch recharge promotions:", err);
    Message.error(err.response?.data?.message || '获取优惠信息失败');
    availablePromotions.value = []; // Clear on error
  } finally {
    promotionsLoading.value = false;
  }
};

const openTopUpModal = () => {
  // Reset form before opening
  topUpForm.amount = null;
  topUpFormRef.value?.clearValidate();
  topUpModalVisible.value = true;

  // Fetch payment config and promotions
  fetchPaymentConfig().then(() => {
    if (paymentConfig.paymentMethods && paymentConfig.paymentMethods.length > 0) {
      if (!topUpForm.paymentMethod || !paymentConfig.paymentMethods.find(pm => pm.key === topUpForm.paymentMethod)) {
         topUpForm.paymentMethod = paymentConfig.paymentMethods[0].key;
      }
    } else {
      topUpForm.paymentMethod = '';
    }
  });
  fetchRechargePromotions(); // Fetch promotions when modal opens
};

const handleTopUpConfirm = async () => {
  const valid = await topUpFormRef.value?.validate();
  if (valid) return;

  topUpSubmitting.value = true;
  try {
    // For now, just simulate and show details. Actual API call will be added later.
    Message.info(`模拟充值: 金额 ${topUpForm.amount} ${paymentConfig.currencySymbol}, 支付方式: ${topUpForm.paymentMethod}. 此功能后续将对接实际支付接口。`);
    // TODO: Call actual top-up API endpoint
    // const response = await apiClient.post('/client/top-up', {
    //   amount: topUpForm.amount,
    //   paymentMethodKey: topUpForm.paymentMethod,
    //   currency: paymentConfig.currencySymbol
    // });
    // Message.success(response.data.message || '充值请求已提交');
    // fetchUserData(); // Refresh user data to show new balance
    topUpModalVisible.value = false;
  } catch (err) {
    console.error("Top-up failed:", err);
    Message.error(err.response?.data?.message || '充值失败');
  } finally {
    topUpSubmitting.value = false;
  }
};

const handleTopUpCancel = () => {
  topUpModalVisible.value = false;
};

// 计算当前可用的充值活动（优先梯度折扣，其次满减折扣，后续可优化为让用户选择）
const selectedPromotion = computed(() => {
  if (!availablePromotions.value.length || !topUpForm.amount) return null;
  // 优先梯度折扣
  const gradient = availablePromotions.value.find(p => p.type === 'gradient_discount');
  if (gradient) return gradient;
  // 其次满减折扣
  const fullReduction = availablePromotions.value.find(p => p.type.startsWith('full_reduction_'));
  if (fullReduction) return fullReduction;
  return null;
});

// 梯度折扣详细信息（tiers）
const gradientTiers = computed(() => {
  if (!selectedPromotion.value || selectedPromotion.value.type !== 'gradient_discount') return [];
  // 需要后端把 tiers 传给前端，暂时假设 displayInfo 不包含详细梯度，后续可优化
  // 这里假设后端已将 tiers 作为 selectedPromotion.value.tiers 传递
  return selectedPromotion.value.tiers || [];
});

// 计算实际支付金额（梯度折扣）
const actualPayAmount = computed(() => {
  const currentAmount = topUpForm.amount;

  if (!selectedPromotion.value || selectedPromotion.value.type !== 'gradient_discount' || typeof currentAmount !== 'number' || currentAmount <= 0) {
    return currentAmount ? Number(currentAmount).toFixed(2) : '0.00';
  }

  const amount = Number(currentAmount);
  const tiers = gradientTiers.value; // From computed: selectedPromotion.value.tiers || []

  if (!tiers || tiers.length === 0) {
    return amount.toFixed(2); // No tiers defined, no discount
  }

  const matchedTier = tiers.find(t => {
    const min = Number(t.minAmountRMB);
    const max = Number(t.maxAmountRMB);
    // Ensure min, max are valid numbers for comparison
    if (isNaN(min) || isNaN(max)) {
      console.warn('Invalid tier range data:', t);
      return false;
    }
    return amount >= min && amount <= max;
  });

  if (!matchedTier) {
    return amount.toFixed(2); // Amount doesn't fall into any defined tier
  }

  const discountRate = Number(matchedTier.discountRate);
  if (isNaN(discountRate) || discountRate < 0 || discountRate > 100) { // Basic validation for discountRate
    console.warn('Invalid discountRate data:', matchedTier);
    return amount.toFixed(2); // discountRate is not a valid percentage, apply no discount
  }

  // discountRate: 80 means pay 80% of the price (20% discount)
  // For example, if amount is 100 and discountRate is 80, the user pays 80
  const calculatedAmount = amount * (discountRate / 100);
  return calculatedAmount.toFixed(2);
});

// 计算预计获得积分（满减折扣）
const estimatedCredits = computed(() => {
  if (!selectedPromotion.value || !topUpForm.amount) return 0;
  const amount = Number(topUpForm.amount);
  const rate = paymentConfig.yuanToCreditsRate || 1;
  if (selectedPromotion.value.type === 'full_reduction_discount_rate') {
    // 折扣率型：积分 = (充值金额 × 兑换率) × (discountRate / 100)
    const discountRate = selectedPromotion.value.value || 100;
    return Math.floor(amount * rate * (discountRate / 100));
  } else if (selectedPromotion.value.type === 'full_reduction_gift_points') {
    // 赠送积分型：积分 = (充值金额 × 兑换率) + 满足条件的赠送积分
    const everyAmount = selectedPromotion.value.minAmount || 0.01;
    const giftPoints = selectedPromotion.value.value || 0;
    const baseCredits = amount * rate;
    const times = Math.floor(amount / everyAmount);
    return Math.floor(baseCredits + times * giftPoints);
  }
  // 其他类型默认
  return Math.floor(amount * rate);
});

// 处理弹窗关闭
const handleModalClose = () => {
  if (props.isModal) {
    emit('update:visible', false);
    localVisible.value = false;
  }
};

// 监听 visible 属性变化，当弹窗打开时获取数据
watch(() => props.visible, (newVal) => {
  if (props.isModal) {
    localVisible.value = newVal;
    if (newVal) {
      fetchUserData();
      fetchPaymentConfig();
      fetchRechargePromotions();
    }
  }
});

// 组件挂载时的初始化
onMounted(() => {
  if (props.isModal) {
    // 初始化 localVisible
    localVisible.value = props.visible;
  } else {
    // 如果不是弹窗模式，则在挂载时获取数据
    fetchUserData();
    fetchPaymentConfig();
    fetchRechargePromotions();
  }
});

</script>

<style scoped>
.account-info-page {
  color: #fff;
}

/* 弹窗模式的样式 */
.modal-content {
  padding: 16px;
}

/* 操作按钮区域 */
.action-buttons {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}

.site-page-header {
  background-color: var(--custom-bg-secondary);
  border-radius: 4px;
  padding: 16px 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.user-details-container {
  background-color: var(--custom-bg-secondary);
  padding: 24px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.edit-mode-forms .form-section {
  margin-bottom: 24px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.05);
}

.error-message {
  padding: 20px;
}

.nickname-edit-section,
.password-change-section {
  border-color: rgba(255, 255, 255, 0.1);
  background-color: rgba(255, 255, 255, 0.05);
}

.exchange-rate-info p {
  margin-bottom: 4px;
  color: rgba(255, 255, 255, 0.7);
}

.exchange-rate-info strong {
  color: #fff;
}

.promotion-info p {
  margin-bottom: 4px;
  color: rgba(255, 255, 255, 0.7);
}

.promotion-info strong {
  font-weight: bold;
  color: #fff;
}

.promotion-item {
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  margin-bottom: 8px;
  background-color: rgba(255, 255, 255, 0.05);
}

.promotion-item:last-child {
  margin-bottom: 0;
}

.mb-4 {
  margin-bottom: 1rem; /* 16px */
}

.text-sm {
  font-size: 0.875rem;
}

.text-gray-500 {
  color: rgba(255, 255, 255, 0.5);
}
</style>