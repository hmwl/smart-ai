const express = require('express');
const router = express.Router();
const CreditSetting = require('../models/CreditSetting');
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');

const SINGLE_SETTING_ID = 'global_credit_settings'; // Must match the ID in the model

// GET /api/credit-settings - Get current credit settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    let settings = await CreditSetting.findById(SINGLE_SETTING_ID);
    if (!settings) {
      // If no settings exist, create them with default values from the model
      settings = new CreditSetting();
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching credit settings:', error);
    res.status(500).json({ message: '获取积分设置失败: ' + error.message });
  }
});

// PUT /api/credit-settings - Update credit settings
router.put('/', authenticateToken, isAdmin, async (req, res) => {
  const { initialCredits, exchangeRate, paymentPlatforms } = req.body;

  try {
    let settings = await CreditSetting.findById(SINGLE_SETTING_ID);
    if (!settings) {
      // This case should ideally be handled by the GET request creating it if not found,
      // but as a fallback, or if GET wasn't called first.
      settings = new CreditSetting({
        _id: SINGLE_SETTING_ID, // Ensure the fixed ID is used
        initialCredits: initialCredits !== undefined ? initialCredits : undefined, // Use model default if not provided
        exchangeRate: exchangeRate !== undefined ? exchangeRate : undefined,
        paymentPlatforms: paymentPlatforms !== undefined ? paymentPlatforms : []
      });
    } else {
      // Update existing settings
      if (initialCredits !== undefined) settings.initialCredits = initialCredits;
      if (exchangeRate !== undefined) settings.exchangeRate = exchangeRate;
      if (paymentPlatforms !== undefined) settings.paymentPlatforms = paymentPlatforms;
    }

    const updatedSettings = await settings.save();
    res.json(updatedSettings);
  } catch (error) {
    console.error('Error updating credit settings:', error);
    if (error.name === 'ValidationError') {
        let errors = Object.values(error.errors).map(el => el.message);
        return res.status(400).json({ message: `更新积分设置验证失败: ${errors.join(', ')}` });
    }
    res.status(500).json({ message: '更新积分设置失败: ' + error.message });
  }
});

module.exports = router; 