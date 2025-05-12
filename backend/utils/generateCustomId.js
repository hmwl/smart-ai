const crypto = require('crypto');

/**
 * Generates a custom ID string.
 * @param {string} prefix - A 2-character prefix for the ID (e.g., 'US', 'AP').
 * @returns {string} An 8-character ID (prefix + 6 random alphanumeric chars).
 */
function generateCustomId(prefix) {
  if (typeof prefix !== 'string' || prefix.length !== 2) {
    throw new Error('Prefix must be a 2-character string.');
  }
  // Generate 6 random alphanumeric characters (case-sensitive)
  // Using 3 bytes of random data, base64 encoding gives 4 chars per 3 bytes.
  // We'll take the first 6 characters. Base64 can include '+' and '/'.
  // Let's use URL-safe base64 and remove padding.
  const randomPart = crypto.randomBytes(4).toString('base64url').substring(0, 6); 

  return `${prefix}${randomPart}`;
}

module.exports = generateCustomId; 