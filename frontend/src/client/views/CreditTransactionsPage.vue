<template>
  <div class="user-credit-transactions-page p-4 md:p-6">
    <a-page-header title="消费记录" class="mb-4 site-page-header" @back="() => $router.go(-1)">
      <template #subtitle>
        <p>查看您的积分消费记录</p>
      </template>
    </a-page-header>

    <!-- Filter Section -->
      <a-form :model="filterForm" layout="inline">
        <a-form-item field="type" label="类型">
          <a-select
            v-model="filterForm.types" 
            placeholder="请选择交易类型"
            multiple
            allow-clear
            style="width: 220px;"
          >
            <a-option value="consumption">消费</a-option>
            <a-option value="topup">充值</a-option>
            <a-option value="refund">退款</a-option>
            <a-option value="grant">赠送</a-option>
            <a-option value="adjustment">系统调整</a-option>
          </a-select>
        </a-form-item>
        <a-form-item field="dateRange" label="时间范围">
          <a-range-picker v-model="filterForm.dateRange" style="width: 260px;" />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" html-type="button" @click="applyFilters" :loading="isLoading">搜索</a-button>
            <a-button @click="resetFilters" :disabled="isLoading">重置</a-button>
          </a-space>
        </a-form-item>
      </a-form>

    <a-spin :loading="isLoading" tip="加载消费记录中..." style="width: 100%;">
      <div v-if="!isLoading && transactions.length === 0" class="empty-state mt-6">
        <a-empty description="暂无符合条件的消费记录" />
      </div>
      <a-table
        v-else-if="transactions.length > 0"
        :data="transactions"
        :pagination="{
          pageSize: pagination.pageSize,
          total: pagination.total,
          current: pagination.current,
          onChange: handlePageChange,
          showTotal: true,
          showPageSize: true,
          pageSizeOptions: [15, 30, 50, 100]
        }"
        @page-size-change="handlePageSizeChange"
        row-key="_id"
        stripe
        class="mt-4"
      >
        <template #columns>
          <a-table-column title="流水ID" data-index="_id" :width="130" ellipsis tooltip></a-table-column>
          <a-table-column title="类型" data-index="type" :width="100">
            <template #cell="{ record }">
              <a-tag :color="getTransactionTypeColor(record.type)">
                {{ translateTransactionType(record.type) }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="AI应用" data-index="aiApplication.name" :width="180" ellipsis tooltip>
            <template #cell="{ record }">
              <span v-if="record.aiApplication">{{ record.aiApplication.name }}</span>
              <span v-else-if="record.aiApplicationId">{{ record.aiApplicationId }}</span>
              <span v-else>-</span>
            </template>
          </a-table-column>
          <a-table-column title="关联活动" data-index="promotionActivity.name" :width="180" ellipsis tooltip>
            <template #cell="{ record }">
              <span v-if="record.promotionActivity">{{ record.promotionActivity.name }}</span>
              <span v-else-if="record.promotionActivityId">{{ record.promotionActivityId }}</span>
              <span v-else>-</span>
            </template>
          </a-table-column>
          <a-table-column title="积分变动" data-index="creditsChanged" align="center" :width="100">
            <template #cell="{ record }">
              <span :class="record.creditsChanged > 0 ? 'text-green-500' : (record.creditsChanged < 0 ? 'text-red-500' : 'text-gray-500')">
                {{ record.creditsChanged > 0 ? '+' : '' }}{{ record.creditsChanged }}
              </span>
            </template>
          </a-table-column>
          <a-table-column title="变动后余额" data-index="balanceAfter" align="center" :width="120"></a-table-column>
          <a-table-column title="交易时间" data-index="createdAt" :width="200">
            <template #cell="{ record }">{{ formatDateCN(record.createdAt) }}</template>
          </a-table-column>
          <a-table-column title="描述" data-index="description" ellipsis tooltip></a-table-column>
        </template>
      </a-table>
    </a-spin>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import apiClient from '../services/apiService';
import {
  Message,
  PageHeader as APageHeader,
  Table as ATable,
  TableColumn as ATableColumn,
  Spin as ASpin,
  Tag as ATag,
  Empty as AEmpty,
  Card as ACard,
  Form as AForm,
  FormItem as AFormItem,
  Select as ASelect,
  Option as AOption,
  RangePicker as ARangePicker,
  Button as AButton,
  Space as ASpace,
} from '@arco-design/web-vue';
import { formatDateCN } from '@/client/utils/date';

const transactions = ref([]);
const isLoading = ref(false);

const filterForm = reactive({
  types: [], // For multiple select
  dateRange: [], // [startDate, endDate]
});

const pagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
});

const translateTransactionType = (type) => {
  const map = {
    consumption: '消费',
    topup: '充值',
    refund: '退款',
    grant: '赠送',
    adjustment: '系统调整' 
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

const fetchUserTransactions = async (page = 1) => {
  isLoading.value = true;
  const params = {
    page: page,
    limit: pagination.pageSize,
  };

  if (filterForm.types && filterForm.types.length > 0) {
    params.type = filterForm.types.join(','); // Backend to handle comma-separated list
  }
  if (filterForm.dateRange && filterForm.dateRange.length === 2) {
    // Ensure dates are in YYYY-MM-DD format or ISO string as expected by backend
    params.startDate = filterForm.dateRange[0]; // Format: 'YYYY-MM-DD' or ISO
    params.endDate = filterForm.dateRange[1];   // Format: 'YYYY-MM-DD' or ISO
    // If backend expects full ISO string with time, adjust accordingly
    // For just date, ensure the backend handles the range inclusively.
    // Example for full day range if backend needs precise timestamps:
    // params.startDate = new Date(filterForm.dateRange[0]).setHours(0, 0, 0, 0).toISOString();
    // params.endDate = new Date(filterForm.dateRange[1]).setHours(23, 59, 59, 999).toISOString();
  }

  try {
    const response = await apiClient.get('/credit-transactions', { params });
    transactions.value = response.data.transactions || [];
    pagination.total = response.data.total || 0;
    pagination.current = page;
    if (transactions.value.length === 0 && page === 1 && (filterForm.types.length > 0 || filterForm.dateRange.length > 0)) {
        Message.info('没有找到符合筛选条件的记录。');
    }
  } catch (error) {
    Message.error('获取消费记录失败: ' + (error.response?.data?.message || error.message));
    transactions.value = [];
    pagination.total = 0;
  } finally {
    isLoading.value = false;
  }
};

const handlePageChange = (newPage) => {
  fetchUserTransactions(newPage);
};

const handlePageSizeChange = (newPageSize) => {
  pagination.pageSize = newPageSize;
  fetchUserTransactions(1); // Reset to page 1 when page size changes
};

const applyFilters = () => {
  pagination.current = 1;
  fetchUserTransactions(1);
};

const resetFilters = () => {
  filterForm.types = [];
  filterForm.dateRange = [];
  pagination.current = 1;
  fetchUserTransactions(1);
};

onMounted(() => {
  fetchUserTransactions();
});
</script>

<style scoped>
.user-credit-transactions-page {
  color: var(--color-text-1); /* Adapted for general theme */
}

.site-page-header {
  background-color: rgba(35, 40, 49, 0.5);
  border-radius: 4px;
  padding: 16px 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.filter-card {
  /* Same style as page header for consistency or can be different */
}

:deep(.arco-table) {
  background-color: var(--color-bg-2);
  /* border: 1px solid var(--color-border-2); */
  border-radius: var(--border-radius-medium);
}

:deep(.arco-table-th) {
  background-color: var(--color-fill-2); /* Slightly different for header */
  /* border-bottom: 1px solid var(--color-border-2); */
}

:deep(.arco-table-td) {
  /* border-bottom: 1px solid var(--color-border-1); */ /* Lighter border for rows */
}

:deep(.arco-table-stripe .arco-table-tr:nth-child(even) .arco-table-td) {
  background-color: var(--color-fill-1); /* Very subtle stripe */
}

:deep(.arco-table-pagination) {
  background-color: var(--color-bg-2);
  /* border-top: 1px solid var(--color-border-2); */
}

.text-green-500 { color: rgb(var(--green-6)); } 
.text-red-500 { color: rgb(var(--red-6)); }   
.text-gray-500 { color: var(--color-text-3); }

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  background-color: var(--color-bg-2);
  border-radius: var(--border-radius-medium);
}

.mt-4 {
  margin-top: 1rem;
}

.mt-6 {
  margin-top: 1.5rem;
}
</style>