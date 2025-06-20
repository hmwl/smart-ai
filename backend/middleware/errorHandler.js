/**
 * 统一错误处理中间件
 */

const errorHandler = (err, req, res, next) => {
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  // 默认错误响应
  let statusCode = 500;
  let message = '服务器内部错误';
  let details = null;

  // 根据错误类型设置响应
  if (err.name === 'ValidationError') {
    // Mongoose 验证错误
    statusCode = 400;
    message = '数据验证失败';
    details = Object.values(err.errors).map(e => e.message);
  } else if (err.name === 'CastError') {
    // Mongoose 类型转换错误
    statusCode = 400;
    message = '无效的数据格式';
    details = `无效的${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    // MongoDB 重复键错误
    statusCode = 409;
    message = '数据已存在';
    const field = Object.keys(err.keyPattern)[0];
    details = `${field} 已存在`;
  } else if (err.name === 'JsonWebTokenError') {
    // JWT 错误
    statusCode = 401;
    message = '无效的认证令牌';
  } else if (err.name === 'TokenExpiredError') {
    // JWT 过期错误
    statusCode = 401;
    message = '认证令牌已过期';
  } else if (err.statusCode) {
    // 自定义错误状态码
    statusCode = err.statusCode;
    message = err.message;
  }

  // 构建错误响应
  const errorResponse = {
    success: false,
    message: message,
    timestamp: new Date().toISOString()
  };

  // 在开发环境中包含更多错误信息
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = details;
    errorResponse.stack = err.stack;
  } else if (details) {
    errorResponse.details = details;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 错误处理中间件
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: '请求的资源不存在',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
};

/**
 * 异步错误包装器
 * 用于包装异步路由处理函数，自动捕获错误
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 自定义错误类
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  AppError
};
