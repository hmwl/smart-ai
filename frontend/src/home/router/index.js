import { createRouter, createWebHistory } from 'vue-router';

// Import view components
const WebsiteView = () => import('../views/WebsiteView.vue');
const ArticleView = () => import('../views/ArticleView.vue'); // Import Article view
const NotFoundView = () => import('../views/NotFoundView.vue'); // Create this later

const routes = [
  // Route for single article view
  {
    path: '/articles/:slug', // Changed from :articleId to :slug
    name: 'ArticleView',
    component: ArticleView,
    props: true, // Pass route params as props (slug will be passed as a prop)
  },
  // Explicit route for the root path
  {
    path: '/',
    name: 'HomePage', // Give it a distinct name
    component: WebsiteView,
  },
  // Catch-all route for other paths (potential pages)
  {
    path: '/:pathMatch(.*)', // Use (.*) instead of (.*)* if root is handled separately
    name: 'WebsiteViewCatchAll', // Different name to avoid conflicts
    component: WebsiteView,
  },
  // You might still want an explicit 404 route if the lookup fails
  // {
  //   path: '/404', 
  //   name: 'NotFound',
  //   component: NotFoundView 
  // },
];

const router = createRouter({
  // Use history mode and set base to '/' for the website
  history: createWebHistory('/'), 
  routes,
  // Scroll to top on route change
  scrollBehavior(to, from, savedPosition) {
    return { top: 0 };
  },
});

export default router; 