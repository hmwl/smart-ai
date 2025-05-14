const mongoose = require('mongoose');

const inspirationCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true, // This creates an index on {name: 1}
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, '分类简介不能超过200个字符']
  },
  works: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Work',
  }],
  order: {
    type: Number,
    default: 0, // For sorting categories themselves
  },
  // creator: { // User who created this category, for admin tracking
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'User',
  // },
  //作品数量: This will be a virtual or calculated field based on the length of the `works` array.
}, { timestamps: true });

inspirationCategorySchema.index({ order: 1 });

const InspirationCategory = mongoose.model('InspirationCategory', inspirationCategorySchema);

module.exports = InspirationCategory; 