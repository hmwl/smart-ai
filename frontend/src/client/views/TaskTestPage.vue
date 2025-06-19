<template>
  <div class="task-test-page">
    <a-page-header title="任务API测试" @back="$router.go(-1)">
      <template #subtitle>
        测试统一化的任务提交、状态查询和结果获取API
      </template>
    </a-page-header>

    <div class="test-content">
      <a-row :gutter="24">
        <!-- 左侧：API测试 -->
        <a-col :span="12">
          <a-card title="API测试" :bordered="false">
            <a-space direction="vertical" fill>
              <!-- 应用选择 -->
              <a-form-item label="选择应用">
                <a-select v-model="selectedAppId" placeholder="请选择要测试的应用">
                  <a-option v-for="app in applications" :key="app._id" :value="app._id">
                    {{ app.name }}
                  </a-option>
                </a-select>
              </a-form-item>

              <!-- 表单配置 -->
              <a-form-item label="表单配置">
                <a-textarea 
                  v-model="formConfigJson" 
                  placeholder="输入JSON格式的表单配置"
                  :rows="4"
                />
              </a-form-item>

              <!-- 操作按钮 -->
              <a-space>
                <a-button type="primary" @click="submitTask" :loading="submitting">
                  提交任务
                </a-button>
                <a-button @click="queryStatus" :disabled="!currentPromptId">
                  查询状态
                </a-button>
                <a-button @click="getResult" :disabled="!currentPromptId">
                  获取结果
                </a-button>
                <a-button @click="cancelTask" :disabled="!currentPromptId" status="warning">
                  取消任务
                </a-button>
              </a-space>

              <!-- 当前任务信息 -->
              <div v-if="currentPromptId" class="current-task">
                <a-alert type="info" :title="`当前任务ID: ${currentPromptId}`" />
              </div>
            </a-space>
          </a-card>
        </a-col>

        <!-- 右侧：WebSocket状态 -->
        <a-col :span="12">
          <a-card title="WebSocket状态" :bordered="false">
            <a-space direction="vertical" fill>
              <div class="ws-status">
                <a-tag :color="wsConnected ? 'green' : 'red'">
                  {{ wsConnected ? '已连接' : '未连接' }}
                </a-tag>
                <a-button size="small" @click="toggleWebSocket">
                  {{ wsConnected ? '断开' : '连接' }}
                </a-button>
              </div>

              <!-- WebSocket消息日志 -->
              <div class="ws-messages">
                <h4>WebSocket消息:</h4>
                <div class="message-log">
                  <div 
                    v-for="(msg, index) in wsMessages" 
                    :key="index" 
                    class="message-item"
                    :class="msg.type"
                  >
                    <span class="timestamp">{{ msg.timestamp }}</span>
                    <span class="content">{{ msg.content }}</span>
                  </div>
                </div>
              </div>
            </a-space>
          </a-card>
        </a-col>
      </a-row>

      <!-- 响应结果显示 -->
      <a-row :gutter="24" style="margin-top: 24px;">
        <a-col :span="24">
          <a-card title="API响应结果" :bordered="false">
            <a-tabs>
              <a-tab-pane key="submit" title="提交响应">
                <pre class="response-content">{{ submitResponse || '暂无数据' }}</pre>
              </a-tab-pane>
              <a-tab-pane key="status" title="状态响应">
                <pre class="response-content">{{ statusResponse || '暂无数据' }}</pre>
              </a-tab-pane>
              <a-tab-pane key="result" title="结果响应">
                <pre class="response-content">{{ resultResponse || '暂无数据' }}</pre>
              </a-tab-pane>
            </a-tabs>
          </a-card>
        </a-col>
      </a-row>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import apiClient from '../services/apiService';
import taskService from '../services/taskService';

// 响应式数据
const applications = ref([]);
const selectedAppId = ref('');
const formConfigJson = ref('{}');
const submitting = ref(false);

// 任务状态
const currentPromptId = ref('');
const submitResponse = ref('');
const statusResponse = ref('');
const resultResponse = ref('');

// WebSocket状态
const wsConnected = ref(false);
const wsMessages = ref([]);

// 获取应用列表
const fetchApplications = async () => {
  try {
    const response = await apiClient.get('/public/ai-applications/active');
    applications.value = response.data.applications || [];
  } catch (error) {
    Message.error('获取应用列表失败: ' + error.message);
  }
};

// 提交任务
const submitTask = async () => {
  if (!selectedAppId.value) {
    Message.error('请选择应用');
    return;
  }

  submitting.value = true;
  try {
    let formConfig = {};
    try {
      formConfig = JSON.parse(formConfigJson.value);
    } catch (e) {
      Message.error('表单配置JSON格式错误');
      return;
    }

    const result = await taskService.submitTask(selectedAppId.value, formConfig);
    
    if (result.success) {
      currentPromptId.value = result.promptId;
      submitResponse.value = JSON.stringify(result, null, 2);
      Message.success('任务提交成功');
      
      // 自动订阅任务状态
      taskService.subscribeToTask(result.promptId, handleTaskUpdate);
    }
  } catch (error) {
    Message.error('提交任务失败: ' + error.message);
    submitResponse.value = JSON.stringify({ error: error.message }, null, 2);
  } finally {
    submitting.value = false;
  }
};

// 查询状态
const queryStatus = async () => {
  if (!currentPromptId.value) return;

  try {
    const result = await taskService.getTaskStatus(currentPromptId.value);
    statusResponse.value = JSON.stringify(result, null, 2);
    Message.success('状态查询成功');
  } catch (error) {
    Message.error('查询状态失败: ' + error.message);
    statusResponse.value = JSON.stringify({ error: error.message }, null, 2);
  }
};

// 获取结果
const getResult = async () => {
  if (!currentPromptId.value) return;

  try {
    const result = await taskService.getTaskResult(currentPromptId.value);
    resultResponse.value = JSON.stringify(result, null, 2);
    Message.success('获取结果成功');
  } catch (error) {
    Message.error('获取结果失败: ' + error.message);
    resultResponse.value = JSON.stringify({ error: error.message }, null, 2);
  }
};

// 取消任务
const cancelTask = async () => {
  if (!currentPromptId.value) return;

  try {
    const result = await taskService.cancelTask(currentPromptId.value);
    if (result.success) {
      Message.success('任务已取消');
      taskService.unsubscribeFromTask(currentPromptId.value, handleTaskUpdate);
    }
  } catch (error) {
    Message.error('取消任务失败: ' + error.message);
  }
};

// 处理任务状态更新
const handleTaskUpdate = (data) => {
  addWSMessage('task_update', JSON.stringify(data, null, 2));
  
  if (data.type === 'task_completed') {
    Message.info(`任务${data.status === 'completed' ? '完成' : '失败'}`);
  }
};

// 移除WebSocket功能，改为纯轮询模式
const toggleWebSocket = () => {
  // WebSocket功能已移除，这个按钮现在只是显示状态
  Message.info('已切换到轮询模式，无需WebSocket连接');
};

const addWSMessage = (type, content) => {
  wsMessages.value.unshift({
    type,
    content,
    timestamp: new Date().toLocaleTimeString()
  });
  
  // 限制消息数量
  if (wsMessages.value.length > 50) {
    wsMessages.value = wsMessages.value.slice(0, 50);
  }
};

onMounted(() => {
  fetchApplications();

  // 设置为轮询模式
  wsConnected.value = false;
  addWSMessage('system', '使用轮询模式监控任务状态');
});

onUnmounted(() => {
  // 清理任务状态
  if (currentPromptId.value) {
    currentPromptId.value = null;
  }
});
</script>

<style scoped>
.task-test-page {
  padding: 24px;
}

.test-content {
  margin-top: 24px;
}

.current-task {
  margin-top: 16px;
}

.ws-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.message-log {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--color-border-2);
  border-radius: 4px;
  padding: 8px;
  background: var(--color-bg-1);
}

.message-item {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
}

.message-item.system {
  color: var(--color-text-3);
}

.message-item.task_update {
  color: var(--color-success-6);
}

.timestamp {
  color: var(--color-text-4);
  min-width: 80px;
}

.content {
  flex: 1;
  word-break: break-all;
}

.response-content {
  background: var(--color-bg-2);
  padding: 16px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
  max-height: 400px;
  overflow-y: auto;
}
</style>
