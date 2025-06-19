const express = require('express');
const router = express.Router();
const AIWidget = require('../models/AIWidget');
const EnumConfig = require('../models/EnumConfig');
const AiApplication = require('../models/AiApplication');
const PromotionActivity = require('../models/PromotionActivity');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const jwt = require('jsonwebtoken');
const settingService = require('../services/settingService');
const authClientService = require('../services/authClientService');

// Helper function to attach active promotions to applications
const attachActivePromotions = async (application) => {
  if (!application) return application;

  const now = new Date();
  // Find the relevant promotion for this single application
  const promotion = await PromotionActivity.findOne({
    isEnabled: true, // Check isEnabled flag
    startTime: { $lte: now }, // Use startTime
    endTime: { $gte: now },   // Use endTime
    activityType: 'usage_discount',
    'activityDetails.usageDiscountSubType': 'app_specific_discount',
    'activityDetails.appSpecific.targetAppIds': application._id // Check if app ID is in the target list
  })
  // If multiple promotions could apply and you need to pick a specific one (e.g., latest), add .sort()
  // .sort({ createdAt: -1 }) // Example: get the most recently created one
  .lean();

  if (promotion && promotion.activityDetails && promotion.activityDetails.appSpecific) {
    const promoDetails = promotion.activityDetails.appSpecific;
    let promoDescription = promotion.name; // Default description

    if (promoDetails.discountType === 'percentage' && promoDetails.discountValue != null) {
        promoDescription = `${promoDetails.discountValue}% off`;
    } else if (promoDetails.discountType === 'fixed_reduction' && promoDetails.discountValue != null) {
        promoDescription = `立减 ${promoDetails.discountValue} 积分`;
    }
    // Fallback if discountValue is null for some reason but type is set
    else if (promoDetails.discountType === 'percentage') {
        promoDescription = `百分比折扣`;
    } else if (promoDetails.discountType === 'fixed_reduction') {
        promoDescription = `固定额度减免`;
    }


    application.activePromotion = {
      name: promotion.name,
      discountType: promoDetails.discountType,
      discountValue: promoDetails.discountValue,
      description: promoDescription,
      _id: promotion._id,
      startDate: promotion.startTime, // Map from startTime
      endDate: promotion.endTime     // Map from endTime
    };
  }
  return application;
};

/**
 * @route   POST /api/auth/client/send-registration-code
 * @desc    Send a registration code to the user's email
 * @access  Public
 */
router.post('/send-registration-code', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: '需要邮箱地址。' });
    }
    try {
        await authClientService.sendRegistrationCode(email);
        res.status(200).json({ message: '验证码已发送至您的邮箱。' });
    } catch (error) {
        console.error('[Route] Error in POST /api/auth/client/send-registration-code: ', error.message);
        res.status(400).json({ message: error.message });
    }
});

/**
 * @route   POST /api/auth/client/register
 * @desc    Register a new client user
 * @access  Public
 */
router.post('/register', async (req, res) => {
    const { username, email, password, code } = req.body;

    if (!username || !email || !password || !code) {
        return res.status(400).json({ message: '请填写所有必填项，包括验证码。' });
    }

    try {
        const newUser = await authClientService.registerUser(username, email, password, code);
        res.status(201).json({ 
            message: '注册成功。',
            user: { id: newUser._id, username: newUser.username }
        });
    } catch (error) {
        console.error('[Route] Error in POST /api/auth/client/register: ', error.message);
        res.status(400).json({ message: error.message });
    }
});

/**
 * @route   POST /api/auth/client/forgot-password
 * @desc    Initiate password reset
 * @access  Public
 */
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: '需要邮箱地址。' });
    }

    try {
        await authClientService.forgotPassword(email);
        res.status(200).json({ message: '如果该邮箱存在于我们的系统中，一封密码重置邮件已经发送到您的邮箱。' });
    } catch (error) {
        console.error('[Route] Error in POST /api/auth/client/forgot-password: ', error.message);
        // Do not reveal internal errors for this endpoint for security reasons
        res.status(200).json({ message: '如果该邮箱存在于我们的系统中，一封密码重置邮件已经发送到您的邮箱。' });
    }
});

/**
 * @route   POST /api/auth/client/reset-password
 * @desc    Reset password with a token
 * @access  Public
 */
router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
        return res.status(400).json({ message: '需要令牌和新密码。' });
    }

    try {
        await authClientService.resetPassword(token, password);
        res.status(200).json({ message: '密码重置成功，您现在可以使用新密码登录。' });
    } catch (error) {
        console.error('[Route] Error in POST /api/auth/client/reset-password: ', error.message);
        res.status(400).json({ message: error.message });
    }
});

// GET /api/auth/client/ai-widgets - Get enabled AI widgets for authenticated client use
router.get('/ai-widgets', async (req, res) => {
  try {
    const { status = 'enabled' } = req.query;
    const query = { status };

    const widgets = await AIWidget.find(query)
      .select('_id name description status creditsConsumed')
      .sort({ name: 1 });

    res.json({ list: widgets });
  } catch (error) {
    console.error('Error fetching AI widgets:', error);
    res.status(500).json({ message: '获取AI挂件列表失败' });
  }
});

// GET /api/auth/client/enum-types/:enumTypeId/configs - Get enum configs for authenticated client use
router.get('/enum-types/:enumTypeId/configs', async (req, res) => {
  try {
    const { enumTypeId } = req.params;

    const enumConfigs = await EnumConfig.find({
      enumType: enumTypeId,
      status: 'active'
    })
    .select('_id translation description') // 返回 translation 字段，移除 name 和 platform 字段
    .lean();

    res.json(enumConfigs);
  } catch (error) {
    console.error('Error fetching enum configs by type:', error);
    res.status(500).json({ message: '按类型获取枚举配置列表失败: ' + error.message });
  }
});

// GET /api/auth/client/ai-applications/:id - Get a single AI application by ID (authenticated)
router.get('/ai-applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let application = await AiApplication.findOne({ _id: id })
      .populate('type', 'name uri _id')
      .select('_id name description tags coverImageUrl type status creditsConsumed formSchema createdAt updatedAt')
      .lean();

    if (!application) {
      return res.status(404).json({ message: 'AI 应用未找到' });
    }

    // 清理 formSchema 中的敏感信息
    if (application.formSchema) {
      // 完全移除 comfyUIConfig
      delete application.formSchema.comfyUIConfig;

      // 清理字段配置中的敏感信息
      if (application.formSchema.fields) {
        application.formSchema.fields = application.formSchema.fields.map(field => {
          const cleanField = { ...field };

          // 移除 props 中的敏感信息
          if (cleanField.props) {
            const cleanProps = { ...cleanField.props };
            // 移除后端相关的敏感字段
            delete cleanProps.nodeId;  // ComfyUI节点ID
            delete cleanProps.key;     // ComfyUI参数key
            cleanField.props = cleanProps;
          }

          // 移除 config 中的敏感信息，只保留客户端需要的
          if (cleanField.config) {
            const {
              label,
              dataSourceType,
              enumTypeId,
              enumOptionIds,
              platformFieldOptions,
              enableConditionalLogic,
              conditionalLogicRules,
              conditionalLogicOperator,
              conditionalLogicVisibilityAction,
              conditionalLogicRequiredAction
            } = cleanField.config;

            cleanField.config = {
              label,
              dataSourceType,
              enumTypeId,
              enumOptionIds,
              platformFieldOptions,
              enableConditionalLogic,
              conditionalLogicRules,
              conditionalLogicOperator,
              conditionalLogicVisibilityAction,
              conditionalLogicRequiredAction
            };
          }

          return cleanField;
        });
      }
    }

    application = await attachActivePromotions(application); // Attach promotion

    res.json(application);
  } catch (err) {
    if (err.name === 'CastError') {
        return res.status(400).json({ message: '无效的应用ID格式' });
    }
    console.error(`Error fetching AI application ${req.params.id}:`, err);
    res.status(500).json({ message: '获取应用详情失败' });
  }
});

// POST /api/auth/client/widgets/:widgetId/execute - Execute a specific widget
router.post('/widgets/:widgetId/execute', async (req, res) => {
  try {
    const { widgetId } = req.params;
    const userId = req.user?.userId; // Correctly access userId

    if (!userId) {
      return res.status(401).json({ success: false, message: '用户未授权' });
    }

    const widget = await AIWidget.findById(widgetId);
    if (!widget) {
      return res.status(404).json({ success: false, message: '挂件未找到' });
    }
    if (widget.status !== 'enabled') {
      return res.status(400).json({ success: false, message: '该挂件当前不可用' });
    }

    const creditsToConsume = widget.creditsConsumed;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: '用户账户未找到' });
    }

    const balanceBeforeDeduction = user.creditsBalance; // Get balance before any potential deduction

    if (creditsToConsume > 0) {
      if (user.creditsBalance < creditsToConsume) {
        return res.status(400).json({ success: false, message: '积分不足，无法执行此挂件' });
      }
      user.creditsBalance -= creditsToConsume;
      await user.save(); // Save user only if credits were deducted
    }

    // Always record a transaction
    const balanceAfterDeduction = user.creditsBalance; // This is the current balance (either unchanged or deducted)

    const newTransaction = new CreditTransaction({
      user: userId,
      type: 'consumption',
      creditsChanged: -creditsToConsume, // This will be 0 for free widgets
      balanceBefore: balanceBeforeDeduction,
      balanceAfter: balanceAfterDeduction,
      description: `使用了AI挂件: ${widget.name}${creditsToConsume === 0 ? ' (免费)' : ''}`,
      transactionDetails: {
        widgetId: widget._id,
        widgetName: widget.name,
        executedBy: 'client'
      }
    });
    await newTransaction.save();

    // ****** Placeholder for Widget Execution Logic ******
    // Based on widget.type or widget.platform or specific widgetId, 
    // you would call a specific service here.
    // This service would handle the actual API call to OpenAI, ComfyUI, etc.
    // It would use req.body (e.g., req.body.currentFieldValue) as input.
    // Example: const executionResult = await WidgetExecutionService.execute(widget, req.body);
    // For now, we'll simulate a successful execution that might return an updated value.
    const simulatedUpdatedValue = req.body.currentFieldValue ? `Processed: ${req.body.currentFieldValue}` : "挂件执行完毕";
    // ****** End of Placeholder ******

    let message = `挂件 "${widget.name}" 执行成功。`;
    if (creditsToConsume > 0) {
      message += ` 已消耗 ${creditsToConsume} 积分。`;
    } else {
      message += ` (免费使用)`;
    }

    res.json({
      success: true,
      message: message,
      updatedFieldValue: simulatedUpdatedValue, // Send back the new value for the form field
      // rawOutput: executionResult.rawOutput // Or any other data from the widget execution
    });

  } catch (error) {
    console.error(`Error executing widget ${req.params.widgetId}:`, error);
    // TODO: Consider rolling back credit deduction if execution failed after deduction
    // (This is complex and needs careful thought, especially if widget execution itself has side effects)
    res.status(500).json({ success: false, message: error.message || '执行挂件时发生服务器内部错误' });
  }
});

// GET /api/auth/client/enum-configs/by-type/:typeId - Get enum configs by type ID
router.get('/enum-configs/by-type/:typeId', async (req, res) => {
  try {
    const { typeId } = req.params;

    const enumConfigs = await EnumConfig.find({
      enumType: typeId,
      status: 'active'
    })
    .select('_id translation description') // 返回 translation 字段，移除 name 和 platform 字段
    .lean();

    res.json(enumConfigs);
  } catch (error) {
    console.error('Error fetching enum configs by type:', error);
    res.status(500).json({ message: '按类型获取枚举配置列表失败: ' + error.message });
  }
});

module.exports = router;
