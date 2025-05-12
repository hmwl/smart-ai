const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const generateCustomId = require('../utils/generateCustomId'); // Import the generator

const articleSchema = new Schema({
  _id: {
    type: String,
    default: () => generateCustomId('AR') // Generate ID on creation
  },
  title: {
    type: String,
    required: true,
    trim: true,
    index: true // Index title for faster searching/sorting
  },
  excerpt: {
    type: String,
    trim: true
  },
  slug: {
    type: String,
    // required: [true, '文章的唯一标识符 (slug) 不能为空'], // 将变为自动生成或可选
    unique: true,
    trim: true,
    index: true
  },
  page: {
    type: String,
    ref: 'Page',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  author: { // Optional author name
    type: String,
    trim: true,
    default: 'Admin' // Or null, or link to User later
  },
  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active',
    index: true
  },
  publishDate: { // Optional publish date
    type: Date,
    default: null
  },
  updatedAt: Date
}, {
  timestamps: true // Automatically add createdAt and updatedAt
});

// Ensure an article title is unique within its parent page (optional but often useful)
// articleSchema.index({ page: 1, title: 1 }, { unique: true });

// 辅助函数：将文本转换为 slug 格式 (这个函数在新的slug生成逻辑中不再直接使用，但可以保留以备他用或移除)
/* function slugify(text) { ... } */

// Add pre-save hook for ID generation (only if NEW) and Slug generation
articleSchema.pre('save', async function (next) {
    if (this.isNew && !this._id) { // Ensure ID is set only for new documents
        this._id = generateCustomId('AR');
    }

    // 自动生成 slug (如果 slug 为空且是新文档)
    if (this.isNew && (!this.slug || this.slug.trim() === '')) {
        let uniqueSlug = '';
        let attempts = 0;
        const Model = this.constructor;
        const MAX_ATTEMPTS = 10; 
        const crypto = require('crypto'); 

        const pageId = this.page; // Get the pageId from the article document

        while (attempts < MAX_ATTEMPTS) {
            const timestampPart = Date.now().toString(36).slice(-5); 
            const randomPart = Math.random().toString(36).substring(2, 5); 
            let baseRandomSlug = timestampPart + randomPart; // Random part, e.g., "ae48ytdc"
            
            // New slug format: "{page_id}_{random_part}" (NO /articles/ prefix here)
            uniqueSlug = `${pageId}_${baseRandomSlug}`;

            // eslint-disable-next-line no-await-in-loop
            if (!(await Model.exists({ slug: uniqueSlug }))) {
                break; // Found a unique slug
            }
            uniqueSlug = ''; // Reset for next attempt
            attempts++;
            if (attempts >= MAX_ATTEMPTS) { 
                console.warn(`Warning: Slug generation for title '${this.title}' on page '${pageId}' reached ${MAX_ATTEMPTS} attempts. Falling back to a stronger unique slug.`);
                let fallbackRandomSlug = Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
                uniqueSlug = `${pageId}_${fallbackRandomSlug}`; // Fallback also without prefix
                // eslint-disable-next-line no-await-in-loop
                if (await Model.exists({ slug: uniqueSlug })) {
                    console.error("CRITICAL: Fallback slug with pageId prefix collided. This should be extremely rare.");
                    return next(new Error('Failed to generate a unique slug even with fallback and pageId prefix.'));
                }
                break;
            }
        }
        this.slug = uniqueSlug;
    }

    next();
});

const Article = mongoose.model('Article', articleSchema);

module.exports = Article; 