<template>
  <div class="client-layout">
    <header class="client-header">
      <div class="header-left">
        <router-link to="/" class="logo">APP LOGO</router-link>
        <nav class="main-nav">
          <router-link to="/inspiration" class="nav-item">灵感市场</router-link>
          <router-link to="/ai-applications" class="nav-item">AI 应用</router-link>
          <router-link to="/creation-history" class="nav-item">创作历史</router-link>
        </nav>
      </div>

      <div class="header-right">
        <span v-if="userData">积分：{{ userData.creditsBalance ?? 'N/A' }}</span>
        <span v-else>积分：加载中...</span>

        <a-dropdown @select="handleDropdownSelect" trigger="click">
          <div class="user-profile-trigger" v-if="userData">
            <a-avatar :size="32" shape="circle" style="margin-right: 8px; background-color: #165dff;">
              {{ userData.nickname ? userData.nickname.charAt(0).toUpperCase() : (userData.username ? userData.username.charAt(0).toUpperCase() : 'U') }}
            </a-avatar>
            <span class="nickname">{{ userData.nickname || userData.username }}</span>
            <icon-down />
          </div>
          <div v-else class="user-profile-trigger">
             <a-avatar :size="32" shape="circle" style="margin-right: 8px;"><icon-user /></a-avatar>
             <span>验证身份...</span>
          </div>
          <template #content>
            <a-doption value="account-info">
              <template #icon><icon-settings /></template>
              账号信息
            </a-doption>
            <a-doption value="top-up">
              <template #icon><icon-gift /></template>
              充值
            </a-doption>
            <a-doption value="credit-transactions" @click="navigateToPath('/credit-transactions')">
              <template #icon><icon-unordered-list /></template>
              消费记录
            </a-doption>
            <a-doption value="logout">
              <template #icon><icon-export /></template>
              退出登录
            </a-doption>
          </template>
        </a-dropdown>
      </div>
    </header>
    <main class="client-main-content">
      <router-view />
    </main>

    <!-- 账户信息弹窗 -->
    <account-info-modal
      v-model:visible="accountInfoModalVisible"
      :user-data="userData"
      @update:user-data="userData = $event"
    />

    <!-- 充值弹窗 -->
    <top-up-modal
      v-model:visible="topUpModalVisible"
      :user-data="userData"
      @update:user-data="userData = $event"
      @top-up-success="handleTopUpSuccess"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '../services/apiService';
import {
  Avatar as AAvatar,
  Dropdown as ADropdown,
  Tag as ATag,
  Divider as ADivider,
  Message,
  Modal
} from '@arco-design/web-vue';
import {
  IconDown,
  IconUser,
  IconGift,
  IconInfoCircle,
  IconSettings,
  IconExport,
  IconUnorderedList
} from '@arco-design/web-vue/es/icon';
import { router } from '../router'; // Assuming router is exported from here
import AccountInfoModal from '../components/AccountInfoModal.vue'; // 使用专门的账户信息弹窗组件
import TopUpModal from '../components/TopUpModal.vue'; // 使用专门的充值弹窗组件

const userData = ref(null);
const accountInfoModalVisible = ref(false);
const topUpModalVisible = ref(false);

const fetchCurrentUserData = async () => {
  try {
    const response = await apiClient.get('/auth/me');
    userData.value = response.data;
  } catch (error) {
    console.error('Failed to fetch user data for layout:', error);
    // Optional: Message.error('无法加载用户信息');
  }
};

const logout = () => {
  localStorage.removeItem('clientAccessToken');
  localStorage.removeItem('clientUserInfo');
  userData.value = null;
  router.push({ name: 'ClientLogin' });
};

const handleDropdownSelect = (value) => {
  switch (value) {
    case 'account-info':
      // 显示账户信息弹窗，而不是导航到页面
      accountInfoModalVisible.value = true;
      break;
    case 'top-up':
      // 显示充值弹窗
      topUpModalVisible.value = true;
      break;
    case 'logout':
      performLogout();
      break;
    default:
      // console.log('Dropdown item selected with no specific action:', value);
      break;
  }
};

const navigateToPath = (path) => {
  router.push({ path: path });
};

const performLogout = () => {
  Modal.confirm({
    title: '确认退出登录',
    content: '您确定要退出当前账号吗？',
    okText: '确定退出',
    cancelText: '取消',
    onOk: () => {
      logout();
    },
    onCancel: () => {
      // Optional: Message.info('已取消退出');
    }
  });
};

// 处理充值成功事件
const handleTopUpSuccess = (data) => {
  // 刷新用户数据
  fetchCurrentUserData();
};

onMounted(() => {
  fetchCurrentUserData();
});
</script>

<style scoped>
.client-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--custom-bg-primary);
}

.client-header {
  background-color: var(--custom-bg-secondary);
  padding: 0 24px;
  height: 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.header-left {
  display: flex;
  align-items: center;
}

.logo {
  font-size: 1.4rem;
  font-weight: bold;
  color: #fff;
  text-decoration: none;
  margin-right: 30px;
}

.main-nav {
  display: flex;
  gap: 20px;
}

.nav-item {
  text-decoration: none;
  color: rgba(255, 255, 255, 0.7);
  padding: 8px 12px;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.nav-item:hover {
  color: #fff;
  background-color: rgba(255, 255, 255, 0.1);
}

.nav-item.router-link-exact-active {
  color: var(--custom-accent-color);
  font-weight: 600;
  background-color: rgba(255, 255, 255, 0.1);
}

.header-right {
  display: flex;
  align-items: center;
  color: #fff;
  gap: 16px;
}

.user-profile-trigger {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: background-color 0.3s ease;
  color: #fff;
}

.user-profile-trigger:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.user-profile-trigger .nickname {
  margin-left: 8px;
  margin-right: 4px;
  font-weight: 500;
}

.client-main-content {
  flex-grow: 1;
}

:deep(.arco-dropdown-option-icon) {
  margin-right: 8px;
}
</style>