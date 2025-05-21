<template>
  <!-- If admin is authenticated, show the main layout -->
  <AdminLayout v-if="isAdminAuthenticated" />

  <!-- Otherwise, show the login page -->
  <AdminLoginPage v-else @login-success="onAdminLoginSuccess" />
</template>

<script setup>
import { ref, onMounted } from 'vue';
// Removed Message import as logout is now in AdminLayout
// import { Message } from '@arco-design/web-vue';
import AdminLayout from './layouts/AdminLayout.vue'; // Corrected path: Use layouts/ directory
import AdminLoginPage from './views/AdminLoginPage.vue';
// Removed AdminPanel import
// import AdminPanel from './views/AdminPanel.vue';

const isAdminAuthenticated = ref(false);

const checkAdminAuth = () => {
  const token = localStorage.getItem('accessToken');
  const userInfoString = localStorage.getItem('userInfo');
  let isActuallyAdmin = false;

  if (token && userInfoString) {
    try {
      const userInfo = JSON.parse(userInfoString);
      if (userInfo && userInfo.isAdmin) {
        isActuallyAdmin = true;
      }
    } catch (e) {
      console.error("Error parsing user info from localStorage", e);
      // Clear invalid data if parsing fails
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userInfo');
    }
  }

  isAdminAuthenticated.value = isActuallyAdmin;

  // No need to log here, AdminLayout or LoginPage will render based on the ref
  // if (!isActuallyAdmin) {
  // }
};

// Logout button is now inside AdminLayout, so this function is no longer needed here
// const handleAdminLogout = () => {
//     localStorage.removeItem('accessToken');
//     localStorage.removeItem('refreshToken');
//     localStorage.removeItem('userInfo');
//     isAdminAuthenticated.value = false;
//     Message.success('已退出登录');
// };

const onAdminLoginSuccess = () => {
    // Simply re-check auth, which will cause the v-if to switch to AdminLayout
    checkAdminAuth();
};

onMounted(() => {
    checkAdminAuth();
});
</script> 

<style>
/* Global styles for the admin app can go here if needed */
body, #app {
  height: 100vh;
  margin: 0;
  overflow: hidden; /* Prevent body scroll when layout manages scrolling */
}
</style> 