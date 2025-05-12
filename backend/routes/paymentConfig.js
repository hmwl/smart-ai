const express = require('express');
const router = express.Router();
const CreditSetting = require('../models/CreditSetting');

// Fixed ID for the single settings document
const SINGLE_SETTING_ID = 'global_credit_settings';

// GET /api/public/payment-config - Get payment configuration
router.get('/', async (req, res) => {
  try {
    const settings = await CreditSetting.findById(SINGLE_SETTING_ID);

    if (!settings) {
      // Default settings if none found in DB (should ideally be seeded)
      console.warn('Payment settings not found in DB, returning defaults.');
      return res.json({
        yuanToCreditsRate: 10, // Default rate
        currencySymbol: 'CNY',
        paymentMethods: [
          { key: 'alipay', name: '支付宝' },
          { key: 'wechat', name: '微信支付' }
        ]
      });
    }

    // Map stored payment platform keys to a more frontend-friendly format
    const paymentMethodMap = {
      'alipay': '支付宝',
      'wechat': '微信支付',
      'unionpay': '云闪付',
      'unifiedpay': '融合支付' // Example, adjust as needed
    };

    const availableMethods = settings.paymentPlatforms
      .map(platformKey => ({
        key: platformKey,
        name: paymentMethodMap[platformKey] || platformKey // Fallback to key if name not mapped
      }))
      .filter(method => paymentMethodMap[method.key]); // Only include methods we have a name for

    res.json({
      yuanToCreditsRate: settings.exchangeRate,
      currencySymbol: 'CNY', // Assuming CNY for now, can be made configurable later
      paymentMethods: availableMethods.length > 0 ? availableMethods : [
        // Provide default fallback if configured paymentPlatforms is empty or unmapped
        { key: 'alipay', name: '支付宝' }, 
        { key: 'wechat', name: '微信支付' }
      ]
    });

  } catch (error) {
    console.error('Error fetching payment configuration:', error);
    res.status(500).json({ message: '获取支付配置失败，服务器内部错误' });
  }
});

module.exports = router; 