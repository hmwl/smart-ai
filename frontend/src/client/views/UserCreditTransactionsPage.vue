<template>
  <div class="user-credit-transactions-page p-4 md:p-6">
    <a-page-header title="我的消费记录" class="mb-4 site-page-header" @back="() => $router.go(-1)">
    </a-page-header>

    <a-spin :loading="isLoading" tip="加载消费记录中..." style="width: 100%;">
      <div v-if="!isLoading && transactions.length === 0" class="empty-state mt-6">
        <a-empty description="暂无消费记录" />
      </div>
      <a-table
        v-else
        :data="transactions"
        :pagination="{ pageSize: pagination.pageSize, total: pagination.total, current: pagination.current, onChange: handlePageChange }"
        row-key="_id"
        stripe
        class="mt-4"
      >
        <template #columns>
          <a-table-column title="流水ID" data-index="_id" :width="180" ellipsis tooltip></a-table-column>
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
          <a-table-column title="交易时间" data-index="createdAt" :width="170">
            <template #cell="{ record }">{{ formatDate(record.createdAt) }}</template>
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
} from '@arco-design/web-vue';

const transactions = ref([]);
const isLoading = ref(false);
const pagination = reactive({
  current: 1,
  pageSize: 15, // Adjusted page size for client view
  total: 0,
});

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

const translateTransactionType = (type) => {
  const map = {
    consumption: '消费',
    topup: '充值',
    refund: '退款',
    grant: '赠送',
    adjustment: '系统调整' // More descriptive for client
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
  try {
    // The backend needs to automatically filter by the logged-in user
    // if no specific userId is provided in params.
    const response = await apiClient.get('/credit-transactions', {
      params: {
        page: page,
        limit: pagination.pageSize,
        // No userId here, relying on backend to use req.user.userId
        // Add other filters if needed in future e.g. type, date range
      }
    });
    transactions.value = response.data.transactions || [];
    pagination.total = response.data.total || 0;
    pagination.current = page;
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

onMounted(() => {
  fetchUserTransactions();
});
</script>

<style scoped>
.user-credit-transactions-page {
  color: #fff;
}

.site-page-header {
  background-color: var(--custom-bg-secondary);
  border-radius: 4px;
  padding: 16px 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Ensure table text is readable in dark mode */
:deep(.arco-table) {
  background-color: var(--custom-bg-secondary);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

:deep(.arco-table-th) {
  background-color: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.arco-table-td) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.arco-table-stripe .arco-table-tr:nth-child(even) .arco-table-td) {
  background-color: rgba(255, 255, 255, 0.02);
}

:deep(.arco-table-pagination) {
  background-color: var(--custom-bg-secondary);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.text-green-500 { color: #22c55e; } /* Tailwind green-500 */
.text-red-500 { color: #ef4444; }   /* Tailwind red-500 */
.text-gray-500 { color: rgba(255, 255, 255, 0.5); } /* Adjusted for dark mode */

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.mt-4 {
  margin-top: 1rem;
}

.mt-6 {
  margin-top: 1.5rem;
}
</style>