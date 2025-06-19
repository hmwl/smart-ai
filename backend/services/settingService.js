const Setting = require('../models/Setting');

// Default values if settings are not found in the DB
const DEFAULT_USER_COOKIE_EXPIRE = { value: 7, unit: 'd', name: 'User Cookie Expiration', description: 'Frontend user account cookie expiration time.' };
const DEFAULT_ADMIN_COOKIE_EXPIRE = { value: 1, unit: 'd', name: 'Admin Cookie Expiration', description: 'Admin panel account cookie expiration time.' };
const DEFAULT_EMAIL_SETTINGS = {
  host: '',
  port: 465,
  secure: true,
  auth: {
    user: '',
    pass: '',
  },
  name: 'Email Server Settings',
  description: 'Settings for the email server (SMTP) used for sending emails like registration verification.'
};

/**
 * Retrieves cookie expiration settings for both user and admin.
 * If a setting is not found in the database, it returns a default value.
 */
exports.getCookieSettings = async () => {
  try {
    let userCookieSetting = await Setting.findOne({ key: 'userCookieExpire' });
    let adminCookieSetting = await Setting.findOne({ key: 'adminCookieExpire' });

    if (!userCookieSetting) {
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
    
    return updatedSettings;
  } catch (error) {
    console.error('[Service] Error in updateCookieSettings:', error.message, error.stack);
    throw error; // Re-throw to be caught by controller/route handler
  }
};

/**
 * Retrieves a single cookie expiration setting and formats it as a string (e.g., "7d", "1h").
 * @param {string} key - The setting key ('userCookieExpire' or 'adminCookieExpire').
 * @returns {string} The expiration string or a default if not found/invalid.
 */
exports.getCookieExpirationString = async (key) => {
  try {
    const setting = await Setting.findOne({ key });
    if (setting && setting.value && typeof setting.value.value === 'number' && typeof setting.value.unit === 'string') {
      return `${setting.value.value}${setting.value.unit}`;
    }
    // Return default if not found or invalid format
    if (key === 'userCookieExpire') {
      return `${DEFAULT_USER_COOKIE_EXPIRE.value}${DEFAULT_USER_COOKIE_EXPIRE.unit}`;
    }
    if (key === 'adminCookieExpire') {
      return `${DEFAULT_ADMIN_COOKIE_EXPIRE.value}${DEFAULT_ADMIN_COOKIE_EXPIRE.unit}`;
    }
    // Fallback for any other unexpected key, though primarily for user/admin
    return '1h'; // Generic default
  } catch (error) {
    console.error(`[Service] Error in getCookieExpirationString for key ${key}:`, error.message);
    // Fallback to default on error
    if (key === 'userCookieExpire') return `${DEFAULT_USER_COOKIE_EXPIRE.value}${DEFAULT_USER_COOKIE_EXPIRE.unit}`;
    if (key === 'adminCookieExpire') return `${DEFAULT_ADMIN_COOKIE_EXPIRE.value}${DEFAULT_ADMIN_COOKIE_EXPIRE.unit}`;
    return '1h';
  }
};

/**
 * Retrieves email server settings.
 * If the setting is not found in the database, it returns a default value.
 */
exports.getEmailSettings = async () => {
  try {
    let emailSetting = await Setting.findOne({ key: 'emailSettings' });

    if (!emailSetting) {
      emailSetting = await Setting.create({
        key: 'emailSettings',
        value: {
          host: DEFAULT_EMAIL_SETTINGS.host,
          port: DEFAULT_EMAIL_SETTINGS.port,
          secure: DEFAULT_EMAIL_SETTINGS.secure,
          auth: { ...DEFAULT_EMAIL_SETTINGS.auth }
        },
        name: DEFAULT_EMAIL_SETTINGS.name,
        description: DEFAULT_EMAIL_SETTINGS.description
      });
      if (!emailSetting) {
        console.error('[Service] CRITICAL: Failed to create default email settings!');
        throw new Error('Failed to initialize email settings in database.');
      }
    }
    
    return emailSetting.value;
  } catch (error) {
    console.error('[Service] Error in getEmailSettings:', error.message, error.stack);
    throw error;
  }
};

/**
 * Updates email server settings.
 * @param {Object} settingsData - An object containing settings to update.
 */
exports.updateEmailSettings = async (settingsData) => {
  const { host, port, secure, auth } = settingsData;
  const errors = [];

  try {
    if (settingsData) {
      // Basic validation
      if (typeof host !== 'string' || host.trim() === '') errors.push('Host is required.');
      if (typeof port !== 'number' || port <= 0) errors.push('Port must be a positive number.');
      if (typeof auth !== 'object' || auth === null) errors.push('Auth object is required.');
      if (typeof auth.user !== 'string' || auth.user.trim() === '') errors.push('Auth user is required.');
      // password can be empty string if user wants to clear it
      if (typeof auth.pass !== 'string') errors.push('Auth password must be a string.');

      if (errors.length > 0) {
        throw new Error(errors.join(' '));
      }

      const updated = await Setting.findOneAndUpdate(
        { key: 'emailSettings' },
        {
          value: { host, port, secure, auth },
          name: DEFAULT_EMAIL_SETTINGS.name,
          description: DEFAULT_EMAIL_SETTINGS.description
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return updated.value;
    } else {
      throw new Error('No settings provided to update.');
    }
  } catch (error) {
    console.error('[Service] Error in updateEmailSettings:', error.message, error.stack);
    throw error;
  }
}; 