const mongoose = require('mongoose');

const LoginHistorySchema = new mongoose.Schema({
  user: {
    type: String,
    ref: 'User',
    required: true,
    index: true,
  },
  ip: {
    type: String,
    required: true,
  },
  userAgent: {
    type: String,
  },
  // Parsed user agent details
  browser: {
    name: { type: String },
    version: { type: String },
  },
  os: {
    name: { type: String },
    version: { type: String },
  },
  device: {
    vendor: { type: String },
    model: { type: String },
    type: { type: String },
  },
  cpu: {
      architecture: { type: String },
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }, // Only track creation time
  versionKey: false,
});

// For better query performance
LoginHistorySchema.index({ createdAt: -1 });


module.exports = mongoose.model('LoginHistory', LoginHistorySchema); 