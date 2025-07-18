const express = require('express');
const router = express.Router();
const User = require('../models/User'); // 引入 User 模型
const LoginHistory = require('../models/LoginHistory'); // 引入 LoginHistory 模型
const CreditSetting = require('../models/CreditSetting'); // 引入 CreditSetting 模型
const bcrypt = require('bcrypt'); // 引入 bcrypt
const mongoose = require('mongoose'); // 引入 mongoose
// Correctly import middleware from their respective files
const authenticateToken = require('../middleware/authenticateToken'); 
const isAdmin = require('../middleware/isAdmin'); 
const CreditTransaction = require('../models/CreditTransaction'); // Import CreditTransaction model

const SINGLE_CREDIT_SETTING_ID = 'global_credit_settings'; // ID for credit settings

// 应用 authenticateToken 到所有需要登录的路由
// 对于需要管理员权限的路由，再额外应用 isAdmin

// GET /api/users - 获取所有用户列表 (需要管理员权限)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    // Add filtering capabilities (example by username or status)
    let query = {};
    if (req.query.username) {
        query.username = new RegExp(req.query.username, 'i'); // Case-insensitive search
    }
    if (req.query.status && ['active', 'disabled'].includes(req.query.status)) {
        query.status = req.query.status;
    }
    // 支持 isAdmin 布尔类型查询
    if (req.query.isAdmin !== undefined) {
      if (req.query.isAdmin === 'true' || req.query.isAdmin === true) {
        query.isAdmin = true;
      } else if (req.query.isAdmin === 'false' || req.query.isAdmin === false) {
        query.isAdmin = false;
      }
    }
    // TODO: Add filtering by isAdmin if needed

    const totalRecords = await User.countDocuments(query);
    const users = await User.find(query)
                            .select('-passwordHash') // Exclude password hash
                            .sort({ createdAt: -1 }) // Sort by creation date, newest first
                            .skip(skip)
                            .limit(limit);

    res.json({
        data: users,
        totalRecords: totalRecords,
        currentPage: page,
        totalPages: Math.ceil(totalRecords / limit)
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: '获取用户列表失败' });
  }
});

// GET /api/users/:id/details - 获取单个用户的详细信息和登录历史 (管理员)
router.get('/:id/details', authenticateToken, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).select('-passwordHash -refreshToken');
    if (!user) {
      return res.status(404).json({ message: '未找到指定用户' });
    }

    // const loginHistory = await LoginHistory.find({ user: userId })
    //   .sort({ createdAt: -1 })
    //   .limit(50); // Limit to the last 50 logins for performance

    res.json({
      user,
      // loginHistory, // Login history is now fetched from a separate endpoint
    });

  } catch (err) {
    console.error(`Error fetching user details for ${req.params.id}:`, err);
    res.status(500).json({ message: '获取用户详情失败' });
  }
});

// GET /api/users/:id/login-history - 分页获取单个用户的登录历史 (管理员)
router.get('/:id/login-history', authenticateToken, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalRecords = await LoginHistory.countDocuments({ user: userId });
    const loginHistory = await LoginHistory.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      data: loginHistory,
      totalRecords: totalRecords,
      currentPage: page,
      totalPages: Math.ceil(totalRecords / limit)
    });

  } catch (err) {
    console.error(`Error fetching user login history for ${req.params.id}:`, err);
    res.status(500).json({ message: '获取用户登录历史失败' });
  }
});

// GET /api/users/:id - 获取单个用户信息 (需要登录用户)
// 如果设计为只有管理员或用户本人能看，逻辑会更复杂
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    // 检查 ID 格式是否有效 (可选，Mongoose 会处理无效 ID 但提前检查更友好)
    // --- Revision: Remove ObjectId validation as _id is now String ---
    /*
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: '无效的用户 ID 格式' });
    }
    */
    // --- End Revision ---

    const user = await User.findById(userId).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ message: '未找到指定用户' });
    }

    res.json(user);

  } catch (err) {
    console.error('Error fetching user by ID:', err);
    res.status(500).json({ message: '获取用户信息失败' });
  }
});

// POST /api/users - 创建新用户 (需要管理员权限)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  const { username, password, email, isAdmin, status } = req.body;

  // 基本验证
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' });
  }
  if (password.length < 6) { 
      return res.status(400).json({ message: '密码长度不能少于6位' });
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ message: '用户名已存在' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 获取初始积分设置
    let initialCreditsToAssign = 0; // Default to 0 if no settings found or specific value missing
    const creditSettings = await CreditSetting.findById(SINGLE_CREDIT_SETTING_ID);
    if (creditSettings && typeof creditSettings.initialCredits === 'number') {
      initialCreditsToAssign = creditSettings.initialCredits;
    }

    const newUserPayload = {
      username,
      passwordHash,
      email: email ? email.trim() : null,
      isAdmin: isAdmin || false,
      status: status || 'active',
      creditsBalance: initialCreditsToAssign // 设置初始积分
    };

    if (newUserPayload.email === '') {
        newUserPayload.email = null;
    }

    const newUser = new User(newUserPayload);
    const savedUser = await newUser.save();

    const userResponse = savedUser.toObject();
    delete userResponse.passwordHash;

    res.status(201).json(userResponse);

  } catch (err) {
    if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
      return res.status(409).json({ message: '邮箱已被注册' });
    }
    console.error('Error creating user:', err);
    res.status(500).json({ message: '创建用户失败: ' + err.message });
  }
});

// PUT /api/users/:id - 更新用户信息 (需要管理员权限)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { 
      email, 
      status, 
      isAdmin: newIsAdminValue, // Renamed to avoid conflict with isAdmin middleware
      password, 
      creditModificationType, 
      creditModificationAmount, 
      creditModificationReason 
    } = req.body; 

    // Find the user first
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '未找到指定用户' });
    }

    // Update standard fields
    if (email !== undefined) user.email = email; 
    if (status !== undefined && ['active', 'disabled'].includes(status)) user.status = status;
    
    // Admin status update logic (prevent self-demotion or last admin removal)
    if (newIsAdminValue !== undefined && user.isAdmin !== newIsAdminValue) {
      if (req.user.userId === userId && !newIsAdminValue) {
        return res.status(403).json({ message: "操作失败：不能移除自己的管理员权限。" });
      }
      if (user.isAdmin && !newIsAdminValue) { // If demoting an admin
        const adminCount = await User.countDocuments({ isAdmin: true });
        if (adminCount <= 1) {
          return res.status(400).json({ message: "操作失败：系统中至少需要保留一名管理员。" });
        }
      }
      user.isAdmin = newIsAdminValue;
    }

    // Handle password update separately
    if (password) {
        if (password.length < 6) {
            return res.status(400).json({ message: '新密码长度不能少于6位' });
        }
        const saltRounds = 10;
        user.passwordHash = await bcrypt.hash(password, saltRounds); 
    }

    // --- Handle Credit Modification ---
    if (creditModificationType && creditModificationType !== null) {
      if (typeof creditModificationAmount !== 'number' || !creditModificationReason || creditModificationReason.trim() === '') {
        return res.status(400).json({ message: '积分变动数额和原因说明均为必填项。' });
      }

      if (creditModificationType === 'grant' && creditModificationAmount < 0) {
        return res.status(400).json({ message: '赠送积分数额必须为非负数。' });
      }

      const balanceBefore = user.creditsBalance;
      user.creditsBalance += creditModificationAmount;
      // Optional: Prevent balance from going below zero if it's an adjustment and that's a business rule
      // if (creditModificationType === 'adjust' && user.creditsBalance < 0) { user.creditsBalance = 0; }

      const transactionType = creditModificationType === 'grant' ? 'grant' : 'adjustment';

      const creditTransaction = new CreditTransaction({
        user: user._id,
        type: transactionType, 
        creditsChanged: creditModificationAmount,
        balanceBefore: balanceBefore,
        balanceAfter: user.creditsBalance,
        description: creditModificationReason,
        referenceId: `ADMIN_OP_BY_${req.user.userId}` // Log which admin performed the action
      });
      await creditTransaction.save();
    }
    // --- End Credit Modification ---

    // Save the updated user
    const updatedUser = await user.save();

    // Return updated user info (excluding password hash)
    const userResponse = updatedUser.toObject();
    delete userResponse.passwordHash;
    delete userResponse.refreshToken; // Also hide refresh token
    delete userResponse.refreshTokenExpires;

    res.json(userResponse);

  } catch (err) {
    // Handle potential errors (like unique email constraint)
    if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
      return res.status(409).json({ message: '邮箱已被其他用户注册' });
    }
     if (err.name === 'ValidationError') {
        return res.status(400).json({ message: '验证错误: ' + err.message });
    }
    console.error('Error updating user:', err);
    res.status(500).json({ message: '更新用户信息失败' });
  }
});

// DELETE /api/users/:id - 删除用户 (需要管理员权限)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const userIdToDelete = req.params.id;

    // 检查是否试图删除自己
    if (req.user.userId === userIdToDelete) {
        return res.status(403).json({ message: '不能删除自己的账户' });
    }

    // 查找要删除的用户信息
    const userToDelete = await User.findById(userIdToDelete);
    if (!userToDelete) {
      return res.status(404).json({ message: '未找到指定用户' });
    }

    // 1. 禁止删除 'admin' 用户
    if (userToDelete.username === 'admin') {
      return res.status(403).json({ message: "不允许删除 \'admin\' 用户。" });
    }

    // 2. 确保至少保留一个管理员
    if (userToDelete.isAdmin) {
      const adminCount = await User.countDocuments({ isAdmin: true });
      if (adminCount <= 1) {
        return res.status(400).json({ message: '操作失败：系统中至少需要保留一名管理员。' });
      }
    }

    // 执行删除
    const deletedUserResult = await User.findByIdAndDelete(userIdToDelete);
    // findByIdAndDelete returns the deleted document or null if not found.
    // We already checked for user existence, so it should not be null here unless a race condition.

    res.status(200).json({ message: '用户删除成功', userId: userIdToDelete });

  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: '删除用户失败' });
  }
});

module.exports = router; 