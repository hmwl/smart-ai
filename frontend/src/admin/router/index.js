import { createRouter, createWebHashHistory } from 'vue-router';

// Import view components (We will create these files soon)
// import UserManagement from '../views/UserManagement.vue';
// import ApplicationManagement from '../views/ApplicationManagement.vue';
// import PageManagement from '../views/PageManagement.vue';

const routes = [
  { path: '', redirect: '/users' }, 
  {
    path: '/login',
    name: 'AdminLogin',
    component: () => import('../views/AdminLoginPage.vue'),
    meta: { title: '系统登录', requiresGuest: true }
  },
  {
    path: '/users',
    name: 'UserManagement',
    // component: UserManagement,
    component: () => import('../views/UserManagement.vue'),
    meta: { title: '用户管理' }
  },
  {
    path: '/applications',
    name: 'ApplicationManagement',
    // component: ApplicationManagement,
    component: () => import('../views/ApplicationManagement.vue'),
    meta: { title: '应用管理' }
  },
  {
    path: '/ai-types',
    name: 'AiTypeManagement',
    component: () => import('../views/AiTypeManagement.vue'),
    meta: { title: 'AI 类型管理' }
  },
  {
    path: '/ai-management',
    name: 'AiManagement',
    component: () => import('../views/AiManagement.vue'),
    meta: { title: 'AI 应用管理' }
  },
  {
    path: '/pages',
    name: 'PageManagement',
    // component: PageManagement,
    component: () => import('../views/PageManagement.vue'),
    meta: { title: '官网页面管理' }
  },
  {
    path: '/pages/:pageId/articles', 
      name: 'ArticleManagement',
    component: () => import('../views/ArticleManagement.vue'), 
    props: true, 
    meta: { title: '文章列表管理' } 
  },
  {
    path: '/menus',
    name: 'MenuManagement',
    component: () => import('../views/MenuManagement.vue'),
    meta: { title: '菜单管理' }
  },
  {
    path: '/templates',
    name: 'TemplateManagement',
    component: () => import('../views/TemplateManagement.vue'),
    meta: { title: '模板管理' }
  },
  {
    path: '/apis',
    name: 'ApiManagement',
    component: () => import('../views/ApiManagement.vue'),
    meta: { title: 'API 管理' }
  },
  {
    path: '/enum-configs',
    name: 'EnumConfigManagement',
    component: () => import('../views/EnumConfigManagement.vue'),
    meta: { title: '枚举配置管理', requiresAuth: true }
  },
  {
    path: '/credits',
    name: 'CreditTransactionManagement',
    component: () => import('../views/CreditsManagement.vue'),
    meta: { title: '消费记录' }
  },
  {
    path: '/credit-settings',
    name: 'CreditSettingsManagement',
    component: () => import('../views/CreditSettingsPage.vue'),
    meta: { title: '积分设置' }
  },
  {
    path: '/promotion-activities',
    name: 'ActivityManagement',
    component: () => import('../views/ActivityManagement.vue'),
    meta: { title: '优惠活动管理' }
  },
  // New Routes for Works Management
  {
    path: '/inspiration-market',
    name: 'InspirationMarket',
    component: () => import('../views/InspirationMarketPage.vue'), // To be created
    meta: { title: '灵感市场', requiresAuth: true } // Assuming requiresAuth for admin pages
  },
  {
    path: '/all-works',
    name: 'AllWorks',
    component: () => import('../views/AllWorksPage.vue'), // To be created
    meta: { title: '所有作品', requiresAuth: true } // Assuming requiresAuth
  },
  {
    path: '/ai-widgets',
    name: 'AIWidgetManagement',
    component: () => import('../views/AiWidgetManagement.vue'),
    meta: { title: 'AI挂件管理', requiresAuth: true }
  },
  {
    path: '/announcements',
    name: 'AnnounceManagement',
    component: () => import('../views/AnnounceManagement.vue'),
    meta: { title: '公告管理', requiresAuth: true }
  },
  {
    path: '/permissions',
    name: 'PermissionManagement',
    component: () => import('../views/PermissionManagementComplete.vue'),
    meta: { title: '权限设置', requiresAuth: true }
  },
  {
    path: '/permission-test',
    name: 'PermissionTest',
    component: () => import('../views/PermissionTest.vue'),
    meta: { title: '权限测试', requiresAuth: true }
  },
  {
    path: '/user-role-test',
    name: 'UserRoleTest',
    component: () => import('../views/UserRoleTest.vue'),
    meta: { title: '用户角色测试', requiresAuth: true }
  },
  {
    path: '/other-settings',
    name: 'OtherSettings',
    component: () => import('../views/OtherSettings.vue'),
    meta: { title: '其他设置', requiresAuth: true }
  },
  // Add a catch-all or 404 route if needed
  // { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFoundComponent }
];

const router = createRouter({
  // Use Hash history because the entry is index.html
  history: createWebHashHistory(), 
  routes,
});

// Optional: Add navigation guards (e.g., for authentication) if needed later
// router.beforeEach((to, from, next) => { ... });

// Add navigation guard to check authentication state
router.beforeEach((to, from, next) => {
  // Check if the route requires authentication
  if (to.matched.some(record => record.meta.requiresAuth)) {
    // Check if user is authenticated (token exists)
    const token = localStorage.getItem('accessToken');
    if (!token) {
      // User is not authenticated, redirect to admin login page
      next({
        path: '/login', // Correct path for the admin login route
        query: { redirect: to.fullPath } // Optionally, save the intended path
      });
    } else {
      // User is authenticated, proceed
      next();
    }
  } else if (to.matched.some(record => record.meta.requiresGuest) && localStorage.getItem('accessToken')) {
    // If route is for guests only (like login) and user is already authenticated
    next({ path: '/' }); // Redirect to admin section root
  } else {
    // Route doesn't require authentication or user is authenticated, proceed
    next();
  }
});

export default router; 