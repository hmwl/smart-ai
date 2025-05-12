import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import '@/style.css'
import '@arco-design/web-vue/dist/arco.css';
import ArcoVue from '@arco-design/web-vue';

// 设置为暗黑主题
document.body.setAttribute('arco-theme', 'dark');

const app = createApp(App);

app.use(router);
app.use(ArcoVue);

// Add router, state management etc. here

app.mount('#app')