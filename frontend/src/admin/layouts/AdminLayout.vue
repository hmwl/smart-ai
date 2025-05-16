<template>
  <a-layout class="admin-layout" style="min-height: 100vh;">
    <a-layout-sider
      breakpoint="lg"
      collapsible
      :collapsed="isCollapsed"
      @collapse="onCollapse"
      :width="220"
    >
      <div class="logo" />
      <a-menu
        v-model:selected-keys="activeMenuKeys"
        v-model:open-keys="currentOpenKeys"
        style="width: 100%;"
        @menu-item-click="onClickMenuItem"
        :level-indent="34"
      >
        <a-menu-item key="user-management">
          <template #icon><icon-user /></template>
          用户管理
        </a-menu-item>
        
        <!-- AI Management Sub-menu -->
        <a-sub-menu key="ai-management-group">
            <template #icon><icon-robot /></template>
            <template #title>AI 管理</template>
            <a-menu-item key="api-management">
                <template #icon><icon-link /></template>
                API 管理
            </a-menu-item>
            <a-menu-item key="ai-type-management">
                <template #icon><icon-tag /></template>
                AI 类型管理
            </a-menu-item>
            <a-menu-item key="ai-app-management">
                <template #icon><icon-code-square /></template>
                AI 应用管理
            </a-menu-item>
        </a-sub-menu>

        <!-- Works Management Sub-menu -->
        <a-sub-menu key="works-management-group">
            <template #icon><icon-book /></template>
            <template #title>作品管理</template>
            <a-menu-item key="inspiration-market">
                <template #icon><icon-bulb /></template>
                灵感市场
            </a-menu-item>
            <a-menu-item key="all-works">
                <template #icon><icon-select-all /></template>
                所有作品
            </a-menu-item>
        </a-sub-menu>

        <!-- Application Management Menu Item -->
        <a-menu-item key="application-management">
          <template #icon><icon-apps /></template>
          应用管理
        </a-menu-item>

        <!-- Credits Management Sub-menu -->
        <a-sub-menu key="credits-management-group">
            <template #icon><icon-gift /></template>
            <template #title>积分管理</template>
            <a-menu-item key="promotion-activity-management">
              <template #icon><icon-fire /></template>
              活动管理
            </a-menu-item>
            <a-menu-item key="credit-transactions">
              <template #icon><icon-list /></template>
              消费记录
            </a-menu-item>
            <a-menu-item key="credit-settings">
              <template #icon><icon-settings /></template>
              积分设置
            </a-menu-item>
        </a-sub-menu>
        
        <!-- Website Management Sub-menu (Restored) -->
        <a-sub-menu key="website-management">
            <template #icon><icon-desktop /></template> 
            <template #title>官网管理</template>
            <a-menu-item key="page-management">
                <template #icon><icon-file /></template>
                页面管理
            </a-menu-item>
            <a-menu-item key="menu-management">
                <template #icon><icon-menu /></template>
                菜单管理
            </a-menu-item>
            <a-menu-item key="template-management">
                 <template #icon><icon-brush /></template>
                 模板管理
            </a-menu-item>
        </a-sub-menu>
        
        <!-- <a-menu-item key="settings">
          <template #icon><icon-settings /></template>
          系统设置
        </a-menu-item> -->
      </a-menu>
       <!-- Sidebar footer for logout -->
      <div class="sidebar-footer">
        <a-button type="text" long @click="handleLogout">
          <template #icon><icon-poweroff /></template>
          <span v-if="!isCollapsed">退出登录</span>
        </a-button>
      </div>
    </a-layout-sider>
    <a-layout style="width: 100%; overflow-x: hidden; flex-grow: 1; padding: 20px 40px;">
      <a-layout-header style="padding-left: 20px; background: var(--color-bg-2); border-bottom: 1px solid var(--color-border);">
        <!-- Can add breadcrumbs or user info here -->
         <span class="text-lg font-semibold">后台管理系统</span>
      </a-layout-header>
      <a-layout-content class="p-4" style="overflow-y: auto; height: 0;">
        <router-view />
      </a-layout-content>
      <a-layout-footer style="text-align: center; font-size: 12px; color: var(--color-text-3);">
        Admin Panel &copy;{{ new Date().getFullYear() }}
      </a-layout-footer>
    </a-layout>
  </a-layout>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Message, Modal, Layout as ALayout, LayoutSider as ALayoutSider, LayoutHeader as ALayoutHeader, LayoutContent as ALayoutContent, LayoutFooter as ALayoutFooter, Menu as AMenu, MenuItem as AMenuItem, SubMenu as ASubMenu, Button as AButton } from '@arco-design/web-vue';
import {
  IconApps, IconUser, IconSettings, IconTool, IconFile, IconPoweroff, IconMenu, IconDesktop,
  IconBrush,
  IconLink,
  IconRobot,
  IconTag,
  IconCodeSquare,
  IconGift,
  IconFire,
  IconList,
  IconBook,
  IconBulb,
  IconSelectAll
} from '@arco-design/web-vue/es/icon';

const router = useRouter();
const route = useRoute();
const isCollapsed = ref(false);

// Ref to hold the menu's selected keys directly
const activeMenuKeys = ref([]);
// Ref to hold the currently open sub-menu keys
const currentOpenKeys = ref([]);

// Compute the target selected key based on current route name
const targetSelectedKey = computed(() => {
  const keyMap = {
      'UserManagement': 'user-management',
      'ApplicationManagement': 'application-management',
      'AiTypeManagement': 'ai-type-management',
      'AiManagement': 'ai-app-management',
      'PageManagement': 'page-management',
      'ArticleManagement': 'page-management',
      'MenuManagement': 'menu-management',
      'TemplateManagement': 'template-management',
      'ApiManagement': 'api-management',
      'CreditTransactionManagement': 'credit-transactions',
      'CreditSettingsManagement': 'credit-settings',
      'PromotionActivityManagement': 'promotion-activity-management',
      'InspirationMarket': 'inspiration-market',
      'AllWorks': 'all-works',
  };
  let selected = keyMap[route.name] || 'user-management';
  
  return selected;
});

// Watch the targetSelectedKey (derived from route) and update activeMenuKeys
watch(targetSelectedKey, (newKey) => {
  if (newKey && activeMenuKeys.value[0] !== newKey) {
    activeMenuKeys.value = [newKey];
  }

  const keysToOpen = [];
  if (['page-management', 'menu-management', 'template-management'].includes(newKey)) {
    keysToOpen.push('website-management');
  }
  if (['api-management', 'ai-type-management', 'ai-app-management'].includes(newKey)) {
      keysToOpen.push('ai-management-group');
  }
  if (['credit-transactions', 'credit-settings', 'promotion-activity-management'].includes(newKey)) {
      keysToOpen.push('credits-management-group');
  }
  if (['inspiration-market', 'all-works'].includes(newKey)) {
    keysToOpen.push('works-management-group');
  }

  if (JSON.stringify(keysToOpen.sort()) !== JSON.stringify(currentOpenKeys.value.sort())) {
      currentOpenKeys.value = keysToOpen;
  }

}, { immediate: true });

const onCollapse = (collapsed, type) => {
  isCollapsed.value = collapsed;
};

const onClickMenuItem = (key) => {
  // Map menu keys back to route names or paths
  const routeMap = {
    'user-management': { name: 'UserManagement' },
    'application-management': { name: 'ApplicationManagement' },
    'ai-type-management': { name: 'AiTypeManagement' },
    'ai-app-management': { name: 'AiManagement' },
    'page-management': { name: 'PageManagement' },
    'menu-management': { name: 'MenuManagement' },
    'template-management': { name: 'TemplateManagement' },
    'api-management': { name: 'ApiManagement' },
    'credit-transactions': { name: 'CreditTransactionManagement' },
    'credit-settings': { name: 'CreditSettingsManagement' },
    'promotion-activity-management': { name: 'PromotionActivityManagement' },
    'inspiration-market': { name: 'InspirationMarket' },
    'all-works': { name: 'AllWorks' },
  };
  if (routeMap[key]) {
    router.push(routeMap[key]);
  } else {
    console.warn('No route defined for menu key:', key);
  }
};

const handleLogout = () => {
    Modal.confirm({
        title: '确认退出',
        content: '您确定要退出登录吗？',
        onOk: () => {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('userInfo');
            Message.success('已成功退出登录');
            // Redirect to the root path. The main App component or router guards
            // should handle redirecting to the appropriate public/login page.
            window.location.href = '/'; // Force a full page reload to clear all state
            // Alternatively, use router.push('/') if router guards handle it:
            // router.push('/'); 
        },
    });
};

</script>

<style scoped>
.admin-layout .logo {
  height: 32px;
  margin: 12px 8px;
  background: rgba(255, 255, 255, 0.2);
  /* Add logo styling */
}

.admin-layout .arco-layout-sider .arco-layout-sider-children {
  display: flex;
  flex-direction: column;
}

.admin-layout .arco-menu {
 flex: 1;
 overflow-y: auto;
 overflow-x: hidden;
}

.sidebar-footer {
  padding: 10px;
  border-top: 1px solid var(--color-border-2);
  margin-top: auto;
}
.sidebar-footer .arco-btn-text {
  width: 100%;
  justify-content: center;
}

/* Adjust content padding if needed */
/* .arco-layout-content {
  padding: 24px;
} */
</style> 