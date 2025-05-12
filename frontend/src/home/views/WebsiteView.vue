<template>
  <div>
    <a-spin :loading="isLoading" tip="Loading page..." class="w-full">
      <div v-if="pageError" class="text-center text-red-500 p-4">
        Error loading page: {{ pageError }}
      </div>
      <div v-else-if="!isLoading && !dynamicTemplateComponent" class="text-center text-gray-500 p-4">
         <!-- Handles cases where page loads but template is missing or fails to compile -->
         Page content could not be displayed. Template might be missing or invalid.
      </div>
      <!-- Render the dynamic component -->
       <div v-else class="page-content-container">
          <component 
            :is="dynamicTemplateComponent" 
            :page="pageData" 
            :articles="articlesData" 
          />
      </div>
    </a-spin>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed, h, compile } from 'vue'; // Import h and compile
import { useRoute, useRouter } from 'vue-router';
import {
    Spin as ASpin,
    List as AList,
    ListItem as AListItem,
    ListItemMeta as AListItemMeta,
    Empty as AEmpty,
    Button as AButton,
    Message
} from '@arco-design/web-vue';
import NotFoundView from './NotFoundView.vue';

const route = useRoute();
const router = useRouter();
const isLoading = ref(false);
const pageError = ref(null);

// Store page data, template content, and articles separately
const pageData = ref(null);
const templateContent = ref(null);
const articlesData = ref([]);

// Ref to hold the dynamically compiled component definition
const dynamicTemplateComponent = ref(null);

// Helper function to format date (duplicate from admin, consider moving to utils)
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  // Simpler format for public view
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }); 
};

const fetchPageData = async (path) => {
  isLoading.value = true;
  pageError.value = null;
  pageData.value = null;
  templateContent.value = null;
  articlesData.value = [];
  dynamicTemplateComponent.value = null; // Reset component on fetch

  try {
    // Use the updated API endpoint
    const response = await fetch(`/api/public/pages/lookup?route=${encodeURIComponent(path)}`);
    if (response.status === 404) {
      throw new Error('Page not found (404).');
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch page data: ${response.status}`);
    }
    const data = await response.json();

    // Store data from the new API response structure
    pageData.value = data.page; 
    templateContent.value = data.templateContent;
    console.log('Articles data from API:', JSON.stringify(data.articles, null, 2));
    articlesData.value = data.articles || [];
    console.log('Assigned articlesData.value:', JSON.stringify(articlesData.value, null, 2));
    
    // Basic check if template content is missing
    if (!templateContent.value) {
        console.warn(`Template content missing for page ${path}`);
        // Error handled by the template rendering section
    }

  } catch (error) {
    console.error("Error fetching page data:", error);
    pageError.value = error.message;
    Message.error(`加载页面失败: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
};

const fetchArticles = async (pageId) => {
    console.log(`Fetching articles for pageId: ${pageId}`);
    try {
        const response = await fetch(`/api/public/articles?pageId=${pageId}`);
        if (response.ok) {
            articlesData.value = await response.json();
        } else {
            console.error(`Error fetching articles: ${response.status}`);
        }
    } catch (error) {
        console.error('Failed to fetch articles:', error);
    }
};

// Watch for route changes to fetch new page data
watch(
  () => route.path,
  (newPath) => {
    // Only fetch if it's a top-level route or a non-article route
    // Article rendering will be handled separately
     if (newPath && !newPath.startsWith('/articles/')) {
        fetchPageData(newPath);
    }
  },
  { immediate: true } // Fetch on initial load
);

// Watch for template content changes to re-compile the component
watch(templateContent, (newTemplateString) => {
    console.log("[WebsiteView Watcher] templateContent changed:", newTemplateString); // Log 1
    if (newTemplateString) {
        try {
            // Compile the template string into a render function
            const compiledRenderFn = compile(newTemplateString);
            console.log("[WebsiteView Watcher] Compiled render function:", compiledRenderFn); // Log 2

            // Define the dynamic component using the compiled function
            dynamicTemplateComponent.value = {
                name: 'DynamicPageTemplate', // Optional: name for debugging
                props: ['page', 'articles'], // Define expected props
                // The setup function returns the compiled render function
                setup(props) {
                    console.log("[DynamicPageTemplate Setup] Received props:", props); // Log 3
                    // You could add computed properties or other setup logic here 
                    // that the template might rely on, using the passed props
                    return compiledRenderFn;
                }
            };
            console.log("[WebsiteView Watcher] dynamicTemplateComponent definition:", dynamicTemplateComponent.value); // Log 4
            pageError.value = null; // Clear previous errors if compilation succeeds
        } catch (e) {
            console.error("Template compilation error:", e);
            pageError.value = 'Failed to compile page template.';
            dynamicTemplateComponent.value = null; // Clear component on error
        }
    } else {
        console.log("[WebsiteView Watcher] Template content is null or empty, clearing component.");
        dynamicTemplateComponent.value = null;
    }
}, { immediate: true });

</script>

<style scoped>
.page-content-container {
  /* Add any container styles if needed */
  padding: 1rem; /* Example padding */
}
/* You might need to add global styles or scoped styles 
   with :deep() selector to style the content rendered by the template */
:deep(.page-content-container h1) {
    font-size: 1.5em; /* Example styling */
    margin-bottom: 0.5em;
}
</style> 