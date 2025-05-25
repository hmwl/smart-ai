const crypto = require('crypto');

const KEY_HEX = process.env.CONTENT_ENCRYPTION_KEY;
if (!KEY_HEX) {
  throw new Error('CONTENT_ENCRYPTION_KEY 环境变量未设置');
}
const KEY = Buffer.from(KEY_HEX, 'hex'); // 32字节

function encryptAesGcm(plaintext) {
  const iv = crypto.randomBytes(12); // 12字节IV
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

function decryptAesGcm({ ciphertext, iv, authTag }) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final()
  ]);
  return plaintext.toString('utf8');
}

module.exports = { encryptAesGcm, decryptAesGcm }; 