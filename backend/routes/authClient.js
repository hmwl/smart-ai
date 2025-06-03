const express = require('express');
const router = express.Router();
const AIWidget = require('../models/AIWidget');
const EnumConfig = require('../models/EnumConfig');
const AiApplication = require('../models/AiApplication');
const PromotionActivity = require('../models/PromotionActivity');

// Helper function to attach active promotions to applications
const attachActivePromotions = async (application) => {
  if (!application) return application;

  const now = new Date();
  const activePromotion = await PromotionActivity.findOne({
    targetType: 'ai_application',
    targetId: application._id,
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now }
  }).select('name discountType discountValue description _id startDate endDate').lean();

  if (activePromotion) {
    application.activePromotion = activePromotion;
  }

  return application;
};

// GET /api/auth/client/ai-widgets - Get enabled AI widgets for authenticated client use
router.get('/ai-widgets', async (req, res) => {
  try {
    const { status = 'enabled' } = req.query;
    const query = { status };

    const widgets = await AIWidget.find(query)
      .select('_id name description status')
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

module.exports = router;
