const express = require('express');
const fetch = require('node-fetch');
const TaskExecution = require('../models/TaskExecution');

const router = express.Router();

// 简单的认证中间件
const simpleAuth = (req, res, next) => {
  // 暂时跳过认证，直接通过
  req.user = { userId: 'temp-user' };
  next();
};

/**
 * 媒体文件代理路由
 * 用于代理ComfyUI等平台的媒体文件，隐藏真实地址
 */

/**
 * GET /api/media/proxy/:taskId/:nodeId/:filename
 * 代理任务输出的媒体文件
 */
router.get('/proxy/:taskId/:nodeId/:filename', simpleAuth, async (req, res) => {
  try {
    const { taskId, nodeId, filename } = req.params;
    const { subfolder = '', type = 'temp' } = req.query;

    // 暂时跳过用户验证，直接查找任务
    const taskExecution = await TaskExecution.findOne({
      prompt_id: taskId
    });

    if (!taskExecution) {
      return res.status(404).json({
        success: false,
        message: '任务未找到'
      });
    }

    // 获取API配置
    const apiConfig = taskExecution.api_config;
    if (!apiConfig || (!apiConfig.apiUrl && !apiConfig.api_url)) {
      // 使用默认配置
      const defaultApiUrl = 'http://127.0.0.1:8188';
      const params = new URLSearchParams({
        filename: filename,
        subfolder: subfolder,
        type: type
      });

      const realUrl = `${defaultApiUrl}/api/view?${params.toString()}`;
      console.log(`[MediaProxy] 使用默认配置代理请求: ${realUrl}`);

      return await proxyRequest(realUrl, res);
    }

    // 构建真实的媒体文件URL
    const apiUrl = apiConfig.apiUrl || apiConfig.api_url;
    const baseUrl = apiUrl.replace(/\/$/, '');

    const params = new URLSearchParams({
      filename: filename,
      subfolder: subfolder,
      type: type
    });

    const realUrl = `${baseUrl}/api/view?${params.toString()}`;
    console.log(`[MediaProxy] 代理请求: ${realUrl}`);

    return await proxyRequest(realUrl, res);

  } catch (error) {
    console.error('[MediaProxy] 代理请求异常:', error);
    res.status(500).json({
      success: false,
      message: '代理服务异常'
    });
  }
});

// 代理请求辅助函数
async function proxyRequest(realUrl, res) {
  try {
    const response = await fetch(realUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Smart-AI-Proxy/1.0'
      }
    });

    if (!response.ok) {
      console.error(`[MediaProxy] 代理请求失败: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        success: false,
        message: `媒体文件获取失败: ${response.statusText}`
      });
    }

    // 获取内容类型
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');

    // 设置响应头
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600', // 缓存1小时
      'Access-Control-Allow-Origin': '*'
    });

    if (contentLength) {
      res.set('Content-Length', contentLength);
    }

    // 流式传输文件内容
    response.body.pipe(res);

  } catch (error) {
    console.error('[MediaProxy] 代理请求失败:', error);
    res.status(500).json({
      success: false,
      message: '代理请求失败'
    });
  }
}

/**
 * GET /api/media/download/:taskId/:nodeId/:filename
 * 下载任务输出的媒体文件
 */
router.get('/download/:taskId/:nodeId/:filename', simpleAuth, async (req, res) => {
  try {
    const { taskId, nodeId, filename } = req.params;
    const { subfolder = '', type = 'temp' } = req.query;

    // 构建下载URL（与代理相同，但添加下载头）
    const defaultApiUrl = 'http://127.0.0.1:8188';
    const params = new URLSearchParams({
      filename: filename,
      subfolder: subfolder,
      type: type
    });

    const realUrl = `${defaultApiUrl}/api/view?${params.toString()}`;
    console.log(`[MediaProxy] 下载请求: ${realUrl}`);

    const response = await fetch(realUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Smart-AI-Proxy/1.0'
      }
    });

    if (!response.ok) {
      console.error(`[MediaProxy] 下载请求失败: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        success: false,
        message: `文件下载失败: ${response.statusText}`
      });
    }

    // 获取内容类型
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');

    // 设置下载响应头
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Access-Control-Allow-Origin': '*'
    });

    if (contentLength) {
      res.set('Content-Length', contentLength);
    }

    // 流式传输文件内容
    response.body.pipe(res);

  } catch (error) {
    console.error('[MediaProxy] 下载请求异常:', error);
    res.status(500).json({
      success: false,
      message: '下载服务异常'
    });
  }
});

/**
 * GET /api/media/info/:taskId
 * 获取任务的媒体文件信息
 */
router.get('/info/:taskId', simpleAuth, async (req, res) => {
  try {
    const { taskId } = req.params;

    // 查找任务
    const taskExecution = await TaskExecution.findOne({
      prompt_id: taskId
    });

    if (!taskExecution) {
      return res.status(404).json({
        success: false,
        message: '任务未找到'
      });
    }

    // 返回输出数据信息
    const outputData = taskExecution.output_data || {};

    res.json({
      success: true,
      taskId: taskId,
      status: taskExecution.status,
      outputData: outputData,
      mediaCount: {
        images: outputData.images ? outputData.images.length : 0,
        videos: outputData.videos ? outputData.videos.length : 0,
        texts: outputData.texts ? outputData.texts.length : 0
      }
    });

  } catch (error) {
    console.error('[MediaProxy] 获取媒体信息异常:', error);
    res.status(500).json({
      success: false,
      message: '获取媒体信息失败'
    });
  }
});

module.exports = router;
