const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VerificationCodeSchema = new Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  code: {
    type: String,
    required: true,
  },
  expires: {
    type: Date,
    required: true,
    // Automatically remove documents after they expire
    // The 'expireAfterSeconds' option must be on a field with a Date value
    // We set it to 0 so it expires at the exact time specified in 'expires'
    expires: 0, 
  }
}, { timestamps: true });

// To ensure one code per email, we can use a unique index if we always upsert
// or just manage it through application logic (e.g., findOneAndUpdate).
// For simplicity, we'll manage via logic.

module.exports = mongoose.model('VerificationCode', VerificationCodeSchema); 