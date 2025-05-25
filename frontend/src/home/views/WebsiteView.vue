<template>
  <div>
    <a-spin :loading="isLoading" tip="Loading page..." class="w-full">
      <div v-if="pageError" class="text-center text-red-500 p-4">
        Error loading page: {{ pageError }}
      </div>
      <div v-else-if="!isLoading && !dynamicTemplateComponent" class="text-center text-gray-500 p-4">
         Page content could not be displayed. Template might be missing or invalid.
      </div>
      <Suspense>
        <template #default>
          <div v-if="!isLoading && dynamicTemplateComponent" class="page-content-container">
            <component 
              :is="dynamicTemplateComponent" 
              :page="pageData" 
              :articles="articlesData" 
            />
          </div>
        </template>
      </Suspense>
    </a-spin>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed, h, compile, markRaw } from 'vue';
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
import { formatDate } from '../utils/date';

const route = useRoute();
const router = useRouter();
const isLoading = ref(false);
const pageError = ref(null);

// Store page data, template content, and articles separately
const pageData = ref(null);
const templateContent = ref(null);
const articlesData = ref([]);
const customJsContent = ref('');

// JSON stringify helper for template
const toJson = (val) => JSON.stringify(val, null, 2);

// Ref to hold the dynamically compiled component definition
const dynamicTemplateComponent = ref(null);

const fetchPageData = async (path) => {
  isLoading.value = true;
  pageError.value = null;
  pageData.value = null;
  templateContent.value = null;
  articlesData.value = [];
  dynamicTemplateComponent.value = null; // Reset component on fetch
  customJsContent.value = '';

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
    customJsContent.value = data.customJs || '';
    articlesData.value = data.articles || [];
    
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
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
watch([templateContent, customJsContent], async ([newTemplateString, newJsString]) => {
    if (newTemplateString) {
        try {
            const compiledRenderFn = compile(newTemplateString);
            dynamicTemplateComponent.value = markRaw({
                name: 'DynamicPageTemplate',
                props: ['page', 'articles'],
                async setup(props) {
                    const expose = { ...props, formatDate, toJson };
                    if (newJsString && typeof newJsString === 'string') {
                        try {
                            const customFn = new AsyncFunction('page', 'articles', 'formatDate', 'toJson', `\n'use strict';\n${newJsString}`);
                            const customResult = await customFn(props.page, props.articles, formatDate, toJson);
                            if (customResult && typeof customResult === 'object') {
                                Object.assign(expose, customResult);
                            }
                        } catch (e) {
                            console.error('自定义JS逻辑执行出错:', e);
                        }
                    }
                    return expose;
                },
                render: compiledRenderFn
            });
            pageError.value = null;
        } catch (e) {
            console.error("Template compilation error:", e);
            pageError.value = 'Failed to compile page template.';
            dynamicTemplateComponent.value = null; // Clear component on error
        }
    } else {
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