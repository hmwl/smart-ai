import apiClient from './apiService';

/**
 * 任务服务
 * 提供统一化的任务管理功能
 */
class TaskService {
  constructor() {
    // 移除WebSocket相关属性，只保留基本功能
  }

  /**
   * 提交任务到平台
   * @param {string} applicationId - 应用ID
   * @param {Object} formConfig - 表单配置
   * @returns {Promise<Object>} 任务提交结果
   */
  async submitTask(applicationId, formConfig) {
    try {
      const response = await apiClient.post('/prompt', {
        applicationId,
        formConfig
      });
      
      if (response.data.success) {
        return {
          success: true,
          promptId: response.data.prompt_id,
          taskId: response.data.task_id,
          status: response.data.status,
          message: response.data.message,
          creditsConsumed: response.data.credits_consumed
        };
      } else {
        throw new Error(response.data.message || '提交任务失败');
      }
    } catch (error) {
      console.error('[TaskService] 提交任务失败:', error);
      throw new Error(error.response?.data?.message || error.message || '提交任务失败');
    }
  }

  /**
   * 查询任务状态
   * @param {string} promptId - 任务ID
   * @returns {Promise<Object>} 任务状态
   */
  async getTaskStatus(promptId) {
    try {
      const response = await apiClient.get('/status', {
        params: { prompt_id: promptId }
      });
      
      if (response.data.success) {
        return {
          success: true,
          promptId: response.data.prompt_id,
          status: response.data.status,
          queueInfo: response.data.queue_info,
          progress: response.data.progress,
          workflowInfo: response.data.workflow_info,
          executionTime: response.data.execution_time,
          errorMessage: response.data.error_message
        };
      } else {
        throw new Error(response.data.message || '查询状态失败');
      }
    } catch (error) {
      console.error('[TaskService] 查询状态失败:', error);
      throw new Error(error.response?.data?.message || error.message || '查询状态失败');
    }
  }

  /**
   * 获取任务结果
   * @param {string} promptId - 任务ID
   * @returns {Promise<Object>} 任务结果
   */
  async getTaskResult(promptId) {
    try {
      const response = await apiClient.get('/promptData', {
        params: { prompt_id: promptId }
      });
      
      if (response.data.success) {
        return {
          success: true,
          promptId: response.data.prompt_id,
          status: response.data.status,
          data: response.data.data,
          executionTime: response.data.execution_time,
          message: response.data.message
        };
      } else {
        throw new Error(response.data.message || '获取结果失败');
      }
    } catch (error) {
      console.error('[TaskService] 获取结果失败:', error);
      throw new Error(error.response?.data?.message || error.message || '获取结果失败');
    }
  }

  /**
   * 获取任务列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 任务列表
   */
  async getTaskList(options = {}) {
    try {
      const response = await apiClient.get('/tasks', {
        params: options
      });
      
      if (response.data.success) {
        return {
          success: true,
          tasks: response.data.tasks,
          pagination: response.data.pagination
        };
      } else {
        throw new Error(response.data.message || '获取任务列表失败');
      }
    } catch (error) {
      console.error('[TaskService] 获取任务列表失败:', error);
      throw new Error(error.response?.data?.message || error.message || '获取任务列表失败');
    }
  }

  /**
   * 取消任务
   * @param {string} promptId - 任务ID
   * @returns {Promise<Object>} 取消结果
   */
  async cancelTask(promptId) {
    try {
      const response = await apiClient.delete(`/tasks/${promptId}`);
      
      if (response.data.success) {
        return {
          success: true,
          message: response.data.message
        };
      } else {
        throw new Error(response.data.message || '取消任务失败');
      }
    } catch (error) {
      console.error('[TaskService] 取消任务失败:', error);
      throw new Error(error.response?.data?.message || error.message || '取消任务失败');
    }
  }





  /**
   * 轮询任务状态直到完成
   * @param {string} promptId - 任务ID
   * @param {Object} options - 轮询选项
   * @returns {Promise<Object>} 最终状态
   */
  async pollTaskUntilComplete(promptId, options = {}) {
    const {
      maxAttempts = 120,
      interval = 3000,
      onProgress = null
    } = options;

    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const status = await this.getTaskStatus(promptId);
        
        if (onProgress && typeof onProgress === 'function') {
          onProgress(status);
        }
        
        if (['completed', 'failed', 'cancelled'].includes(status.status)) {
          return status;
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, interval));
        
      } catch (error) {
        console.error(`[TaskService] 轮询状态失败 (尝试 ${attempts + 1}):`, error);
        attempts++;
        
        if (attempts >= maxAttempts) {
          throw new Error(`轮询超时: 已尝试 ${maxAttempts} 次`);
        }
        
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    throw new Error(`轮询超时: 任务在 ${maxAttempts} 次尝试后仍未完成`);
  }
}

// 单例模式
const taskService = new TaskService();

export default taskService;
