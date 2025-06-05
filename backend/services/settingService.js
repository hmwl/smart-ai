const Setting = require('../models/Setting');

// Default values if settings are not found in the DB
const DEFAULT_USER_COOKIE_EXPIRE = { value: 7, unit: 'd', name: 'User Cookie Expiration', description: 'Frontend user account cookie expiration time.' };
const DEFAULT_ADMIN_COOKIE_EXPIRE = { value: 1, unit: 'd', name: 'Admin Cookie Expiration', description: 'Admin panel account cookie expiration time.' };

/**
 * Retrieves cookie expiration settings for both user and admin.
 * If a setting is not found in the database, it returns a default value.
 */
exports.getCookieSettings = async () => {
  console.log('[Service] Attempting to get cookie settings...');
  try {
    let userCookieSetting = await Setting.findOne({ key: 'userCookieExpire' });
    let adminCookieSetting = await Setting.findOne({ key: 'adminCookieExpire' });

    if (!userCookieSetting) {
      console.log('[Service] User cookie setting not found, creating default...');
      userCookieSetting = await Setting.create({
        key: 'userCookieExpire',
        value: { value: DEFAULT_USER_COOKIE_EXPIRE.value, unit: DEFAULT_USER_COOKIE_EXPIRE.unit },
        name: DEFAULT_USER_COOKIE_EXPIRE.name,
        description: DEFAULT_USER_COOKIE_EXPIRE.description
      });
      if (!userCookieSetting) {
        // This case should ideally not happen if create is successful, but as a guard:
        console.error('[Service] CRITICAL: Failed to create default user cookie setting!');
        throw new Error('Failed to initialize user cookie setting in database.');
      }
    }

    if (!adminCookieSetting) {
      console.log('[Service] Admin cookie setting not found, creating default...');
      adminCookieSetting = await Setting.create({
        key: 'adminCookieExpire',
        value: { value: DEFAULT_ADMIN_COOKIE_EXPIRE.value, unit: DEFAULT_ADMIN_COOKIE_EXPIRE.unit },
        name: DEFAULT_ADMIN_COOKIE_EXPIRE.name,
        description: DEFAULT_ADMIN_COOKIE_EXPIRE.description
      });
      if (!adminCookieSetting) {
        // This case should ideally not happen if create is successful, but as a guard:
        console.error('[Service] CRITICAL: Failed to create default admin cookie setting!');
        throw new Error('Failed to initialize admin cookie setting in database.');
      }
    }
    
    console.log('[Service] Successfully retrieved/created cookie settings.');
    return {
      userCookieExpire: userCookieSetting.value,
      adminCookieExpire: adminCookieSetting.value,
    };
  } catch (error) {
    console.error('[Service] Error in getCookieSettings:', error.message, error.stack);
    throw error; // Re-throw the error to be caught by the route handler
  }
};

/**
 * Updates cookie expiration settings for user and/or admin.
 * @param {Object} settingsData - An object containing settings to update.
 * @param {Object} [settingsData.userCookieExpire] - User cookie expiration { value, unit }.
 * @param {Object} [settingsData.adminCookieExpire] - Admin cookie expiration { value, unit }.
 */
exports.updateCookieSettings = async (settingsData) => {
  console.log('[Service] Attempting to update cookie settings with data:', settingsData);
  const { userCookieExpire, adminCookieExpire } = settingsData;
  const updatedSettings = {};
  const errors = [];

  try {
    if (userCookieExpire && typeof userCookieExpire.value === 'number' && typeof userCookieExpire.unit === 'string') {
      const updated = await Setting.findOneAndUpdate(
        { key: 'userCookieExpire' },
        {
          value: { value: parseInt(userCookieExpire.value, 10), unit: userCookieExpire.unit },
          name: DEFAULT_USER_COOKIE_EXPIRE.name,
          description: DEFAULT_USER_COOKIE_EXPIRE.description
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      updatedSettings.userCookieExpire = updated.value;
    } else if (userCookieExpire) {
      errors.push('Invalid format for userCookieExpire.');
    }

    if (adminCookieExpire && typeof adminCookieExpire.value === 'number' && typeof adminCookieExpire.unit === 'string') {
      const updated = await Setting.findOneAndUpdate(
        { key: 'adminCookieExpire' },
        {
          value: { value: parseInt(adminCookieExpire.value, 10), unit: adminCookieExpire.unit },
          name: DEFAULT_ADMIN_COOKIE_EXPIRE.name,
          description: DEFAULT_ADMIN_COOKIE_EXPIRE.description
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      updatedSettings.adminCookieExpire = updated.value;
    } else if (adminCookieExpire) {
      errors.push('Invalid format for adminCookieExpire.');
    }

    if (errors.length > 0) {
      console.warn('[Service] Validation errors during updateCookieSettings:', errors.join(' '));
      throw new Error(errors.join(' '));
    }
    
    console.log('[Service] Successfully updated cookie settings. Result:', updatedSettings);
    return updatedSettings;
  } catch (error) {
    console.error('[Service] Error in updateCookieSettings:', error.message, error.stack);
    throw error; // Re-throw to be caught by controller/route handler
  }
}; 