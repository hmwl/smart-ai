const User = require('../models/User');
const VerificationCode = require('../models/VerificationCode');
const CreditSetting = require('../models/CreditSetting');
const emailService = require('./emailService');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Generate and send a registration verification code.
 * @param {string} email
 * @param {string} [username] - Optional username for personalization.
 * @returns {Promise<void>}
 */
exports.sendRegistrationCode = async (email, username) => {
  // Check if an active user with this email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser && existingUser.status === 'active') {
    throw new Error('该邮箱已被注册。');
  }

  const code = crypto.randomInt(100000, 999999).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  await VerificationCode.findOneAndUpdate(
    { email },
    { code, expires },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await emailService.sendRegistrationCode(email, code, username);
};

/**
 * Register a new client user after verifying the code.
 * @param {string} username
 * @param {string} email
 * @param {string} password
 * @param {string} code
 * @returns {Promise<User>}
 */
exports.registerUser = async (username, email, password, code) => {
  const verification = await VerificationCode.findOne({ email, code });

  if (!verification) {
    throw new Error('验证码无效或已过期。');
  }
  
  // Check if user with the same username or email already exists
  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser) {
    if (existingUser.username === username) throw new Error('用户名已存在。');
    if (existingUser.email === email) throw new Error('邮箱已被注册。');
  }

  // Fetch initial credits from settings
  let initialCredits = 0; // Default to 0
  const creditSettings = await CreditSetting.findById('global_credit_settings');
  if (creditSettings) {
    initialCredits = creditSettings.initialCredits;
  }

  const newUser = new User({
    username,
    email,
    passwordHash: password, // The pre-save hook will hash this
    status: 'active', // Directly activate the user
    isAdmin: false,
    creditsBalance: initialCredits, // Assign initial credits
  });

  await newUser.save();

  // Delete the verification code after successful registration
  await VerificationCode.deleteOne({ _id: verification._id });

  return newUser;
};

/**
 * Verify user's email with a verification code.
 * @param {string} email
 * @param {string} code
 * @returns {Promise<boolean>}
 */
exports.verifyEmailCode = async (email, code) => {
    const user = await User.findOne({ email });

    if (!user) {
        throw new Error('用户不存在。');
    }

    if (user.verificationCode !== code) {
        throw new Error('验证码无效。');
    }

    if (user.verificationCodeExpires < new Date()) {
        throw new Error('验证码已过期。');
    }

    user.status = 'active';
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();
    return true;
};

/**
 * Initiate password reset process for a user.
 * @param {string} email
 * @returns {Promise<void>}
 */
exports.forgotPassword = async (email) => {
    const user = await User.findOne({ email });
    if (!user) {
        // Don't reveal that the user does not exist
        console.warn(`Password reset attempt for non-existent email: ${email}`);
        return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = jwt.sign({ id: user._id, token: resetToken }, process.env.JWT_SECRET || 'a-very-secret-key-for-password-reset', { expiresIn: '1h' });
    user.resetPasswordTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    await user.save();
    await emailService.sendPasswordResetEmail(user.email, user.resetPasswordToken, user.username);
};

/**
 * Reset user's password using a token.
 * @param {string} token
 * @param {string} password
 * @returns {Promise<boolean>}
 */
exports.resetPassword = async (token, password) => {
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || 'a-very-secret-key-for-password-reset');
    } catch (e) {
        throw new Error('无效或过期的重置令牌。');
    }
    
    const user = await User.findOne({
        _id: decoded.id,
        resetPasswordToken: token,
        resetPasswordTokenExpires: { $gt: new Date() },
    });

    if (!user) {
        throw new Error('无效或过期的重置令牌。');
    }

    user.passwordHash = password; // Pre-save hook will hash it
    user.resetPasswordToken = null;
    user.resetPasswordTokenExpires = null;
    
    // Also clear verification code fields if they exist from a pending state
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    user.status = 'active'; // Ensure user is active

    await user.save();
    return true;
}; 