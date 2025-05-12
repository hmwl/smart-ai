<template>
  <div class="article-view-dynamic">
    <a-spin :loading="isLoading" tip="加载文章中..." class="w-full min-h-[300px] flex items-center justify-center">
      <div v-if="pageError" class="text-center text-red-500 p-4">
        页面加载错误: {{ pageError }}
      </div>
      <div v-else-if="!isLoading && !dynamicArticleComponent && article" class="text-center text-gray-500 p-4">
         文章模板加载失败或无效。
      </div>
      <div v-else-if="!isLoading && !article && !pageError" class="text-center text-gray-500 p-4">
         文章未找到。
      </div>
      <div v-else class="article-dynamic-content-container">
          <component 
            :is="dynamicArticleComponent" 
            :article="article" 
            :page="parentPageData" 
          />
      </div>
    </a-spin>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed, h, compile } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    Spin as ASpin,
    Message
} from '@arco-design/web-vue';

const props = defineProps({
  slug: {
    type: String,
    required: true
  }
});

const router = useRouter();

const isLoading = ref(true);
const article = ref(null);
const parentPageData = ref(null);
const templateContent = ref(null);
const dynamicArticleComponent = ref(null);
const pageError = ref(null);

const fetchArticleData = async () => {
    isLoading.value = true;
    article.value = null;
    parentPageData.value = null;
    templateContent.value = null;
    dynamicArticleComponent.value = null;
    pageError.value = null;
    console.log(`[ArticleView] Fetching article data for SLUG: ${props.slug}`);

    try {
        const response = await fetch(`/api/public/articles/by-slug/${props.slug}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '未知错误' }));
            if (response.status === 404) {
                pageError.value = `文章 (slug: ${props.slug}) 未找到或未激活。`;
                console.log(pageError.value, errorData.message);
            } else {
                pageError.value = `获取文章失败: ${response.status} - ${errorData.message}`;
                console.error(pageError.value);
            }
            return; 
        }
        const responseData = await response.json();
        
        if (!responseData.article) {
            pageError.value = `API响应中未包含文章数据 (slug: ${props.slug})。`;
            console.error(pageError.value);
            return;
        }
        if (!responseData.templateContent) {
            pageError.value = `文章 (slug: ${props.slug}) 对应的显示模板未找到。`;
            console.warn(pageError.value);
            article.value = responseData.article;
            return;
        }

        article.value = responseData.article; 
        parentPageData.value = responseData.page;
        templateContent.value = responseData.templateContent;

        if (article.value && article.value.title) {
            document.title = article.value.title; 
        }

    } catch (error) {
        console.error('[ArticleView] Failed to fetch or process article data by slug:', error);
        pageError.value = `加载文章数据时发生网络或处理错误: ${error.message}`;
    } finally {
        isLoading.value = false;
    }
};

watch(templateContent, (newTemplateString) => {
    console.log("[ArticleView Watcher] templateContent changed, length:", newTemplateString?.length);
    if (newTemplateString && typeof newTemplateString === 'string') {
        try {
            const compiledRenderFn = compile(newTemplateString);
            console.log("[ArticleView Watcher] Compiled render function successfully.");

            dynamicArticleComponent.value = {
                name: 'DynamicArticleTemplate',
                props: ['article', 'page'],
                setup(props) {
                    console.log("[DynamicArticleTemplate Setup] Received props: article title:", props.article?.title);
                    return compiledRenderFn;
                }
            };
            pageError.value = null;
        } catch (e) {
            console.error("[ArticleView] Template compilation error:", e);
            pageError.value = '文章显示模板编译失败。请检查模板内容。';
            dynamicArticleComponent.value = null;
        }
    } else if (article.value && !newTemplateString) {
        if (!pageError.value) {
             console.warn("[ArticleView Watcher] Template content is null or empty, but no pageError was set. dynamicArticleComponent will be null.");
        }
        dynamicArticleComponent.value = null;
    } else {
        dynamicArticleComponent.value = null;
    }
}, { immediate: false });

const goBack = () => {
    if (window.history.length > 1) {
        router.go(-1);
    } else {
        router.push('/');
    }
};

onMounted(() => {
    fetchArticleData();
});

</script>

<style scoped>
.article-view-dynamic .min-h-\[300px\] {
    min-height: 300px;
}
.article-dynamic-content-container {
  /* Add any container styles if needed */
  /* padding: 1rem; Example padding */
}
/* Styling for dynamically rendered content might need to be global 
   or use :deep() if specific container styling is applied here. 
   The dynamic template itself should handle its own styling or use global styles.
*/
</style> 