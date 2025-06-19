const express = require('express');
const fetch = require('node-fetch');
const TaskExecution = require('../models/TaskExecution');

const router = express.Router();

/**
 * 简化的媒体代理路由
 * GET /api/proxy/:taskId/:nodeId/:filename
 */
router.get('/:taskId/:nodeId/:filename', async (req, res) => {
  try {
    const { taskId, nodeId, filename } = req.params;
    const { subfolder = '', type = 'temp' } = req.query;

    console.log(`[SimpleProxy] 代理请求: taskId=${taskId}, nodeId=${nodeId}, filename=${filename}`);

    // 查找任务（暂时不验证用户权限）
    const taskExecution = await TaskExecution.findOne({
      prompt_id: taskId
    });

    if (!taskExecution) {
      console.log(`[SimpleProxy] 任务未找到: ${taskId}`);
      return res.status(404).json({
        success: false,
        message: '任务未找到'
      });
    }

    // 从任务输出数据中查找原始文件名
    let originalFilename = filename;
    if (taskExecution.output_data) {
      const { images = [], videos = [] } = taskExecution.output_data;
      const allFiles = [...images, ...videos];

      // 查找匹配的文件
      const matchedFile = allFiles.find(file =>
        file.nodeId === nodeId && file.filename === filename
      );

      if (matchedFile && matchedFile.originalFilename) {
        originalFilename = matchedFile.originalFilename;
        console.log(`[SimpleProxy] 映射文件名: ${filename} -> ${originalFilename}`);
      }
    }

    // 构建ComfyUI的真实URL
    let apiUrl = 'http://127.0.0.1:8188'; // 默认地址

    if (taskExecution.api_config) {
      apiUrl = taskExecution.api_config.apiUrl || taskExecution.api_config.api_url || apiUrl;
    }

    const params = new URLSearchParams({
      filename: originalFilename, // 使用原始文件名
      subfolder: subfolder,
      type: type
    });

    const realUrl = `${apiUrl}/api/view?${params.toString()}`;
    console.log(`[SimpleProxy] 代理到: ${realUrl}`);

    // 发起代理请求
    const response = await fetch(realUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Smart-AI-Proxy/1.0'
      }
    });

    if (!response.ok) {
      console.error(`[SimpleProxy] 代理请求失败: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        success: false,
        message: `媒体文件获取失败: ${response.statusText}`
      });
    }

    // 获取内容类型
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');

    console.log(`[SimpleProxy] 成功获取文件: ${originalFilename}, 类型: ${contentType}`);

    // 设置响应头
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    });

    if (contentLength) {
      res.set('Content-Length', contentLength);
    }

    // 流式传输文件内容
    response.body.pipe(res);

  } catch (error) {
    console.error('[SimpleProxy] 代理请求异常:', error);
    res.status(500).json({
      success: false,
      message: '代理服务异常'
    });
  }
});

/**
 * 下载接口
 * GET /api/proxy/download/:taskId/:nodeId/:filename
 */
router.get('/download/:taskId/:nodeId/:filename', async (req, res) => {
  try {
    const { taskId, nodeId, filename } = req.params;
    const { subfolder = '', type = 'temp' } = req.query;

    console.log(`[SimpleProxy] 下载请求: ${filename}`);

    // 查找任务以获取原始文件名和用户信息
    const taskExecution = await TaskExecution.findOne({
      prompt_id: taskId
    });

    if (!taskExecution) {
      return res.status(404).json({
        success: false,
        message: '任务未找到'
      });
    }

    // 从任务输出数据中查找原始文件名
    let originalFilename = filename;
    if (taskExecution.output_data) {
      const { images = [], videos = [] } = taskExecution.output_data;
      const allFiles = [...images, ...videos];

      // 查找匹配的文件
      const matchedFile = allFiles.find(file =>
        file.nodeId === nodeId && file.filename === filename
      );

      if (matchedFile && matchedFile.originalFilename) {
        originalFilename = matchedFile.originalFilename;
      }
    }

    // 构建ComfyUI的真实URL
    let apiUrl = 'http://127.0.0.1:8188';
    if (taskExecution.api_config) {
      apiUrl = taskExecution.api_config.apiUrl || taskExecution.api_config.api_url || apiUrl;
    }

    const params = new URLSearchParams({
      filename: originalFilename, // 使用原始文件名
      subfolder: subfolder,
      type: type
    });

    const realUrl = `${apiUrl}/api/view?${params.toString()}`;

    // 发起代理请求
    const response = await fetch(realUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Smart-AI-Proxy/1.0'
      }
    });

    if (!response.ok) {
      console.error(`[SimpleProxy] 下载请求失败: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        success: false,
        message: `文件下载失败: ${response.statusText}`
      });
    }

    // 获取内容类型
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');

    // 使用代理文件名作为下载文件名（已经包含用户ID和时间戳）
    const downloadFilename = filename;

    // 设置下载响应头
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${downloadFilename}"`,
      'Access-Control-Allow-Origin': '*'
    });

    if (contentLength) {
      res.set('Content-Length', contentLength);
    }

    console.log(`[SimpleProxy] 开始下载: ${downloadFilename}`);

    // 流式传输文件内容
    response.body.pipe(res);

  } catch (error) {
    console.error('[SimpleProxy] 下载请求异常:', error);
    res.status(500).json({
      success: false,
      message: '下载服务异常'
    });
  }
});

module.exports = router;
