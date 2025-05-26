<template>
  <div>
    <!-- Title for the transaction list page -->
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">消费记录</h2>
      <a-space>
        <a-input-search 
          v-model="filters.userId" 
          placeholder="搜索用户ID/用户名"
          allow-clear 
          style="width: 200px;" 
          @search="applyFiltersAndFetch" 
          @clear="applyFiltersAndFetch"
          @press-enter="applyFiltersAndFetch"
        />
        <a-input-search 
          v-model="filters.transactionId" 
          placeholder="搜索流水号"
          allow-clear 
          style="width: 200px;" 
          @search="applyFiltersAndFetch" 
          @clear="applyFiltersAndFetch"
          @press-enter="applyFiltersAndFetch"
        />
        <a-select 
          v-model="filters.type" 
          placeholder="交易类型" 
          allow-clear 
          style="width: 130px;" 
          @change="applyFiltersAndFetch"
        >
          <a-option value="consumption">消费</a-option>
          <a-option value="topup">充值</a-option>
          <a-option value="refund">退款</a-option>
          <a-option value="grant">赠送</a-option>
          <a-option value="adjustment">调整</a-option>
        </a-select>
        <a-date-picker 
          v-model="filters.startDate" 
          style="width: 140px;" 
          placeholder="开始日期" 
          @change="applyFiltersAndFetch"
        />
        <a-date-picker 
          v-model="filters.endDate" 
          style="width: 140px;" 
          placeholder="结束日期" 
          @change="applyFiltersAndFetch"
        />
        <a-button @click="refreshTransactions" :loading="isLoading">
          <template #icon><icon-refresh /></template> 刷新
        </a-button>
      </a-space>
    </div>

    <a-spin :loading="isLoading" tip="加载交易流水中..." class="w-full">
      <a-table
        :data="transactions"
        :pagination="pagination"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        row-key="_id"
        stripe
        :scroll="{ x: 'max-content' }"
      >
        <template #columns>
          <a-table-column title="流水ID" data-index="_id" :width="120">
            <template #cell="{ record }">
              {{ record._id }}
            </template>
          </a-table-column>
          <a-table-column title="用户" data-index="user.username" :width="180">
            <template #cell="{ record }">
              <span v-if="record.user">{{ record.user.username }} ({{ record.user._id }})</span>
              <span v-else class="text-gray-400">未知用户</span>
            </template>
          </a-table-column>
          <a-table-column title="操作人" data-index="operator.username" :width="180">
            <template #cell="{ record }">
              <span v-if="record.operator && record.operator.username">
                {{ record.operator.username }}
                <span v-if="record.operator._id !== record.user?._id"> (管理员)</span>
                <span v-else> (用户本人)</span>
              </span>
              <span v-else-if="record.user && record.user.username">
                {{ record.user.username }} (用户本人)
              </span>
              <span v-else class="text-gray-400">未知操作人</span>
            </template>
          </a-table-column>
          <a-table-column title="类型" data-index="type" :width="120">
            <template #cell="{ record }">
              <a-tag :color="getTransactionTypeColor(record.type)">
                {{ translateTransactionType(record.type) }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="AI应用" data-index="aiApplication.name" :width="200">
            <template #cell="{ record }">
              <span v-if="record.aiApplication">{{ record.aiApplication.name }} ({{ record.aiApplication._id }})</span>
              <span v-else>-</span>
            </template>
          </a-table-column>
          <a-table-column title="活动" :width="180">
            <template #cell="{ record }">
              <span v-if="record.promotionActivity && record.promotionActivity.name">
                {{ record.promotionActivity.name }}
              </span>
              <span v-else-if="record.promotionActivityId">
                是 (ID: {{ record.promotionActivityId }})
              </span>
              <span v-else>-</span>
            </template>
          </a-table-column>
          <a-table-column title="积分变动" data-index="creditsChanged" align="center" :width="120" :sortable="{ sortDirections: ['ascend', 'descend'] }">
            <template #cell="{ record }">
              <span :class="record.creditsChanged > 0 ? 'text-green-600' : (record.creditsChanged < 0 ? 'text-red-600' : '')">
                {{ record.creditsChanged > 0 ? '+' : '' }}{{ record.creditsChanged }}
              </span>
            </template>
          </a-table-column>
          <a-table-column title="变动后余额" data-index="balanceAfter" align="center" :width="130" :sortable="{ sortDirections: ['ascend', 'descend'] }"></a-table-column>
          <a-table-column title="描述" data-index="description" ellipsis tooltip :width="200"></a-table-column>
          <a-table-column title="交易时间" data-index="createdAt" :width="200" fixed="right">
            <template #cell="{ record }">{{ formatDateCN(record.createdAt) }}</template>
          </a-table-column>
        </template>
      </a-table>
    </a-spin>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, watch } from 'vue';
import {
  Message,
  Table as ATable,
  TableColumn as ATableColumn,
  Spin as ASpin,
  Tag as ATag,
  Button as AButton,
  Space as ASpace,
  Input as AInput,
  Select as ASelect,
  Option as AOption,
  DatePicker as ADatePicker,
} from '@arco-design/web-vue';
import { IconRefresh, IconSearch, IconDelete } from '@arco-design/web-vue/es/icon';
import apiService from '../services/apiService';
import { debounce } from 'lodash-es';
import { formatDateCN } from '@/admin/utils/date';

// State for Credit Transactions
const transactions = ref([]);
const isLoading = ref(false);
const pagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [10, 15, 20, 50, 100],
});
const filters = reactive({
  userId: '',
  transactionId: '',
  type: undefined,
  startDate: null,
  endDate: null,
});

// --- Transaction Functions ---
const translateTransactionType = (type) => {
  const map = {
    consumption: '消费',
    topup: '充值',
    refund: '退款',
    grant: '赠送',
    adjustment: '调整'
  };
  return map[type] || type;
};

const getTransactionTypeColor = (type) => {
  const map = {
    consumption: 'red',
    topup: 'green',
    refund: 'orange',
    grant: 'blue',
    adjustment: 'purple'
  };
  return map[type] || 'gray';
};

const fetchCreditTransactions = async (page = 1, pageSize = pagination.pageSize) => {
  isLoading.value = true;
  const params = { page: page, limit: pageSize };
  if (filters.userId) params.userId = filters.userId;
  if (filters.transactionId) params.transactionId = filters.transactionId;
  if (filters.type) params.type = filters.type;
  if (filters.startDate) params.startDate = filters.startDate;
  if (filters.endDate) params.endDate = filters.endDate;

  try {
    const response = await apiService.get('/credit-transactions', { params });
    transactions.value = response.data.transactions || [];
    pagination.total = response.data.total || 0;
    pagination.current = page;
  } catch (error) {
    Message.error('获取交易流水失败: ' + (error.response?.data?.message || error.message));
    transactions.value = [];
    pagination.total = 0;
  } finally {
    isLoading.value = false;
  }
};

const applyFiltersAndFetch = () => {
  pagination.current = 1;
  fetchCreditTransactions(pagination.current, pagination.pageSize);
};

const refreshTransactions = () => {
  fetchCreditTransactions(pagination.current, pagination.pageSize);
};

const handlePageChange = (newPage) => {
  pagination.current = newPage;
  fetchCreditTransactions(pagination.current, pagination.pageSize);
};

const handlePageSizeChange = (newPageSize) => {
  pagination.pageSize = newPageSize;
  pagination.current = 1; // Reset to first page
  fetchCreditTransactions(pagination.current, pagination.pageSize);
};

onMounted(() => {
  fetchCreditTransactions();
});

</script>

<style scoped>
/* Styles for settings card removed */
/* .mb-6 { ... } removed */
</style> 