const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const generateCustomId = require('../utils/generateCustomId'); // Import the generator

const ExternalApiSchema = new Schema({
    // --- Revision: Use String _id and default generator ---
    _id: {
        type: String,
        default: () => generateCustomId('EA') // Generate ID on creation
    },
    // --- End Revision ---
    platformName: {
        type: String,
        // ... existing code ...
    },
    updatedAt: Date
});

// --- Revision: Add pre-save hook for ID generation (only if NEW) ---
ExternalApiSchema.pre('save', function (next) {
    if (this.isNew && !this._id) { // Ensure ID is set only for new documents
        this._id = generateCustomId('EA');
    }
    next();
});
// --- End Revision ---

module.exports = mongoose.model('ExternalApi', ExternalApiSchema); 