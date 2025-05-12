<template>
  <div>
    <!-- Page Title Header -->
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">菜单管理</h2>
      <!-- Optional: Add any top-level global action buttons here if needed later -->
    </div>

    <!-- Main Layout with Sidebar and Content -->
    <a-layout class="menu-management-layout">
      <!-- Left Sider for Menu List -->
      <a-layout-sider class="p-4 sider-fixed-height !shadow-none border-r !border-gray-200" :width="200">
        <a-list v-if="menuList.length > 0" :bordered="false" class="menu-selection-list">
          <a-list-item 
            v-for="menu in menuList" 
            :key="menu._id" 
            @click="selectMenu(menu._id)"
            class="cursor-pointer hover:bg-gray-100 p-2 rounded"
            :class="{ 'bg-blue-100 text-blue-700 font-semibold': selectedMenuId === menu._id }"
          >
            {{ menu.name }} <span class="text-xs text-gray-500">({{ menu.location }})</span>
          </a-list-item>
        </a-list>
        <div v-else-if="!isListLoading" class="text-center text-gray-400 py-5">
          没有可用的菜单。
        </div>
         <a-spin v-if="isListLoading" tip="加载菜单列表..." />
      </a-layout-sider>

      <!-- Right Content Area for Menu Editor -->
      <a-layout-content class="p-4 content-fixed-height">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold">
            {{ selectedMenuId ? `【${menuList.find(m => m._id === selectedMenuId)?.name || '请选择菜单'}】` : '请从左侧选择一个菜单' }}
          </h3>
          <a-space>
            <a-button type="primary" @click="addItem(currentMenuItems)" :disabled="!selectedMenuId">
              <template #icon><icon-plus /></template> 添加顶级项
            </a-button>
            <a-button @click="saveMenu" :loading="isSaving" :disabled="!selectedMenuId || !isDirty">
              <template #icon><icon-save /></template> 保存当前菜单
            </a-button>
            <a-button @click="fetchMenuList" :loading="isListLoading">
              <template #icon><icon-refresh /></template> 刷新
            </a-button>
          </a-space>
        </div>

        <a-spin :loading="isLoadingDetails" tip="加载菜单项中..." class="w-full">
          <div v-if="!selectedMenuId && !isLoadingDetails" class="text-center text-gray-500 p-10">
            请从左侧选择一个菜单进行编辑。
          </div>
          
          <div v-else-if="selectedMenuId && currentMenuItems.length === 0 && !isLoadingDetails" class="text-center text-gray-500 p-10">
            此菜单当前没有条目。点击 "添加顶级项" 开始。
          </div>

          <div v-else-if="selectedMenuId" class="menu-editor-container p-4 rounded">
             <a-tree
                :data="currentMenuItems"
                :draggable="true"
                :field-names="{ key: '_frontend_id', title: 'title', children: 'children' }" 
                :allow-drop="handleAllowDrop" 
                @drop="onDrop"
                block-node 
                default-expand-all 
                class="menu-tree" 
             >
                <template #extra="nodeData"> 
                   <a-space class="item-actions" size="mini">
                      <span class="item-type">({{ nodeData.type }})</span>
                      <a-tooltip content="编辑">
                         <a-button shape="circle" size="mini" @click="editItem(nodeData)"><icon-edit /></a-button>
                      </a-tooltip>
                      <a-tooltip content="删除">
                         <a-button shape="circle" size="mini" status="danger" @click="deleteTreeNode(nodeData)"><icon-delete /></a-button>
                      </a-tooltip>
                       <a-tooltip content="添加子项" v-if="nodeData.type === 'submenu'">
                          <a-button shape="circle" size="mini" type="primary" status="success" @click="addItem(nodeData.children)"><icon-plus /></a-button> 
                       </a-tooltip>
                   </a-space>
                </template>
                 <template #title="nodeData">
                     <span v-if="nodeData.type === 'divider'" class="divider-title">------</span>
                     <span v-else>{{ nodeData.title }}</span>
                 </template>
             </a-tree>
          </div>
        </a-spin>
      </a-layout-content>
    </a-layout>
     <!-- Modal remains the same -->
    <a-modal 
      v-model:visible="itemModalVisible" 
      :title="isEditItemMode ? '编辑菜单项' : '添加菜单项'" 
      @ok="handleItemSubmit" 
      @cancel="handleItemCancel" 
      :mask-closable="false"
      unmount-on-close
    >
      <a-form ref="itemFormRef" :model="itemForm" layout="vertical">
           <a-form-item field="type" label="类型" :rules="[{ required: true, message: '请选择类型' }]">
              <a-select v-model="itemForm.type" placeholder="选择菜单项类型">
                  <a-option value="page">内部页面</a-option>
                  <a-option value="external">外部链接</a-option>
                  <a-option value="submenu">子菜单容器</a-option>
                  <a-option value="divider">分割线</a-option>
              </a-select>
          </a-form-item>
          <a-form-item field="pageId" label="链接到页面" v-if="itemForm.type === 'page'" :rules="[{ required: true, message: '请选择一个页面' }]">
              <a-select v-model="itemForm.pageId" placeholder="选择一个已创建的页面" :loading="isPagesLoading" allow-search>
                  <a-option v-for="page in availablePages" :key="page._id" :value="page._id" :label="`${page.name} (${page.route || '未设置路由'})`"></a-option>
              </a-select>
          </a-form-item>
          <a-form-item field="url" label="外部 URL" v-if="itemForm.type === 'external'" :rules="[{ required: true, message: '请输入有效的 URL' }, { type: 'url', message: '请输入有效的 URL' }]">
              <a-input v-model="itemForm.url" placeholder="例如: https://example.com" />
          </a-form-item>
          <a-form-item field="title" label="标题" :rules="[{ required: true, message: '请输入标题' }]" v-if="itemForm.type !== 'divider'">
              <a-input v-model="itemForm.title" placeholder="菜单项显示的文本" />
          </a-form-item>
      </a-form>
   </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import { 
    Message, Modal, Spin as ASpin, Button as AButton, Select as ASelect, 
    Option as AOption, Space as ASpace, Form as AForm, FormItem as AFormItem, 
    Input as AInput, Tree as ATree, Tooltip as ATooltip,
    Layout as ALayout, LayoutSider as ALayoutSider, LayoutContent as ALayoutContent,
    List as AList, ListItem as AListItem
} from '@arco-design/web-vue';
import { IconPlus, IconSave, IconRefresh, IconEdit, IconDelete } from '@arco-design/web-vue/es/icon';
import { v4 as uuidv4 } from 'uuid';
// Sortable is not directly used with a-tree's draggable, can be removed if not used elsewhere.
// import { Sortable } from 'sortablejs-vue3'; 

const menuList = ref([]);
const selectedMenuId = ref(null);
const currentMenuItems = ref([]);
const originalMenuItemsJson = ref(''); // To track changes for isDirty
const isListLoading = ref(false);    // For menu list in sider
const isLoadingDetails = ref(false); // For menu items tree in content
const isSaving = ref(false);         // For "Save Current Menu" button
const isDirty = ref(false);          // Tracks if current menu items have changed

const itemModalVisible = ref(false);
const currentEditItem = ref(null);   // Stores the original reference to the item being edited in the tree
const isEditItemMode = ref(false);
const itemFormRef = ref(null);
const itemForm = ref({});            // Form model for adding/editing individual menu items
const targetItemsArray = ref(null);  // Ref to the array where a new item should be pushed (top-level or a submenu's children)

const availablePages = ref([]);      // For linking menu items to pages
const isPagesLoading = ref(false);   // Loading state for available pages select

// --- New function to handle menu selection from sidebar ---
const selectMenu = (menuId) => {
  if (selectedMenuId.value === menuId) return; // Do nothing if already selected

  if (isDirty.value) {
    Modal.confirm({
      title: '未保存的更改',
      content: '当前菜单有未保存的更改。切换菜单将会丢失这些更改。确定要切换吗？',
      okText: '确定切换',
      cancelText: '取消',
      onOk: () => {
        selectedMenuId.value = menuId;
        fetchMenuDetails(); // fetchMenuDetails will reset isDirty
      },
      onCancel: () => {
        // User cancelled, do nothing, keep current selection
      }
    });
  } else {
    selectedMenuId.value = menuId;
    fetchMenuDetails();
  }
};

const loop = (data, key, callback) => {
  data.some((item, index, arr) => {
    if (item._frontend_id === key) {
      callback(item, index, arr);
      return true;
    }
    if (item.children) {
      return loop(item.children, key, callback);
    }
    return false;
  });
};

const handleAllowDrop = ({ dropNode, dropPosition }) => {
  if (dropNode.type !== 'submenu' && dropPosition === 0) {
    return false; // Prevent dropping non-submenu items as children of other items directly
  }
  return true;
};

const onDrop = ({ dragNode, dropNode, dropPosition }) => {
    const data = currentMenuItems.value;
    const dragKey = dragNode._frontend_id;
    const dropKey = dropNode._frontend_id;
    const draggedItemData = dragNode.dataRef || dragNode; // dataRef holds the actual node data

    // Remove the item from its original position
    let foundAndRemoved = false;
    loop(data, dragKey, (item, index, arr) => {
        arr.splice(index, 1);
        foundAndRemoved = true;
    });

    if (!foundAndRemoved) {
        console.error("Drop Error: Dragged item not found in source.");
        Message.error("拖拽失败：无法找到原始项目");
        // Potentially re-fetch or revert state if this happens
        return;
    }

    // Insert the item into its new position
    let foundDropTarget = false;
    if (dropPosition === 0) { // Dropped onto a node to become its child
        loop(data, dropKey, (item) => {
            item.children = item.children || [];
            // Ensure it's added to the correct target, especially if dropNode itself can't have children
            if (item.type === 'submenu') { 
                item.children.unshift(draggedItemData); // Add to the beginning of children
                foundDropTarget = true;
            } else {
                // If trying to drop onto a non-submenu item as a child, this is disallowed by handleAllowDrop
                // or should be handled by inserting it near the dropNode at the same level.
                // For simplicity, let's assume handleAllowDrop prevents invalid nesting.
                // If somehow it gets here, could re-insert at root or based on dropNode's parent.
                 Message.warning(`无法将项目作为子项添加到 "${item.title}" (类型: ${item.type})`);
                 // Re-add to root as a fallback if drop onto non-submenu as child was attempted and slipped through
                 data.push(draggedItemData); // Or a more specific recovery
                 foundDropTarget = true; // Mark as handled to avoid double add
            }
        });
    } else { // Dropped before or after a node (at the same level)
        loop(data, dropKey, (item, index, arr) => {
            arr.splice(dropPosition < 0 ? index : index + 1, 0, draggedItemData);
            foundDropTarget = true;
        });
    }

    if (foundDropTarget) {
         currentMenuItems.value = [...data]; // Trigger reactivity
         isDirty.value = true; // Mark as dirty
         Message.success('菜单顺序已调整');
    } else {
        // Fallback: if for some reason the drop target wasn't found in the loop 
        // (e.g. dropKey was not valid, or structure changed unexpectedly)
        // Add to the end of the root list.
        console.warn("Drop target node not identified in loop, adding to root end.");
        data.push(draggedItemData);
        currentMenuItems.value = [...data]; 
        isDirty.value = true; 
        Message.info('菜单项已移动到列表末尾');
    }
};


const addUniqueIds = (items) => {
  return items.map(item => ({
    ...item,
    _frontend_id: item._frontend_id || uuidv4(), // Preserve existing _frontend_id if re-editing
    children: item.children ? addUniqueIds(item.children) : []
  }));
};

const fetchMenuList = async () => {
  isListLoading.value = true;
  const accessToken = localStorage.getItem('accessToken');
  if (!accessToken) { Message.error('未认证'); isListLoading.value = false; return; }
  try {
    const response = await fetch('/api/menus', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error(`获取菜单列表失败: ${response.status}`);
    const data = await response.json();
    // Sort by createdAt in descending order
    if (Array.isArray(data)) { // Ensure data is an array before sorting
      data.sort((a, b) => {
        // Assuming createdAt exists and is a valid date string or number
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        // Handle cases where createdAt might be missing or invalid
        if (isNaN(dateA.getTime())) return 1; // Push items with invalid dateA to the end
        if (isNaN(dateB.getTime())) return -1; // Push items with invalid dateB to the end
        return dateB - dateA;
      });
    }
    menuList.value = data.map(menu => ({ ...menu, key: menu._id }));
    // If no menu is currently selected, or selected one is no longer in the list, select the first one
    if (menuList.value.length > 0 && 
        (!selectedMenuId.value || !menuList.value.find(m => m._id === selectedMenuId.value))) {
      // Do not automatically select if isDirty to prevent accidental data loss warning
      if (!isDirty.value) {
         selectMenu(menuList.value[0]._id);
      } else if (!selectedMenuId.value && menuList.value.length > 0) {
          // If nothing was selected and list is dirty (unlikely scenario), still select first
          // Or prompt user? For now, let's just select.
          selectMenu(menuList.value[0]._id);
      }
    } else if (menuList.value.length === 0) {
        selectedMenuId.value = null;
        currentMenuItems.value = [];
        originalMenuItemsJson.value = '[]';
        isDirty.value = false;
    }
  } catch (error) {
    Message.error(error.message);
    menuList.value = [];
  } finally {
    isListLoading.value = false;
  }
};

const fetchMenuDetails = async () => {
  // This function is now called by selectMenu, which handles the isDirty check
  if (!selectedMenuId.value) {
    currentMenuItems.value = [];
    originalMenuItemsJson.value = '[]';
    isDirty.value = false;
    return;
  }
  isLoadingDetails.value = true;
  // isDirty is reset here because we are loading new data
  isDirty.value = false; 
  const accessToken = localStorage.getItem('accessToken');
  if (!accessToken) { Message.error('未认证'); isLoadingDetails.value = false; return; }
  try {
    const response = await fetch(`/api/menus/${selectedMenuId.value}`, {
       headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error(`获取菜单详情失败: ${response.status}`);
    const menuData = await response.json();
    const itemsWithIds = addUniqueIds(menuData.items || []);
    currentMenuItems.value = itemsWithIds;
    // Store the original structure (without _frontend_id) for dirty checking
    originalMenuItemsJson.value = JSON.stringify(stripFrontendIds(itemsWithIds)); 
  } catch (error) {
    Message.error(error.message);
    currentMenuItems.value = [];
    originalMenuItemsJson.value = '[]';
  } finally {
    isLoadingDetails.value = false;
  }
};


// Helper to strip _frontend_id before saving to backend or comparing for dirtiness
const stripFrontendIds = (items) => {
    return items.map(item => {
        const { _frontend_id, children, ...rest } = item; // Destructure to remove _frontend_id
        const strippedItem = { ...rest };
        if (children && children.length > 0) {
            strippedItem.children = stripFrontendIds(children);
        }
        return strippedItem;
    });
};

// Watch for changes in currentMenuItems to set isDirty flag
// This needs to compare against the original structure *after* stripping _frontend_id from current
watch(currentMenuItems, (newValue) => {
    if (isLoadingDetails.value || isSaving.value) return; // Don't mark dirty during load/save operations
    
    const currentJson = JSON.stringify(stripFrontendIds(newValue));
    if (currentJson !== originalMenuItemsJson.value) {
        isDirty.value = true;
    } else {
        isDirty.value = false; // Can also become clean if reverted
    }
}, { deep: true });


const saveMenu = async () => {
  if (!selectedMenuId.value || !isDirty.value) {
      if (!selectedMenuId.value) Message.warning('请先选择一个菜单。');
      else if (!isDirty.value) Message.info('当前菜单没有未保存的更改。');
      return;
  }
  isSaving.value = true;
  const accessToken = localStorage.getItem('accessToken');
  if (!accessToken) { Message.error('未认证'); isSaving.value = false; return; }
  
  const currentMenuMeta = menuList.value.find(m => m._id === selectedMenuId.value);
  if (!currentMenuMeta) {
      Message.error('无法找到当前菜单的元信息 (名称/位置)');
      isSaving.value = false;
      return;
  }

  try {
    const payload = {
        name: currentMenuMeta.name,         // Send current name
        location: currentMenuMeta.location, // Send current location
        items: stripFrontendIds(currentMenuItems.value) // Send processed items
    };
    const response = await fetch(`/api/menus/${selectedMenuId.value}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '无法解析错误信息' }));
        throw new Error(`保存菜单失败: ${response.status} - ${errorData.message || '未知错误'}`);
    }
    const updatedMenuFromServer = await response.json();
    // Update originalMenuItemsJson to the new saved state to reset isDirty
    const itemsWithIds = addUniqueIds(updatedMenuFromServer.items || []);
    currentMenuItems.value = itemsWithIds; // Re-assign to ensure tree updates if backend changes structure
    originalMenuItemsJson.value = JSON.stringify(stripFrontendIds(itemsWithIds));
    isDirty.value = false; // Reset dirty flag
    Message.success('菜单保存成功！');
  } catch (error) {
    Message.error(error.message);
  } finally {
    isSaving.value = false;
  }
};

const fetchAvailablePages = async () => {
    isPagesLoading.value = true;
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) { Message.error('未认证'); isPagesLoading.value = false; return; }
    try {
        const response = await fetch('/api/pages', { 
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) throw new Error(`获取页面列表失败: ${response.status}`);
        const pages = await response.json();
        availablePages.value = pages
                                .filter(p => p.type === 'single' || p.type === 'collection') // Only allow linking to actual pages
                                .map(p => ({ _id: p._id, name: p.name, route: p.route }));
    } catch (error) {
        Message.error(error.message);
        availablePages.value = [];
    } finally {
        isPagesLoading.value = false;
    }
};

const getInitialItemForm = () => ({ title: '', type: 'page', pageId: null, url: '' });

// addItem now needs to know which array to add to (top-level or a submenu's children)
const addItem = (targetArray) => { // targetArray is currentMenuItems or nodeData.children
    itemForm.value = getInitialItemForm();
    isEditItemMode.value = false;
    currentEditItem.value = null;
    // Store the actual array reference where the new item should be pushed
    targetItemsArray.value = targetArray; 
    itemModalVisible.value = true;
    itemFormRef.value?.clearValidate();
    fetchAvailablePages(); // Fetch pages when adding/editing a 'page' type item
};

const editItem = (itemData) => { // itemData is the node data from the tree
    // Create a deep copy for the form to prevent direct mutation of tree data before submit
    itemForm.value = { 
        _frontend_id: itemData._frontend_id, // Keep frontend_id for lookup
        title: itemData.title,
        type: itemData.type,
        pageId: itemData.pageId || null,
        url: itemData.url || '',
        // DO NOT include children here, children are managed by tree structure
    };
    isEditItemMode.value = true;
    
    // Find the original item in the tree to update its properties directly on submit
    let originalItemRef = null;
    loop(currentMenuItems.value, itemData._frontend_id, (item) => { originalItemRef = item; }); 
    currentEditItem.value = originalItemRef; 
    
    if (!currentEditItem.value) {
         console.error("无法找到编辑项的引用! Node data:", itemData);
         Message.error("编辑错误：无法定位原始菜单项");
         return;
    }

    itemModalVisible.value = true;
    itemFormRef.value?.clearValidate();
    if (itemData.type === 'page') { // Also fetch pages if editing a 'page' type
        fetchAvailablePages();
    }
};

const handleItemSubmit = async () => {
    const validationResult = await itemFormRef.value?.validate();
    if (validationResult) return;

    const formData = { ...itemForm.value };

    // Clean up formData based on type
    if (formData.type !== 'page') formData.pageId = null;
    if (formData.type !== 'external') formData.url = '';
    if (formData.type === 'divider') formData.title = '---'; // Standardize divider title

    if (isEditItemMode.value && currentEditItem.value) {
        // Update existing item's properties directly
        // Exclude _frontend_id from being overwritten if it's not in formData (it shouldn't be)
        const { _frontend_id, ...dataToAssign } = formData;
        Object.assign(currentEditItem.value, dataToAssign);

        // Ensure 'children' array exists if type is 'submenu' and it was changed to submenu
        if (currentEditItem.value.type === 'submenu' && !currentEditItem.value.children) {
            currentEditItem.value.children = [];
        } else if (currentEditItem.value.type !== 'submenu') {
            // If type changed from submenu to something else, remove children
            delete currentEditItem.value.children;
        }
        Message.success('菜单项更新成功');
    } else { // Adding a new item
        const newItem = {
            ...formData, // Includes title, type, pageId/url
            _frontend_id: uuidv4(), // New frontend ID
            ...(formData.type === 'submenu' && { children: [] }) // Add children array if submenu
        };
        delete newItem._id; // Ensure no backend _id is carried over if form was populated from an existing item

        if (targetItemsArray.value && Array.isArray(targetItemsArray.value)) {
            targetItemsArray.value.push(newItem);
        } else {
            console.error("添加错误：目标数组未设置或无效！");
            Message.error("添加菜单项失败");
            itemModalVisible.value = false;
            return;
        } 
        Message.success('菜单项添加成功');
    }
    // Trigger reactivity for the tree by re-assigning the root array
    currentMenuItems.value = [...currentMenuItems.value];
    isDirty.value = true; // Mark changes as dirty
    itemModalVisible.value = false;
};

const handleItemCancel = () => { itemModalVisible.value = false; };

const deleteTreeNode = (nodeToDelete) => {
    const keyToDelete = nodeToDelete._frontend_id;
    Modal.confirm({
        title: '确认删除',
        content: `确定要删除菜单项 \"${nodeToDelete.title}\" 吗？${nodeToDelete.children && nodeToDelete.children.length > 0 ? ' 其所有子项也将被删除！' : ''}`,
        okText: '确认删除',
        cancelText: '取消',
        okButtonProps: { status: 'danger' },
        onOk: () => {
            const data = currentMenuItems.value; // Operate on a mutable copy if necessary, but direct mutation followed by spread should be fine.
            let found = false;
            loop(data, keyToDelete, (item, index, arr) => {
                arr.splice(index, 1);
                found = true;
            });

            if (found) {
                 currentMenuItems.value = [...data]; // Trigger reactivity
                 isDirty.value = true; // Mark changes as dirty
                 Message.success(`菜单项 \"${nodeToDelete.title}\" 已删除`);
            } else {
                 // This should ideally not happen if nodeToDelete comes from the tree
                 console.error(`删除失败：未找到key ${keyToDelete}`);
                 Message.error('删除菜单项时出错');
            }
        }
    });
};

// --- Auto-select first menu on mount if available and no other selection logic applies ---
onMounted(() => {
  fetchMenuList(); // This will also attempt to select the first menu if conditions are met
  fetchAvailablePages(); // Fetch pages once on mount for the modal
});

</script>

<style scoped>
/* Add fixed height to sider and content if layout is direct child of a sized container */
.sider-fixed-height {
  height: calc(100vh - 160px); /* Adjust 160px based on parent padding and new header height */
  overflow-y: auto;
}
.content-fixed-height {
  height: calc(100vh - 160px); /* Adjust 160px based on parent padding and new header height */
  overflow-y: auto;
}

.menu-selection-list .arco-list-item.bg-blue-100 { 
    background-color: var(--color-primary-light-1); 
    color: var(--color-primary-light-7); 
}
.menu-editor-container {
    min-height: 300px; 
    background-color: var(--color-fill-1); 
}

:deep(.arco-tree-node-extra) {
    margin-left: auto; 
    padding-left: 10px;
    opacity: 0; 
    transition: opacity 0.2s;
    display: inline-flex; 
    align-items: center;
}
:deep(.arco-tree-node:hover .arco-tree-node-extra) {
    opacity: 1; 
}

.item-type {
    font-size: 0.8em;
    color: var(--color-text-3); 
    background-color: var(--color-fill-2); 
    padding: 1px 5px;
    border-radius: 3px;
    margin-right: 8px; 
}

.divider-title {
    color: var(--color-text-4); 
    font-style: italic;
}

.menu-tree :deep(.tree-node-dropover) > :deep(.arco-tree-node-title) {
  animation: blinkBg 0.4s 2;
}

@keyframes blinkBg {
  0% {
    background-color: transparent;
  }
  100% {
    background-color: var(--color-primary-light-1); 
  }
}
</style> 