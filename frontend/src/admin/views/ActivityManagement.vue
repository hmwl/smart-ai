<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">活动管理</h2>
      <a-space>
        <a-input-search v-model="filters.name" placeholder="活动名称" allow-clear style="width: 180px;" @change="queryWithFilters" />
        <a-select v-model="filters.effectiveStatus" placeholder="状态" allow-clear style="width: 130px;" @change="queryWithFilters">
          <a-option value="not_started">未开始</a-option>
          <a-option value="ongoing">进行中</a-option>
          <a-option value="ended">已结束</a-option>
          <a-option value="disabled">已禁用</a-option>
        </a-select>
        <a-select v-model="filters.activityType" placeholder="活动类型" allow-clear style="width: 140px;" @change="queryWithFilters">
          <a-option value="recharge_discount">充值折扣</a-option>
          <a-option value="usage_discount">使用折扣</a-option>
        </a-select>
        <a-button type="primary" @click="openCreateModal">
          <template #icon><icon-plus /></template> 创建活动
        </a-button>
        <a-button @click="fetchActivities" :loading="isLoading">
          <template #icon><icon-refresh /></template> 刷新
        </a-button>
      </a-space>
    </div>

    <a-spin :loading="isLoading" tip="加载活动列表中..." class="w-full">
      <a-table
        :data="activities"
        :pagination="paginationStateForTable"
        @change="handleTableChange"
        row-key="_id"
        stripe
        :scroll="{ x: 'max-content' }"
      >
        <template #columns>
          <a-table-column title="ID" data-index="_id" :width="120" fixed="left"></a-table-column>
          <a-table-column title="活动名称" data-index="name" :width="200" ellipsis tooltip></a-table-column>
          <a-table-column title="活动时间" :width="350">
            <template #cell="{ record }">
              {{ formatDateCN(record.startTime) }} - {{ formatDateCN(record.endTime) }}
            </template>
          </a-table-column>
          <a-table-column title="状态" data-index="effectiveStatus" :width="100">
            <template #cell="{ record }">
              <a-tag :color="getStatusColor(record.effectiveStatus)">{{ translateStatus(record.effectiveStatus) }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="类型" data-index="activityType" :width="220">
            <template #cell="{ record }">{{ translateActivitySubType(record) }}</template>
          </a-table-column>
          <a-table-column title="创建人" :width="120">
             <template #cell="{ record }">
                {{ record.createdBy ? record.createdBy.username : 'N/A' }}
            </template>
          </a-table-column>
          <a-table-column title="创建时间" data-index="createdAt" :width="200">
            <template #cell="{ record }">{{ formatDateCN(record.createdAt) }}</template>
          </a-table-column>
          <a-table-column title="更新时间" data-index="updatedAt" :width="200">
            <template #cell="{ record }">{{ formatDateCN(record.updatedAt) }}</template>
          </a-table-column>
          <a-table-column title="备注" data-index="remarks" :width="180" ellipsis tooltip></a-table-column>
          <a-table-column title="操作" fixed="right" :width="150">
            <template #cell="{ record }">
              <a-button type="text" status="warning" size="mini" @click="editActivity(record)">编辑</a-button>
              <a-popconfirm content="确定要删除此活动吗?" type="warning" @ok="deleteActivity(record._id)">
                <a-button type="text" status="danger" size="mini">删除</a-button>
              </a-popconfirm>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-spin>

    <!-- Create/Edit Modal -->
    <a-modal
      :visible="modalVisible"
      :title="isEditMode ? '编辑优惠活动' : '创建优惠活动'"
      width="700px"
      @ok="handleSubmit"
      @cancel="handleCancel"
      :confirm-loading="isSubmitting"
      unmount-on-close
    >
      <a-form ref="activityFormRef" :model="activityForm" layout="vertical">
        <a-form-item field="name" label="活动名称" :rules="[{required: true, message: '请输入活动名称'}]">
          <a-input v-model="activityForm.name" placeholder="例如：新用户充值送积分" />
        </a-form-item>
        <a-form-item label="活动时间" field="dateRange" :rules="[{required: true, message: '请选择活动时间'}, {validator: validateDateRange}]">
             <a-range-picker 
                v-model="activityForm.dateRange"
                show-time
                :time-picker-props="{ defaultValue: ['00:00:00', '23:59:59'] }"
                format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%;"
             />
        </a-form-item>
        <a-row :gutter="16">
            <a-col :span="12">
                <a-form-item field="activityType" label="活动类型" :rules="[{required: true, message: '请选择活动类型'}]">
                    <a-select v-model="activityForm.activityType" placeholder="选择类型" @change="handleActivityTypeChange">
                        <a-option value="recharge_discount">充值折扣</a-option>
                        <a-option value="usage_discount">使用折扣</a-option>
                    </a-select>
                </a-form-item>
            </a-col>
            <a-col :span="12">
                 <a-form-item field="isEnabled" label="启用状态" :rules="[{required: true, message: '请选择启用状态'}]">
                    <a-switch v-model="activityForm.isEnabled">
                        <template #checked>启用</template>
                        <template #unchecked>禁用</template>
                    </a-switch>
                </a-form-item>
            </a-col>
        </a-row>

        <!-- Dynamic Details for Recharge Discount -->
        <div v-if="activityForm.activityType === 'recharge_discount'">
          <a-form-item label="充值折扣方式" field="rechargeDiscountSubType" :rules="[{required: true, message: '请选择充值折扣方式'}]">
            <a-radio-group v-model="activityForm.rechargeDiscountSubType">
              <a-radio value="gradient_discount">梯度折扣</a-radio>
              <a-radio value="full_reduction_discount">满减折扣</a-radio>
            </a-radio-group>
          </a-form-item>

          <!-- Placeholder for Gradient Discount Form -->
          <div v-if="activityForm.rechargeDiscountSubType === 'gradient_discount'">
            <div class="flex justify-between items-center mb-2 gap-2">
              <h4 class="text-sm font-semibold whitespace-nowrap">梯度折扣配置:</h4>
              <a-button type="primary" @click="addGradientTier" size="small">
                <template #icon><icon-plus /></template> 添加梯度
              </a-button>
            </div>
            <div class="mb-3 p-3 border rounded flex gap-2 flex-col">
              <div v-for="(tier, index) in activityForm.rechargeGradientTiers" :key="tier.id">
                <a-row :gutter="16" class="!items-center">
                  <a-col :span="7">
                    <a-form-item :field="`rechargeGradientTiers[${index}].minAmountRMB`" hide-label :rules="[{ required: true, message: '请输入最小金额' }]">
                      <a-input-number v-model="tier.minAmountRMB" placeholder="最小金额" :min="0" :precision="2" allow-clear style="width: 100%;" @change="handleTierAmountChange"/>
                    </a-form-item>
                  </a-col>
                  <a-col :span="1" class="!mb-[20px] text-center">-</a-col>
                  <a-col :span="7">
                    <a-form-item :field="`rechargeGradientTiers[${index}].maxAmountRMB`" hide-label :rules="[{ required: true, message: '请输入最大金额' }, { validator: (value, cb) => validateMaxAmount(value, tier.minAmountRMB, cb) }]">
                      <a-input-number v-model="tier.maxAmountRMB" placeholder="最大金额" :min="0" :precision="2" allow-clear style="width: 100%;" @change="handleTierAmountChange"/>
                    </a-form-item>
                  </a-col>
                  <a-col :span="6">
                    <a-form-item :field="`rechargeGradientTiers[${index}].discountRate`" hide-label :rules="[{ required: true, message: '请输入折扣比例' }]">
                      <a-input-number v-model="tier.discountRate" placeholder="折扣比例" :min="1" :max="100" :precision="0" allow-clear append="%" style="width: 100%;"/>
                    </a-form-item>
                  </a-col>
                  <a-col :span="3" class="!mb-[20px]">
                    <a-button status="danger" @click="() => removeGradientTier(tier.id)" size="small">
                      <template #icon><icon-minus /></template>
                    </a-button>
                  </a-col>
                </a-row>
              </div>
            </div>
            <a-alert class="!w-auto" v-if="activityForm.rechargeGradientTiers.length > 1" v-show="validateTierOverlap(activityForm.rechargeGradientTiers)" type="error" banner>
                {{ validateTierOverlap(activityForm.rechargeGradientTiers) }}
              </a-alert>
          </div>

          <!-- Full Reduction Discount Form -->
          <div v-if="activityForm.rechargeDiscountSubType === 'full_reduction_discount'">
            <div class="flex justify-between items-center mb-2 gap-2">
              <h4 class="text-sm font-semibold whitespace-nowrap">满减折扣配置:</h4>
              <a-radio-group v-model="activityForm.rechargeFullReduction.type" size="small" @change="handleFullReductionTypeChange">
                <a-radio value="discount">折扣率</a-radio>
                <a-radio value="points">赠送积分</a-radio>
              </a-radio-group>
            </div>
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item
                  label="每满金额 (￥)"
                  field="rechargeFullReduction.everyAmountRMB"
                  :rules="[{ required: true, message: '每满金额必填'}]"
                >
                  <a-input-number
                    v-model="activityForm.rechargeFullReduction.everyAmountRMB"
                    placeholder="例如: 100"
                    :min="0.01" :precision="2" style="width: 100%;"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item
                  v-if="activityForm.rechargeFullReduction.type === 'discount'"
                  label="折扣率 (%)"
                  field="rechargeFullReduction.discountRate"
                  :rules="[{ required: true, message: '折扣率必填'}]"
                  tooltip="例如：90表示9折"
                >
                  <a-input-number
                    v-model="activityForm.rechargeFullReduction.discountRate"
                    placeholder="例如: 90"
                    :min="1" :max="100" :precision="0" style="width: 100%;"
                  />
                </a-form-item>
                <a-form-item
                  v-if="activityForm.rechargeFullReduction.type === 'points'"
                  label="赠送积分"
                  field="rechargeFullReduction.giftPoints"
                  :rules="[{ required: true, message: '赠送积分必填'}]"
                  tooltip="每满足条件赠送的积分数量"
                >
                  <a-input-number
                    v-model="activityForm.rechargeFullReduction.giftPoints"
                    placeholder="例如: 100"
                    :min="1" :precision="0" style="width: 100%;"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item
                  label="优惠上限金额 (￥)"
                  field="rechargeFullReduction.maxDiscountCapRMB"
                  tooltip="0表示无上限"
                >
                  <a-input-number
                    v-model="activityForm.rechargeFullReduction.maxDiscountCapRMB"
                    placeholder="0表示无上限"
                    :default-value="0"
                    :min="0" :precision="2" style="width: 100%;"
                  />
                </a-form-item>
              </a-col>
            </a-row>
          </div>
        </div>

        <!-- Dynamic Details for Usage Discount -->
        <div v-if="activityForm.activityType === 'usage_discount'">
          <a-form-item label="使用折扣方式" field="usageDiscountSubType" :rules="[{required: true, message: '请选择使用折扣方式'}]">
            <a-radio-group v-model="activityForm.usageDiscountSubType">
              <a-radio value="app_specific_discount">AI应用折扣</a-radio>
              <a-radio value="usage_volume_discount">用量折扣</a-radio>
            </a-radio-group>
          </a-form-item>

          <!-- App Specific Discount Form -->
          <div v-if="activityForm.usageDiscountSubType === 'app_specific_discount'">
            <div class="flex justify-between items-center mb-2 gap-2">
              <h4 class="text-sm font-semibold whitespace-nowrap">AI应用折扣配置:</h4>
              <a-radio-group v-model="activityForm.usageAppSpecific.discountType">
                <a-radio value="percentage">折扣率</a-radio>
                <a-radio value="fixed_reduction">立减积分</a-radio> 
              </a-radio-group>
            </div>

            <a-form-item 
              label="目标AI应用 (多选)" 
              field="usageAppSpecific.targetAppIds" 
              :rules="[{ required: true, type: 'array', min: 1, message: '至少选择一个目标应用'}]"
            >
              <a-select 
                v-model="activityForm.usageAppSpecific.targetAppIds" 
                placeholder="请选择已启用的AI应用"
                multiple 
                :loading="isAppListLoading"
              >
                <a-option v-for="app in availableApps" :key="app._id" :value="app._id">{{ app.name }}</a-option>
                <a-option v-if="isAppListLoading && availableApps.length === 0" value="loading" disabled>加载中...</a-option>
                <a-option v-if="!isAppListLoading && availableApps.length === 0" value="no-apps" disabled>无已启用的AI应用</a-option>
              </a-select>
            </a-form-item>
            
            <a-form-item 
              v-if="activityForm.usageAppSpecific.discountType === 'percentage'"
              label="折扣率 (%)"
              field="usageAppSpecific.discountValue"
              :rules="[{ required: true, message: '折扣率必填'}]"
              tooltip="例如：90表示9折"
            >
              <a-input-number 
                v-model="activityForm.usageAppSpecific.discountValue" 
                placeholder="例如: 90"
                :min="1" :max="100" :precision="0" style="width: 100%;"
              />
            </a-form-item>

            <a-form-item 
              v-if="activityForm.usageAppSpecific.discountType === 'fixed_reduction'"
              label="立减积分"
              field="usageAppSpecific.discountValue"
              :rules="[{ required: true, message: '立减积分必填'}]"
              tooltip="每次使用立减的积分数量，不能为负"
            >
              <a-input-number 
                v-model="activityForm.usageAppSpecific.discountValue" 
                placeholder="例如: 100"
                :min="0" :precision="0" style="width: 100%;"
              />
            </a-form-item>
          </div>

          <!-- Usage Volume Discount Form -->
          <div v-if="activityForm.usageDiscountSubType === 'usage_volume_discount'">
            <h4 class="text-sm font-semibold mb-2">用量折扣配置:</h4>
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item 
                  label="计算周期"
                  field="usageVolume.calculationCycle"
                  :rules="[{ required: true, message: '请选择计算周期'}]"
                >
                  <a-select v-model="activityForm.usageVolume.calculationCycle" placeholder="选择计算周期">
                    <a-option value="daily">1天</a-option>
                    <a-option value="weekly">1周</a-option>
                    <a-option value="monthly">1月</a-option>
                    <a-option value="quarterly">1季度</a-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item 
                  label="积分用量门槛"
                  field="usageVolume.usageThresholdCredits" 
                  :rules="[{ required: true, message: '积分用量门槛必填'}]"
                  tooltip="在选定周期内累计使用的积分量"
                >
                  <a-input-number 
                    v-model="activityForm.usageVolume.usageThresholdCredits" 
                    placeholder="例如: 1000 (积分)"
                    :min="1" :precision="0" style="width: 100%;"
                  />
                </a-form-item>
              </a-col>
            </a-row>

            <a-form-item label="达到门槛后" field="usageVolume.discountType" :rules="[{required: true, message: '请选择折扣类型'}]" tooltip="达到门槛后，后续使用折扣类型">
              <a-radio-group v-model="activityForm.usageVolume.discountType">
                <a-radio value="percentage">百分比折扣</a-radio>
                <a-radio value="fixed_reduction">固定积分减免</a-radio> 
              </a-radio-group>
            </a-form-item>

            <a-form-item 
              v-if="activityForm.usageVolume.discountType === 'percentage'"
              label="折扣率 (%)"
              field="usageVolume.discountValue"
              :rules="[{ required: true, message: '折扣率必填'}]"
              tooltip="每次使用立减的折扣率"
            >
              <a-input-number 
                v-model="activityForm.usageVolume.discountValue" 
                placeholder="例如: 80" 
                :min="1" :max="100" :precision="0" style="width: 100%;"
              />
            </a-form-item>

            <a-form-item 
              v-if="activityForm.usageVolume.discountType === 'fixed_reduction'"
              label="固定积分减免"
              field="usageVolume.discountValue"
              :rules="[{ required: true, message: '减免积分必填'}]"
              tooltip="每次使用立减的积分数量"
            >
              <a-input-number 
                v-model="activityForm.usageVolume.discountValue" 
                placeholder="例如: 5"
                :min="0" :precision="0" style="width: 100%;"
              />
            </a-form-item>
          </div>
        </div>
        
        <a-form-item field="remarks" label="备注">
          <a-textarea v-model="activityForm.remarks" placeholder="输入备注信息" :auto-size="{minRows:2,maxRows:4}"/>
        </a-form-item>
      </a-form>
    </a-modal>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue';
import {
  Message, Modal, Button, Space, Input, Select, Option, DatePicker, RangePicker,
  Table, TableColumn, Spin, Tag, Popconfirm, Form, FormItem, Textarea, Row, Col, Switch,
  RadioGroup, Radio, Alert, InputNumber
} from '@arco-design/web-vue';
import { IconRefresh, IconPlus, IconSearch, IconMinus } from '@arco-design/web-vue/es/icon';
import apiService from '../services/apiService';
import { formatDateCN } from '@/admin/utils/date';

const isLoading = ref(false);

const serverPagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [10, 15, 20, 50, 100],
});

const filters = reactive({
  name: '',
  effectiveStatus: undefined,
  activityType: undefined,
});

const activities = ref([]);

const paginationStateForTable = computed(() => ({
  current: serverPagination.current,
  pageSize: serverPagination.pageSize,
  total: serverPagination.total,
  showTotal: serverPagination.showTotal,
  showPageSize: serverPagination.showPageSize,
  pageSizeOptions: serverPagination.pageSizeOptions,
}));

const handleTableChange = (page, sorter, filters) => {
  serverPagination.current = page.current;
  serverPagination.pageSize = page.pageSize;
  fetchActivities();
};

const modalVisible = ref(false);
const isEditMode = ref(false);
const currentActivityId = ref(null);
const activityFormRef = ref(null);
const activityForm = reactive({
  name: '',
  dateRange: [],
  isEnabled: false,
  activityType: undefined,
  remarks: '',

  // --- Fields for Recharge Discount ---
  rechargeDiscountSubType: undefined, // 'gradient_discount' or 'full_reduction_discount'
  rechargeGradientTiers: [], // For gradient_discount: [{ id: Date.now(), minAmountRMB: null, maxAmountRMB: null, discountRate: null }]
  rechargeFullReduction: { // For full_reduction_discount
    type: 'discount', // 'discount' or 'points'
    everyAmountRMB: null,
    discountRate: null,
    giftPoints: null, // Added for points
    maxDiscountCapRMB: null
  },

  // --- Fields for Usage Discount ---
  usageDiscountSubType: undefined, // 'app_specific_discount' or 'usage_volume_discount'
  usageAppSpecific: { // For app_specific_discount
    targetAppIds: [], // Array of strings
    discountType: 'percentage', // 'percentage' or 'fixed_reduction'
    discountValue: null
  },
  usageVolume: { // For usage_volume_discount
    calculationCycle: 'daily', // 'daily', 'weekly', 'monthly', 'quarterly'
    usageThresholdCredits: null, // Renamed from dailyUsageThresholdCredits
    discountType: 'percentage', // 'percentage' or 'fixed_reduction'
    discountValue: null
  },
});
const isSubmitting = ref(false);

const isAppListLoading = ref(false); // Placeholder state for app list loading
const availableApps = ref([]); // Placeholder for available apps, e.g. [{id: 'app1', name: 'App One'}]

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour:'2-digit', minute: '2-digit' });
};

const statusMap = {
  not_started: { text: '未开始', color: 'orange' },
  ongoing: { text: '进行中', color: 'green' },
  ended: { text: '已结束', color: 'blue' },
  disabled: { text: '已禁用', color: 'red' },
};
const translateStatus = (statusKey) => statusMap[statusKey]?.text || statusKey;
const getStatusColor = (statusKey) => statusMap[statusKey]?.color || 'default';

const activityTypeMap = {
  recharge_discount: '充值折扣',
  usage_discount: '使用折扣',
};

const translateActivitySubType = (record) => {
  const mainType = activityTypeMap[record.activityType] || record.activityType;
  let subType = '';

  if (record.activityDetails) {
    if (record.activityType === 'recharge_discount') {
      switch (record.activityDetails.rechargeDiscountSubType) {
        case 'gradient_discount':
          subType = '梯度折扣';
          break;
        case 'full_reduction_discount':
          subType = '满减折扣';
          break;
        default:
          subType = record.activityDetails.rechargeDiscountSubType || '';
      }
    } else if (record.activityType === 'usage_discount') {
      switch (record.activityDetails.usageDiscountSubType) {
        case 'app_specific_discount':
          subType = 'AI应用折扣';
          break;
        case 'usage_volume_discount':
          subType = '用量折扣';
          break;
        default:
          subType = record.activityDetails.usageDiscountSubType || '';
      }
    }
  }
  return subType ? `${mainType} - ${subType}` : mainType;
};

const fetchActivities = async () => {
  isLoading.value = true;
  const params = {
    page: serverPagination.current,
    limit: serverPagination.pageSize,
    name: filters.name || undefined,
    effectiveStatus: filters.effectiveStatus || undefined,
    activityType: filters.activityType || undefined,
  };

  Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

  try {
    const response = await apiService.get('/promotion-activities', { params });
    activities.value = response.data.activities || [];
    serverPagination.total = response.data.total || 0;
  } catch (error) {
    Message.error('获取活动列表失败: ' + (error.response?.data?.message || error.message));
    activities.value = [];
    serverPagination.total = 0;
  } finally {
    isLoading.value = false;
  }
};

const queryWithFilters = () => {
  serverPagination.current = 1;
  fetchActivities();
}

const openCreateModal = () => {
  isEditMode.value = false;
  currentActivityId.value = null;
  // Reset to default state for dynamic forms
  Object.assign(activityForm, {
    name: '',
    dateRange: [],
    isEnabled: false,
    activityType: undefined,
    remarks: '',
    rechargeDiscountSubType: undefined,
    rechargeGradientTiers: [],
    rechargeFullReduction: { type: 'discount', everyAmountRMB: null, discountRate: null, giftPoints: null, maxDiscountCapRMB: null },
    usageDiscountSubType: undefined,
    usageAppSpecific: { targetAppIds: [], discountType: 'percentage', discountValue: null },
    usageVolume: { calculationCycle: 'daily', usageThresholdCredits: null, discountType: 'percentage', discountValue: null },
  });
  modalVisible.value = true;
  activityFormRef.value?.clearValidate();
};

const editActivity = (activity) => {
  isEditMode.value = true;
  currentActivityId.value = activity._id;
  
  const details = activity.activityDetails || {};
  let rechargeDetails = {
    rechargeDiscountSubType: undefined,
    rechargeGradientTiers: [],
    rechargeFullReduction: { type: 'discount', everyAmountRMB: null, discountRate: null, giftPoints: null, maxDiscountCapRMB: null },
  };
  let usageDetails = {
    usageDiscountSubType: undefined,
    usageAppSpecific: { targetAppIds: [], discountType: 'percentage', discountValue: null },
    usageVolume: { calculationCycle: 'daily', usageThresholdCredits: null, discountType: 'percentage', discountValue: null },
  };

  if (activity.activityType === 'recharge_discount') {
    rechargeDetails.rechargeDiscountSubType = details.rechargeDiscountSubType;
    if (details.rechargeDiscountSubType === 'gradient_discount' && Array.isArray(details.tiers)) {
      rechargeDetails.rechargeGradientTiers = details.tiers.map(t => ({ ...t, id: Date.now() + Math.random() })); // Add unique ID for UI key
    } else if (details.rechargeDiscountSubType === 'full_reduction_discount' && details.fullReduction) {
      rechargeDetails.rechargeFullReduction = {
        type: details.fullReduction.type || 'discount', // Default to 'discount' if type is missing
        everyAmountRMB: details.fullReduction.everyAmountRMB,
        discountRate: details.fullReduction.discountRate,
        giftPoints: details.fullReduction.giftPoints,
        maxDiscountCapRMB: details.fullReduction.maxDiscountCapRMB
      };
      // Ensure only relevant value is populated based on type
      if (rechargeDetails.rechargeFullReduction.type === 'discount') {
          rechargeDetails.rechargeFullReduction.giftPoints = null;
      } else { // 'points'
          rechargeDetails.rechargeFullReduction.discountRate = null;
          // maxDiscountCapRMB is kept as is from data but UI will disable if type is points
      }
    }
  } else if (activity.activityType === 'usage_discount') {
    usageDetails.usageDiscountSubType = details.usageDiscountSubType;
    if (details.usageDiscountSubType === 'app_specific_discount' && details.appSpecific) {
      usageDetails.usageAppSpecific = { ...details.appSpecific };
    } else if (details.usageDiscountSubType === 'usage_volume_discount' && details.volumeDiscount) {
      usageDetails.usageVolume = { 
        calculationCycle: details.volumeDiscount.calculationCycle || 'daily', // Default if missing
        usageThresholdCredits: details.volumeDiscount.usageThresholdCredits || details.volumeDiscount.dailyUsageThresholdCredits, // Handle old field name
        discountType: details.volumeDiscount.discountType || 'percentage',
        discountValue: details.volumeDiscount.discountValue
       };
    }
  }

  Object.assign(activityForm, {
    name: activity.name,
    dateRange: [activity.startTime, activity.endTime],
    isEnabled: activity.isEnabled,
    activityType: activity.activityType,
    remarks: activity.remarks,
    ...rechargeDetails,
    ...usageDetails,
  });
  modalVisible.value = true;
  activityFormRef.value?.clearValidate();
};

const handleCancel = () => {
  modalVisible.value = false;
};

const handleSubmit = async () => {

  const validationResult = await activityFormRef.value?.validate();

  // Arco Design validate() returns undefined if successful, or an object of errors if failed.
  if (validationResult) { // 如果 validationResult 不是 undefined，说明有错误
    // Optional: Scroll to the first error field
    const firstErrorField = Object.keys(validationResult)[0];
    if (firstErrorField && activityFormRef.value?.scrollToField) {
      activityFormRef.value.scrollToField(firstErrorField);
    }
    return false; // Prevent modal from closing
  }

  isSubmitting.value = true;

  let activityDetailsPayload = {};

  if (activityForm.activityType === 'recharge_discount') {
    activityDetailsPayload.rechargeDiscountSubType = activityForm.rechargeDiscountSubType;
    if (activityForm.rechargeDiscountSubType === 'gradient_discount') {
      activityDetailsPayload.tiers = activityForm.rechargeGradientTiers.map(({id, ...rest}) => rest);
    } else if (activityForm.rechargeDiscountSubType === 'full_reduction_discount') {
      activityDetailsPayload.fullReduction = {
        type: activityForm.rechargeFullReduction.type,
        everyAmountRMB: activityForm.rechargeFullReduction.everyAmountRMB,
        maxDiscountCapRMB: activityForm.rechargeFullReduction.maxDiscountCapRMB,
        // discountRate and giftPoints are added based on type below
      };
      if (activityForm.rechargeFullReduction.type === 'discount') {
        activityDetailsPayload.fullReduction.discountRate = activityForm.rechargeFullReduction.discountRate;
      } else { // 'points'
        activityDetailsPayload.fullReduction.giftPoints = activityForm.rechargeFullReduction.giftPoints;
      }
    }
  } else if (activityForm.activityType === 'usage_discount') {
    activityDetailsPayload.usageDiscountSubType = activityForm.usageDiscountSubType;
    if (activityForm.usageDiscountSubType === 'app_specific_discount') {
      activityDetailsPayload.appSpecific = { ...activityForm.usageAppSpecific };
    } else if (activityForm.usageDiscountSubType === 'usage_volume_discount') {
      activityDetailsPayload.volumeDiscount = { 
        calculationCycle: activityForm.usageVolume.calculationCycle,
        usageThresholdCredits: activityForm.usageVolume.usageThresholdCredits,
        discountType: activityForm.usageVolume.discountType,
        discountValue: activityForm.usageVolume.discountValue
      };
    }
  }

  let payload = {
    name: activityForm.name,
    startTime: activityForm.dateRange[0],
    endTime: activityForm.dateRange[1],
    isEnabled: activityForm.isEnabled,
    activityType: activityForm.activityType,
    remarks: activityForm.remarks,
    activityDetails: activityDetailsPayload
  };

  try {
    if (isEditMode.value) {
      await apiService.put(`/promotion-activities/${currentActivityId.value}`, payload);
      Message.success('活动更新成功！');
    } else {
      await apiService.post('/promotion-activities', payload);
      Message.success('活动创建成功！');
    }
    modalVisible.value = false;
    fetchActivities();
  } catch (error) {
    Message.error('操作失败: ' + (error.response?.data?.message || error.message));
    return false; // Keep modal open if API call fails
  } finally {
    isSubmitting.value = false;
  }
};

const deleteActivity = async (id) => {
  try {
    await apiService.delete(`/promotion-activities/${id}`);
    Message.success('活动删除成功！');
    fetchActivities();
  } catch (error) {
    Message.error('删除失败: ' + (error.response?.data?.message || error.message));
  }
};

const validateDateRange = (value, callback) => {
  if (!value || value.length !== 2) {
    return callback('请选择活动时间范围');
  }
  if (new Date(value[1]) <= new Date(value[0])) {
    return callback('结束时间必须晚于开始时间');
  }
  return callback();
};

// Function to reset sub-type specific details when main activityType changes
const handleActivityTypeChange = (newType) => {
  if (newType === 'recharge_discount') {
    activityForm.usageDiscountSubType = undefined;
    activityForm.usageAppSpecific = { targetAppIds: [], discountType: 'percentage', discountValue: null };
    activityForm.usageVolume = { calculationCycle: 'daily', usageThresholdCredits: null, discountType: 'percentage', discountValue: null };
  } else if (newType === 'usage_discount') {
    activityForm.rechargeDiscountSubType = undefined;
    activityForm.rechargeGradientTiers = [];
    activityForm.rechargeFullReduction = { type: 'discount', everyAmountRMB: null, discountRate: null, giftPoints: null, maxDiscountCapRMB: null };
  }
  // Reset validation for sub-types might be needed if form is already validated.
  activityFormRef.value?.clearValidate(['rechargeDiscountSubType', 'usageDiscountSubType']); 
};

// Functions for Gradient Tiers
const addGradientTier = () => {
  activityForm.rechargeGradientTiers.push({
    id: Date.now() + Math.random(), // Unique temporary ID for v-for key and removal
    minAmountRMB: null,
    maxAmountRMB: null,
    discountRate: null,
  });
};

const removeGradientTier = (tierIdToRemove) => {
  activityForm.rechargeGradientTiers = activityForm.rechargeGradientTiers.filter(tier => tier.id !== tierIdToRemove);
  activityFormRef.value?.validateField('rechargeGradientTiers'); // Potentially trigger re-validation of the array if a global rule is set
};

// Validator for individual tier's max amount
const validateMaxAmount = (maxAmount, minAmount, callback) => {
  if (maxAmount === null || maxAmount === undefined) {
    return callback(); 
  }
  if (minAmount !== null && minAmount !== undefined && parseFloat(maxAmount) <= parseFloat(minAmount)) {
    return callback('最大金额必须大于最小金额');
  }
  // When maxAmount changes, also try to validate the overall tiers for overlap
  activityFormRef.value?.validateField('rechargeGradientTiers');
  return callback();
};

// Validator for checking overlap between tiers
const validateTierOverlap = (tiers) => {
  if (!tiers || tiers.length < 2) {
    return '';
  }
  // Create a copy and filter out tiers that don't have both min and max amounts defined yet for sorting/validation purpose
  const validTiers = tiers
    .filter(tier => tier.minAmountRMB !== null && tier.maxAmountRMB !== null && tier.minAmountRMB !== undefined && tier.maxAmountRMB !== undefined)
    .map(tier => ({...tier, minAmountRMB: parseFloat(tier.minAmountRMB), maxAmountRMB: parseFloat(tier.maxAmountRMB)})); // ensure numbers
  
  if(validTiers.length < 2) return ''; // Not enough valid tiers to check overlap

  validTiers.sort((a, b) => a.minAmountRMB - b.minAmountRMB);

  for (let i = 0; i < validTiers.length - 1; i++) {
    const currentTier = validTiers[i];
    const nextTier = validTiers[i+1];

    // This check assumes minAmountRMB < maxAmountRMB which is handled by validateMaxAmount
    // Overlap condition: current tier's max is greater than next tier's min.
    // If currentTier.maxAmountRMB = 100 and nextTier.minAmountRMB = 100, this is considered an overlap of the boundary.
    // Ranges are inclusive [min, max]. Example: [0,100] and [100,200]. Here 100 is an overlap point.
    // To avoid this, nextMin should be strictly greater than currentMax.
    // So, if currentMax >= nextMin, it's an overlap.
    if (currentTier.maxAmountRMB >= nextTier.minAmountRMB) {
      return `梯度 ${i + 1} (${currentTier.minAmountRMB}-${currentTier.maxAmountRMB}) 与梯度 ${i + 2} (${nextTier.minAmountRMB}-${nextTier.maxAmountRMB}) 的范围重叠或接触`;
    }
  }
  return '';
};

// Update min/max input handlers to trigger overlap validation
// This is implicitly handled by adding validateField in validateMaxAmount.
// And for minAmount, we need a similar trigger if its input component allows @change or @input.
// For a-input-number, the v-model update should be sufficient if the form item re-validates.
// We might need to explicitly add @change handlers to the input numbers if validateField isn't triggered reliably.

const handleTierAmountChange = () => {
    // When any tier amount changes, trigger validation for the entire list of tiers.
    // Debounce this if it becomes too frequent or performance intensive.
    activityFormRef.value?.validateField('rechargeGradientTiers');
};

// When discountType changes for appSpecific, reset its discountValue
watch(() => activityForm.usageAppSpecific.discountType, (newType) => {
  activityForm.usageAppSpecific.discountValue = null;
  // Potentially clear validation for discountValue if needed
  activityFormRef.value?.clearValidate('usageAppSpecific.discountValue');
});

// When discountType changes for usageVolume, reset its discountValue
watch(() => activityForm.usageVolume.discountType, (newType) => {
  activityForm.usageVolume.discountValue = null;
  activityFormRef.value?.clearValidate('usageVolume.discountValue');
});

// Handler for Full Reduction Type Change
const handleFullReductionTypeChange = (newType) => {
  activityFormRef.value?.clearValidate(['rechargeFullReduction.discountRate', 'rechargeFullReduction.giftPoints']);
  if (newType === 'discount') {
    activityForm.rechargeFullReduction.giftPoints = null;
  } else { // points
    activityForm.rechargeFullReduction.discountRate = null;
  }
};

// Function to fetch available AI applications (enabled)
const fetchAvailableApps = async () => {
  isAppListLoading.value = true;
  try {
    const response = await apiService.get('/ai-applications', { 
        params: { 
            // isEnabled: true, // Assuming the backend filters by status=active or similar for enabled apps
            status: 'active', // Explicitly request active applications
            limit: 0 // Attempt to get all active applications, adjust if API doesn't support 0 for all
        }
    });
    availableApps.value = response.data.data || []; // Corrected path to the array
    if (availableApps.value.length === 0) {
        Message.info('未能获取到已启用的AI应用列表，或列表为空。');
    }
  } catch (error) {
    Message.error('获取AI应用列表失败: ' + (error.response?.data?.message || error.message));
    availableApps.value = [];
  } finally {
    isAppListLoading.value = false;
  }
};

onMounted(() => {
  fetchActivities();
  fetchAvailableApps(); // Fetch AI apps when component is mounted
});

</script>

<style scoped>
/* Add any specific styles if needed */
</style> 