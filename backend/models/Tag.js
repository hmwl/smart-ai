const mongoose = require('mongoose');
const generateCustomId = require('../utils/generateCustomId'); // Assuming you want custom IDs for tags too

const tagSchema = new mongoose.Schema({
  _id: { 
    type: String, 
    default: () => generateCustomId('TG') 
  },
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true, // Store tags in lowercase for consistency
    index: true,
  },
  // Optional: Add a counter for how many works use this tag
  // workCount: { type: Number, default: 0 }, 
  // Optional: createdBy if you want to track who created the tag
  // createdBy: { type: String, ref: 'User' } 
}, { timestamps: true });

const Tag = mongoose.model('Tag', tagSchema);

module.exports = Tag; 