<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">灵感市场</h2>
      <a-space>
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
             <a-alert v-if="selectedCategory && selectedCategory.key !== ALL_WORKS_KEY && worksOfSelectedCategory.length > 0" type="info" closable style="margin-bottom: 16px;">
                当前分类共 {{ worksOfSelectedCategory.length }} 个作品。您可以拖拽作品调整顺序。
             </a-alert>
             <a-alert v-else-if="selectedCategory && selectedCategory.key === ALL_WORKS_KEY && allWorksForPageDisplay.length > 0" type="info" closable style="margin-bottom: 16px;">
                共 {{ allWorksForPageDisplay.length }} 个作品。
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
      <a-input-search 
        placeholder="搜索所有作品标题、ID、标签..." 
        v-model="allWorksSearchTermInModal" 
        @input="debouncedFetchAllWorksForModal" 
        @clear="fetchAllWorksForModal" 
        style="margin-bottom: 16px; width: 300px;"
        allow-clear
      />
      <a-spin :loading="allWorksLoading" style="width:100%; min-height: 200px;"> 
        <div v-if="filteredAllWorksForModal.length > 0" class="works-grid modal-works-grid">
          <div v-for="work in filteredAllWorksForModal" :key="work._id" class="work-card-wrapper-modal">
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
        <a-empty v-else-if="!allWorksLoading && allWorksForModal.length === 0" description="没有可供选择的作品。请先在'所有作品'页面添加作品。" style="margin-top: 20px;"/>
        <a-empty v-else-if="!allWorksLoading && filteredAllWorksForModal.length === 0 && allWorksSearchTermInModal" description="没有匹配搜索条件的作品。" style="margin-top: 20px;"/>
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
    InputSearch as AInputSearch, Transfer as ATransfer
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

const filteredAllWorksForModal = computed(() => {
  if (!allWorksSearchTermInModal.value) {
    return allWorksForModal.value;
  }
  const searchTerm = allWorksSearchTermInModal.value.toLowerCase();
  return allWorksForModal.value.filter(work => {
    return (
      (work.title && work.title.toLowerCase().includes(searchTerm)) ||
      (work._id && work._id.toLowerCase().includes(searchTerm)) ||
      (work.tags && work.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
    );
  });
});

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
    let aggregatedWorks = [];
    try {
        if (categories.value.length > 0) {
            const categoryWorkPromises = categories.value.map(cat =>
                apiService.getInspirationCategoryById(cat._id)
                    .then(response => response.data.works || [])
                    .catch(err => {
                        console.error(`Failed to fetch works for category ${cat._id}:`, err);
                        return [];
                    })
            );
            const results = await Promise.all(categoryWorkPromises);
            results.forEach(workList => {
                if (Array.isArray(workList)) {
                    aggregatedWorks.push(...workList);
                }
            });
        }
        const uniqueWorksMap = new Map();
        aggregatedWorks.forEach(work => {
            if (work && work._id) { 
                 uniqueWorksMap.set(work._id, work);
            }
        });
        allWorksForPageDisplay.value = Array.from(uniqueWorksMap.values());
        totalWorksCount.value = allWorksForPageDisplay.value.length;
    } catch (error) {
        // Message.error already handled by apiService interceptor for most cases
        allWorksForPageDisplay.value = [];
        totalWorksCount.value = 0; 
    } finally {
        worksLoading.value = false;
    }
};

const fetchWorksForCategory = async (categoryId) => {
    if (!categoryId || categoryId === ALL_WORKS_KEY) {
        if (categoryId === ALL_WORKS_KEY) await fetchAllWorksForPageDisplay();
        else worksOfSelectedCategory.value = [];
        return;
    }
    worksLoading.value = true;
    try {
        const response = await apiService.getInspirationCategoryById(categoryId);
        const categoryData = response.data;
        const foundCategoryInList = categories.value.find(c => c._id === categoryId);
        if (foundCategoryInList) {
             selectedCategory.value = { ...foundCategoryInList, ...categoryData, key: categoryId, name: categoryData.name };
        } else {
             selectedCategory.value = { ...categoryData, key: categoryId };
        }
        worksOfSelectedCategory.value = categoryData.works || [];
        const catInList = categories.value.find(c => c._id === categoryId);
        if (catInList) catInList.workCount = worksOfSelectedCategory.value.length;
    } catch (error) {
        // Message.error already handled by apiService interceptor for most cases
        worksOfSelectedCategory.value = [];
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

onMounted(() => { fetchCategories(false); });

watch(selectedCategoryKeys, async (newKeys) => {
    if (newKeys && newKeys.length > 0) {
        const keyToSelect = newKeys[0];
        if (keyToSelect === ALL_WORKS_KEY) {
            const allNode = treeData.value.find(n => n.key === ALL_WORKS_KEY);
            selectedCategory.value = allNode ? { ...allNode, _id: ALL_WORKS_KEY, name: allNode.title } : { key: ALL_WORKS_KEY, _id: ALL_WORKS_KEY, name: '全部' };
            await fetchAllWorksForPageDisplay();
            worksOfSelectedCategory.value = [];
        } else {
            const categoryToSelect = categories.value.find(c => c._id === keyToSelect);
            if(categoryToSelect) {
                 selectedCategory.value = { ...categoryToSelect, key: categoryToSelect._id };
                 fetchWorksForCategory(keyToSelect);
                 allWorksForPageDisplay.value = [];
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
    currentCategoryWorkIds.value = worksOfSelectedCategory.value.map(w => w._id);
    allWorksSearchTermInModal.value = ''; 
    await fetchAllWorksForModal(); 
    showAddWorksToCategoryModal.value = true;
};

const fetchAllWorksForModal = async () => {
    allWorksLoading.value = true;
    try {
        const params = { limit: 1000 };
        const response = await apiService.getWorks(params);
        allWorksForModal.value = Array.isArray(response.data?.works) ? response.data.works : [];
    } catch (error) { /* Handled by interceptor */ 
        allWorksForModal.value = [];
    } finally {
        allWorksLoading.value = false;
    }
};
const debouncedFetchAllWorksForModal = debounce(() => { fetchAllWorksForModal(); }, 300);

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
        await fetchWorksForCategory(selectedCategory.value._id);
        if (selectedCategoryKeys.value[0] === ALL_WORKS_KEY) await fetchAllWorksForPageDisplay();
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