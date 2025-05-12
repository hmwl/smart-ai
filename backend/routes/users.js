const express = require('express');
const router = express.Router();
const User = require('../models/User'); // 引入 User 模型
const CreditSetting = require('../models/CreditSetting'); // 引入 CreditSetting 模型
const bcrypt = require('bcrypt'); // 引入 bcrypt
const mongoose = require('mongoose'); // 引入 mongoose
// Correctly import middleware from their respective files
const authenticateToken = require('../middleware/authenticateToken'); 
const isAdmin = require('../middleware/isAdmin'); 

const SINGLE_CREDIT_SETTING_ID = 'global_credit_settings'; // ID for credit settings

// 应用 authenticateToken 到所有需要登录的路由
// 对于需要管理员权限的路由，再额外应用 isAdmin

// GET /api/users - 获取所有用户列表 (需要管理员权限)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    // 实际应用中需要添加分页、排序、过滤和权限检查
    const users = await User.find().select('-passwordHash'); // 查询所有用户，但不返回 passwordHash
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: '获取用户列表失败' });
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
    const { email, status, isAdmin, password } = req.body; // Destructure specific fields

    // --- Revision: Remove ObjectId validation as _id is now String ---
    /*
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: '无效的用户 ID 格式' });
    }
    */
    // --- End Revision ---

    // Find the user first
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '未找到指定用户' });
    }

    // Update allowed fields
    if (email !== undefined) user.email = email; // Allow updating email
    if (status !== undefined && ['active', 'disabled'].includes(status)) user.status = status;
    if (isAdmin !== undefined) {
        // Optional: Prevent admin from removing their own admin status?
        // if (req.user.userId === userId && isAdmin === false) {
        //     return res.status(403).json({ message: "不能移除自己的管理员权限" });
        // }
        user.isAdmin = isAdmin;
    }

    // Handle password update separately
    if (password) {
        if (password.length < 6) {
            return res.status(400).json({ message: '新密码长度不能少于6位' });
        }
        const saltRounds = 10;
        user.passwordHash = await bcrypt.hash(password, saltRounds); // Hash and update password
    }

    // Save the updated user
    // Mongoose validation will run automatically on save()
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