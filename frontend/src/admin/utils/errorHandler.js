/**
 * 错误处理工具
 */

import { Message } from '@arco-design/web-vue';

/**
 * 处理API错误
 * @param {Error} error - 错误对象
 * @param {string} defaultMessage - 默认错误消息
 */
export function handleApiError(error, defaultMessage = '操作失败') {
  console.error('API错误:', error);
  
  let message = defaultMessage;
  
  if (error.response) {
    // 服务器响应错误
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        message = data?.message || '请求参数错误';
        break;
      case 401:
        message = '未授权，请重新登录';
        // 可以在这里处理登录跳转
        break;
      case 403:
        message = data?.message || '权限不足';
        break;
      case 404:
        message = '请求的资源不存在';
        break;
      case 422:
        message = data?.message || '数据验证失败';
        break;
      case 500:
        message = '服务器内部错误';
        break;
      default:
        message = data?.message || defaultMessage;
    }
  } else if (error.request) {
    // 网络错误
    message = '网络连接失败，请检查网络';
  } else {
    // 其他错误
    message = error.message || defaultMessage;
  }
  
  Message.error(message);
  return message;
}

/**
 * 异步操作包装器，自动处理错误
 * @param {Function} asyncFn - 异步函数
 * @param {string} errorMessage - 错误消息
 * @param {boolean} showSuccess - 是否显示成功消息
 * @param {string} successMessage - 成功消息
 */
export async function withErrorHandling(
  asyncFn, 
  errorMessage = '操作失败',
  showSuccess = false,
  successMessage = '操作成功'
) {
  try {
    const result = await asyncFn();
    if (showSuccess) {
      Message.success(successMessage);
    }
    return result;
  } catch (error) {
    handleApiError(error, errorMessage);
    throw error;
  }
}

/**
 * 表单提交错误处理
 * @param {Error} error - 错误对象
 */
export function handleFormError(error) {
  if (error.response?.data?.errors) {
    // 处理表单验证错误
    const errors = error.response.data.errors;
    const firstError = Object.values(errors)[0];
    Message.error(Array.isArray(firstError) ? firstError[0] : firstError);
  } else {
    handleApiError(error, '表单提交失败');
  }
}

/**
 * 权限错误处理
 * @param {Error} error - 错误对象
 */
export function handlePermissionError(error) {
  if (error.response?.status === 403) {
    Message.error('权限不足，无法执行此操作');
  } else {
    handleApiError(error, '权限检查失败');
  }
}

export default {
  handleApiError,
  withErrorHandling,
  handleFormError,
  handlePermissionError
};
