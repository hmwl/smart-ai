const fs = require('fs').promises;
const path = require('path');
const EnumConfig = require('../../models/EnumConfig'); // Import EnumConfig model

/**
 * ComfyUI Service
 *
 * This service will contain the logic to interact with a ComfyUI instance.
 * - Make API calls to generate images, etc.
 * - Handle authentication if necessary.
 * - Process responses from ComfyUI.
 */

class ComfyUIService {
  constructor() {
    // General initialization, specific API details will be handled per call via application object
  }

  // Main method to be called by the router
  async handleLaunchRequest(application, clientInputs = {}) {
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
      
      // Store the output node ID for later result retrieval
      const outputNodeId = application.formSchema?.comfyUIConfig?.outputNodeId;
      const outputType = application.formSchema?.comfyUIConfig?.outputType || 'image';
      
      return {
        data: data,
        clientMessage: `任务已成功提交至 ComfyUI。`, // Message for client
        promptId: data.prompt_id,
        apiUrl: apiUrl,
        outputNodeId: outputNodeId,
        outputType: outputType
      };
    } catch (error) {
      console.error(`[ComfyUIService] Error during /prompt call for ${apiName} (${apiUrl}): ${error.message}`);
      // Re-throw the original or newly constructed error. The route handler will catch it.
      throw error;
    }
  }

  /**
   * Check the status of a ComfyUI task
   * @param {string} promptId - The prompt ID returned from handleLaunchRequest
   * @param {string} apiUrl - The ComfyUI API URL
   * @returns {Object} Status information
   */
  async checkTaskStatus(promptId, apiUrl) {
    if (!promptId || !apiUrl) {
      throw new Error('缺少必要的参数：promptId 或 apiUrl');
    }

    try {
      // Call the ComfyUI task monitor endpoint
      const endpoint = `${apiUrl.replace(/\/$/, '')}/task_monitor/status`;
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`状态查询失败: ${response.status} ${response.statusText}`);
      }

      const statusData = await response.json();
      
      // Standardize the response format for our API
      const result = {
        promptId: promptId,
        status: 'unknown', // Default status
        progress: 0,
        queuePosition: -1,
        message: '',
        error: null
      };

      // Check if our prompt is in the running queue
      if (statusData.queue && Array.isArray(statusData.queue.running)) {
        const runningTask = statusData.queue.running.find(task => task.prompt_id === promptId);
        if (runningTask) {
          result.status = 'running';
          
          // If we have progress information
          if (statusData.current_task_progress) {
            const progress = statusData.current_task_progress;
            if (progress.step !== undefined && progress.total_steps) {
              result.progress = Math.round((progress.step / progress.total_steps) * 100);
            }
            result.message = `正在处理节点: ${progress.node_type || '未知'} (${progress.step || 0}/${progress.total_steps || '?'})`;
          } else if (statusData.workflow_progress) {
            const progress = statusData.workflow_progress;
            if (progress.executed_nodes !== undefined && progress.total_nodes) {
              result.progress = Math.round((progress.executed_nodes / progress.total_nodes) * 100);
            }
            result.message = `工作流进度: ${progress.executed_nodes || 0}/${progress.total_nodes || '?'} 节点已执行`;
          }
        }
      }

      // Check if our prompt is in the pending queue
      if (result.status === 'unknown' && statusData.queue && Array.isArray(statusData.queue.pending)) {
        const pendingIndex = statusData.queue.pending.findIndex(task => task.prompt_id === promptId);
        if (pendingIndex !== -1) {
          result.status = 'pending';
          result.queuePosition = pendingIndex + 1; // 1-based position
          result.message = `排队中，位置: ${result.queuePosition}`;
        }
      }

      // Check for completion or errors
      if (result.status === 'unknown') {
        // If not found in running or pending, and we have outputs, it's completed
        if (statusData.current_task_outputs && Object.keys(statusData.current_task_outputs).length > 0) {
          result.status = 'completed';
          result.progress = 100;
          result.message = '处理完成';
        } 
        // If there's an error
        else if (statusData.error_info) {
          result.status = 'error';
          result.error = statusData.error_info;
          result.message = `处理出错: ${statusData.error_info}`;
        }
        // If task_id matches but not found in queues, it might be completed but no outputs yet
        else if (statusData.task_id === promptId) {
          result.status = 'processing';
          result.message = '正在处理中...';
        }
        // Truly unknown status
        else {
          result.message = '任务状态未知';
        }
      }

      return result;
    } catch (error) {
      console.error(`[ComfyUIService] Error checking task status: ${error.message}`);
      throw new Error(`检查任务状态失败: ${error.message}`);
    }
  }

  /**
   * Get the results of a completed ComfyUI task
   * @param {string} promptId - The prompt ID returned from handleLaunchRequest
   * @param {string} apiUrl - The ComfyUI API URL
   * @param {string} outputNodeId - The ID of the output node in the workflow
   * @param {string} outputType - The type of output (image, text, etc.)
   * @returns {Object} The task results
   */
  async getTaskResults(promptId, apiUrl, outputNodeId, outputType = 'image') {
    if (!promptId || !apiUrl) {
      throw new Error('缺少必要的参数：promptId 或 apiUrl');
    }

    try {
      // First check if the task is completed
      const statusResult = await this.checkTaskStatus(promptId, apiUrl);
      if (statusResult.status !== 'completed') {
        throw new Error(`任务尚未完成，当前状态: ${statusResult.status}`);
      }

      // For ComfyUI, we need to get the history to find our completed outputs
      const historyEndpoint = `${apiUrl.replace(/\/$/, '')}/history`;
      const historyResponse = await fetch(historyEndpoint);
      
      if (!historyResponse.ok) {
        throw new Error(`获取历史记录失败: ${historyResponse.status} ${historyResponse.statusText}`);
      }

      const historyData = await historyResponse.json();
      
      // Find our prompt in the history
      if (!historyData[promptId]) {
        throw new Error(`在历史记录中找不到任务 ID: ${promptId}`);
      }

      const promptHistory = historyData[promptId];
      
      // Get the outputs based on the output node ID
      let outputs = null;
      if (outputNodeId && promptHistory.outputs && promptHistory.outputs[outputNodeId]) {
        outputs = promptHistory.outputs[outputNodeId];
      } else {
        // If no specific output node ID, try to find any output
        for (const nodeId in promptHistory.outputs || {}) {
          outputs = promptHistory.outputs[nodeId];
          break;
        }
      }

      if (!outputs) {
        throw new Error('找不到任务输出');
      }

      // Process the outputs based on the output type
      let result;
      
      if (outputType === 'image') {
        // For images, we need to construct the URL to the image
        const images = [];
        
        if (Array.isArray(outputs.images)) {
          for (const image of outputs.images) {
            const imageUrl = `${apiUrl.replace(/\/$/, '')}/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder || '')}&type=${encodeURIComponent(image.type || 'output')}`;
            images.push({
              url: imageUrl,
              filename: image.filename,
              type: image.type || 'output',
              subfolder: image.subfolder || ''
            });
          }
        }
        
        result = {
          type: 'image',
          images: images
        };
      } else if (outputType === 'text') {
        // For text outputs
        result = {
          type: 'text',
          text: outputs.text || JSON.stringify(outputs)
        };
      } else {
        // For other types, just return the raw outputs
        result = {
          type: outputType,
          data: outputs
        };
      }

      return result;
    } catch (error) {
      console.error(`[ComfyUIService] Error getting task results: ${error.message}`);
      throw new Error(`获取任务结果失败: ${error.message}`);
    }
  }
}

module.exports = ComfyUIService; 