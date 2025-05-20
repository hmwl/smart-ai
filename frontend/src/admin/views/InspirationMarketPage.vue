<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">灵感市场</h2>
      <a-space>
        <a-select v-model="selectedWorkType" placeholder="筛选作品类型" allow-clear style="width: 150px;">
          <a-option value="image">图片</a-option>
          <a-option value="audio">音频</a-option>
          <a-option value="video">视频</a-option>
          <a-option value="model">模型</a-option>
        </a-select>
        <a-select 
          v-model="selectedCreatorId" 
          placeholder="筛选创作者" 
          allow-clear 
          show-search
          :filter-option="creatorFilterOption" 
          style="width: 180px;" 
          :loading="usersLoading"
        >
          <a-option v-for="user in userList" :key="user._id" :value="user._id">{{ user.username }}</a-option>
        </a-select>
        <a-select 
          v-model="selectedTagsOnPage" 
          placeholder="筛选标签 (可多选)" 
          allow-clear 
          multiple
          style="width: 200px;"
          :options="tagOptionsForSelect"
          :loading="tagsLoading"
          @change="debouncedFetchMainPageWorks"
        >
        </a-select>
        <a-input-search 
          v-model="workSearchTermOnPage" 
          placeholder="搜索作品名称..." 
          allow-clear
          style="width: 220px;"
        />
        <a-button @click="refreshData" :loading="categoriesLoading || worksLoading">
          <template #icon><icon-refresh /></template> 刷新
        </a-button>
      </a-space>
    </div>

    <!-- Main Content Layout: Categories (Sider) and Works (Content) -->
    <a-layout class="page-content-layout" style="flex-grow: 1; overflow: hidden; height: calc(100vh - 120px);">
      <a-layout-sider 
        :width="280" 
        style="background: var(--color-bg-2); border-right: 1px solid var(--color-border-2); padding: 16px; display: flex; flex-direction: column; overflow-y: auto;"
        collapsible
        breakpoint="lg"
        :collapsed-width="0"
        ref="categorySiderRef"
      >
        <div class="flex justify-between items-center mb-3">
          <span class="text-base font-medium">作品分类</span>
          <a-button type="primary" size="mini" @click="showAddCategoryModal = true">
            <template #icon><icon-plus /></template> 添加分类
          </a-button>
        </div>
        <a-spin :loading="categoriesLoading" style="width: 100%; flex-grow:1;">
          <a-tree
            v-if="treeData.length > 0"
            :data="treeData"
            block-node
            :draggable="isCategoryDraggable"
            show-line
            :selected-keys="selectedCategoryKeys"
            @select="handleCategorySelect"
            @drop="handleCategoryDrop"
            class="category-tree"
            :allow-drop="allowCategoryDrop"
          >
            <template #title="nodeData">
              <span class="category-node-text">{{ nodeData.title }} ({{ nodeData.workCount }})</span>
              <div
                v-if="nodeData.key !== ALL_WORKS_KEY"
                class="category-actions"
                @click.stop
              >
                <a-tooltip content="重命名">
                  <a-button type="text" size="mini" @click.stop="handleRenameCategory(nodeData)"><icon-edit /></a-button>
                </a-tooltip>
                <a-tooltip content="删除分类" v-if="nodeData.workCount === 0">
                    <a-popconfirm 
                        content="确定删除此分类吗？此操作不可恢复。" 
                        type="warning" 
                        @ok="handleDeleteCategory(nodeData.key)"
                        :getPopupContainer="() => categorySiderRef?.$el || document.body"
                    >
                      <a-button type="text" status="danger" size="mini"><icon-delete /></a-button>
                    </a-popconfirm>
                </a-tooltip>
              </div>
            </template>
          </a-tree>
          <a-empty v-else-if="!categoriesLoading" description="暂无分类，请点击上方'添加分类'按钮创建。" />
        </a-spin>
      </a-layout-sider>

      <a-layout-content style="padding: 16px 16px 16px 24px; background: var(--color-bg-1); display: flex; flex-direction: column; overflow-y: hidden;">
        <div class="flex justify-between items-center gap-6">
          <a-typography-title :heading="6" class="!m-0">
            {{ selectedCategory ? selectedCategory.name : (treeData.length > 0 ? '请选择分类或"全部"查看作品' : '作品展示区') }}
            <span v-if="selectedCategory && currentWorksToDisplay.length > 0">
              ({{ currentWorksToDisplay.length }} 个作品)
              
            </span>
          </a-typography-title>
          <a-button 
            type="primary" 
            @click="openAddWorksToCategoryModal" 
            :disabled="!selectedCategory || !selectedCategory._id || selectedCategory.key === ALL_WORKS_KEY"
            v-if="selectedCategory && selectedCategory.key !== ALL_WORKS_KEY"
          >
            <template #icon><icon-plus /></template>
            添加作品
          </a-button>
        </div>
        <p v-if="selectedCategory && selectedCategory.description" class="text-xs text-gray-500 mt-2 mb-4">{{  selectedCategory.description }}</p>
        
        <a-spin :loading="worksLoading" style="width:100%; flex-grow: 1; overflow-y: auto;">
          <div v-if="currentWorksToDisplay.length > 0" class="works-grid-container">
             <a-alert v-if="selectedCategory && selectedCategory.key !== ALL_WORKS_KEY && worksOfSelectedCategory.length > 0 && !worksPagination.disabled" type="info" closable style="margin-bottom: 16px;">
                当前分类共 {{ worksPagination.total }} 个作品。您可以拖拽当前页的作品调整顺序。
             </a-alert>
             <a-alert v-else-if="selectedCategory && selectedCategory.key === ALL_WORKS_KEY && allWorksForPageDisplay.length > 0 && !worksPagination.disabled" type="info" closable style="margin-bottom: 16px;">
                共 {{ worksPagination.total }} 个作品。
             </a-alert>
            <draggable 
              v-model="draggableWorksModel" 
              item-key="_id" 
              class="works-grid" 
              ghost-class="ghost"
              animation="150"
              @end="handleWorkDragEnd"
              :disabled="!selectedCategory || selectedCategory.key === ALL_WORKS_KEY || worksLoading"
            >
              <template #item="{element}">
                <div class="work-card-wrapper">
                  <WorkCard 
                    :work="element" 
                    @details="handleShowWorkDetails"
                    @edit="handleEditWorkInAllWorks"
                    @deleteFromCategory="() => handleDeleteWorkFromCategoryConfirm(element._id, element.title)"
                    :show-edit-button="false"
                    :show-delete-button="false" 
                    :show-delete-from-category="selectedCategory && selectedCategory.key !== ALL_WORKS_KEY"
                  />
                </div>
              </template>
            </draggable>
          </div>
          <a-empty 
            v-else-if="(selectedCategory || treeData.length > 0) && !worksLoading && !categoriesLoading"
            :description="emptyStateDescription"
          />
           <a-empty v-else-if="categoriesLoading || worksLoading" description="加载中..."/>
           <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
             <a-pagination
              v-if="!worksLoading && worksPagination.total > 0 && !worksPagination.disabled"
              :current="worksPagination.current"
              :page-size="worksPagination.pageSize"
              :total="worksPagination.total"
              :page-size-options="worksPagination.pageSizeOptions"
              show-total
              show-page-size
              :show-jumper="false"
              @change="handleWorksPageChange"
              @page-size-change="handleWorksPageSizeChange"
            />
          </div>
        </a-spin>
      </a-layout-content>
    </a-layout>

    <!-- Add/Edit Category Modal -->
    <a-modal v-model:visible="showAddCategoryModal" :title="renameCategoryForm.id ? '重命名分类' : '添加新分类'" @ok="handleAddOrUpdateCategory" @cancel="closeCategoryModal" :width="400" unmount-on-close>
      <a-form :model="categoryForm" ref="categoryFormRef" layout="vertical">
        <a-form-item field="name" label="分类名称" required :rules="[{required: true, message:'分类名称不能为空'}]">
          <a-input v-model="categoryForm.name" placeholder="请输入分类名称" />
        </a-form-item>
        <a-form-item field="description" label="分类简介 (可选)">
          <a-textarea v-model="categoryForm.description" placeholder="请输入分类简介，最多200字" :max-length="200" show-word-limit auto-size />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- Add Works to Category Modal (Manages which works are IN the category) -->
    <a-modal 
      v-model:visible="showAddWorksToCategoryModal" 
      :title="addWorksModalTitle" 
      @ok="handleAddWorksToCategoryModalOk" 
      @cancel="showAddWorksToCategoryModal = false"
      :width="1000" 
      :body-style="{ maxHeight: '70vh', overflowY: 'auto' }"
      ok-text="保存更改"
      unmount-on-close
      class="add-works-to-category-modal"
    >
      <a-alert type="info" style="margin-bottom: 16px;">点击作品卡片下方的按钮，将其添加或移出当前分类。作品本身不会被删除。</a-alert>
      
      <a-space style="margin-bottom: 16px; display: flex; flex-wrap: wrap;">
        <a-input-search 
          placeholder="搜索所有作品..." 
          v-model="allWorksSearchTermInModal" 
          style="width: 250px;"
          allow-clear
          @input="debouncedFetchAllWorksForModal" 
          @clear="debouncedFetchAllWorksForModal"
        />
        <a-select 
          v-model="addWorksModalSelectedType" 
          placeholder="筛选作品类型" 
          allow-clear 
          style="width: 150px;"
          @change="() => { addWorksModalPagination.current = 1; fetchAllWorksForModal(); }"
        >
          <a-option value="image">图片</a-option>
          <a-option value="audio">音频</a-option>
          <a-option value="video">视频</a-option>
          <a-option value="model">模型</a-option>
        </a-select>
        <a-select 
          v-model="addWorksModalSelectedCreatorId" 
          placeholder="筛选创作者" 
          allow-clear 
          show-search
          :filter-option="creatorFilterOption" 
          style="width: 180px;" 
          :loading="usersLoading" 
          @change="() => { addWorksModalPagination.current = 1; fetchAllWorksForModal(); }"
        >
          <a-option v-for="user in userList" :key="user._id" :value="user._id">{{ user.username }}</a-option>
        </a-select>
        <a-select 
          v-model="addWorksModalSelectedTags" 
          placeholder="筛选标签 (可多选)" 
          allow-clear 
          multiple 
          style="width: 200px;"
          :options="tagOptionsForSelect"
          :loading="tagsLoading"
          @change="() => { addWorksModalPagination.current = 1; fetchAllWorksForModal(); }"
        >
        </a-select>
      </a-space>

      <a-spin :loading="allWorksLoading" style="width:100%; min-height: 200px;"> 
        <div v-if="allWorksForModal.length > 0" class="works-grid modal-works-grid">
          <div v-for="work in allWorksForModal" :key="work._id" class="work-card-wrapper-modal">
            <WorkCard 
              :work="work" 
              @details="handleShowWorkDetails"
              :show-edit-button="false"
              :show-delete-button="false"
              :show-delete-from-category="false" 
              style="box-shadow: var(--shadow-1);" 
              class="modal-work-item-card" 
            >
            </WorkCard>
            <a-button 
              type="primary" 
              size="small"
              @click="toggleWorkInSelection(work._id)"
              :status="isWorkSelectedForCategory(work._id) ? 'danger' : 'normal'"
              style="width: 100%; margin-top: 8px;" 
            >
              <template #icon>
                <icon-check-circle-fill v-if="isWorkSelectedForCategory(work._id)" />
                <icon-plus v-else />
              </template>
              {{ isWorkSelectedForCategory(work._id) ? '已选择 (移除)' : '选择此作品' }}
            </a-button>
          </div>
        </div>
        <a-empty v-else-if="!allWorksLoading && (allWorksSearchTermInModal || addWorksModalSelectedType || addWorksModalSelectedCreatorId || addWorksModalSelectedTags)" description="没有匹配筛选条件的作品。" style="margin-top: 20px;"/>
        <a-empty v-else-if="!allWorksLoading && allWorksForModal.length === 0" description="没有可供选择的作品。请先在'所有作品'页面添加作品或尝试其他筛选。" style="margin-top: 20px;"/>
        <a-empty v-else-if="allWorksLoading" description="加载中..." style="margin-top: 20px;"/>
        
        <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
          <a-pagination
              v-if="!allWorksLoading && addWorksModalPagination.total > 0"
              :current="addWorksModalPagination.current"
              :page-size="addWorksModalPagination.pageSize"
              :total="addWorksModalPagination.total"
              :page-size-options="addWorksModalPagination.pageSizeOptions"
              show-total
              show-page-size
              :show-jumper="false" 
              @change="handleModalWorksPageChange"
              @page-size-change="handleModalWorksPageSizeChange"
          />
        </div>
      </a-spin>
    </a-modal>

    <WorkDetailModal 
      v-model:visible="workDetailModalVisible" 
      :work="workForDetailModal"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, reactive } from 'vue';
import draggable from 'vuedraggable';
import { debounce } from 'lodash-es';
import { 
    Layout as ALayout, LayoutSider as ALayoutSider, LayoutContent as ALayoutContent,
    Button as AButton, Modal as AModal, Form as AForm, FormItem as AFormItem, Input as AInput, TypographyTitle as ATypographyTitle,
    Tree as ATree, Spin as ASpin, Empty as AEmpty, Space as ASpace, Tooltip as ATooltip, Popconfirm as APopconfirm, Message, Alert as AAlert,
    InputSearch as AInputSearch, Transfer as ATransfer, Pagination as APagination, Select as ASelect, Option as AOption
} from '@arco-design/web-vue';
import { IconPlus, IconEdit, IconDelete, IconPlusCircle, IconRefresh, IconCheckCircleFill } from '@arco-design/web-vue/es/icon';
import apiService from '../services/apiService';
import WorkCard from '../components/WorkCard.vue';
import WorkDetailModal from '../components/WorkDetailModal.vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const ALL_WORKS_KEY = '__ALL_WORKS__';

const categories = ref([]);
const categoriesLoading = ref(false);
const selectedCategoryKeys = ref([]);
const selectedCategory = ref(null);
const workSearchTermOnPage = ref('');
const selectedWorkType = ref(null);
const selectedCreatorId = ref(null);
const userList = ref([]);
const usersLoading = ref(false);
const predefinedTagsList = ref([]);
const tagsLoading = ref(false);
const selectedTagsOnPage = ref([]);

const worksOfSelectedCategory = ref([]);
const allWorksForPageDisplay = ref([]);
const worksLoading = ref(false);

const showAddCategoryModal = ref(false);
const categoryFormRef = ref(null);
const categoryForm = reactive({ name: '', description: '' });
const renameCategoryForm = reactive({ id: null });

const showAddWorksToCategoryModal = ref(false);
const allWorksForModal = ref([]);
const allWorksLoading = ref(false);
const allWorksSearchTermInModal = ref('');
const currentCategoryWorkIds = ref([]);

const workDetailModalVisible = ref(false);
const workForDetailModal = ref(null);

const totalWorksCount = ref(0);
const categorySiderRef = ref(null);

// Pagination state for works list
const worksPagination = reactive({
  current: 1,
  pageSize: 15, // Standardized
  total: 0,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [10, 15, 20, 50, 100], // Standardized
  disabled: false, // To disable pagination when no category or "All" with client-side pagination
});

// New state for modal filters and pagination
const addWorksModalPagination = reactive({
  current: 1,
  pageSize: 12, 
  total: 0,
  showTotal: true,
  showPageSize: true,
  pageSizeOptions: [12, 24, 48, 96], 
});
const addWorksModalSelectedType = ref(null);
const addWorksModalSelectedCreatorId = ref(null);
const addWorksModalSelectedTags = ref([]);

const treeData = computed(() => {
  const staticAllCategory = {
    key: ALL_WORKS_KEY,
    title: '全部',
    workCount: totalWorksCount.value,
    draggable: false,
    isStatic: true,
  };
  const regularCategories = categories.value.map(cat => ({
    key: cat._id,
    title: cat.name,
    workCount: cat.workCount != null ? cat.workCount : (cat.works ? cat.works.length : 0),
    draggable: true,
  }));
  return [staticAllCategory, ...regularCategories];
});

const isCategoryDraggable = computed(() => {
    return true;
});

const allowCategoryDrop = ({ dropNode, dropPosition }) => {
  if (dropNode.key === ALL_WORKS_KEY && dropPosition === -1) return false;
  if (dropNode.key === ALL_WORKS_KEY && dropPosition !== -1) return false;
  return true;
};

const currentWorksToDisplay = computed(() => {
  let worksToFilter = [];
  if (selectedCategory.value && selectedCategory.value.key === ALL_WORKS_KEY) {
    worksToFilter = allWorksForPageDisplay.value;
  } else if (selectedCategory.value) {
    worksToFilter = worksOfSelectedCategory.value;
  } else {
     if (workSearchTermOnPage.value) worksToFilter = allWorksForPageDisplay.value;
     else worksToFilter = [];
  }

  if (workSearchTermOnPage.value) {
    const searchTerm = workSearchTermOnPage.value.toLowerCase();
    return worksToFilter.filter(work => 
      (work.title && work.title.toLowerCase().includes(searchTerm)) ||
      (work.prompt && work.prompt.toLowerCase().includes(searchTerm)) ||
      (work.tags && work.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
    );
  }
  return worksToFilter;
});

const draggableWorksModel = computed({
    get() {
        if (selectedCategory.value && selectedCategory.value.key !== ALL_WORKS_KEY) {
            return worksOfSelectedCategory.value;
        }
        return currentWorksToDisplay.value;
    },
    set(newValue) {
        if (selectedCategory.value && selectedCategory.value.key !== ALL_WORKS_KEY) {
            worksOfSelectedCategory.value = newValue;
        }
    }
});

const emptyStateDescription = computed(() => {
  if (categoriesLoading.value || worksLoading.value) return "加载中...";
  if (workSearchTermOnPage.value && currentWorksToDisplay.value.length === 0) return "没有匹配搜索条件的作品";
  if (selectedCategory.value) {
    if (selectedCategory.value.key === ALL_WORKS_KEY) return "暂无任何作品";
    return `暂无作品。点击右上方的 "添加作品" 按钮添加`;
  }
  if (treeData.value.length <= 1 && categories.value.length === 0) return "请先添加一个分类目录以管理作品";
  return "请从左侧选择一个分类或'全部'以查看作品";
});

const addWorksModalTitle = computed(() => {
  if (selectedCategory.value && selectedCategory.value.name && selectedCategory.value.key !== ALL_WORKS_KEY) {
    return `管理 "${selectedCategory.value.name}" 分类下的作品`;
  }
  return '管理分类作品';
});

const fetchCategories = async (selectFirstCategory = false) => {
  categoriesLoading.value = true;
  try {
    const response = await apiService.getInspirationCategories({ populateWorks: 'false' });
    categories.value = response.data.sort((a,b) => a.order - b.order);
    
    if (selectFirstCategory && categories.value.length > 0) {
        handleCategorySelect([categories.value[0]._id], {node: {key: categories.value[0]._id, title: categories.value[0].name } });
    } else if (!selectedCategoryKeys.value.length) {
        handleCategorySelect([ALL_WORKS_KEY], { node: treeData.value.find(n => n.key === ALL_WORKS_KEY) });
    } else {
        const currentSelection = selectedCategoryKeys.value[0];
        if (currentSelection === ALL_WORKS_KEY) {
            await fetchAllWorksForPageDisplay();
        } else if (categories.value.find(c => c._id === currentSelection)) {
            await fetchWorksForCategory(currentSelection);
        } else {
            handleCategorySelect([ALL_WORKS_KEY], { node: treeData.value.find(n => n.key === ALL_WORKS_KEY) });
        }
    }
  } catch (error) {
    // Message.error already handled by apiService interceptor for most cases
  } finally {
    categoriesLoading.value = false;
  }
};

const fetchAllWorksForPageDisplay = async () => {
    if (!selectedCategory.value || selectedCategory.value.key !== ALL_WORKS_KEY) return;
    if (worksLoading.value) return; 
    worksLoading.value = true;
    worksPagination.disabled = false;

    try {
        const params = {
            page: worksPagination.current,
            limit: worksPagination.pageSize,
            search: workSearchTermOnPage.value || undefined,
            workType: selectedWorkType.value || undefined,
            creatorId: selectedCreatorId.value || undefined,
            tags: selectedTagsOnPage.value.length > 0 ? selectedTagsOnPage.value.join(',') : undefined,
        };
        const response = await apiService.get('/public/market/works', { params }); 
        allWorksForPageDisplay.value = response.data.works || [];
        worksPagination.total = response.data.total || 0; // Backend uses 'total', not 'totalWorks'
        totalWorksCount.value = response.data.total || 0; 

    } catch (error) {
        allWorksForPageDisplay.value = [];
        worksPagination.total = 0;
        totalWorksCount.value = 0; 
        // Error message handled by apiService interceptor
    } finally {
        worksLoading.value = false;
    }
};

const fetchWorksForCategory = async (categoryId, page = worksPagination.current, limit = worksPagination.pageSize) => {
    if (!categoryId || categoryId === ALL_WORKS_KEY) {
        if (categoryId === ALL_WORKS_KEY) {
            selectedCategory.value = { key: ALL_WORKS_KEY, _id: ALL_WORKS_KEY, name: '全部' };
            await fetchAllWorksForPageDisplay(); 
        } else {
             worksOfSelectedCategory.value = [];
             worksPagination.total = 0;
             selectedCategory.value = null;
             worksPagination.disabled = true;
        }
        return;
    }
    worksLoading.value = true;
    worksPagination.disabled = false;
    try {
        const params = { 
            page,
            limit,
            search: workSearchTermOnPage.value || undefined,
            workType: selectedWorkType.value || undefined,
            creatorId: selectedCreatorId.value || undefined,
            tags: selectedTagsOnPage.value.length > 0 ? selectedTagsOnPage.value.join(',') : undefined,
        };
        const response = await apiService.getInspirationCategoryById(categoryId, { params });
        const categoryData = response.data;
        
        const foundCategoryInList = categories.value.find(c => c._id === categoryId);
        if (foundCategoryInList) {
             selectedCategory.value = { ...foundCategoryInList, ...categoryData, key: categoryId, name: categoryData.name };
        } else {
             selectedCategory.value = { ...categoryData, key: categoryId };
        }
        worksOfSelectedCategory.value = categoryData.works || []; // Assuming backend returns paginated works
        worksPagination.current = page;
        worksPagination.pageSize = limit;
        worksPagination.total = categoryData.totalWorks || 0; // Assuming backend returns totalWorks

        const catInList = categories.value.find(c => c._id === categoryId);
        if (catInList) catInList.workCount = worksPagination.total; // Update overall count for the category in the tree

    } catch (error) {
        worksOfSelectedCategory.value = [];
        worksPagination.total = 0;
    } finally {
        worksLoading.value = false;
    }
};

const refreshData = async () => {
    categoriesLoading.value = true;
    worksLoading.value = true;
    await fetchCategories();
    Message.success('数据已刷新');
    categoriesLoading.value = false;
    worksLoading.value = false;
};

const fetchUserListForFilter = async () => {
  usersLoading.value = true;
  try {
    const response = await apiService.get('/users', { params: { page: 1, limit: 1000 } }); 
    if (response.data && response.data.data) {
        userList.value = response.data.data.map(user => ({ 
            _id: user._id, 
            username: user.username, 
            nickname: user.nickname // Keep nickname in the data structure if needed elsewhere
        }));
    } else {
        userList.value = [];
        Message.error('获取创作者列表失败: 响应数据格式不正确或无数据');
    }
  } catch (error) {
    console.error("Failed to fetch user list for filter:", error);
    Message.error('获取创作者列表失败: ' + (error.response?.data?.message || error.message));
    userList.value = [];
  } finally {
    usersLoading.value = false;
  }
};

const fetchTags = async () => {
  tagsLoading.value = true;
  try {
    const response = await apiService.get('/tags');
    predefinedTagsList.value = response.data || [];
  } catch (error) {
    Message.error('获取标签列表失败: ' + (error.response?.data?.message || error.message));
    predefinedTagsList.value = [];
  } finally {
    tagsLoading.value = false;
  }
};

const creatorFilterOption = (inputValue, option) => {
  // option.children[0].children is the text content of the a-option
  // Ensure robust access to text content
  const textContent = option.children && option.children.length > 0 && option.children[0].children 
                      ? String(option.children[0].children)
                      : '';
  return textContent.toLowerCase().includes(inputValue.toLowerCase());
};

onMounted(() => { 
  fetchCategories(false); 
  fetchUserListForFilter(); 
  fetchTags();
});

watch(selectedCategoryKeys, async (newKeys) => {
    if (newKeys && newKeys.length > 0) {
        const keyToSelect = newKeys[0];
        workSearchTermOnPage.value = ''; 
        selectedWorkType.value = null;
        selectedCreatorId.value = null;
        selectedTagsOnPage.value = [];
        worksPagination.current = 1; 

        if (keyToSelect === ALL_WORKS_KEY) {
            await fetchWorksForCategory(ALL_WORKS_KEY);
        } else {
            const categoryToSelect = categories.value.find(c => c._id === keyToSelect);
            if(categoryToSelect) {
                 await fetchWorksForCategory(keyToSelect, worksPagination.current, worksPagination.pageSize);
            } else if (!categoriesLoading.value) {
                handleCategorySelect([ALL_WORKS_KEY], { node: treeData.value.find(n => n.key === ALL_WORKS_KEY) });
            }
        }
    } else {
        handleCategorySelect([ALL_WORKS_KEY], { node: treeData.value.find(n => n.key === ALL_WORKS_KEY) });
    }
});

const handleCategorySelect = (keys, data) => {
  if (keys.length > 0) {
    if (data && data.node && data.node.key === ALL_WORKS_KEY) selectedCategoryKeys.value = [ALL_WORKS_KEY];
    else if (data && data.node && categories.value.some(c => c._id === data.node.key)) selectedCategoryKeys.value = keys;
    else if (!data && keys[0] === ALL_WORKS_KEY) selectedCategoryKeys.value = [ALL_WORKS_KEY];
    else if (!data && categories.value.some(c => c._id === keys[0])) selectedCategoryKeys.value = keys;
    else selectedCategoryKeys.value = [ALL_WORKS_KEY];
  } else selectedCategoryKeys.value = [ALL_WORKS_KEY];
};

const closeCategoryModal = () => {
    showAddCategoryModal.value = false;
    categoryForm.name = '';
    categoryForm.description = '';
    renameCategoryForm.id = null;
    categoryFormRef.value?.clearValidate();
};

const handleAddOrUpdateCategory = async () => {
  if (renameCategoryForm.id === ALL_WORKS_KEY) return;
  const validationResult = await categoryFormRef.value?.validate();
  if (validationResult && validationResult.name) return;
  try {
    const payload = { name: categoryForm.name, description: categoryForm.description };
    if (renameCategoryForm.id) { 
        await apiService.updateInspirationCategory(renameCategoryForm.id, payload);
        const catIndex = categories.value.findIndex(c => c._id === renameCategoryForm.id);
        if (catIndex !== -1) {
            categories.value[catIndex].name = categoryForm.name;
            categories.value[catIndex].description = categoryForm.description;
        }
        if (selectedCategory.value && selectedCategory.value._id === renameCategoryForm.id) {
            selectedCategory.value.name = categoryForm.name;
            selectedCategory.value.description = categoryForm.description;
        }
        Message.success('分类更新成功');
    } else { 
        const newCategoryData = { ...payload, order: categories.value.length };
        const response = await apiService.createInspirationCategory(newCategoryData);
        const newCat = {...response.data, workCount: 0, description: categoryForm.description };
        categories.value.push(newCat);
        categories.value.sort((a,b) => a.order - b.order);
        Message.success(`分类 "${newCat.name}" 添加成功`);
        handleCategorySelect([newCat._id], { node: { key: newCat._id, title: newCat.name, description: newCat.description } });
    }
    closeCategoryModal();
  } catch (error) { /* Handled by interceptor */ }
};

const handleRenameCategory = (nodeData) => {
    if (nodeData.key === ALL_WORKS_KEY) return;
    renameCategoryForm.id = nodeData.key;
    const categoryToEdit = categories.value.find(cat => cat._id === nodeData.key);
    categoryForm.name = nodeData.title.split(' (')[0];
    categoryForm.description = categoryToEdit ? categoryToEdit.description || '' : '';
    showAddCategoryModal.value = true;
};

const handleDeleteCategory = async (categoryId) => {
  if (categoryId === ALL_WORKS_KEY) return;
  try {
    await apiService.deleteInspirationCategory(categoryId);
    categories.value = categories.value.filter(cat => cat._id !== categoryId);
    Message.success('分类删除成功');
    if (selectedCategory.value && selectedCategory.value._id === categoryId) {
        handleCategorySelect([ALL_WORKS_KEY], { node: treeData.value.find(n => n.key === ALL_WORKS_KEY) });
    }
  } catch (error) { /* Handled by interceptor */ }
};

const handleCategoryDrop = async ({ dragNode, dropNode, dropPosition }) => {
    if (dragNode.key === ALL_WORKS_KEY || dropNode.key === ALL_WORKS_KEY) return;
    const draggedId = dragNode.key;
    const currentCategoriesList = [...categories.value];
    const draggedItemIndex = currentCategoriesList.findIndex(c => c._id === draggedId);
    if (draggedItemIndex === -1) return;
    const draggedItem = currentCategoriesList.splice(draggedItemIndex, 1)[0];
    let targetIndex = currentCategoriesList.findIndex(c => c._id === dropNode.key);
    if (targetIndex === -1 && currentCategoriesList.length === 0) targetIndex = 0;
    else if (targetIndex === -1) return;
    if (dropPosition === 0) currentCategoriesList.splice(targetIndex, 0, draggedItem);
    else if (dropPosition === 1) currentCategoriesList.splice(targetIndex + 1, 0, draggedItem);
    else currentCategoriesList.splice(targetIndex, 0, draggedItem);
    const orderedCategoryIds = currentCategoriesList.map((cat, index) => { cat.order = index; return cat._id; });
    categories.value = [...currentCategoriesList];
    try {
        await apiService.reorderInspirationCategories(orderedCategoryIds);
        Message.success('分类顺序更新成功');
    } catch (error) {
        fetchCategories();
    }
};

const openAddWorksToCategoryModal = async () => {
    if (!selectedCategory.value || !selectedCategory.value._id || selectedCategory.value.key === ALL_WORKS_KEY) return;
    
    allWorksSearchTermInModal.value = '';
    addWorksModalSelectedType.value = null;
    addWorksModalSelectedCreatorId.value = null;
    addWorksModalSelectedTags.value = [];
    addWorksModalPagination.current = 1;
    addWorksModalPagination.pageSize = 12; 
    addWorksModalPagination.total = 0;
    allWorksForModal.value = [];

    try {
        const categoryDetails = await apiService.getInspirationCategoryById(selectedCategory.value._id, { params: { limit: 0 } }); 
        currentCategoryWorkIds.value = categoryDetails.data.works.map(w => typeof w === 'string' ? w : w._id);
    } catch(error) {
        Message.error('无法获取当前分类的完整作品列表。');
        currentCategoryWorkIds.value = worksOfSelectedCategory.value.map(w => w._id); 
    }
    
    await fetchAllWorksForModal(); 
    showAddWorksToCategoryModal.value = true;
};

const fetchAllWorksForModal = async () => {
    allWorksLoading.value = true;
    try {
        const params = { 
            limit: addWorksModalPagination.pageSize,
            page: addWorksModalPagination.current,
            search: allWorksSearchTermInModal.value || undefined,
            type: addWorksModalSelectedType.value || undefined, 
            creator: addWorksModalSelectedCreatorId.value || undefined, 
            tags: addWorksModalSelectedTags.value.length > 0 ? addWorksModalSelectedTags.value.join(',') : undefined,
        };
        const response = await apiService.getWorks(params); 
        allWorksForModal.value = Array.isArray(response.data?.works) ? response.data.works : [];
        addWorksModalPagination.total = response.data?.totalWorks || 0;
    } catch (error) { 
        allWorksForModal.value = [];
        addWorksModalPagination.total = 0;
    } finally {
        allWorksLoading.value = false;
    }
};
const debouncedFetchAllWorksForModal = debounce(() => { 
    addWorksModalPagination.current = 1; 
    fetchAllWorksForModal(); 
}, 300);

const isWorkSelectedForCategory = (workId) => currentCategoryWorkIds.value.includes(workId);

const toggleWorkInSelection = (workId) => {
  const index = currentCategoryWorkIds.value.indexOf(workId);
  if (index > -1) currentCategoryWorkIds.value.splice(index, 1);
  else currentCategoryWorkIds.value.push(workId);
};

const handleAddWorksToCategoryModalOk = async () => {
    if (!selectedCategory.value || !selectedCategory.value._id || selectedCategory.value.key === ALL_WORKS_KEY) return;
    try {
        await apiService.updateInspirationCategory(selectedCategory.value._id, {
            works: currentCategoryWorkIds.value 
        });
        Message.success(`作品已成功更新到分类 "${selectedCategory.value.name}"`);
        showAddWorksToCategoryModal.value = false;
        await fetchWorksForCategory(selectedCategory.value._id, worksPagination.current, worksPagination.pageSize); 
        await fetchCategories(); 
    } catch (error) { /* Handled by interceptor */ }
};

const handleWorkDragEnd = async (event) => {
    if (!selectedCategory.value || !selectedCategory.value._id || selectedCategory.value.key === ALL_WORKS_KEY) return;
    const orderedWorkIds = worksOfSelectedCategory.value.map(w => w._id);
    try {
        await apiService.updateInspirationCategory(selectedCategory.value._id, {
            works: orderedWorkIds
        });
        Message.success('作品顺序已更新');
    } catch (error) {
        await fetchWorksForCategory(selectedCategory.value._id);
    }
};

const handleShowWorkDetails = (work) => {
    workForDetailModal.value = work;
    workDetailModalVisible.value = true;
};

const handleEditWorkInAllWorks = (work) => {
    router.push({ name: 'AllWorks', query: { editWorkId: work._id } });
    Message.info('正在跳转到作品编辑...');
};

const handleDeleteWorkFromCategoryConfirm = (workId, workTitle) => {
    if (!selectedCategory.value || !selectedCategory.value._id || selectedCategory.value.key === ALL_WORKS_KEY) return;
    Modal.confirm({
        title: '确认从分类移除',
        content: `您确定要从分类 "${selectedCategory.value.name}" 中移除作品 "${workTitle || workId}" 吗？作品本身不会被删除。`,
        okText: '确认移除',
        cancelText: '取消',
        onOk: async () => {
            try {
                await apiService.removeWorkFromInspirationCategory(selectedCategory.value._id, workId);
                Message.success('作品已从分类中移除');
                await fetchWorksForCategory(selectedCategory.value._id);
                if (selectedCategoryKeys.value[0] === ALL_WORKS_KEY) await fetchAllWorksForPageDisplay();
            } catch (error) { /* Handled by interceptor */ }
        },
    });
};

// Add handlers for pagination
const handleWorksPageChange = (page) => {
  worksPagination.current = page;
  if (selectedCategory.value && selectedCategory.value.key !== ALL_WORKS_KEY) {
    fetchWorksForCategory(selectedCategory.value._id, worksPagination.current, worksPagination.pageSize);
  } else if (selectedCategory.value && selectedCategory.value.key === ALL_WORKS_KEY) {
    fetchAllWorksForPageDisplay(); // Fetch new page for "All" works
  }
};

const handleWorksPageSizeChange = (pageSize) => {
  worksPagination.pageSize = pageSize;
  worksPagination.current = 1; // Reset to first page
  if (selectedCategory.value && selectedCategory.value.key !== ALL_WORKS_KEY) {
    fetchWorksForCategory(selectedCategory.value._id, worksPagination.current, worksPagination.pageSize);
  } else if (selectedCategory.value && selectedCategory.value.key === ALL_WORKS_KEY) {
    fetchAllWorksForPageDisplay(); // Fetch new page size for "All" works
  }
};

// Watch for search term changes to re-fetch "All" works if it's the current view
watch(workSearchTermOnPage, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    worksPagination.current = 1; // Reset to first page on new search
    if (selectedCategory.value && selectedCategory.value.key === ALL_WORKS_KEY) {
      debouncedFetchAllWorksForPageDisplay();
    } else if (selectedCategory.value && selectedCategory.value.key !== ALL_WORKS_KEY) {
      debouncedFetchWorksForSelectedCategory();
    }
  }
});

// Watch for work type filter changes
watch(selectedWorkType, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    debouncedFetchMainPageWorks();
  }
});

// Watch for creator filter changes
watch(selectedCreatorId, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    debouncedFetchMainPageWorks();
  }
});

const debouncedFetchAllWorksForPageDisplay = debounce(() => {
    if (selectedCategory.value && selectedCategory.value.key === ALL_WORKS_KEY) {
        fetchAllWorksForPageDisplay();
    }
}, 300);

const debouncedFetchWorksForSelectedCategory = debounce(() => {
    if (selectedCategory.value && selectedCategory.value.key !== ALL_WORKS_KEY) {
        fetchWorksForCategory(selectedCategory.value._id, worksPagination.current, worksPagination.pageSize);
    }
}, 300);

// Pagination handlers for the modal
const handleModalWorksPageChange = (page) => {
  addWorksModalPagination.current = page;
  fetchAllWorksForModal();
};

const handleModalWorksPageSizeChange = (pageSize) => {
  addWorksModalPagination.pageSize = pageSize;
  addWorksModalPagination.current = 1; 
  fetchAllWorksForModal();
};

// Watchers for modal filters
watch(allWorksSearchTermInModal, () => { 
    debouncedFetchAllWorksForModal();
});
watch(addWorksModalSelectedType, () => { 
    addWorksModalPagination.current = 1;
    fetchAllWorksForModal();
});
watch(addWorksModalSelectedCreatorId, () => { 
    addWorksModalPagination.current = 1;
    fetchAllWorksForModal();
});
watch(addWorksModalSelectedTags, () => {
    addWorksModalPagination.current = 1;
    fetchAllWorksForModal();
});

// Computed property for tag select options
const tagOptionsForSelect = computed(() => 
  predefinedTagsList.value.map(tag => ({ label: tag.name, value: tag.name }))
);

// Define the new debounced function for main page filter changes
const debouncedFetchMainPageWorks = debounce(() => {
  worksPagination.current = 1; // Reset to first page
  if (selectedCategory.value && selectedCategory.value.key === ALL_WORKS_KEY) {
    fetchAllWorksForPageDisplay();
  } else if (selectedCategory.value && selectedCategory.value._id && selectedCategory.value.key !== ALL_WORKS_KEY) {
    fetchWorksForCategory(selectedCategory.value._id, worksPagination.current, worksPagination.pageSize);
  }
}, 300);

</script>

<style scoped>

.page-content-layout .arco-layout-sider-children {
    overflow-y: auto; 
    overflow-x: hidden;
}

.category-tree :deep(.arco-tree-node-title) {
    position: relative;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
}

/* Style for the text span within the tree node title */
.category-tree :deep(.arco-tree-node-title .category-node-text) {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-right: 65px;
    box-sizing: border-box;
    line-height: 32px;
}

.category-tree .category-actions {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  z-index: 10;
}

.category-tree .category-actions .arco-btn {
    margin-left: 2px;
}
.category-tree .category-actions .arco-btn:first-child {
    margin-left: 0;
}

.category-tree :deep(.arco-tree-node-title:hover) .category-actions {
  display: flex;
  align-items: center;
}

.works-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); 
    gap: 20px;
}

.ghost {
  opacity: 0.4;
  background: #e6f7ff;
  border: 1px dashed #91d5ff;
}

.custom-transfer :deep(.arco-transfer-list) {
    width: calc(50% - 12px); 
    height: 55vh;
}
.custom-transfer :deep(.arco-transfer-list-content) {
    height: calc(100% - 40px); 
}

.modal-works-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); 
    gap: 24px;
}

.work-card-wrapper-modal {
    display: flex;
    flex-direction: column;
}

.modal-work-item-card {
  margin-bottom: 0;
}

/* Remove or adjust styles related to the old #actions slot if they are no longer needed or causing issues */
.add-works-to-category-modal :deep(.arco-card-actions) {
    /* display: none; */
}
/* .add-works-to-category-modal :deep(.arco-card-actions > *) {} */
/* .add-works-to-category-modal :deep(.arco-card-actions .arco-btn) {} */

/* Hide the default drag icon if not needed and causing layout issues */
.category-tree :deep(.arco-tree-node-drag-icon) {
    display: none !important; /* Use !important if necessary to override Arco's default styles */
}

.category-tree .category-actions {
  display: flex; /* Use flex to layout buttons nicely, or inline-flex */
  align-items: center;
}

</style> 