const nodemailer = require('nodemailer');
const settingService = require('./settingService');

async function getTransporter() {
  const emailSettings = await settingService.getEmailSettings();
  if (!emailSettings || !emailSettings.host || !emailSettings.auth.user) {
    console.error('Email settings are not configured.');
    throw new Error('Email service is not configured.');
  }

  return nodemailer.createTransport({
    host: emailSettings.host,
    port: emailSettings.port,
    secure: emailSettings.secure, // true for 465, false for other ports
    auth: {
      user: emailSettings.auth.user,
      pass: emailSettings.auth.pass,
    },
  });
}

/**
 * Sends a verification email.
 * @param {string} to - Recipient's email address.
 * @param {string} token - The verification token.
 */
exports.sendVerificationEmail = async (to, token) => {
  const transporter = await getTransporter();
  const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;

  const mailOptions = {
    from: `"Your App Name" <${(await settingService.getEmailSettings()).auth.user}>`, // sender address
    to: to, // list of receivers
    subject: 'Please verify your email address', // Subject line
    text: `Please click on the following link to verify your email address: ${verificationLink}`, // plain text body
    html: `<b>Please click on the following link to verify your email address:</b> <a href="${verificationLink}">${verificationLink}</a>`, // html body
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Sends a registration verification code.
 * @param {string} to - Recipient's email address.
 * @param {string} code - The verification code.
 */
exports.sendRegistrationCode = async (to, code) => {
  const transporter = await getTransporter();
  const mailOptions = {
    from: `"Your App Name" <${(await settingService.getEmailSettings()).auth.user}>`,
    to: to,
    subject: '您的注册验证码',
    text: `您的验证码是: ${code}。该验证码将在10分钟内失效。`,
    html: `<b>您的验证码是: ${code}</b><p>该验证码将在10分钟内失效。</p>`,
  };
  await transporter.sendMail(mailOptions);
};

/**
 * Sends a password reset email.
 * @param {string} to - Recipient's email address.
 * @param {string} token - The password reset token.
 */
exports.sendPasswordResetEmail = async (to, token) => {
    const transporter = await getTransporter();
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/src/client/index.html#/reset-password?token=${token}`;

    const mailOptions = {
        from: `"Your App Name" <${(await settingService.getEmailSettings()).auth.user}>`,
        to: to,
        subject: 'Password Reset Request',
        text: `You requested a password reset. Please click on the following link to reset your password: ${resetLink}`,
        html: `<b>You requested a password reset.</b><br/>Please click on the following link to reset your password: <a href="${resetLink}">${resetLink}</a>`,
    };

    await transporter.sendMail(mailOptions);
}; 