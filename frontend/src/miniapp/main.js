import { createApp } from 'vue'
import App from './App.vue'
import '@/style.css' // 小程序可能需要独立的样式入口
import '@arco-design/web-vue/dist/arco.css'; // 小程序 UI 库可能不同

const app = createApp(App);

app.mount('#app') 