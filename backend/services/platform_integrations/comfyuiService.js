/**
 * ComfyUI Service
 *
 * This service will contain the logic to interact with a ComfyUI instance.
 * - Make API calls to generate images, etc.
 * - Handle authentication if necessary.
 * - Process responses from ComfyUI.
 */

class ComfyUIService {
  constructor(apiConfig) {
    // apiConfig will be an instance of ApiEntry.config
    // e.g., { apiUrl: 'http://127.0.0.1:8188' }
    this.apiUrl = apiConfig.apiUrl;
    if (!this.apiUrl) {
      throw new Error('ComfyUI API URL not provided in config.');
    }
    console.log(`[ComfyUIService] Initialized for: ${this.apiUrl}`);
  }

  async healthCheck() {
    console.log(`[ComfyUIService] Performing health check for ${this.apiUrl}`);
    try {
      // const response = await fetch(`${this.apiUrl}/health`); 
      // if (!response.ok) throw new Error(`Health check failed with status ${response.status}`);
      // const data = await response.json();
      // console.log(`[ComfyUIService] Health check successful for ${this.apiUrl}`, data);
      return { status: 'ok', message: 'ComfyUI instance is responsive (simulated health check).' };
    } catch (error) {
      console.error(`[ComfyUIService] Health check failed for ${this.apiUrl}: ${error.message}`);
      const userMessage = `ComfyUI 健康检查失败 (${this.apiUrl})。`;
      throw new Error(`${userMessage} Details: ${error.message}`);
    }
  }

  async getUsersInfo() {
    const endpoint = `${this.apiUrl}/users`;
    console.log(`[ComfyUIService] Calling /users endpoint at ${endpoint}`);
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`ComfyUI /users 接口调用失败: ${response.status} ${response.statusText} (${this.apiUrl})`);
      }
      const data = await response.json();
      console.log(`[ComfyUIService] Successfully fetched /users data from ${this.apiUrl}`);
      return data; 
    } catch (error) {
      console.error(`[ComfyUIService] Error fetching /users data from ${this.apiUrl}: ${error.message}`);
      if (error.message.startsWith('ComfyUI /users 接口调用失败:')) {
        throw error; 
      }
      throw new Error(`获取 ComfyUI 用户信息失败 (${this.apiUrl}). 原因: ${error.message}`);
    }
  }

  async generateTextToImage(prompt, params = {}) {
    const workflow = params.workflow || "default_t2i_workflow"; 
    console.log(`[ComfyUIService] Queuing prompt for '${prompt}' with workflow '${workflow}' at ${this.apiUrl}`);
    // Actual ComfyUI prompt queuing logic would go here
    // Example: const response = await fetch(`${this.apiUrl}/prompt`, { method: 'POST', body: JSON.stringify(payload) });
    // if (!response.ok) throw new Error(`ComfyUI prompt queue failed: ${response.status}`);
    // const data = await response.json();
    // if (data.error) throw new Error(`ComfyUI error: ${JSON.stringify(data.error)}`);
    // console.log('[ComfyUIService] Prompt queued successfully:', data.prompt_id);
    // return { jobId: data.prompt_id, message: '文生图任务已提交至 ComfyUI。' };

    console.log(`[ComfyUIService] Simulating text-to-image for prompt: "${prompt}" at ${this.apiUrl}`);
    return {
      success: true,
      message: '图像生成已模拟排队 (ComfyUI)。',
      jobId: `comfyui_job_${Date.now()}`,
    };
  }

  // Add other methods as needed, e.g., getImageStatus, getGeneratedImage
}

module.exports = ComfyUIService; 