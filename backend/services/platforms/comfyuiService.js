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

    const comfyApis = application.apis.filter(
      (api) => api.platformType === 'ComfyUI' && api.config && api.config.apiUrl
    );

    if (comfyApis.length === 0) {
      throw new Error('应用 "${application.name}" 未配置有效的 ComfyUI API 地址。');
    }

    // For simplicity, pick a random API if multiple are configured
    const selectedApiEntry = comfyApis[Math.floor(Math.random() * comfyApis.length)];
    const apiUrl = selectedApiEntry.config.apiUrl;
    const apiName = selectedApiEntry.platformName || apiUrl; // Use platformName if available


    // 2. Perform the specific task (currently, /users endpoint as a placeholder)
    // In the future, this could be decided by application.type.uri or clientInputs
    const endpoint = `${apiUrl}/users`;

    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        // Use the simplified error message style from user's recent changes
        throw new Error(`任务提交失败: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      
      return {
        data: data,
        clientMessage: `任务提交成功`, // Message for client
      };
    } catch (error) {
      console.error(`[ComfyUIService] Error during /users call for ${apiName} (${apiUrl}): ${error.message}`);
      if (error.message.startsWith('任务提交失败')) {
          throw error;
      }
      throw new Error(`${error.message}`);
    }
  }
}

module.exports = ComfyUIService; 