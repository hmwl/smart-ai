import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { vitePluginForArco } from '@arco-plugins/vite-vue'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vitePluginForArco({
      style: 'css' // 或者 'less' 如果你想使用 less
    }),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'vue': 'vue/dist/vue.esm-bundler.js'
    },
  },
  server: {
    // open: '/src/home/index.html', // Remove this line
    // Proxy API requests to the backend server running on port 3000
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true, // Needed for virtual hosted sites
        // rewrite: (path) => path.replace(/^\/api/, ''), // Uncomment if backend API routes don't have /api prefix
      },
      '/app': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL('index.html', import.meta.url)), // Updated home entry point
        client: fileURLToPath(new URL('src/client/index.html', import.meta.url)),
        admin: fileURLToPath(new URL('src/admin/index.html', import.meta.url)),
        miniapp: fileURLToPath(new URL('src/miniapp/index.html', import.meta.url)), // 实际可能不需要 web 构建
        website: fileURLToPath(new URL('src/website/index.html', import.meta.url)),
      },
    },
  },
});
