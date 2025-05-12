<template>
  <div class="website-footer">
     <nav class="mb-2">
        <a-space :size="10" wrap>
            <template v-for="(item, index) in footerNav" :key="index">
                <router-link 
                    v-if="item.type === 'page'" 
                    :to="item.route || '/'" 
                    class="footer-link"
                  >
                    {{ item.title }}
                 </router-link>
                 <a 
                    v-else-if="item.type === 'external'"
                    :href="item.url"
                    target="_blank"
                    class="footer-link"
                  >
                    {{ item.title }}
                 </a>
            </template>
        </a-space>
    </nav>
    <div>&copy; {{ new Date().getFullYear() }} My Website. All Rights Reserved.</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Space as ASpace } from '@arco-design/web-vue';

const footerNav = ref([]);

const fetchFooterNav = async () => {
    try {
        const response = await fetch('/api/public/menus/lookup?location=footer');
        if (response.ok) {
            footerNav.value = await response.json();
        } else {
            console.error('Failed to fetch footer navigation (new endpoint)');
            footerNav.value = [];
        }
    } catch (error) {
        console.error('Error fetching footer navigation:', error);
        footerNav.value = [];
    }
};

onMounted(() => {
    fetchFooterNav();
});
</script>

<style scoped>
.website-footer {
    text-align: center;
    font-size: 12px;
}
.footer-link {
    text-decoration: none;
    color: var(--color-text-2);
    transition: color 0.3s;
}
.footer-link:hover {
     color: rgb(var(--primary-6));
}
</style> 