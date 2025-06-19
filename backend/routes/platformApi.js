const express = require('express');
const authenticateToken = require('../middleware/authenticateToken');
const TaskExecution = require('../models/TaskExecution');
const AiApplication = require('../models/AiApplication');
const User = require('../models/User');
const { getPlatformService } = require('../services/platforms');

const router = express.Router();

/**
 * POST /api/prompt - 提交任务到平台
 * 统一化的任务提交接口
 */
router.post('/prompt', authenticateToken, async (req, res) => {
  try {
    const { applicationId, formConfig } = req.body;
    const userId = req.user.userId;

    if (!applicationId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少应用ID参数' 
      });
    }

    // 获取应用信息
    const application = await AiApplication.findById(applicationId)
      .populate('apis', '_id name platformName platformType apiUrl config');

    if (!application) {
      return res.status(404).json({ 
        success: false, 
        message: '应用未找到' 
      });
    }

    if (application.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        message: '应用当前未激活' 
      });
    }

    // 检查用户积分
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户未找到' 
      });
    }

    const creditsRequired = application.creditsConsumed || 0;
    if (creditsRequired > 0 && user.creditsBalance < creditsRequired) {
      return res.status(400).json({ 
        success: false, 
        message: '积分余额不足' 
      });
    }

    // 获取平台服务
    const platformService = getPlatformService(application.platformType);

    // 提交任务
    const result = await platformService.submitPrompt(application, {
      userId: userId,
      formConfig: formConfig
    });

    // 扣除积分
    if (creditsRequired > 0) {
      await User.findByIdAndUpdate(userId, {
        $inc: { creditsBalance: -creditsRequired }
      });
    }

    res.json({
      success: true,
      prompt_id: result.prompt_id,
      task_id: result.task_id || result.prompt_id,
      status: result.status,
      message: result.message,
      credits_consumed: creditsRequired
    });

  } catch (error) {
    console.error('[PlatformAPI] 提交任务失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '提交任务失败'
    });
  }
});

/**
 * GET /api/status - 查询任务状态
 * 统一化的状态查询接口
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const { prompt_id } = req.query;
    const userId = req.user.userId;

    if (!prompt_id) {
      return res.status(400).json({
        success: false,
        message: '缺少prompt_id参数'
      });
    }

    // 临时修复：如果是有问题的 prompt_id，直接返回失败状态
    if (prompt_id === '51cfb1ee-36cd-4156-a2f3-fbc40aa15f6c') {
      console.log('[PlatformAPI] 跳过有问题的 prompt_id:', prompt_id);
      return res.json({
        success: true,
        prompt_id: prompt_id,
        status: 'failed',
        queue_info: { position: null, running_count: 0, pending_count: 0 },
        progress: null,
        workflow_info: null,
        execution_time: null,
        error_message: '任务已失效',
        message: '任务已失效'
      });
    }

    // 查找任务执行记录
    const taskExecution = await TaskExecution.findOne({ 
      prompt_id, 
      user_id: userId 
    }).populate('application_id', 'name platformType');

    if (!taskExecution) {
      return res.status(404).json({ 
        success: false, 
        message: '任务未找到' 
      });
    }

    // 如果任务已完成，直接返回缓存的状态
    if (taskExecution.is_completed) {
      return res.json({
        success: true,
        prompt_id: taskExecution.prompt_id,
        status: taskExecution.status,
        queue_info: taskExecution.queue_info,
        progress: taskExecution.progress,
        workflow_info: taskExecution.workflow_info,
        execution_time: taskExecution.timing.execution_time,
        error_message: taskExecution.error_info?.message
      });
    }

    // 获取平台服务并查询最新状态
    console.log('[PlatformAPI] TaskExecution api_config:', JSON.stringify(taskExecution.api_config, null, 2));
    const platformService = getPlatformService(taskExecution.platform_type);
    const statusResult = await platformService.getStatus(prompt_id, taskExecution.api_config);

    res.json({
      success: true,
      ...statusResult
    });

  } catch (error) {
    console.error('[PlatformAPI] 查询状态失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '查询状态失败'
    });
  }
});

/**
 * GET /api/promptData - 获取任务结果
 * 统一化的结果获取接口
 */
router.get('/promptData', authenticateToken, async (req, res) => {
  try {
    const { prompt_id } = req.query;
    const userId = req.user.userId;

    if (!prompt_id) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少prompt_id参数' 
      });
    }

    // 查找任务执行记录
    const taskExecution = await TaskExecution.findOne({ 
      prompt_id, 
      user_id: userId 
    }).populate('application_id', 'name platformType');

    if (!taskExecution) {
      return res.status(404).json({ 
        success: false, 
        message: '任务未找到' 
      });
    }

    // 如果任务未完成，返回错误
    if (!taskExecution.is_completed) {
      return res.status(400).json({ 
        success: false, 
        message: `任务尚未完成，当前状态: ${taskExecution.status}` 
      });
    }

    // 如果任务失败，返回错误信息
    if (taskExecution.status === 'failed') {
      return res.status(400).json({ 
        success: false, 
        message: taskExecution.error_info?.message || '任务执行失败' 
      });
    }

    // 如果已有缓存的结果，直接返回
    if (taskExecution.output_data) {
      return res.json({
        success: true,
        prompt_id: taskExecution.prompt_id,
        status: taskExecution.status,
        data: taskExecution.output_data,
        execution_time: taskExecution.timing.execution_time,
        message: '任务执行完成'
      });
    }

    // 获取平台服务并获取结果
    const platformService = getPlatformService(taskExecution.platform_type);
    const resultData = await platformService.getPromptData(prompt_id, taskExecution.api_config);

    res.json({
      success: true,
      ...resultData
    });

  } catch (error) {
    console.error('[PlatformAPI] 获取结果失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取结果失败'
    });
  }
});

/**
 * GET /api/tasks - 获取用户任务列表
 * 用户任务历史查询接口
 */
router.get('/tasks', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      status, 
      platform_type, 
      page = 1, 
      limit = 20 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const tasks = await TaskExecution.getByUser(userId, {
      status,
      platform_type,
      limit: parseInt(limit),
      skip
    });

    const total = await TaskExecution.countDocuments({
      user_id: userId,
      ...(status && { status }),
      ...(platform_type && { platform_type })
    });

    res.json({
      success: true,
      tasks,
      pagination: {
        current: parseInt(page),
        pageSize: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('[PlatformAPI] 获取任务列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取任务列表失败'
    });
  }
});

/**
 * DELETE /api/tasks/:prompt_id - 取消任务
 * 任务取消接口
 */
router.delete('/tasks/:prompt_id', authenticateToken, async (req, res) => {
  try {
    const { prompt_id } = req.params;
    const userId = req.user.userId;

    // 查找任务执行记录
    const taskExecution = await TaskExecution.findOne({ 
      prompt_id, 
      user_id: userId 
    });

    if (!taskExecution) {
      return res.status(404).json({ 
        success: false, 
        message: '任务未找到' 
      });
    }

    if (taskExecution.is_completed) {
      return res.status(400).json({ 
        success: false, 
        message: '任务已完成，无法取消' 
      });
    }

    // 获取平台服务并取消任务
    const platformService = getPlatformService(taskExecution.platform_type);
    
    try {
      await platformService.cancelTask(prompt_id, taskExecution.api_config);
    } catch (cancelError) {
      console.warn('[PlatformAPI] 平台取消任务失败，仅更新本地状态:', cancelError.message);
    }

    // 更新本地状态
    taskExecution.status = 'cancelled';
    taskExecution.timing.completed_at = new Date();
    await taskExecution.save();

    res.json({
      success: true,
      message: '任务已取消'
    });

  } catch (error) {
    console.error('[PlatformAPI] 取消任务失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '取消任务失败'
    });
  }
});

module.exports = router;
