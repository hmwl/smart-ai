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
    children: [
      {
        path: '',
        name: 'ClientHomeRedirect',
        redirect: '/inspiration' // Default to InspirationPage
      },
      {
        path: 'ai-applications',
        name: 'AiApplications',
        component: () => import('../views/AiApplicationsPage.vue'),
        meta: { title: 'AI 应用' }
      },
      {
        path: 'inspiration', // Route for Inspiration Gallery / Market
        name: 'Inspiration',
        component: () => import('../views/InspirationPage.vue'), 
        meta: { title: '灵感市场' } // Publicly accessible
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
        meta: { title: 'AI 应用详情' },
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
      // Instead of redirecting to a login page, we prevent navigation.
      // The UI should handle prompting for login via a modal.
      console.warn(`Navigation to "${to.path}" blocked, requires authentication.`);
      // Emitting an event or calling a store action to open a global login modal
      // would be a more robust solution here for handling direct URL access to protected routes.
      // For now, we rely on UI elements to trigger login.
      // If `from.name` is null, it might be a direct entry, consider redirecting to home or login page still.
      if (from.name) {
        next(false); // Cancel navigation if coming from another route
      } else {
        // Optional: For direct URL access to a protected route, you might still want to redirect to login or home.
        // Or, rely on the component itself to show a login prompt if it detects no user.
        next({ name: 'ClientHomeRedirect' }); // Redirect to a safe public page like home/inspiration
      }
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