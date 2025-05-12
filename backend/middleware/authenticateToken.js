const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  // 从 Authorization header 获取 token (通常格式为 'Bearer TOKEN')
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    // 如果没有 token，返回 401 未授权
    return res.status(401).json({ message: '未提供认证令牌' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('JWT_SECRET is not defined in .env file for authentication');
    return res.status(500).json({ message: '服务器内部错误: 认证配置不完整' });
  }

  // 验证 token
  jwt.verify(token, jwtSecret, (err, userPayload) => {
    if (err) {
      // 如果 token 无效或已过期，返回 403 禁止访问
      if (err.name === 'TokenExpiredError') {
          return res.status(403).json({ message: '认证令牌已过期' });
      }
      console.error('JWT verification error:', err.message);
      return res.status(403).json({ message: '无效的认证令牌' });
    }

    // Token 有效，将解码后的用户信息附加到请求对象上
    req.user = userPayload; // userPayload 包含 { userId, username, isAdmin, iat, exp }
    next(); // 继续处理请求
  });
}

// REMOVED redundant isAdmin function definition
/*
function isAdmin(req, res, next) {
    if (req.user && req.user.isAdmin) {
        next(); // 用户是管理员，继续
    } else {
        res.status(403).json({ message: '需要管理员权限' });
    }
}
*/

// Export ONLY the authenticateToken function
module.exports = authenticateToken; 