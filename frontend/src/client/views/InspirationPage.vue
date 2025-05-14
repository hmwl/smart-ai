<template>
  <div class="inspiration-page p-4 md:p-6">
    <a-page-header title="灵感画廊" class="mb-4 page-header-custom">
      <template #subtitle>
        <p>在这里发现和探索由 AI 生成的艺术作品和创意灵感。</p>
      </template>
    </a-page-header>

    <div class="inspiration-page-main-content">
      <a-tabs :active-key="selectedCategoryId" @change="handleCategoryChange" type="rounded" class="mb-6">
        <a-tab-pane key="all" title="全部"></a-tab-pane>
        <a-tab-pane v-for="category in categories" :key="category._id" :title="`${category.name} (${category.publicWorkCount})`">
        </a-tab-pane>
      </a-tabs>

      <div class="search-container">
        <a-input-search 
          v-model="searchTerm"
          placeholder="搜索作品标题、描述、标签..."
          style="width: 300px;"
          allow-clear
          @input="debouncedFetchWorks"
          @clear="fetchWorksFirstPage"
        />
      </div>

      <a-spin :loading="loadingWorks" style="width: 100%;">
        <div v-if="works.length > 0" class="works-grid">
          <WorkCard 
            v-for="work in works" 
            :key="work._id" 
            :work="work"
            :show-details-button="false"
            :show-edit-button="false"
            :show-delete-button="false"
            :show-delete-from-category="false"
            @details="showWorkDetailsModal"
            class="public-work-card"
          />
        </div>
        <a-empty v-else-if="!loadingWorks && !initialLoad" description="该分类下暂无公开作品，或无匹配搜索结果。" />
        <a-empty v-else-if="!loadingWorks && initialLoad && categories.length === 0" description="市场暂无公开作品。" />
      </a-spin>

      <div v-if="totalPages > 1" class="pagination-container">
        <a-pagination
          :current="currentPage"
          :total="totalWorks"
          :page-size="pageSize"
          @change="handlePageChange"
          show-total
        />
      </div>

      <WorkDetailModal 
        v-if="workForDetailModal" 
        v-model:visible="workDetailModalVisible" 
        :work="workForDetailModal"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { 
  PageHeader as APageHeader,
  Tabs as ATabs, TabPane as ATabPane,
  Spin as ASpin, Empty as AEmpty, Pagination as APagination, Message,
  InputSearch as AInputSearch,
  Button as AButton
} from '@arco-design/web-vue';
import { debounce } from 'lodash-es';
import apiClient from '../services/apiService';
import WorkCard from '../../admin/components/WorkCard.vue';
import WorkDetailModal from '../../admin/components/WorkDetailModal.vue';

const categories = ref([]);
const works = ref([]);
const selectedCategoryId = ref('all'); 
const loadingCategories = ref(false);
const loadingWorks = ref(false);
const initialLoad = ref(true);

const searchTerm = ref('');
const currentPage = ref(1);
const pageSize = ref(12); 
const totalWorks = ref(0);
const totalPages = ref(0);

const workDetailModalVisible = ref(false);
const workForDetailModal = ref(null);

const fetchCategories = async () => {
  loadingCategories.value = true;
  try {
    const response = await apiClient.getPublicInspirationCategories();
    categories.value = response.data;
  } catch (error) {
    if (!error.response) {
        Message.error('获取灵感分类失败: ' + (error.message || '未知错误'));
    }
  } finally {
    loadingCategories.value = false;
  }
};

const fetchWorks = async (page = 1) => {
  loadingWorks.value = true;
  try {
    const params = {
      category_id: selectedCategoryId.value,
      page,
      limit: pageSize.value,
      search: searchTerm.value || undefined,
    };
    const response = await apiClient.getPublicWorks(params);
    works.value = response.data.works;
    totalWorks.value = response.data.total;
    currentPage.value = response.data.page;
    totalPages.value = response.data.totalPages;
    initialLoad.value = false;
  } catch (error) {
    if (!error.response) {
        Message.error('获取作品列表失败: ' + (error.message || '未知错误'));
    }
    works.value = []; 
    totalWorks.value = 0;
  } finally {
    loadingWorks.value = false;
  }
};

const debouncedFetchWorks = debounce(() => {
    currentPage.value = 1; 
    fetchWorks(1);
}, 500);

const fetchWorksFirstPage = () => {
    currentPage.value = 1;
    fetchWorks(1);
}

const handleCategoryChange = (key) => {
  selectedCategoryId.value = key;
  searchTerm.value = ''; 
  fetchWorksFirstPage();
};

const handlePageChange = (page) => {
  fetchWorks(page);
};

const showWorkDetailsModal = (work) => {
  workForDetailModal.value = work;
  workDetailModalVisible.value = true;
};

onMounted(async () => {
  await fetchCategories();
  await fetchWorksFirstPage(); 
});

</script>

<style scoped>
.inspiration-page {
  min-height: calc(100vh - 60px);
  color: #fff;
}

.page-header-custom {
  background-color: var(--custom-bg-secondary);
  border-radius: 4px;
  padding: 16px 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.page-header-custom .arco-page-header-title,
.page-header-custom .arco-page-header-subtitle,
.page-header-custom .arco-page-header-subtitle p {
  color: var(--dark-text-primary);
}

.inspiration-page-main-content {
  padding: 24px;
}

.works-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 24px;
}

.public-work-card {
  /* Styling for work cards if needed */
}

.search-container {
  display: flex;
  justify-content: flex-start; 
  margin-bottom: 1.5rem;
}

.pagination-container {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
}
</style>