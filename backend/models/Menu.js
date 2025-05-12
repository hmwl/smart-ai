const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const generateCustomId = require('../utils/generateCustomId'); // Import the generator

// Define the schema for a single menu item recursively
const MenuItemSchema = new Schema({
    title: {
        type: String,
        required: [true, 'Menu item title is required.']
    },
    type: {
        type: String,
        required: true,
        enum: ['page', 'external', 'submenu', 'divider'], // Added 'divider' type
        default: 'page'
    },
    pageId: { // Link to an internal Page document
        type: String,
        ref: 'Page',
        // Required only if type is 'page'
        required: function() { return this.type === 'page'; }
    },
    url: { // URL for external links
        type: String,
        // Required only if type is 'external'
        required: function() { return this.type === 'external'; }
        // Basic URL validation could be added here if desired
    },
    // Children array for submenus, using the same schema
    children: [this] // Recursive reference
}, { _id: false }); // Don't generate separate _id for sub-items by default

const MenuSchema = new Schema({
    _id: {
        type: String,
        default: () => generateCustomId('MN') // Generate ID on creation
    },
    name: { // User-friendly name (e.g., "Main Header Navigation")
        type: String,
        required: [true, 'Menu name is required.'],
        unique: true
    },
    location: { // Where this menu should appear (used for lookup)
        type: String,
        required: [true, 'Menu location is required.'],
        enum: ['header', 'footer', 'none'], // Add more locations as needed
        unique: true, // Enforce only one menu per location
        index: true
    },
    items: [MenuItemSchema] // Array of top-level menu items
}, {
    timestamps: true // Add createdAt and updatedAt timestamps
});

MenuSchema.pre('save', function (next) {
    if (this.isNew && !this._id) { // Ensure ID is set only for new documents
        this._id = generateCustomId('MN');
    }
    next();
});

// Pre-save hook or validation could be added here to ensure pageId exists
// or URL is valid, etc., if needed.

module.exports = mongoose.model('Menu', MenuSchema); 