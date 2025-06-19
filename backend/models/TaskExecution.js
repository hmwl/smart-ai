const mongoose = require('mongoose');

/**
 * TaskExecution Model
 * 
 * 用于存储平台任务执行状态和相关信息
 */
const taskExecutionSchema = new mongoose.Schema({
  // 基础任务信息
  prompt_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // 平台特定的任务ID（如ComfyUI的task_id）
  platform_task_id: {
    type: String,
    index: true
  },
  
  // 关联的AI应用
  application_id: {
    type: mongoose.Schema.Types.Mixed, // 改为Mixed类型以支持字符串ID
    required: true,
    index: true
  },

  // 执行用户
  user_id: {
    type: mongoose.Schema.Types.Mixed, // 改为Mixed类型以支持字符串ID
    required: true,
    index: true
  },
  
  // 平台类型
  platform_type: {
    type: String,
    required: true,
    enum: ['ComfyUI', 'OpenAI', 'StableDiffusion', 'Midjourney'],
    index: true
  },
  
  // 使用的API配置
  api_config: {
    api_url: String,
    platform_name: String
  },
  
  // 任务状态
  status: {
    type: String,
    required: true,
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  // 队列信息
  queue_info: {
    position: Number,           // 在队列中的位置
    running_count: Number,      // 正在运行的任务数
    pending_count: Number       // 等待中的任务数
  },
  
  // 进度信息
  progress: {
    current_step: Number,       // 当前步骤
    total_steps: Number,        // 总步骤数
    percentage: Number,         // 完成百分比
    current_node_id: String,    // 当前执行的节点ID
    current_node_type: String,  // 当前执行的节点类型
    text_message: String        // 进度文本消息
  },
  
  // 工作流信息
  workflow_info: {
    total_nodes: Number,        // 总节点数
    executed_nodes: Number,     // 已执行节点数
    last_executed_node_id: String
  },
  
  // 执行时间信息
  timing: {
    submitted_at: {
      type: Date,
      default: Date.now
    },
    started_at: Date,           // 开始执行时间
    completed_at: Date,         // 完成时间
    execution_time: Number      // 执行耗时（秒）
  },
  
  // 输入数据
  input_data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // 输出结果
  output_data: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // 错误信息
  error_info: {
    message: String,
    code: String,
    details: mongoose.Schema.Types.Mixed
  },
  
  // 平台原始响应数据
  raw_responses: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['submit', 'status', 'result', 'error']
    },
    data: mongoose.Schema.Types.Mixed
  }],
  
  // 消费的积分
  credits_consumed: {
    type: Number,
    default: 0
  },
  
  // 重试信息
  retry_info: {
    count: {
      type: Number,
      default: 0
    },
    max_retries: {
      type: Number,
      default: 3
    },
    last_retry_at: Date
  }
}, {
  timestamps: true,
  collection: 'task_executions'
});

// 索引优化
taskExecutionSchema.index({ user_id: 1, status: 1 });
taskExecutionSchema.index({ application_id: 1, status: 1 });
taskExecutionSchema.index({ platform_type: 1, status: 1 });
taskExecutionSchema.index({ 'timing.submitted_at': -1 });

// 虚拟字段：是否完成
taskExecutionSchema.virtual('is_completed').get(function() {
  return ['completed', 'failed', 'cancelled'].includes(this.status);
});

// 虚拟字段：是否成功
taskExecutionSchema.virtual('is_successful').get(function() {
  return this.status === 'completed';
});

// 虚拟字段：总执行时间
taskExecutionSchema.virtual('total_execution_time').get(function() {
  if (this.timing.completed_at && this.timing.started_at) {
    return (this.timing.completed_at - this.timing.started_at) / 1000; // 秒
  }
  return null;
});

// 实例方法：更新状态
taskExecutionSchema.methods.updateStatus = function(newStatus, additionalData = {}) {
  this.status = newStatus;
  
  // 更新时间戳
  if (newStatus === 'running' && !this.timing.started_at) {
    this.timing.started_at = new Date();
  } else if (['completed', 'failed', 'cancelled'].includes(newStatus) && !this.timing.completed_at) {
    this.timing.completed_at = new Date();
  }
  
  // 合并额外数据
  Object.assign(this, additionalData);
  
  return this.save();
};

// 实例方法：添加原始响应
taskExecutionSchema.methods.addRawResponse = function(type, data) {
  this.raw_responses.push({
    type,
    data,
    timestamp: new Date()
  });
  return this.save();
};

// 实例方法：更新进度
taskExecutionSchema.methods.updateProgress = function(progressData) {
  this.progress = { ...this.progress, ...progressData };
  
  // 计算百分比
  if (progressData.current_step && progressData.total_steps) {
    this.progress.percentage = Math.round((progressData.current_step / progressData.total_steps) * 100);
  }
  
  return this.save();
};

// 静态方法：根据用户获取任务列表
taskExecutionSchema.statics.getByUser = function(userId, options = {}) {
  const {
    status,
    platform_type,
    limit = 20,
    skip = 0,
    sort = { 'timing.submitted_at': -1 }
  } = options;
  
  const query = { user_id: userId };
  if (status) query.status = status;
  if (platform_type) query.platform_type = platform_type;
  
  return this.find(query)
    .populate('application_id', 'name description')
    .sort(sort)
    .limit(limit)
    .skip(skip);
};

// 静态方法：获取活跃任务统计
taskExecutionSchema.statics.getActiveStats = function() {
  return this.aggregate([
    {
      $match: {
        status: { $in: ['pending', 'running'] }
      }
    },
    {
      $group: {
        _id: '$platform_type',
        pending_count: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        running_count: {
          $sum: { $cond: [{ $eq: ['$status', 'running'] }, 1, 0] }
        },
        total_count: { $sum: 1 }
      }
    }
  ]);
};

const TaskExecution = mongoose.model('TaskExecution', taskExecutionSchema);

module.exports = TaskExecution;
