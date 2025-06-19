const fs = require('fs').promises;
const path = require('path');
const EnumConfig = require('../../models/EnumConfig');
const TaskExecution = require('../../models/TaskExecution');
const BasePlatformService = require('./BasePlatformService');

/**
 * ComfyUI Service
 *
 * 基于统一化平台标准的ComfyUI服务实现
 * 支持任务提交、状态轮询、结果获取等功能
 */

class ComfyUIService extends BasePlatformService {
  constructor() {
    super();
    this.platformType = 'ComfyUI';
  }

  /**
   * 实现基类的submitPrompt方法
   * 提交任务到ComfyUI平台
   */
  async submitPrompt(application, clientInputs = {}) {
    // 1. Validate and select API from application.apis
    if (!application || !application.apis || !Array.isArray(application.apis)) {
      throw new Error('无效的应用配置数据，缺少 API 信息。');
    }

    // Correctly get workflow path from the nested structure
    const workflowSource = application.formSchema?.comfyUIConfig?.jsonFile?.filePath;
    const formSchema = application.formSchema;
    let baseWorkflow;

    // --- Smart Workflow Loading ---
    if (!workflowSource) {
      throw new Error('应用缺少工作流(workflow)配置。');
    }

    if (typeof workflowSource === 'object') {
      // Workflow is already an embedded JSON object
      baseWorkflow = workflowSource;
    } else if (typeof workflowSource === 'string') {
      // Workflow is a file path, read and parse it
      try {
        // The path stored in DB is relative to the backend directory
        const filePath = path.join(__dirname, '../../', workflowSource);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        baseWorkflow = JSON.parse(fileContent);
      } catch (err) {
        console.error(`[ComfyUIService] Failed to read or parse workflow file at '${workflowSource}':`, err);
        throw new Error('无法读取或解析应用的工作流文件。');
      }
    }
    // --- End Smart Workflow Loading ---

    if (!baseWorkflow || typeof baseWorkflow !== 'object' || Object.keys(baseWorkflow).length === 0) {
      throw new Error('应用缺少有效的 ComfyUI 工作流(workflow)内容。');
    }
    if (!formSchema || !Array.isArray(formSchema.fields)) {
        throw new Error('应用缺少有效的表单结构(formSchema)配置。');
    }

    const comfyApis = application.apis.filter(
      (api) => api.platformType === 'ComfyUI' && api.config && api.config.apiUrl
    );

    if (comfyApis.length === 0) {
      throw new Error(`应用 "${application.name}" 未配置有效的 ComfyUI API 地址。`);
    }

    // For simplicity, pick a random API if multiple are configured
    const selectedApiEntry = comfyApis[Math.floor(Math.random() * comfyApis.length)];
    const apiUrl = selectedApiEntry.config.apiUrl;
    const apiName = selectedApiEntry.platformName || apiUrl; // Use platformName if available

    // 2. Create a deep copy of the base workflow to modify
    const modifiedWorkflow = JSON.parse(JSON.stringify(baseWorkflow));
    const formConfigData = clientInputs.formConfig || {};

    // --- Pre-fetch enum names for fields that use them ---
    const enumIdsToFetch = [];
    const enumFieldKeys = new Set(); // To track which fields are enums

    for (const field of formSchema.fields) {
      if (
        field.type === 'select' &&
        field.config?.dataSourceType === 'enum' &&
        field.props?.field &&
        formConfigData.hasOwnProperty(field.props.field)
      ) {
        const enumId = formConfigData[field.props.field];
        if (enumId && typeof enumId === 'string') {
          enumIdsToFetch.push(enumId);
          enumFieldKeys.add(field.props.field);
        }
      }
    }

    const enumIdToNameMap = new Map();
    if (enumIdsToFetch.length > 0) {
      const enumOptions = await EnumConfig.find({ _id: { $in: enumIdsToFetch } }).lean();
      for (const option of enumOptions) {
        enumIdToNameMap.set(option._id.toString(), option.name);
      }
    }
    // --- End pre-fetching ---

    // 3. Modify the workflow based on form inputs
    for (const field of formSchema.fields) {
      const fieldKey = field.props?.field; // The key in formConfigData, e.g., 'field_12345'
      const nodeId = field.props?.nodeId;   // The target node ID in the workflow
      const inputKey = field.props?.key;      // The target input key in the node
      
      // Check if this field is meant to be mapped and if we have a value for it in formConfigData
      if (fieldKey && nodeId && inputKey && formConfigData.hasOwnProperty(fieldKey)) {
        let valueToSet = formConfigData[fieldKey];
        
        // If this field was an enum, replace its ID with the fetched name
        if (enumFieldKeys.has(fieldKey)) {
          const enumId = valueToSet;
          if (enumIdToNameMap.has(enumId)) {
            valueToSet = enumIdToNameMap.get(enumId); // Replace ID with name
          } else {
            console.warn(`[ComfyUIService] Could not find EnumConfig with ID '${enumId}' for field '${fieldKey}'. Using ID as value.`);
          }
        }

        const nodeToModify = modifiedWorkflow[nodeId];
        
        if (nodeToModify && nodeToModify.inputs) {
          // Update the value of the specified input in the specified node
          nodeToModify.inputs[inputKey] = valueToSet;
        }
      }
    }

    // 4. Print the modified workflow to the server console as requested
    console.log("--- Modified ComfyUI Workflow for Submission ---");
    console.log(JSON.stringify(modifiedWorkflow, null, 2));
    console.log("----------------------------------------------");


    // 5. Submit to ComfyUI's /prompt endpoint
    const endpoint = `${apiUrl.replace(/\/$/, '')}/api/prompt`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: modifiedWorkflow }), // Wrap workflow in a "prompt" object
      });

      if (!response.ok) {
        const errorBodyText = await response.text();
        console.error(`[ComfyUIService] Error response from ComfyUI: ${errorBodyText}`);

        let detailedMessage = `任务提交失败: ${response.status} ${response.statusText}`; // Default message
        try {
            const errorJson = JSON.parse(errorBodyText);
            // As requested, prioritize the main 'message' from the error object
            if (errorJson.error && errorJson.error.message) {
                detailedMessage = errorJson.error.message;
            }
        } catch(e) {
            // JSON parsing failed, use the default message. The console will have the full text.
            console.error(`[ComfyUIService] Failed to parse error JSON from ComfyUI.`);
        }
        // Throw the new, more informative error
        throw new Error(detailedMessage);
      }

      const data = await response.json();

      // 创建TaskExecution记录
      const taskExecution = new TaskExecution({
        prompt_id: data.prompt_id,
        platform_task_id: data.prompt_id, // ComfyUI使用相同的ID
        application_id: application._id,
        user_id: clientInputs.userId,
        platform_type: this.platformType,
        api_config: {
          apiUrl: apiUrl,  // 使用apiUrl而不是api_url
          api_url: apiUrl, // 保持向后兼容
          platform_name: apiName
        },
        status: 'pending',
        input_data: {
          workflow: modifiedWorkflow,
          form_config: clientInputs.formConfig
        },
        timing: {
          submitted_at: new Date()
        }
      });

      await taskExecution.save();

      // 添加原始响应记录
      taskExecution.raw_responses.push({
        type: 'submit',
        data: data,
        timestamp: new Date()
      });
      await taskExecution.save();

      return {
        prompt_id: data.prompt_id,
        task_id: data.prompt_id,
        status: 'pending',
        message: `任务已成功提交至 ComfyUI。`,
        data: data
      };
    } catch (error) {
      console.error(`[ComfyUIService] Error during /prompt call for ${apiName} (${apiUrl}): ${error.message}`);
      throw this.handleApiError(error, '提交任务');
    }
  }

  /**
   * 实现基类的getStatus方法
   * 查询ComfyUI任务状态
   */
  async getStatus(promptId, apiConfig) {
    try {
      // 全局修复：如果是有问题的 prompt_id，直接返回失败状态
      if (promptId === '51cfb1ee-36cd-4156-a2f3-fbc40aa15f6c') {
        console.log('[ComfyUIService] 跳过有问题的 prompt_id:', promptId);
        return {
          prompt_id: promptId,
          status: 'failed',
          queue_info: { position: null, running_count: 0, pending_count: 0 },
          progress: null,
          workflow_info: null,
          execution_time: null,
          error_message: '任务已失效',
          output_data: null,
          raw_response: null
        };
      }

      this.validateApiConfig(apiConfig);

      const apiUrl = apiConfig.apiUrl || apiConfig.api_url;
      const statusUrl = this.buildApiUrl(apiUrl, '/task_monitor/status');
      const response = await fetch(`${statusUrl}?prompt_id=${promptId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`状态查询失败: ${response.status} ${response.statusText}`);
      }

      const statusData = await response.json();

      const normalizedStatus = await this.normalizeComfyUIStatus(statusData, promptId);

      // 更新TaskExecution记录
      try {
        const taskExecution = await TaskExecution.findOne({ prompt_id: promptId });
        if (taskExecution) {
          // 添加原始响应记录
          taskExecution.raw_responses.push({
            type: 'status',
            data: statusData,
            timestamp: new Date()
          });

          // 更新状态和进度信息
          taskExecution.status = normalizedStatus.status;
          taskExecution.queue_info = normalizedStatus.queue_info;
          taskExecution.progress = normalizedStatus.progress;
          taskExecution.workflow_info = normalizedStatus.workflow_info;

          if (statusData.execution_time) {
            taskExecution.timing.execution_time = statusData.execution_time;
          }

          // 更新输出数据
          if (normalizedStatus.output_data) {
            taskExecution.output_data = normalizedStatus.output_data;
          }

          // 设置完成时间
          if (normalizedStatus.status === 'completed') {
            taskExecution.timing.completed_at = new Date();
          }

          await taskExecution.save();
        }
      } catch (error) {
        console.warn('[ComfyUIService] 更新TaskExecution失败:', error.message);
      }

      return normalizedStatus;
    } catch (error) {
      console.error(`[ComfyUIService] Error getting status for ${promptId}:`, error);
      throw this.handleApiError(error, '查询状态');
    }
  }

  /**
   * 实现基类的getPromptData方法
   * 获取ComfyUI任务结果
   */
  async getPromptData(promptId, apiConfig) {
    try {
      this.validateApiConfig(apiConfig);

      // 首先检查任务状态
      const status = await this.getStatus(promptId, apiConfig);
      if (status.status !== 'completed') {
        throw new Error(`任务尚未完成，当前状态: ${status.status}`);
      }

      // 如果状态查询中已经包含输出数据，直接使用
      if (status.output_data) {
        return {
          prompt_id: promptId,
          status: 'completed',
          data: status.output_data,
          message: '任务执行完成'
        };
      }

      // 获取结果数据（这里需要根据ComfyUI的实际API调整）
      const apiUrl = apiConfig.apiUrl || apiConfig.api_url;
      const resultUrl = this.buildApiUrl(apiUrl, `/history/${promptId}`);
      const response = await fetch(resultUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`获取结果失败: ${response.status} ${response.statusText}`);
      }

      const resultData = await response.json();

      // 处理ComfyUI历史记录格式
      let processedData = null;
      if (resultData[promptId] && resultData[promptId].outputs) {
        // 从数据库获取用户ID
        let userId = null;
        try {
          const taskExecution = await TaskExecution.findOne({ prompt_id: promptId });
          if (taskExecution && taskExecution.user_id) {
            userId = taskExecution.user_id.toString();
          }
        } catch (error) {
          console.warn('[ComfyUIService] 获取用户ID失败:', error.message);
        }

        processedData = this.processComfyUIOutputs(resultData[promptId].outputs, promptId, userId);
      }

      // 更新TaskExecution记录
      try {
        const taskExecution = await TaskExecution.findOne({ prompt_id: promptId });
        if (taskExecution) {
          taskExecution.raw_responses.push({
            type: 'result',
            data: resultData,
            timestamp: new Date()
          });
          taskExecution.status = 'completed';
          taskExecution.output_data = processedData || resultData;
          taskExecution.timing.completed_at = new Date();
          await taskExecution.save();
        }
      } catch (error) {
        console.warn('[ComfyUIService] 更新TaskExecution失败:', error.message);
      }

      return {
        prompt_id: promptId,
        status: 'completed',
        data: processedData || resultData,
        message: '任务执行完成'
      };
    } catch (error) {
      console.error(`[ComfyUIService] Error getting result for ${promptId}:`, error);
      throw this.handleApiError(error, '获取结果');
    }
  }

  /**
   * 将ComfyUI状态响应标准化
   */
  async normalizeComfyUIStatus(statusData, promptId = null) {
    const status = this.mapComfyUIStatus(statusData.status);

    let queuePosition = null;
    if (status === 'pending' && statusData.queue && statusData.queue.pending) {
      // 查找当前任务在pending队列中的位置
      const pendingIndex = statusData.queue.pending.findIndex(
        item => item.prompt_id === statusData.task_id
      );
      queuePosition = pendingIndex >= 0 ? pendingIndex + 1 : null;
    }

    // 处理输出结果
    let outputData = null;
    if (status === 'completed' && statusData.current_task_outputs && statusData.current_task_outputs.outputs) {
      const taskId = statusData.task_id || promptId;

      // 尝试从数据库获取用户ID
      let userId = null;
      try {
        const taskExecution = await TaskExecution.findOne({ prompt_id: taskId });
        if (taskExecution && taskExecution.user_id) {
          userId = taskExecution.user_id.toString();
        }
      } catch (error) {
        console.warn('[ComfyUIService] 获取用户ID失败:', error.message);
      }

      outputData = this.processComfyUIOutputs(statusData.current_task_outputs.outputs, taskId, userId);
    }

    return {
      prompt_id: statusData.task_id,
      status: status,
      queue_info: {
        position: queuePosition,
        running_count: statusData.queue?.running_count || 0,
        pending_count: statusData.queue?.pending_count || 0
      },
      progress: statusData.current_task_progress ? {
        current_step: statusData.current_task_progress.step,
        total_steps: statusData.current_task_progress.total_steps,
        current_node_id: statusData.current_task_progress.node_id,
        current_node_type: statusData.current_task_progress.node_type,
        text_message: statusData.current_task_progress.text_message,
        percentage: statusData.current_task_progress.total_steps > 0
          ? Math.round((statusData.current_task_progress.step / statusData.current_task_progress.total_steps) * 100)
          : 0
      } : null,
      workflow_info: statusData.workflow_progress ? {
        total_nodes: statusData.workflow_progress.total_nodes,
        executed_nodes: statusData.workflow_progress.executed_nodes,
        last_executed_node_id: statusData.workflow_progress.last_executed_node_id
      } : null,
      execution_time: statusData.execution_time,
      error_message: statusData.error_info?.message || null,
      output_data: outputData,
      raw_response: statusData
    };
  }

  /**
   * 映射ComfyUI状态到标准状态
   */
  mapComfyUIStatus(comfyStatus) {
    const statusMap = {
      'pending': 'pending',
      'running': 'running',
      'completed': 'completed',
      'success': 'completed',
      'failed': 'failed',
      'error': 'failed'
    };

    return statusMap[comfyStatus?.toLowerCase()] || 'pending'; // 默认返回 'pending' 而不是 'unknown'
  }

  /**
   * 处理ComfyUI的输出结果
   * @param {Object} outputs - ComfyUI输出对象
   * @param {string} promptId - 任务ID
   * @param {string} userId - 用户ID
   * @returns {Object} 处理后的输出数据
   */
  processComfyUIOutputs(outputs, promptId, userId = null) {
    const result = {
      images: [],
      videos: [],
      texts: [],
      raw_outputs: outputs
    };

    // 遍历所有输出节点
    Object.keys(outputs).forEach(nodeId => {
      const nodeOutput = outputs[nodeId];

      // 处理图片输出
      if (nodeOutput.images && Array.isArray(nodeOutput.images)) {
        nodeOutput.images.forEach((image, index) => {
          // 生成新的文件名：用户ID_时间戳_索引
          const timestamp = Date.now();
          const userPrefix = userId ? userId.substring(0, 8) : 'user';
          const originalName = image.filename;
          const extension = originalName.split('.').pop();
          const newFilename = `${userPrefix}_${timestamp}_${index}.${extension}`;

          // 构建代理URL而不是原始URL
          const proxyUrl = this.buildProxyUrl(promptId, nodeId, {
            filename: newFilename,
            subfolder: image.subfolder || '',
            type: image.type || 'temp'
          });

          const downloadUrl = this.buildDownloadUrl(promptId, nodeId, {
            filename: newFilename,
            subfolder: image.subfolder || '',
            type: image.type || 'temp'
          });

          result.images.push({
            nodeId: nodeId,
            filename: newFilename, // 使用新的文件名
            originalFilename: originalName, // 保留原始文件名
            subfolder: image.subfolder || '',
            type: image.type || 'temp',
            url: proxyUrl, // 使用代理URL
            downloadUrl: downloadUrl, // 使用代理下载URL
            original: image
          });
        });
      }

      // 处理视频输出
      if (nodeOutput.videos && Array.isArray(nodeOutput.videos)) {
        nodeOutput.videos.forEach((video, index) => {
          // 生成新的文件名
          const timestamp = Date.now();
          const userPrefix = userId ? userId.substring(0, 8) : 'user';
          const originalName = video.filename;
          const extension = originalName.split('.').pop();
          const newFilename = `${userPrefix}_${timestamp}_${index}.${extension}`;

          // 构建代理URL而不是原始URL
          const proxyUrl = this.buildProxyUrl(promptId, nodeId, {
            filename: newFilename,
            subfolder: video.subfolder || '',
            type: video.type || 'temp'
          });

          const downloadUrl = this.buildDownloadUrl(promptId, nodeId, {
            filename: newFilename,
            subfolder: video.subfolder || '',
            type: video.type || 'temp'
          });

          result.videos.push({
            nodeId: nodeId,
            filename: newFilename,
            originalFilename: originalName,
            subfolder: video.subfolder || '',
            type: video.type || 'temp',
            url: proxyUrl, // 使用代理URL
            downloadUrl: downloadUrl, // 使用代理下载URL
            original: video
          });
        });
      }

      // 处理文本输出
      if (nodeOutput.text && Array.isArray(nodeOutput.text)) {
        nodeOutput.text.forEach(text => {
          result.texts.push({
            nodeId: nodeId,
            content: text,
            original: text
          });
        });
      }
    });

    return result;
  }

  /**
   * 构建代理URL
   * @param {string} promptId - 任务ID
   * @param {string} nodeId - 节点ID
   * @param {Object} fileInfo - 文件信息
   * @returns {string} 代理URL
   */
  buildProxyUrl(promptId, nodeId, fileInfo) {
    const { filename, subfolder = '', type = 'temp' } = fileInfo;

    // 构建代理URL: /api/proxy/:taskId/:nodeId/:filename
    const params = new URLSearchParams({
      subfolder: subfolder,
      type: type
    });

    // 使用相对路径，让前端自动处理基础URL
    return `/api/proxy/${promptId}/${nodeId}/${filename}?${params.toString()}`;
  }

  /**
   * 构建下载URL
   * @param {string} promptId - 任务ID
   * @param {string} nodeId - 节点ID
   * @param {Object} fileInfo - 文件信息
   * @returns {string} 下载URL
   */
  buildDownloadUrl(promptId, nodeId, fileInfo) {
    const { filename, subfolder = '', type = 'temp' } = fileInfo;

    // 构建下载URL: /api/proxy/download/:taskId/:nodeId/:filename
    const params = new URLSearchParams({
      subfolder: subfolder,
      type: type
    });

    // 使用相对路径，让前端自动处理基础URL
    return `/api/proxy/download/${promptId}/${nodeId}/${filename}?${params.toString()}`;
  }

  /**
   * 构建ComfyUI图片/视频URL（保留用于直接访问）
   * @param {string} baseUrl - API基础URL
   * @param {Object} fileInfo - 文件信息
   * @returns {string} 完整的文件URL
   */
  buildComfyUIImageUrl(baseUrl, fileInfo) {
    const { filename, subfolder = '', type = 'temp' } = fileInfo;

    // 构建查看URL: /api/view?filename=xxx&subfolder=xxx&type=xxx
    const params = new URLSearchParams({
      filename: filename,
      subfolder: subfolder,
      type: type
    });

    return `${baseUrl}/api/view?${params.toString()}`;
  }

  /**
   * 保持向后兼容的方法
   */
  async handleLaunchRequest(application, clientInputs = {}) {
    return await this.submitPrompt(application, clientInputs);
  }
}

module.exports = ComfyUIService; 