const express = require('express');
const router = express.Router();
const settingService = require('../services/settingService');
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');

/**
 * @route   GET /api/settings/cookie
 * @desc    Get user and admin cookie expiration settings
 * @access  Private (Admin)
 */
router.get('/cookie', authenticateToken, isAdmin, async (req, res) => {
  try {
    const settings = await settingService.getCookieSettings();
    res.status(200).json(settings);
  } catch (error) {
    console.error('[Route] Error in GET /api/settings/cookie: ', error.message);
    console.error('[Route] Error stack: ', error.stack);
    res.status(500).json({ 
      message: 'Failed to retrieve cookie settings. Check server logs for details.', 
      error: error.message 
    });
  }
});

/**
 * @route   POST /api/settings/cookie
 * @desc    Update user and admin cookie expiration settings
 * @access  Private (Admin)
 */
router.post('/cookie', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userCookieExpire, adminCookieExpire } = req.body;
    if (!userCookieExpire && !adminCookieExpire) {
      console.warn('[Route] POST /api/settings/cookie - Bad Request: No settings provided.');
      return res.status(400).json({ message: 'No settings provided to update.' });
    }

    const updatedSettings = await settingService.updateCookieSettings({ userCookieExpire, adminCookieExpire });
    res.status(200).json({ message: 'Cookie settings updated successfully', settings: updatedSettings });
  } catch (error) {
    console.error('[Route] Error in POST /api/settings/cookie: ', error.message);
    console.error('[Route] Error stack: ', error.stack);
    res.status(500).json({ 
      message: 'Failed to update cookie settings. Check server logs for details.', 
      error: error.message 
    });
  }
});

module.exports = router; 