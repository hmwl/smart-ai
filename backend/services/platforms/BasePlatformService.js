/**
 * Base Platform Service
 * 
 * 统一化平台对接标准基类
 * 所有平台服务都应该继承此基类并实现其抽象方法
 */

class BasePlatformService {
  constructor() {
    if (this.constructor === BasePlatformService) {
      throw new Error('BasePlatformService is an abstract class and cannot be instantiated directly.');
    }
  }

  /**
   * 提交任务到平台
   * @param {Object} application - 应用配置对象
   * @param {Object} clientInputs - 客户端输入数据
   * @returns {Promise<Object>} 返回包含 prompt_id 的响应
   */
  async submitPrompt(application, clientInputs = {}) {
    throw new Error('submitPrompt method must be implemented by subclass');
  }

  /**
   * 查询任务状态
   * @param {string} promptId - 任务ID
   * @param {Object} apiConfig - API配置信息
   * @returns {Promise<Object>} 返回任务状态信息
   */
  async getStatus(promptId, apiConfig) {
    throw new Error('getStatus method must be implemented by subclass');
  }

  /**
   * 获取任务结果数据
   * @param {string} promptId - 任务ID
   * @param {Object} apiConfig - API配置信息
   * @returns {Promise<Object>} 返回任务结果数据
   */
  async getPromptData(promptId, apiConfig) {
    throw new Error('getPromptData method must be implemented by subclass');
  }

  /**
   * 取消任务
   * @param {string} promptId - 任务ID
   * @param {Object} apiConfig - API配置信息
   * @returns {Promise<Object>} 返回取消结果
   */
  async cancelTask(promptId, apiConfig) {
    throw new Error('cancelTask method must be implemented by subclass');
  }

  /**
   * 获取平台支持的状态列表
   * @returns {Array<string>} 状态列表
   */
  getSupportedStatuses() {
    return ['pending', 'running', 'completed', 'failed', 'cancelled'];
  }

  /**
   * 标准化状态响应格式
   * @param {Object} rawStatus - 平台原始状态响应
   * @returns {Object} 标准化的状态响应
   */
  normalizeStatusResponse(rawStatus) {
    return {
      prompt_id: rawStatus.prompt_id || rawStatus.task_id,
      status: this.mapPlatformStatus(rawStatus.status),
      progress: rawStatus.progress || null,
      queue_position: rawStatus.queue_position || null,
      estimated_time: rawStatus.estimated_time || null,
      error_message: rawStatus.error_message || null,
      raw_response: rawStatus
    };
  }

  /**
   * 将平台特定状态映射到标准状态
   * @param {string} platformStatus - 平台状态
   * @returns {string} 标准状态
   */
  mapPlatformStatus(platformStatus) {
    // 子类应该重写此方法以映射特定平台的状态
    const statusMap = {
      'pending': 'pending',
      'running': 'running',
      'completed': 'completed',
      'success': 'completed',
      'failed': 'failed',
      'error': 'failed',
      'cancelled': 'cancelled',
      'canceled': 'cancelled'
    };
    
    return statusMap[platformStatus?.toLowerCase()] || 'unknown';
  }

  /**
   * 验证API配置
   * @param {Object} apiConfig - API配置
   * @returns {boolean} 配置是否有效
   */
  validateApiConfig(apiConfig) {
    if (!apiConfig) {
      throw new Error('API配置无效：配置为空');
    }

    // 支持多种字段名格式
    const apiUrl = apiConfig.apiUrl || apiConfig.api_url;
    if (!apiUrl) {
      throw new Error('API配置无效：缺少apiUrl');
    }
    return true;
  }

  /**
   * 构建API请求URL
   * @param {string} baseUrl - 基础URL
   * @param {string} endpoint - 端点路径
   * @returns {string} 完整的API URL
   */
  buildApiUrl(baseUrl, endpoint) {
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${cleanBaseUrl}${cleanEndpoint}`;
  }

  /**
   * 处理API请求错误
   * @param {Error} error - 错误对象
   * @param {string} operation - 操作名称
   * @returns {Error} 处理后的错误
   */
  handleApiError(error, operation = 'API请求') {
    console.error(`[${this.constructor.name}] ${operation}失败:`, error);
    
    if (error.response) {
      // HTTP错误响应
      const status = error.response.status;
      const message = error.response.data?.message || error.response.statusText;
      return new Error(`${operation}失败 (${status}): ${message}`);
    } else if (error.request) {
      // 网络错误
      return new Error(`${operation}失败: 网络连接错误`);
    } else {
      // 其他错误
      return new Error(`${operation}失败: ${error.message}`);
    }
  }

  /**
   * 等待指定时间
   * @param {number} ms - 等待毫秒数
   * @returns {Promise<void>}
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 轮询任务状态直到完成
   * @param {string} promptId - 任务ID
   * @param {Object} apiConfig - API配置
   * @param {Object} options - 轮询选项
   * @returns {Promise<Object>} 最终状态
   */
  async pollUntilComplete(promptId, apiConfig, options = {}) {
    const {
      maxAttempts = 120,  // 最大轮询次数
      interval = 2000,    // 轮询间隔(毫秒)
      onProgress = null   // 进度回调函数
    } = options;

    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const status = await this.getStatus(promptId, apiConfig);
        const normalizedStatus = this.normalizeStatusResponse(status);
        
        // 调用进度回调
        if (onProgress && typeof onProgress === 'function') {
          onProgress(normalizedStatus);
        }
        
        // 检查是否完成
        if (['completed', 'failed', 'cancelled'].includes(normalizedStatus.status)) {
          return normalizedStatus;
        }
        
        attempts++;
        await this.sleep(interval);
        
      } catch (error) {
        console.error(`[${this.constructor.name}] 轮询状态失败 (尝试 ${attempts + 1}):`, error);
        attempts++;
        
        if (attempts >= maxAttempts) {
          throw new Error(`轮询超时: 已尝试 ${maxAttempts} 次`);
        }
        
        await this.sleep(interval);
      }
    }
    
    throw new Error(`轮询超时: 任务在 ${maxAttempts} 次尝试后仍未完成`);
  }
}

module.exports = BasePlatformService;
