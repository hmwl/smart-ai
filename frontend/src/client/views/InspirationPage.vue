<template>
  <div class="inspiration-page p-4 md:p-6">
    <a-page-header title="灵感市场" class="mb-4 page-header-custom">
      <template #subtitle>
        <p>在这里发现和探索由 AI 生成的艺术作品和创意灵感。</p>
      </template>
    </a-page-header>

    <div class="inspiration-page-main-content">
      <div class="flex justify-between items-start">
        <a-tabs :active-key="selectedCategoryId" @change="handleCategoryChange" type="rounded">
          <a-tab-pane key="all" title="全部"></a-tab-pane>
          <a-tab-pane v-for="category in categories" :key="category._id" :title="`${category.name} (${category.publicWorkCount})`"></a-tab-pane>
        </a-tabs>
        <a-input-search 
            v-model="searchTerm"
            placeholder="搜索作品标题、描述、标签..."
            style="width: 300px;"
            allow-clear
            @input="debouncedSearchTermChange"
            @search="fetchWorksFirstPage" 
            @clear="handleSearchClear"
          />
      </div>

      <div class="search-and-selected-tags-container">
        
        <!-- Selected Filter Tags Display -->
        <div v-if="selectedFilterTags.length > 0" class="selected-tags-display mt-2">
          <span class="mr-2">筛选标签:</span>
          <a-tag 
            v-for="tag in selectedFilterTags" 
            :key="tag" 
            closable 
            @close="removeFilterTag(tag)"
            class="mr-1"
          >
            {{ tag }}
          </a-tag>
        </div>
      </div>

      <!-- Available Tags Filter -->
      <div v-if="availableTags.length > 0" class="available-tags-container mb-4">
        <a-spin :loading="loadingTags">
          <div class="tags-list-wrapper">
            <a-tag 
              v-for="tag in availableTags" 
              :key="tag.name" 
              @click="handleTagClick(tag.name)"
              :color="selectedFilterTags.includes(tag.name) ? 'blue' : undefined"
              class="cursor-pointer m-1"
            >
              {{ tag.name }} ({{ tag.count }})
            </a-tag>
          </div>
        </a-spin>
      </div>

      <a-spin :loading="loadingWorks" style="width: 100%;">
        <div v-if="works.length > 0" class="works-grid">
          <WorkCard 
            v-for="work in works" 
            :key="work._id" 
            :work="work"
            :show-edit-button="false"
            :show-delete-button="false"
            :show-delete-from-category="false"
            @details="showWorkDetailsModal"
            class="public-work-card"
          />
        </div>
        <a-empty v-else-if="!loadingWorks && !initialLoad" description="该分类下暂无公开作品，或无匹配搜索结果。" />
        <a-empty v-else-if="!loadingWorks && initialLoad && categories.length === 0 && availableTags.length === 0" description="市场暂无公开作品或标签。" />
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
import { ref, onMounted, watch, computed } from 'vue';
import { 
  PageHeader as APageHeader,
  Tabs as ATabs, TabPane as ATabPane,
  Spin as ASpin, Empty as AEmpty, Pagination as APagination, Message,
  InputSearch as AInputSearch,
  Button as AButton,
  Tag as ATag
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

// New state variables for tag filtering
const availableTags = ref([]);
const selectedFilterTags = ref([]);
const loadingTags = ref(false);

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

const fetchAvailableTags = async () => {
  loadingTags.value = true;
  try {
    const params = {
      category_id: selectedCategoryId.value === 'all' ? undefined : selectedCategoryId.value,
      search: searchTerm.value || undefined,
      active_tags: selectedFilterTags.value.length > 0 ? selectedFilterTags.value.join(',') : undefined
    };
    const response = await apiClient.getPublicMarketTags(params);
    availableTags.value = response.data;
  } catch (error) {
    Message.error('获取可用标签列表失败: ' + (error.response?.data?.message || error.message));
    availableTags.value = [];
  } finally {
    loadingTags.value = false;
  }
};

const fetchWorks = async (page = 1) => {
  loadingWorks.value = true;
  try {
    const params = {
      category_id: selectedCategoryId.value === 'all' ? undefined : selectedCategoryId.value,
      page,
      limit: pageSize.value,
      search: searchTerm.value || undefined,
      tags: selectedFilterTags.value.length > 0 ? selectedFilterTags.value.join(',') : undefined,
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

const fetchWorksFirstPage = () => {
    currentPage.value = 1;
    fetchWorks(1);
};

const debouncedFetchWorksAndTags = debounce(() => {
    fetchWorksFirstPage();
    fetchAvailableTags();
}, 500);

const debouncedSearchTermChange = debounce(() => {
  fetchWorksFirstPage();
  fetchAvailableTags();
}, 500);

const handleSearchClear = () => {
  searchTerm.value = '';
  fetchWorksFirstPage();
  fetchAvailableTags();
};

const handleCategoryChange = (key) => {
  selectedCategoryId.value = key;
  searchTerm.value = ''; // Reset search term when category changes
  selectedFilterTags.value = []; // Reset selected tags when category changes
  fetchWorksFirstPage();
  fetchAvailableTags();
};

const handlePageChange = (page) => {
  fetchWorks(page);
  // Tag counts might slightly change if works are distributed across pages differently,
  // but for simplicity, we might not reload tags on mere page change unless desired.
  // fetchAvailableTags(); 
};

const showWorkDetailsModal = (work) => {
  workForDetailModal.value = work;
  workDetailModalVisible.value = true;
};

const handleTagClick = (tagName) => {
  const index = selectedFilterTags.value.indexOf(tagName);
  if (index > -1) {
    selectedFilterTags.value.splice(index, 1);
  } else {
    selectedFilterTags.value.push(tagName);
  }
  // No need to call fetchWorksFirstPage and fetchAvailableTags here, 
  // as the watcher for selectedFilterTags will handle it.
};

const removeFilterTag = (tagName) => {
  const index = selectedFilterTags.value.indexOf(tagName);
  if (index > -1) {
    selectedFilterTags.value.splice(index, 1);
  }
  // Watcher will also handle this.
};

onMounted(async () => {
  await fetchCategories();
  // Initial fetch for works and tags will be triggered by watchers if needed,
  // or can be called directly. For simplicity, let's call them directly after categories.
  await fetchWorksFirstPage(); 
  await fetchAvailableTags();
});

// Watch for changes in filters to refetch data
watch(selectedCategoryId, () => {
  // This is handled by handleCategoryChange now to also reset other filters
});

watch(searchTerm, () => {
  // This is handled by debouncedSearchTermChange
});

watch(selectedFilterTags, () => {
  fetchWorksFirstPage();
  fetchAvailableTags();
}, { deep: true });

</script>

<style scoped>
.inspiration-page {
  color: #fff;
}

.page-header-custom {
  background-color: var(--custom-bg-secondary);
  border-radius: 4px;
  padding: 16px 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Removed specific dark theme text colors to allow theme to control them */
/* .page-header-custom .arco-page-header-title, ... */

.inspiration-page-main-content {
  padding: 0px 24px 24px 24px; /* Adjusted padding */
}

.available-tags-container {
  /* Max 3 lines of tags. Adjust max-height based on your tag size and margins. */
  /* Assuming line-height of a-tag is around 22px and margin is 4px top/bottom (total ~30px per line) */
  max-height: calc(3 * (22px + 8px)); /* (tag-height + vertical-margins) * 3 */
  overflow-y: auto;
  border: 1px solid var(--color-border-2);
  padding: 8px;
  border-radius: var(--border-radius-medium);
}

.tags-list-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 8px; /* For spacing between tags */
}

.search-and-selected-tags-container {
  /* Container for search and selected tags display */
}

.selected-tags-display {
  /* Styles for the display area of selected filter tags */
  padding: 8px 0;
}

.works-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 24px;
}

.public-work-card {
  /* Styling for work cards if needed */
}

.search-container { /* This class seems unused now, can be removed if .search-and-selected-tags-container covers it */
  display: flex;
  justify-content: flex-start; 
  margin-bottom: 1.5rem;
}

.pagination-container {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
}

.cursor-pointer {
  cursor: pointer;
}

/* Adjust Arco component styles if needed */
:deep(.arco-tabs-nav-tab-list) {
  /* Styles for tab list if needed */
}
:deep(.arco-tabs-tab) {
  /* Styles for individual tabs if needed */
}

</style>