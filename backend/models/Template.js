const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const generateCustomId = require('../utils/generateCustomId'); // Import the generator

// Schema for individual fields within a template
const TemplateFieldSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Field name is required.'],
        trim: true,
        // Add validation for field name format if needed (e.g., no spaces)
    },
    description: {
        type: String,
        required: [true, 'Field description is required.'],
        trim: true
    }
}, { _id: false });

const TemplateSchema = new Schema({
    _id: {
        type: String,
        default: () => generateCustomId('TP') // Generate ID on creation
    },
    name: {
        type: String,
        required: [true, 'Template name is required.'],
        unique: true,
        trim: true
    },
    type: {
        type: String,
        required: [true, 'Template type is required.'],
        enum: ['single', 'list', 'item'], // For single pages, collection lists, collection items
        index: true
    },
    content: {
        type: String,
        required: [true, 'Template content (HTML) is required.']
        // No default here, must be provided
    },
    // Removed fields array
    // fields: [TemplateFieldSchema] 
}, {
    timestamps: true
});

// --- Revision: Add pre-save hook for ID generation (only if NEW) ---
TemplateSchema.pre('save', function (next) {
    if (this.isNew && !this._id) { // Ensure ID is set only for new documents
        this._id = generateCustomId('TP');
    }
    next();
});
// --- End Revision ---

module.exports = mongoose.model('Template', TemplateSchema); 