/**
 * 平台服务工厂
 * 统一管理所有平台服务的创建和获取
 */

const ComfyUIService = require('./comfyuiService');
const OpenAIService = require('./openaiService');

// 平台服务映射
const platformServices = {
  'ComfyUI': ComfyUIService,
  'OpenAI': OpenAIService
};

/**
 * 获取平台服务实例
 * @param {string} platformType - 平台类型
 * @returns {BasePlatformService} 平台服务实例
 */
function getPlatformService(platformType) {
  const ServiceClass = platformServices[platformType];
  if (!ServiceClass) {
    throw new Error(`不支持的平台类型: ${platformType}`);
  }
  return new ServiceClass();
}

/**
 * 获取所有支持的平台类型
 * @returns {Array<string>} 平台类型列表
 */
function getSupportedPlatforms() {
  return Object.keys(platformServices);
}

/**
 * 注册新的平台服务
 * @param {string} platformType - 平台类型
 * @param {Class} ServiceClass - 服务类
 */
function registerPlatformService(platformType, ServiceClass) {
  platformServices[platformType] = ServiceClass;
}

module.exports = {
  getPlatformService,
  getSupportedPlatforms,
  registerPlatformService,
  platformServices
};
