import { createRouter, createWebHashHistory } from 'vue-router';
import ClientLayout from '../layouts/ClientLayout.vue';

const routes = [
  {
    path: '/login',
    name: 'ClientLogin',
    component: () => import('../views/ClientLoginPage.vue'),
    meta: { requiresGuest: true } // For redirecting if already logged in
  },
  {
    path: '/',
    component: ClientLayout,
    // redirect: '/ai-applications', // Default page after login
    children: [
      {
        path: '',
        name: 'ClientHomeRedirect',
        redirect: '/inspiration'
      },
      {
        path: 'ai-applications',
        name: 'AiApplications',
        component: () => import('../views/AiApplicationsPage.vue'),
        meta: { title: 'AI 应用' }
      },
      {
        path: 'inspiration', // New route for Inspiration Gallery
        name: 'Inspiration',
        component: () => import('../views/InspirationPage.vue'), // This file will be created next
        meta: { title: '灵感画廊' } // Publicly accessible, no requiresAuth
      },
      {
        path: 'creation-history',
        name: 'CreationHistory',
        component: () => import('../views/CreationHistoryPage.vue'),
        meta: { requiresAuth: true, title: '创作历史' }
      },
      {
        path: 'account-info',
        name: 'AccountInfo',
        component: () => import('../views/AccountInfoPage.vue'),
        meta: { requiresAuth: true, title: '账号信息' },
        // 添加 props 以便传递参数
        props: { isModal: false }
      },
      {
        path: 'credit-transactions',
        name: 'UserCreditTransactions',
        component: () => import('../views/UserCreditTransactionsPage.vue'),
        meta: { requiresAuth: true, title: '消费记录' }
      },
      {
        path: 'ai-applications/:id', // New Detail Route
        name: 'AiApplicationDetail',
        component: () => import('../views/AiApplicationDetailPage.vue'),
        meta: { requiresAuth: true, title: 'AI 应用详情' },
        props: true // Pass route params as props to the component
      }
    ]
  },
  // Add a catch-all or 404 route if needed
  // { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFoundComponent }
];

const router = createRouter({
  history: createWebHashHistory(), // Using hash history for simplicity
  routes,
});

// Basic navigation guard (can be expanded later)
router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem('clientAccessToken'); // Assuming token name

  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!isAuthenticated) {
      next({ name: 'ClientLogin', query: { redirect: to.fullPath } });
    } else {
      next();
    }
  } else if (to.matched.some(record => record.meta.requiresGuest)) {
    if (isAuthenticated) {
      next('/'); // Redirect to a default authenticated route
    } else {
      next();
    }
  } else {
    next();
  }
});

export { router };