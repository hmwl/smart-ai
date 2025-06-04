<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">权限管理</h2>
      <a-space>
        <a-button type="primary" disabled>
          <template #icon><icon-plus /></template> 新建权限
        </a-button>
        <a-button disabled>
          <template #icon><icon-refresh /></template> 刷新
        </a-button>
      </a-space>
    </div>
    <a-spin :loading="false" tip="加载权限列表中..." class="w-full">
      <a-table :data="[]" row-key="_id" stripe :scroll="{ x: 'max-content' }">
        <template #columns>
          <a-table-column title="ID" data-index="_id" :width="120" />
          <a-table-column title="权限名称" data-index="name" :width="200" />
          <a-table-column title="描述" data-index="description" :width="300" />
          <a-table-column title="操作" :width="150" fixed="right">
            <template #cell="{ record }">
              <a-button type="text" size="mini" disabled>编辑</a-button>
              <a-button type="text" status="danger" size="mini" disabled>删除</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-spin>
  </div>
</template>

<script setup>
import { IconRefresh, IconPlus } from '@arco-design/web-vue/es/icon';
</script> 