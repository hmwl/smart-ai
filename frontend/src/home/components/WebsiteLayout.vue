<template>
  <a-layout style="min-height: 100vh;">
    <a-layout-header>
        <WebsiteHeader />
    </a-layout-header>
    <a-layout-content style="padding: 20px 50px;">
        <!-- Router view to display dynamic page content -->
        <router-view /> 
    </a-layout-content>
    <a-layout-footer>
        <WebsiteFooter />
    </a-layout-footer>
  </a-layout>
</template>

<script setup>
import WebsiteHeader from './WebsiteHeader.vue';
import WebsiteFooter from './WebsiteFooter.vue';
import { Layout as ALayout, LayoutHeader as ALayoutHeader, LayoutContent as ALayoutContent, LayoutFooter as ALayoutFooter } from '@arco-design/web-vue';
</script>

<style scoped>
.arco-layout-header {
    /* Add header styles */
    background-color: #fff; /* Example */
    border-bottom: 1px solid var(--color-border-2);
}
.arco-layout-content {
    background-color: var(--color-bg-1); /* Example */
}
.arco-layout-footer {
    /* Add footer styles */
    text-align: center;
    color: var(--color-text-3);
    background-color: var(--color-fill-2);
     padding: 15px 50px;
}
</style> 