import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // Import the router
import '@/style.css' // 引入根目录的全局样式
import '@arco-design/web-vue/dist/arco.css';
import axios from 'axios';

const app = createApp(App);

app.use(router); // Use the router

window.axios = axios;

// 如果需要路由、状态管理等，在这里配置

app.mount('#app') 