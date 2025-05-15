const mongoose = require('mongoose');
const generateCustomId = require('../utils/generateCustomId'); // Import the utility

const workSchema = new mongoose.Schema({
  _id: { // Define custom string ID
    type: String,
    default: () => generateCustomId('WK')
  },
  title: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['image', 'audio', 'video', 'model'], // GLB models would fall under 'model'
  },
  sourceUrl: { // URL to the actual file in /uploads or external link
    type: String,
    required: true,
    trim: true,
  },
  thumbnailUrl: { // Optional: URL to a specific thumbnail, especially for video/model
    type: String,
    trim: true,
  },
  prompt: {
    type: String,
    trim: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  creator: {
    type: String,
    ref: 'User',
    // required: true, // Might not always have a logged-in creator if works are added systemically
  },
  originalApplication: { // Optional: Link to the AI app that generated it
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AiApplication',
  },
  status: { // To differentiate works shown in the inspiration market vs all works
    type: String,
    enum: ['private', 'public_market'], // 'private' = available to be added, 'public_market' = shown in market
    default: 'private',
  },
  // For the inspiration market, we might need a separate field for category order if a work can be in multiple categories.
  // If a work is tied to a single InspirationCategory, then the order is managed in InspirationCategory.works array.
  // For now, assuming order within a category is handled by the InspirationCategory model.

  // Additional fields based on description:
  // WorkID: will be _id
  //作品缩略图: thumbnailUrl or sourceUrl
  //作品类型: type
  //提示词: prompt
  //标签: tags
  //创作人: creator (populated)
  //创作时间: createdAt (Mongoose timestamp)
  //数量 (右下角显示数量 - this seems to refer to a collection/batch, not a single work. Will clarify if needed)
}, { timestamps: true });

// Optional: Index fields for faster querying
workSchema.index({ type: 1 });
workSchema.index({ status: 1 });
workSchema.index({ creator: 1 });
workSchema.index({ tags: 1 });

const Work = mongoose.model('Work', workSchema);

module.exports = Work; 