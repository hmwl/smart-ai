const nodemailer = require('nodemailer');
const settingService = require('./settingService');
const Template = require('../models/Template'); // Import the Template model

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
 * Renders an email template with the given data.
 * @param {string} content - The template string with placeholders like {{key}}.
 * @param {object} data - An object with key-value pairs to replace.
 * @returns {string} The rendered HTML string.
 */
function renderTemplate(content, data) {
  let rendered = content;
  for (const key in data) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    rendered = rendered.replace(regex, data[key]);
  }
  return rendered;
}

/**
 * Fetches an email template, renders it, and sends the email.
 * @param {string} emailSubType - The sub-type of the email template to use.
 * @param {string} to - The recipient's email address.
 * @param {object} data - Data to render into the template.
 */
async function sendEmailFromTemplate(emailSubType, to, data) {
  const template = await Template.findOne({ type: 'email', emailSubType });
  if (!template) {
    console.error(`Email template for subType "${emailSubType}" not found.`);
    throw new Error(`邮件模板 "${emailSubType}" 未找到，请在后台配置。`);
  }

  const transporter = await getTransporter();
  const smtpEmail = (await settingService.getEmailSettings()).auth.user;

  // Add global variables
  const allData = {
    appName: '您的应用名称', // This could be a global setting later
    ...data,
  };

  const mailOptions = {
    from: `"${renderTemplate(template.emailConfig.from, allData)}" <${smtpEmail}>`,
    to: to,
    subject: renderTemplate(template.emailConfig.subject, allData),
    html: renderTemplate(template.content, allData),
    // Add text version if it exists in the template
    ...(template.emailConfig.text && { text: renderTemplate(template.emailConfig.text, allData) }),
  };

  await transporter.sendMail(mailOptions);
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
 * Sends a registration verification code using a template.
 * @param {string} to - Recipient's email address.
 * @param {string} code - The verification code.
 * @param {string} [username] - Optional username for personalization.
 */
exports.sendRegistrationCode = async (to, code, username) => {
  await sendEmailFromTemplate('verification_code', to, { 
    email: to, 
    code,
    username: username || '新用户' // Provide a fallback
  });
};

/**
 * Sends a password reset email using a template.
 * @param {string} to - Recipient's email address.
 * @param {string} token - The password reset token.
 * @param {string} username - The user's username.
 */
exports.sendPasswordResetEmail = async (to, token, username) => {
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/src/client/index.html#/reset-password?token=${token}`;
    await sendEmailFromTemplate('password_reset', to, { 
      email: to, 
      resetLink,
      username
    });
}; 