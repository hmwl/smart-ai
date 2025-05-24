<template>
  <div class="website-header flex justify-between items-center h-16">
    <div class="logo text-xl font-bold">My Website</div>
    <nav>
      <a-space size="large">
        <!-- Iterate over new menu items structure -->
        <template v-for="(item, index) in headerNav" :key="index"> 
          <!-- Simple Link (Page or External) -->
          <router-link 
            v-if="item.type === 'page' && !item.children?.length" 
            :to="item.route || '/'" 
            class="nav-link"
          >
            {{ item.title }}
          </router-link>
          <a 
            v-else-if="item.type === 'external' && !item.children?.length"
            :href="item.url"
            target="_blank"
            class="nav-link"
          >
            {{ item.title }} <icon-link />
          </a>
          
          <!-- Submenu with Dropdown -->
          <a-dropdown v-else-if="item.type === 'submenu' && item.children?.length">
            <span class="nav-link cursor-pointer">{{ item.title }} <icon-down /></span>
            <template #content>
              <a-doption v-for="(child, childIndex) in item.children" :key="childIndex">
                <router-link v-if="child.type === 'page'" :to="child.route || '/'" class="dropdown-link">
                   {{ child.title }}
                </router-link>
                <a v-else-if="child.type === 'external'" :href="child.url" target="_blank" class="dropdown-link">
                   {{ child.title }} <icon-link />
                </a>
                <!-- Divider (if needed) -->
                 <div v-else-if="child.type === 'divider'" class="arco-dropdown-option-divider"></div>
                <!-- Deeper submenus not supported here -->
                <span v-else class="dropdown-link disabled">{{ child.title }}</span> 
              </a-doption>
            </template>
          </a-dropdown>

          <!-- Divider -->
           <div v-else-if="item.type === 'divider'" class="nav-divider"></div>

           <!-- Fallback for unexpected types or structures -->
           <span v-else class="nav-link disabled">{{ item.title }}</span>
        </template>
      </a-space>
    </nav>
    <div>
      <a-space>
        <a-button type="outline" @click="goToLogin">登录</a-button> 
        <a-button type="primary" @click="goToAdmin">后台管理</a-button>
      </a-space>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
// Import necessary Arco components
import { Space as ASpace, Button as AButton, Dropdown as ADropdown, Doption as ADoption } from '@arco-design/web-vue';
import { IconLink, IconDown } from '@arco-design/web-vue/es/icon'; // Added IconDown

const headerNav = ref([]);

const fetchHeaderNav = async () => {
    try {
        // Update fetch URL
        const response = await fetch('/api/public/menus/lookup?location=header'); 
        if (response.ok) {
            headerNav.value = await response.json();
        } else {
            console.error('Failed to fetch header navigation (new endpoint)');
            headerNav.value = []; // Clear on error
        }
    } catch (error) {
        console.error('Error fetching header navigation:', error);
        headerNav.value = []; // Clear on error
    }
};

const goToAdmin = () => {
    window.location.href = 'src/admin/index.html'; // Path to admin entry point
};

const goToLogin = () => {
    window.location.href = 'src/client/index.html#/login'; // Path to client app's login page
};

onMounted(() => {
    fetchHeaderNav();
});
</script>

<style scoped>
.website-header {
    padding: 0 50px;
}
.nav-link {
    text-decoration: none;
    color: var(--color-text-1);
    transition: color 0.3s;
    font-weight: 500;
}
.nav-link:hover, .router-link-active {
    color: rgb(var(--primary-6));
}
.cursor-pointer {
    cursor: pointer;
}
.disabled {
    color: var(--color-text-3);
    cursor: not-allowed;
}
.dropdown-link {
    display: block; /* Make link fill the doption */
    text-decoration: none;
    color: inherit; /* Inherit color from doption */
    width: 100%;
}
.nav-divider {
    height: 1em;
    width: 1px;
    background-color: var(--color-border-2);
    margin: 0 5px; /* Adjust spacing */
}
/* Ensure icon alignment */
.arco-space .arco-icon {
    vertical-align: middle;
}
.arco-dropdown-option-content .arco-icon {
     vertical-align: middle;
     margin-left: 5px;
}
</style> 