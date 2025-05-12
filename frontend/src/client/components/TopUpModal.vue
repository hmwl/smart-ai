<template>
  <a-modal
    :visible="visible"
    title="账户充值"
    @ok="handleTopUpConfirm"
    @cancel="handleTopUpCancel"
    :ok-loading="topUpSubmitting"
    ok-text="确认充值"
    cancel-text="取消"
    width="600px"
  >
    <a-form :model="topUpForm" layout="vertical" ref="topUpFormRef">
      <a-form-item field="amount" label="充值金额 (CNY)" :rules="[{ required: true, type: 'number', min: 1.00, message: '请输入有效的充值金额'}]">
        <a-input-number v-model="topUpForm.amount" placeholder="请输入充值金额" :precision="2" :min="1.00" style="width: 100%;" />
      </a-form-item>

      <div v-if="paymentConfig.yuanToCreditsRate" class="exchange-rate-info mb-4">
        <p>当前兑换率: 1.00 CNY = {{ paymentConfig.yuanToCreditsRate }} 积分</p>
      </div>

      <a-form-item field="paymentMethod" label="支付方式" :rules="[{ required: true, message: '请选择支付方式'}]">
        <a-radio-group v-if="paymentConfig.paymentMethods && paymentConfig.paymentMethods.length > 0" v-model="topUpForm.paymentMethod">
          <a-radio v-for="method in paymentConfig.paymentMethods" :key="method.key" :value="method.key">
            {{ method.name }}
          </a-radio>
        </a-radio-group>
        <a-empty v-else description="暂无可用的支付方式" />
      </a-form-item>

      <!-- Conditionally render the entire promotions section -->
      <div v-if="promotionsLoading || availablePromotions.length > 0" class="promotion-info mb-4">
        <a-spin :loading="promotionsLoading" style="width: 100%;">
          <!-- Keep this v-if for when loading is done and there ARE promotions -->
          <div v-if="!promotionsLoading && availablePromotions.length > 0">
            <div v-for="promo in availablePromotions" :key="promo.id" class="promotion-item">
              <p><strong>【{{ promo.name }}】</strong></p>
              {{ promo.displayInfo || promo.description }}
              <div v-if="promo.minAmount > 0"><em>(最低充值 {{ promo.minAmount.toFixed(2) }} CNY)</em></div>
            </div>
          </div>
          <!-- a-empty is no longer needed here -->
        </a-spin>
      </div>
    </a-form>
    <!-- 修改按钮文案 -->
    <template #footer>
      <div class="modal-footer-layout">
        <p class="footer-credits-info">预计可获得: <strong>{{ estimatedCredits }}</strong> 积分 <span v-if="selectedPromotion && selectedPromotion.type === 'full_reduction_discount' && selectedPromotion.fullReductionDetails && selectedPromotion.fullReductionDetails.type === 'points'">（含赠送 {{ estimatedCredits - topUpForm.amount * paymentConfig.yuanToCreditsRate }} 积分）</span></p>
        <a-space class="footer-buttons">
          <a-button @click="handleTopUpCancel">取消</a-button>
          <a-button type="primary" :loading="topUpSubmitting" @click="handleTopUpConfirm">
            <template v-if="topUpForm.amount > 0">
              确认支付 ￥{{ finalPayableAmount }}
              <!-- Show discount amount if final payable amount is less than original amount -->
              <span v-if="Number(finalPayableAmount) < topUpForm.amount">
                （优惠 ￥{{ (topUpForm.amount - Number(finalPayableAmount)).toFixed(2) }}）
              </span>
            </template>
            <template v-else>
              确认充值
            </template>
          </a-button>
        </a-space>
      </div>
    </template>
  </a-modal>

  <!-- Add QR Code Modal -->
  <a-modal
    :visible="qrCodeVisible"
    :footer="false"
    :closable="false"
    :mask-closable="false"
    title="模拟支付"
    width="300px"
    :body-style="{ padding: '20px' }"
  >
    <div class="qr-code-placeholder">
      <p>请扫描二维码完成支付</p>
      <p>（此为模拟，5秒后自动确认）</p>
      <p class="timestamp">时间戳: {{ qrCodeTimestamp }}</p>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import apiClient from '../services/apiService';
import {
  Button as AButton,
  Empty as AEmpty,
  Form as AForm,
  FormItem as AFormItem,
  InputNumber as AInputNumber,
  Modal as AModal,
  Radio as ARadio,
  RadioGroup as ARadioGroup,
  Spin as ASpin,
  Message,
  Space as ASpace,
} from '@arco-design/web-vue';

// 定义 props 和 emits
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  userData: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update:visible', 'update:userData', 'top-up-success']);

// State for QR Code Modal
const qrCodeVisible = ref(false);
const qrCodeTimestamp = ref('');

// 充值相关状态
const topUpSubmitting = ref(false);
const topUpFormRef = ref(null);
const topUpForm = reactive({
  amount: null,
  paymentMethod: ''
});

const paymentConfig = reactive({
  yuanToCreditsRate: null,
  currencySymbol: 'CNY',
  paymentMethods: []
});
const paymentConfigLoading = ref(false);

// 优惠活动相关状态
const availablePromotions = ref([]);
const promotionsLoading = ref(false);

// 计算属性：选中的优惠活动
const selectedPromotion = computed(() => {
  if (!availablePromotions.value || availablePromotions.value.length === 0 || !topUpForm.amount) return null;

  // 找到适用于当前充值金额的优惠活动
  const amount = Number(topUpForm.amount);
  return availablePromotions.value.find(promo =>
    amount >= (promo.minAmount || 0) &&
    (!promo.maxAmount || amount <= promo.maxAmount)
  );
});

// 计算属性：梯度折扣层级
const gradientTiers = computed(() => {
  if (!selectedPromotion.value || selectedPromotion.value.type !== 'gradient_discount') return [];
  return selectedPromotion.value.tiers || [];
});

// 计算实际支付金额（梯度折扣）
const actualPayAmount = computed(() => {
  const currentAmount = topUpForm.amount;

  if (!selectedPromotion.value || selectedPromotion.value.type !== 'gradient_discount' || typeof currentAmount !== 'number' || currentAmount <= 0) {
    return currentAmount ? Number(currentAmount).toFixed(2) : '0.00';
  }

  const amount = Number(currentAmount);
  const tiers = gradientTiers.value;

  if (!tiers || tiers.length === 0) {
    return amount.toFixed(2);
  }

  // 找到适用的折扣层级
  const applicableTier = tiers.find(tier =>
    amount >= tier.minAmountRMB &&
    (!tier.maxAmountRMB || amount <= tier.maxAmountRMB)
  );

  if (applicableTier) {
    const discountRate = applicableTier.discountRate / 100; // 例如：8折 = 0.8
    return (amount * discountRate).toFixed(2);
  }

  return amount.toFixed(2);
});

// Compute the final amount the user actually pays
const finalPayableAmount = computed(() => {
  const currentAmount = topUpForm.amount;
  if (typeof currentAmount !== 'number' || currentAmount <= 0) {
    return '0.00'; // Default if amount is invalid
  }
  const amount = Number(currentAmount);

  if (selectedPromotion.value) {
    const promoType = selectedPromotion.value.type;
    const details = selectedPromotion.value.fullReductionDetails; // Alias for easier access

    if (promoType === 'gradient_discount') {
      // For gradient discount, use the calculated actualPayAmount
      // Note: actualPayAmount already calculates based on tiers and rate/100
      return actualPayAmount.value; 

    } else if (promoType === 'full_reduction_discount' && details && details.type === 'discount') {
      // Check if threshold is met
      if (amount >= details.everyAmountRMB) {
        const discountRate = details.discountRate || 100; // e.g., 80 for 80%
        const multiplier = discountRate / 100; // e.g., 0.8
        let discountedAmount = amount * multiplier;
        
        // Apply max discount cap if applicable
        const maxCap = details.maxDiscountCapRMB;
        if (maxCap > 0) {
            const potentialDiscount = amount - discountedAmount;
            if (potentialDiscount > maxCap) {
                // Cap the discount, recalculate final amount
                discountedAmount = amount - maxCap;
            }
        }
        return discountedAmount.toFixed(2);
      } else {
        // Threshold not met, pay full amount
        return amount.toFixed(2);
      }
    } else {
      // For 'points' type or other types, pay full amount
      return amount.toFixed(2);
    }
  } else {
    // No promotion selected, pay full amount
    return amount.toFixed(2);
  }
});

// 计算预计获得积分（满减/赠送积分）
const estimatedCredits = computed(() => {
  // Return 0 if amount is invalid
  if (!topUpForm.amount || typeof topUpForm.amount !== 'number' || topUpForm.amount <= 0) return 0;
  
  const amount = Number(topUpForm.amount);
  const rate = paymentConfig.yuanToCreditsRate || 1;
  let finalCredits = amount * rate; // Start with base credits

  // Check if an applicable promotion adds bonus points OR affects credits (only points type does)
  if (selectedPromotion.value && 
      selectedPromotion.value.type === 'full_reduction_discount' && 
      selectedPromotion.value.fullReductionDetails)
  {
    const details = selectedPromotion.value.fullReductionDetails;
    if (details.type === 'points') {
        // Calculate how many times the condition is met
        const everyAmount = details.everyAmountRMB;
        const giftPoints = details.giftPoints || 0;
        
        if (everyAmount > 0) {
          const times = Math.floor(amount / everyAmount);
          finalCredits += times * giftPoints; // Add bonus points to base credits
        }
    } 
    // Note: The 'discount' type for full_reduction should NOT affect credits received, only amount paid.
  }
  
  // Return the final calculated credits (potentially including bonus)
  return Math.floor(finalCredits);
});

// Map platform keys to display names
const platformNames = {
  wechat: '微信支付',
  alipay: '支付宝',
  unionpay: '云闪付',
  unifiedpay: '融合支付',
};

// 获取支付配置 (积分设置)
const fetchPaymentConfig = async () => {
  paymentConfigLoading.value = true;
  try {
    // Fetch from the authenticated credit settings endpoint
    const response = await apiClient.get('/credit-settings');
    const settings = response.data;

    if (settings) {
      paymentConfig.yuanToCreditsRate = settings.exchangeRate;
      // Filter and map enabled payment platforms
      paymentConfig.paymentMethods = (settings.paymentPlatforms || [])
        .map(key => ({ key: key, name: platformNames[key] || key }))
        .filter(method => method.name); // Only keep methods with known names

      // Select the first available payment method by default if none is selected
      if (!topUpForm.paymentMethod && paymentConfig.paymentMethods.length > 0) {
        topUpForm.paymentMethod = paymentConfig.paymentMethods[0].key;
      }
    } else {
       // Handle case where settings might be null/undefined from API
       console.warn('No credit settings received from API.');
       paymentConfig.yuanToCreditsRate = 100; // Default fallback
       paymentConfig.paymentMethods = []; // Default fallback
    }

  } catch (err) {
    console.error("获取支付配置失败:", err);
    Message.error('加载支付配置失败: ' + (err.response?.data?.message || err.message));
    // Set defaults on error
    paymentConfig.yuanToCreditsRate = 100;
    paymentConfig.paymentMethods = [];
  } finally {
    paymentConfigLoading.value = false;
  }
};

// 获取充值优惠活动
const fetchRechargePromotions = async () => {
  promotionsLoading.value = true;
  try {
    const response = await apiClient.get('/promotion-activities', {
      params: {
        isEnabled: true,
        activityType: 'recharge_discount',
        effectiveStatus: 'ongoing' // Ensure only ongoing activities are fetched
      }
    });
    // Process promotions to be more display-friendly
    availablePromotions.value = (response.data.activities || response.data || []).map(promo => {
      let displayInfo = '';
      let minAmountRMB = 0; // Default minimum amount
      const details = promo.activityDetails || {}; // Initialize details safely

      if (promo.activityType === 'recharge_discount') {
        if (details.rechargeDiscountSubType === 'gradient_discount' && details.tiers && details.tiers.length > 0) {
          minAmountRMB = Math.min(...details.tiers.map(t => t.minAmountRMB));
          // Updated displayInfo for gradient discount to show tiers clearly
          displayInfo = details.tiers
              .sort((a, b) => a.minAmountRMB - b.minAmountRMB) // Sort tiers by min amount
              .map(t => `￥${t.minAmountRMB.toFixed(2)}-${t.maxAmountRMB.toFixed(2)} 享 ${t.discountRate/10} 折`)
              .join('; ');
        } else if (details.rechargeDiscountSubType === 'full_reduction_discount' && details.fullReduction) {
          minAmountRMB = details.fullReduction.everyAmountRMB;
          if (details.fullReduction.type === 'discount') {
            displayInfo = `每满 ${details.fullReduction.everyAmountRMB.toFixed(2)}元 享 ${details.fullReduction.discountRate/10} 折`;
            if (details.fullReduction.maxDiscountCapRMB > 0) {
              displayInfo += ` (最高优惠 ${details.fullReduction.maxDiscountCapRMB.toFixed(2)}元)`;
            }
          } else if (details.fullReduction.type === 'points') {
            displayInfo = `每满 ${details.fullReduction.everyAmountRMB.toFixed(2)}元 赠送 ${details.fullReduction.giftPoints} 积分`;
          }
        }
      }
      
      return {
        id: promo._id,
        name: promo.name,
        type: details.rechargeDiscountSubType,
        tiers: details.rechargeDiscountSubType === 'gradient_discount' && details.tiers ? details.tiers : [],
        fullReductionDetails: details.rechargeDiscountSubType === 'full_reduction_discount' && details.fullReduction ? details.fullReduction : null,
        description: promo.remarks || '暂无详细描述',
        displayInfo: displayInfo || promo.name,
        minAmount: minAmountRMB,
      };
    });

  } catch (err) {
    console.error("获取优惠活动失败:", err);
    Message.error('加载优惠活动失败: ' + (err.response?.data?.message || err.message));
    availablePromotions.value = [];
  } finally {
    promotionsLoading.value = false;
  }
};

// 处理充值确认
const handleTopUpConfirm = async () => {
  // 注意：validate 成功时返回 undefined，失败时返回 true
  const valid = await topUpFormRef.value?.validate();
  if (valid) return; // Validation failed

  topUpSubmitting.value = true; // Start loading state for the main button

  // 1. Show QR Code Modal with Timestamp
  qrCodeTimestamp.value = new Date().toLocaleString();
  qrCodeVisible.value = true;

  // 2. Simulate Payment Scan Delay (5 seconds)
  setTimeout(async () => {
    qrCodeVisible.value = false; // Hide QR code modal

    try {
      // 3. Prepare data for backend
      const payload = {
        amount: topUpForm.amount,
        paymentMethod: topUpForm.paymentMethod,
        promotionId: selectedPromotion.value?.id || null,
        payableAmount: Number(finalPayableAmount.value),
        estimatedCredits: estimatedCredits.value,
      };

      // 4. Call Backend API to create the transaction record
      // Change endpoint to /api/credit-transactions
      console.log('Calling backend API with payload:', payload);
      const response = await apiClient.post('/credit-transactions', payload);
      console.log('Backend response:', response.data);

      // 5. Handle Success
      const earnedCredits = response.data?.earnedCredits || estimatedCredits.value; // Use backend value if provided
      const newBalance = response.data?.updatedCreditsBalance; // Use backend value if provided

      Message.success(response.data?.message || `充值成功! 获得积分: ${earnedCredits}`);

      // Update user data locally if backend provides new balance
      if (props.userData && newBalance !== undefined) {
        const updatedUserData = {
          ...props.userData,
          creditsBalance: newBalance
        };
        emit('update:userData', updatedUserData);
      } else if (props.userData) {
         // Fallback: update with frontend calculation if backend doesn't return balance
         const updatedUserData = {
           ...props.userData,
           creditsBalance: (props.userData.creditsBalance || 0) + earnedCredits
         };
         emit('update:userData', updatedUserData);
      }


      // Emit success event with details
      emit('top-up-success', {
        amount: payload.amount,
        payAmount: payload.payableAmount,
        credits: earnedCredits, // Use actual earned credits
        paymentMethod: payload.paymentMethod,
        transactionId: response.data?.transactionId // Pass transaction ID if returned
      });

      // Close the main top-up modal
      emit('update:visible', false);

    } catch (err) {
      // 6. Handle Error
      console.error("Top-up transaction creation failed:", err);
      Message.error(err.response?.data?.message || '充值记录创建失败，请稍后重试');
      // Keep the main modal open for the user to retry or cancel
    } finally {
      topUpSubmitting.value = false; // Stop loading state for the main button
    }
  }, 5000); // 5-second delay
};

// 处理充值取消
const handleTopUpCancel = () => {
  emit('update:visible', false);
};

// 监听 visible 属性变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    // 当弹窗打开时，重置表单并获取最新配置
    topUpForm.amount = null;
    topUpForm.paymentMethod = '';
    topUpFormRef.value?.clearValidate();

    fetchPaymentConfig().then(() => {
      if (paymentConfig.paymentMethods && paymentConfig.paymentMethods.length > 0) {
        if (!topUpForm.paymentMethod || !paymentConfig.paymentMethods.find(pm => pm.key === topUpForm.paymentMethod)) {
          topUpForm.paymentMethod = paymentConfig.paymentMethods[0].key;
        }
      }
    });
    fetchRechargePromotions();
  }
});

// 组件挂载时初始化
onMounted(() => {
  if (props.visible) {
    fetchPaymentConfig();
    fetchRechargePromotions();
  }
});
</script>

<style scoped>
.promotion-item {
  margin-bottom: 8px;
  padding: 8px;
  border-radius: 4px;
  background-color: rgba(var(--primary-6), 0.1);
}

.exchange-rate-info {
  padding: 8px;
  border-radius: 4px;
  background-color: rgba(var(--success-6), 0.1);
}

.mb-4 {
  margin-bottom: 16px;
}

.text-sm {
  font-size: 0.875rem;
}

.text-gray-500 {
  color: var(--color-text-3);
}

.modal-footer-layout {
  display: flex;
  justify-content: space-between;
  align-items: center; /* Vertically align items */
  width: 100%; /* Ensure full width */
}

.footer-credits-info {
  color: var(--color-text-1);
  margin: 0; /* Remove default paragraph margin */
}

.footer-buttons {
  /* a-space handles spacing between buttons */
}

.qr-code-placeholder {
  text-align: center;
  padding: 40px 20px;
  font-size: 16px;
  background-color: #f8f8f8;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  color: #333;
}

.qr-code-placeholder p {
  margin: 0;
  line-height: 1.6;
}

.qr-code-placeholder .timestamp {
  font-size: 12px;
  color: #666;
  margin-top: 10px;
}
</style>