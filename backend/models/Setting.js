const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed, // Allows storing various data types, like our { value: Number, unit: String } object
    required: true,
  },
  name: { // Optional: A human-readable name for the setting
    type: String,
    trim: true,
  },
  description: { // Optional: A brief description of what the setting does
    type: String,
    trim: true,
  }
}, { timestamps: true });

// Ensure unique key
SettingSchema.path('key').validate(async function (value) {
  if (!this.isNew && !this.isModified('key')) {
    return true;
  }
  const count = await mongoose.models.Setting.countDocuments({ key: value });
  return !count;
}, 'Setting key already exists.');

module.exports = mongoose.model('Setting', SettingSchema); 