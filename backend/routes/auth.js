const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LoginHistory = require('../models/LoginHistory'); // 引入 LoginHistory 模型
const uaparser = require('ua-parser-js'); // 引入 ua-parser-js
const crypto = require('crypto'); // 用于生成随机字符串
const ms = require('ms'); // 用于解析时间字符串，如 '7d'
const authenticateToken = require('../middleware/authenticateToken'); // 引入认证中间件
const AiApplication = require('../models/AiApplication'); // Added AiApplication model
const CreditTransaction = require('../models/CreditTransaction'); // Added CreditTransaction model
const PromotionActivity = require('../models/PromotionActivity'); // Added PromotionActivity model
const fs = require('fs');
const path = require('path');
const settingService = require('../services/settingService'); // Import settingService

// Dynamically load platform services
const platformsDir = path.join(__dirname, '../services/platforms');
const platformServiceMap = {};

fs.readdirSync(platformsDir).forEach(file => {
  if (file.endsWith('Service.js')) {
    const serviceName = file.replace('Service.js', '');
    const platformKey = serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
    platformServiceMap[platformKey] = require(path.join(platformsDir, file));
  }
});

// POST /api/auth/login - 用户登录
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: '请输入用户名和密码' });
  }

  try {
    // 1. 根据用户名查找用户
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: '用户名或密码错误' }); // 401 Unauthorized
    }

    // 2. 检查用户状态是否为 active
    if (user.status !== 'active') {
        return res.status(403).json({ message: '用户已被禁用' }); // 403 Forbidden
    }

    // 3. 比较密码哈希值
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    // 4. 密码匹配，生成 Access Token (JWT)
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('JWT_SECRET is not defined in .env file');
        return res.status(500).json({ message: '服务器内部错误: JWT 密钥未配置' });
    }

    const payload = {
      userId: user._id,
      username: user.username,
      isAdmin: user.isAdmin
      // 可以根据需要添加其他信息，但避免敏感信息
    };

    // Fetch admin cookie expiration setting
    const adminTokenLifetime = await settingService.getCookieExpirationString('adminCookieExpire');

    const accessToken = jwt.sign(
        payload,
        jwtSecret,
        { expiresIn: adminTokenLifetime } // Use dynamic admin expiration
    );

    // 5. 生成并存储 Refresh Token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenLifetime = process.env.REFRESH_TOKEN_LIFETIME || '7d'; // 从 .env 获取或默认 7 天
    user.refreshToken = refreshToken;
    user.refreshTokenExpires = Date.now() + ms(refreshTokenLifetime);

    // Update lastLoginAt timestamp
    user.lastLoginAt = new Date();

    // --- Revision: Use updateOne instead of save to avoid potential _id issues ---
    // await user.save(); // 保存 refresh token 和 lastLoginAt 到数据库
    await User.updateOne(
        { _id: user._id }, // Explicitly use the _id from the found user object
        {
            $set: {
                refreshToken: user.refreshToken,
                refreshTokenExpires: user.refreshTokenExpires,
                lastLoginAt: user.lastLoginAt
            }
        }
    );
    // --- End Revision ---

    // --- Record Login History ---
    try {
      const ua = uaparser(req.headers['user-agent']);
      const loginHistory = new LoginHistory({
        user: user._id,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: ua.ua,
        browser: ua.browser, // { name, version }
        os: ua.os, // { name, version }
        device: ua.device, // { vendor, model, type }
        cpu: ua.cpu, // { architecture }
      });
      await loginHistory.save();
    } catch (historyError) {
      console.error('Failed to save login history:', historyError);
      // Do not block login process if history fails to save
    }
    // --- End Record Login History ---

    // 6. 返回 Access Token, Refresh Token 和用户信息
    res.json({
      accessToken, // Access Token
      refreshToken, // Refresh Token
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: '登录失败，服务器内部错误' });
  }
});

// POST /api/auth/register - 用户注册
router.post('/register', async (req, res) => {
  const { username, password, email } = req.body;

  // 基本验证
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' });
  }
  // 密码复杂度验证
  if (password.length < 6) {
    return res.status(400).json({ message: '密码长度不能少于6位' });
  }
  // 可选：添加邮箱格式验证
  // if (email && !isValidEmailFormat(email)) { ... }

  try {
    // 检查用户名是否已存在
    let existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ message: '用户名已存在' });
    }

    // 如果提供了 email，检查 email 是否已存在
    if (email) {
        existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: '邮箱已被注册' });
        }
    }

    // 哈希密码
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 创建新用户 (默认非管理员，状态为 active)
    const newUser = new User({
      username,
      passwordHash,
      email: email || undefined, // 如果 email 为空字符串或 null，则不设置
      isAdmin: false, // 默认注册用户不是管理员
      status: 'active' // 默认状态为激活
    });

    const savedUser = await newUser.save();

    // 返回成功信息或新用户信息 (不含密码)
    const userResponse = savedUser.toObject();
    delete userResponse.passwordHash;

    // 可选：注册成功后自动登录，生成并返回 JWT
    // const jwtSecret = process.env.JWT_SECRET;
    // if (jwtSecret) { ... generate token ... res.json({ token, user: userResponse }); }
    // else { res.status(201).json(userResponse); }

    res.status(201).json({ message: '注册成功', user: userResponse });

  } catch (err) {
    // Mongoose 验证错误或其他错误
     if (err.code === 11000) { // Duplicate key error
        if (err.keyPattern.username) return res.status(409).json({ message: '用户名已存在' });
        if (err.keyPattern.email) return res.status(409).json({ message: '邮箱已被注册' });
    }
    console.error('Registration error:', err);
    res.status(500).json({ message: '注册失败，服务器内部错误' });
  }
});

// POST /api/auth/client/login - 客户端用户登录
router.post('/client/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: '请输入用户名和密码' });
  }

  try {
    // 1. 根据用户名查找用户
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    // 2. 检查用户是否为客户端用户 (isAdmin === false)
    if (user.isAdmin) {
      return res.status(403).json({ message: '用户名或密码错误' });
    }

    // 3. 检查用户状态是否为 active
    if (user.status !== 'active') {
      return res.status(403).json({ message: '用户已被禁用' });
    }

    // 4. 比较密码哈希值
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    // --- Record Login History ---
    try {
      const ua = uaparser(req.headers['user-agent']);
      const loginHistory = new LoginHistory({
        user: user._id,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: ua.ua,
        browser: ua.browser, // { name, version }
        os: ua.os, // { name, version }
        device: ua.device, // { vendor, model, type }
        cpu: ua.cpu, // { architecture }
      });
      await loginHistory.save();
    } catch (historyError) {
      console.error('Failed to save login history:', historyError);
      // Do not block login process if history fails to save
    }
    // --- End Record Login History ---

    // 5. 密码匹配，生成 Access Token (JWT)
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET is not defined in .env file');
      return res.status(500).json({ message: '服务器内部错误: JWT 密钥未配置' });
    }

    const payload = {
      userId: user._id,
      username: user.username,
    };

    // Fetch user cookie expiration setting
    const clientTokenLifetime = await settingService.getCookieExpirationString('userCookieExpire');

    const accessToken = jwt.sign(
      payload,
      jwtSecret,
      { expiresIn: clientTokenLifetime } // Use dynamic client expiration
    );

    // 6. 生成并存储 Refresh Token (与管理员登录逻辑类似)
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenLifetime = process.env.CLIENT_REFRESH_TOKEN_LIFETIME || '14d';
    
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          refreshToken: refreshToken,
          refreshTokenExpires: Date.now() + ms(refreshTokenLifetime),
          lastLoginAt: new Date()
        }
      }
    );

    // 7. 返回 Access Token, Refresh Token 和用户信息
    res.json({
      token: accessToken, // For consistency with client frontend (expects 'token')
      refreshToken: refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        creditsBalance: user.creditsBalance
        // Add other non-sensitive fields client might need
      },
      message: '客户端登录成功！'
    });

  } catch (err) {
    console.error('Client login error:', err);
    res.status(500).json({ message: '登录失败，服务器内部错误' });
  }
});

// POST /api/auth/refresh - 刷新 Access Token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: '未提供刷新令牌' });
  }

  try {
    // 1. 查找拥有此 refresh token 且未过期的用户
    const user = await User.findOne({
      refreshToken: refreshToken,
      refreshTokenExpires: { $gt: Date.now() } // 检查过期时间
    });

    if (!user) {
      // 如果找不到或已过期，要求重新登录
      return res.status(403).json({ message: '无效或已过期的刷新令牌，请重新登录' }); // 403 Forbidden
    }

    // --- 可选：Refresh Token 轮换 --- START
    // 为了提高安全性，可以在每次使用后都生成一个新的 Refresh Token
    // const newRefreshToken = crypto.randomBytes(40).toString('hex');
    // const refreshTokenLifetime = process.env.REFRESH_TOKEN_LIFETIME || '7d';
    // user.refreshToken = newRefreshToken;
    // user.refreshTokenExpires = Date.now() + ms(refreshTokenLifetime);
    // await user.save();
    // --- 可选：Refresh Token 轮换 --- END

    // 2. 生成新的 Access Token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET is not defined in .env file for refresh');
      return res.status(500).json({ message: '服务器内部错误: 认证配置不完整' });
    }

    const payload = {
      userId: user._id,
      username: user.username,
      isAdmin: user.isAdmin
    };
    const newAccessToken = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });

    // 3. 返回新的 Access Token (如果实现了轮换，也返回 newRefreshToken)
    res.json({
      accessToken: newAccessToken
      // , refreshToken: newRefreshToken // 如果实现了轮换，取消此行注释
    });

  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ message: '刷新令牌失败，服务器内部错误' });
  }
});

// POST /api/auth/logout - 用户登出
// 需要用户提供有效的 Access Token 来调用此接口
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // 从 authenticateToken 中间件获取 userId
    const userId = req.user.userId;

    // 查找用户并清除 refresh token 信息
    const user = await User.findOne({ _id: userId });
    if (user) {
      user.refreshToken = null;
      user.refreshTokenExpires = null;
      await user.save();
    }
    // 即使用户没找到或已经没有 token，也返回成功
    res.status(200).json({ message: '登出成功' });

  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: '登出失败，服务器内部错误' });
  }
});

// GET /api/auth/me - 获取当前登录用户信息
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select('-passwordHash -refreshToken -refreshTokenExpires'); // Exclude sensitive fields

    if (!user) {
      // This case should ideally not be reached if authenticateToken works correctly
      // and the token corresponds to an existing user.
      return res.status(404).json({ message: '用户未找到' });
    }

    res.json({
      id: user._id, // Ensure 'id' is included for frontend consistency if needed
      username: user.username,
      email: user.email,
      nickname: user.nickname,
      creditsBalance: user.creditsBalance,
      status: user.status,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      // Add any other non-sensitive fields the client might need
    });

  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ message: '获取用户信息失败，服务器内部错误' });
  }
});

// PATCH /api/auth/me - 更新当前登录用户信息 (例如: 昵称)
router.patch('/me', authenticateToken, async (req, res) => {
  const { nickname } = req.body;
  const userId = req.user.userId;

  // Validate nickname
  if (nickname === undefined) {
    // Allow unsetting nickname by providing nickname: null
    // If nickname field is not in body, it means no change requested for it.
    // However, our current plan is to only update nickname via this PATCH.
    // If other fields were updatable, we'd check `req.body.hasOwnProperty('nickname')`
    return res.status(400).json({ message: '请求体中未包含昵称' });
  }

  if (nickname !== null && (typeof nickname !== 'string' || nickname.trim() === '')) {
    // Allow null to clear nickname, but if provided and not null, it must be a non-empty string.
    // The model already has maxlength, so we primarily check for empty string if not null.
    // If a truly empty string is desired, the model should allow it. For now, non-empty if not null.
     return res.status(400).json({ message: '昵称不能为空' });
  }
  
  if (nickname !== null && nickname.length > 50) {
      return res.status(400).json({ message: '昵称长度不能超过50个字符' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户未找到' });
    }

    // Update nickname. If nickname is null, it will be set to null (cleared).
    // If it's a valid string, it will be updated.
    user.nickname = nickname === null ? null : nickname.trim();
    
    const updatedUser = await user.save();

    res.json({
      id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      nickname: updatedUser.nickname,
      creditsBalance: updatedUser.creditsBalance,
      status: updatedUser.status,
      isAdmin: updatedUser.isAdmin,
      createdAt: updatedUser.createdAt,
      message: '昵称更新成功'
    });

  } catch (err) {
    if (err.name === 'ValidationError') {
        // Mongoose validation errors (e.g. maxlength from schema)
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ message: messages.join(', ') });
    }
    console.error('Error updating nickname:', err);
    res.status(500).json({ message: '更新昵称失败，服务器内部错误' });
  }
});

// POST /api/auth/change-password - 用户修改密码
router.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const userId = req.user.userId;

  // Basic validation
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: '所有密码字段均为必填项' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: '新密码长度不能少于6位' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: '新密码和确认密码不匹配' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      // Should not happen if token is valid and user exists
      return res.status(404).json({ message: '用户未找到' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      // Return 400 Bad Request for incorrect current password
      return res.status(400).json({ message: '当前密码不正确' });
    }

    // Hash new password
    const saltRounds = 10; // Same as registration
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    user.passwordHash = newPasswordHash;
    await user.save();

    // Return success with forceLogout flag
    res.json({ message: '密码更新成功', forceLogout: true });

  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ message: '修改密码失败，服务器内部错误' });
  }
});

// POST /api/client/ai-applications/:id/launch - Client launches an AI application
router.post('/client/ai-applications/:id/launch', authenticateToken, async (req, res) => {
  console.log('[LAUNCH] --- Launch request received ---');
  let consumptionTransactionId = null;
  const { id: applicationId } = req.params;
  const userId = req.user ? req.user.userId : null;

  try {
    console.log(`[LAUNCH] 1. Validating user: ${userId}`);
    if (!userId) {
      // This case should ideally be caught by authenticateToken, but as a safeguard:
      return res.status(401).json({ message: '用户认证失败，无法执行操作。' });
    }

    // 1. Fetch User and Application, perform initial checks
    const currentUser = await User.findById(userId);
    if (!currentUser) return res.status(404).json({ message: '用户未找到。' });
    console.log(`[LAUNCH] 2. User found: ${currentUser.username}`);
    if (currentUser.isAdmin) return res.status(403).json({ message: '此操作仅限客户端用户。' });
    if (currentUser.status !== 'active') return res.status(403).json({ message: '用户账户已被禁用。' });

    const application = await AiApplication.findById(applicationId)
      .populate('type', 'name uri _id') // Keep type populated if needed for UI or other logic
      .populate('apis'); // Populate all API details for the service to use

    if (!application) return res.status(404).json({ message: 'AI 应用未找到。' });
    console.log(`[LAUNCH] 3. Application found: ${application.name}`);
    
    // --- DEBUG: Print the full application object ---
    console.log('[LAUNCH] DEBUG: Full application object from DB:', JSON.stringify(application, null, 2));
    // --- END DEBUG ---
    
    if (application.status !== 'active') return res.status(400).json({ message: `AI 应用 "${application.name}" 当前不可用。` });

    // 2. Determine Credits to Consume (with Promotion Logic)
    console.log('[LAUNCH] 4. Calculating credits and promotions.');
    let originalCreditsToConsume = application.creditsConsumed;
    let finalCreditsToConsume = originalCreditsToConsume;
    let appliedPromotionId = null;
    let appliedPromotionName = null;
    let promotion = null;

    const now = new Date();
    const promotionQuery = {
      isEnabled: true,
      startTime: { $lte: now },
      endTime: { $gte: now },
      activityType: 'usage_discount',
      'activityDetails.usageDiscountSubType': 'app_specific_discount',
      'activityDetails.appSpecific.targetAppIds': application._id.toString()
    };

    const applicablePromotions = await PromotionActivity.find(promotionQuery).sort({ createdAt: -1 });

    if (applicablePromotions.length > 0) {
      promotion = applicablePromotions[0];
      appliedPromotionId = promotion._id;
      appliedPromotionName = promotion.name;
      const appSpecificDetails = promotion.activityDetails.appSpecific;

      if (appSpecificDetails.discountType === 'percentage') {
        const discountRate = parseFloat(appSpecificDetails.discountValue);
        if (discountRate > 0 && discountRate <= 100) {
          finalCreditsToConsume = Math.max(0, Math.round(originalCreditsToConsume * (1 - discountRate / 100)));
        }
      } else if (appSpecificDetails.discountType === 'fixed_reduction') {
        const reductionAmount = parseInt(appSpecificDetails.discountValue, 10);
        if (reductionAmount > 0) {
          finalCreditsToConsume = Math.max(0, originalCreditsToConsume - reductionAmount);
        }
      }
    }

    // 3. Check and Deduct Credits
    const balanceBeforeConsumption = currentUser.creditsBalance;

    if (finalCreditsToConsume > 0) { // Only deduct if there's a cost
        if (balanceBeforeConsumption < finalCreditsToConsume) {
            return res.status(400).json({ message: `积分不足 (需要 ${finalCreditsToConsume}, 当前 ${balanceBeforeConsumption})，无法执行应用 "${application.name}"。` });
        }
        currentUser.creditsBalance -= finalCreditsToConsume;
        await currentUser.save();
    }
    

    const transactionDescription = appliedPromotionId ?
      `执行 AI 应用: ${application.name} (ID: ${applicationId}) (促销: ${appliedPromotionName})` :
      `执行 AI 应用: ${application.name} (ID: ${applicationId})`;

    const consumptionTransaction = new CreditTransaction({
      user: userId,
      type: 'consumption',
      aiApplication: applicationId,
      creditsChanged: -finalCreditsToConsume, // Use final (potentially discounted) amount
      balanceBefore: balanceBeforeConsumption,
      balanceAfter: currentUser.creditsBalance,
      description: transactionDescription,
      promotionActivity: appliedPromotionId // Link to promotion if applied
    });
    await consumptionTransaction.save();
    consumptionTransactionId = consumptionTransaction._id;
    console.log(`[LAUNCH] 5. Credit transaction saved: ${consumptionTransactionId}`);

    // 4. Dynamically get and execute platform-specific service
    console.log(`[LAUNCH] 6. Looking for service for platform: ${application.platformType}`);
    // Case-insensitive key lookup
    const platformTypeFromApp = application.platformType;
    const mapKeys = Object.keys(platformServiceMap);
    const matchingKey = mapKeys.find(key => key.toLowerCase() === platformTypeFromApp.toLowerCase());
    
    const ServiceClass = matchingKey ? platformServiceMap[matchingKey] : null;

    if (!ServiceClass) {
      // This error will trigger the refund logic below
      console.error(`[LAUNCH] ERROR: Service class not found for platform type: ${application.platformType}`);
      throw new Error(`平台类型 "${application.platformType}" 的服务处理程序未实现。`);
    }
    console.log(`[LAUNCH] 7. Service class found. Instantiating...`);

    const serviceInstance = new ServiceClass();
    let serviceResult;
    let clientResponseMessage = '';

    try {
      // Pass the full application model and any relevant client inputs (req.body could be used for this)
      console.log('[LAUNCH] 8. Executing serviceInstance.handleLaunchRequest...');
      serviceResult = await serviceInstance.handleLaunchRequest(application, req.body);
      console.log('[LAUNCH] 9. Service execution successful.');
      
      clientResponseMessage = serviceResult.clientMessage || `应用 "${application.name}" 服务执行成功。`;
      
      let successMessage = `${clientResponseMessage}`;
      if (finalCreditsToConsume > 0) {
        successMessage += ` 已消耗 ${finalCreditsToConsume} 积分。`;
      } else {
        successMessage += ` (免费使用${appliedPromotionId ? ' - 已应用优惠' : ''})`;
      }
      if (appliedPromotionId && finalCreditsToConsume > 0) { // Add promotion name if discount applied and cost > 0
          successMessage += ` (已应用促销: ${appliedPromotionName})`;
      }


      return res.json({
        message: successMessage,
        newBalance: currentUser.creditsBalance,
        transactionId: consumptionTransactionId,
        serviceData: serviceResult.data, // Pass through any data returned by the service
        creditsConsumed: finalCreditsToConsume, // Send back the actual consumed credits
        promotionApplied: !!appliedPromotionId,
        promotionName: appliedPromotionName,
        promotionStartDate: promotion ? promotion.startTime : undefined,
        promotionEndDate: promotion ? promotion.endTime : undefined
      });

    } catch (serviceExecutionError) {
      console.error(`[LAUNCH] ERROR inside service execution: ${serviceExecutionError.stack}`);
      clientResponseMessage = serviceExecutionError.message || `应用 "${application.name}" 服务执行失败。`;

      // Refund logic: only refund if credits were actually deducted
      if (finalCreditsToConsume > 0) {
        const balanceBeforeRefund = currentUser.creditsBalance;
        currentUser.creditsBalance += finalCreditsToConsume; // Add back the deducted credits
        await currentUser.save();

        const refundTransaction = new CreditTransaction({
          user: userId,
          type: 'refund',
          aiApplication: applicationId,
          creditsChanged: finalCreditsToConsume, // Amount that was deducted
          balanceBefore: balanceBeforeRefund,
          balanceAfter: currentUser.creditsBalance,
          description: `应用 "${application.name}" 执行失败退款. 原因: ${clientResponseMessage.substring(0, 150)}`, // Truncate error
          relatedTransaction: consumptionTransactionId,
          promotionActivity: appliedPromotionId // Keep track of promotion if one was involved in original charge
        });
        await refundTransaction.save();
        
        return res.status(500).json({ // Or 400/422 depending on error type
            message: `${clientResponseMessage} 已退还 ${finalCreditsToConsume} 积分。`,
            errorDetail: serviceExecutionError.message, // Full technical error for client debugging if needed
            newBalance: currentUser.creditsBalance,
            originalTransactionId: consumptionTransactionId,
            refundTransactionId: refundTransaction._id,
            creditsConsumed: 0, // No credits consumed after refund
            promotionApplied: !!appliedPromotionId, 
            promotionName: appliedPromotionName
        });
      } else { // If it was free and failed, just report error without refund
         return res.status(500).json({
            message: `${clientResponseMessage} (应用免费，未扣除积分)`,
            errorDetail: serviceExecutionError.message,
            newBalance: currentUser.creditsBalance,
            originalTransactionId: consumptionTransactionId, // Still send original transaction ID for reference
            creditsConsumed: 0,
            promotionApplied: !!appliedPromotionId,
            promotionName: appliedPromotionName
        });
      }
    }
  } catch (outerError) {
    console.error(`[LAUNCH] FATAL ERROR in outer try-catch: ${outerError.stack}`);
    
    // Avoid refund logic here if consumptionTransactionId is null, as credits weren't confirmed deducted.
    // If consumptionTransactionId exists, a more complex state might exist (e.g. DB error after deduction but before service call).
    // For now, keep it simple: if error is before service call or a setup issue, client message is generic.

    let responseStatus = 500;
    let clientMessage = `执行应用过程中发生严重错误。`;

    if (outerError.name === 'CastError' && outerError.path === '_id') {
        responseStatus = 400;
        clientMessage = '无效的应用ID格式。';
    } else if (outerError.message.includes('服务处理程序未实现')) {
        // This specific error from our logic should also be a 500, but can have a more specific message
        clientMessage = outerError.message; // Use the specific message
    } else {
        clientMessage = `执行应用时发生服务器错误: ${outerError.message.substring(0,100)}`;
    }
    
    // If credits were deducted (consumptionTransactionId is set) but we are in outerError AFTER that point
    // (e.g., error instantiating service, or an unexpected error before service.handleLaunchRequest call)
    // a refund MIGHT be needed, but the current structure doesn't explicitly handle refunding from outerError.
    // This implies the primary failure wasn't the service execution itself.
    // For robustness, one might check if consumptionTransactionId is set and outerError happened *after* credit deduction step.
    // For now, we assume outer errors are setup/config issues and don't auto-refund from here.
    // The service execution block has its own refund logic.

    return res.status(responseStatus).json({ 
        message: clientMessage + (consumptionTransactionId ? ' 请联系管理员核实您的积分。' : ''),
        error: outerError.message // Keep original error for server logs / admin diagnosis
    });
  }
});

// GET /api/client/ai-tasks/:promptId/status - Check status of an AI task
router.get('/client/ai-tasks/:promptId/status', authenticateToken, async (req, res) => {
  const { promptId } = req.params;
  const { apiUrl, platformType } = req.query;
  const userId = req.user ? req.user.userId : null;

  try {
    if (!userId) {
      return res.status(401).json({ message: '用户认证失败，无法执行操作。' });
    }

    if (!promptId || !apiUrl || !platformType) {
      return res.status(400).json({ message: '缺少必要的参数：promptId, apiUrl, 或 platformType' });
    }

    // Dynamically get the correct service based on platformType
    const mapKeys = Object.keys(platformServiceMap);
    const matchingKey = mapKeys.find(key => key.toLowerCase() === platformType.toLowerCase());
    
    const ServiceClass = matchingKey ? platformServiceMap[matchingKey] : null;

    if (!ServiceClass) {
      return res.status(400).json({ message: `不支持的平台类型: ${platformType}` });
    }

    const serviceInstance = new ServiceClass();
    
    // Call the checkTaskStatus method
    const statusResult = await serviceInstance.checkTaskStatus(promptId, apiUrl);
    
    return res.json(statusResult);
  } catch (error) {
    console.error(`Error checking task status: ${error.message}`);
    return res.status(500).json({ message: `检查任务状态失败: ${error.message}` });
  }
});

// GET /api/client/ai-tasks/:promptId/results - Get results of an AI task
router.get('/client/ai-tasks/:promptId/results', authenticateToken, async (req, res) => {
  const { promptId } = req.params;
  const { apiUrl, platformType, outputNodeId, outputType } = req.query;
  const userId = req.user ? req.user.userId : null;

  try {
    if (!userId) {
      return res.status(401).json({ message: '用户认证失败，无法执行操作。' });
    }

    if (!promptId || !apiUrl || !platformType) {
      return res.status(400).json({ message: '缺少必要的参数：promptId, apiUrl, 或 platformType' });
    }

    // Dynamically get the correct service based on platformType
    const mapKeys = Object.keys(platformServiceMap);
    const matchingKey = mapKeys.find(key => key.toLowerCase() === platformType.toLowerCase());
    
    const ServiceClass = matchingKey ? platformServiceMap[matchingKey] : null;

    if (!ServiceClass) {
      return res.status(400).json({ message: `不支持的平台类型: ${platformType}` });
    }

    const serviceInstance = new ServiceClass();
    
    // Call the getTaskResults method
    const resultData = await serviceInstance.getTaskResults(promptId, apiUrl, outputNodeId, outputType);
    
    return res.json(resultData);
  } catch (error) {
    console.error(`Error getting task results: ${error.message}`);
    return res.status(500).json({ message: `获取任务结果失败: ${error.message}` });
  }
});

module.exports = router; 