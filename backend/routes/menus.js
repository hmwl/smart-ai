const express = require('express');
const router = express.Router();
const Menu = require('../models/Menu');
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');
const generateCustomId = require('../utils/generateCustomId'); // Import the ID generator

// --- Admin Routes --- 

// GET all menus (admin only)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        let menus = await Menu.find().sort({ location: 1 }); // Sort by location for consistency

        // --- Auto-create default menus if they don't exist ---
        const requiredLocations = ['header', 'footer'];
        const existingLocations = menus.map(m => m.location);
        const missingLocations = requiredLocations.filter(loc => !existingLocations.includes(loc));

        if (missingLocations.length > 0) {
            const defaultsToCreate = missingLocations.map(loc => ({
                _id: generateCustomId('MN'), // Explicitly generate custom string ID
                name: loc === 'header' ? '头部菜单' : '底部菜单',
                location: loc,
                items: []
            }));

            try {
                await Menu.insertMany(defaultsToCreate, { ordered: false }); // Insert missing ones, ignore duplicates if any race condition
                // Re-fetch the list to include the newly created ones
                menus = await Menu.find().sort({ location: 1 }); 
            } catch (creationError) {
                // Log the error but proceed with the potentially incomplete list
                console.error('Error auto-creating default menus:', creationError);
                // Don't send error to client, just log it. The menu list might be partially populated.
            }
        }
        // --- End auto-creation ---

        res.json(menus);
    } catch (error) {
        console.error('Error fetching menus:', error);
        res.status(500).json({ message: 'Error fetching menus', error: error.message });
    }
});

// GET a single menu by ID (admin only)
router.get('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        // Simplified: only find by string ID
        const menu = await Menu.findOne({ _id: req.params.id });
        if (!menu) {
            return res.status(404).json({ message: 'Menu not found' });
        }
        res.json(menu);
    } catch (error) {
        console.error('Error fetching menu by ID:', error);
        res.status(500).json({ message: 'Error fetching menu by ID', error: error.message });
    }
});

// POST create a new menu (admin only)
// Typically, you might only create one 'header' and one 'footer' menu initially.
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    // Basic validation for required fields
    const { name, location } = req.body;
    if (!name || !location) {
        return res.status(400).json({ message: 'Menu name and location are required.' });
    }
    // Validation for location enum could be added here if needed, though schema does it.

    const menu = new Menu({
        name: req.body.name,
        location: req.body.location,
        items: req.body.items || [] // Default to empty items array
    });

    try {
        const newMenu = await menu.save();
        res.status(201).json(newMenu);
    } catch (error) {
        console.error('Error creating menu:', error);
        if (error.code === 11000) { // Handle duplicate key error (likely location)
            return res.status(409).json({ message: `Menu with location '${req.body.location}' already exists.` });
        }
        res.status(400).json({ message: 'Error creating menu', error: error.message });
    }
});

// PUT update an existing menu by ID (admin only)
// This will be the main endpoint for saving the menu structure from the admin UI
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        // Simplified: only find by string ID
        const menu = await Menu.findOne({ _id: req.params.id });
        if (!menu) {
            return res.status(404).json({ message: 'Menu not found' });
        }

        // Update fields - carefully handle the nested 'items' array
        menu.name = req.body.name !== undefined ? req.body.name : menu.name; // Allow name change
        
        // Prevent changing location for default header/footer menus
        if (menu.location === 'header' || menu.location === 'footer') {
            if (req.body.location && req.body.location !== menu.location) {
                return res.status(403).json({ message: `不允许修改默认 ${menu.location} 菜单的位置。` });
            }
            // If location wasn't in req.body or was the same, we don't update it.
        } else {
             // Allow changing location for non-default menus
             if (req.body.location) {
                 // Add check for location conflict if changing for non-default
                if (req.body.location !== menu.location) {
                     const existingMenu = await Menu.findOne({ location: req.body.location, _id: { $ne: menu._id } });
                     if (existingMenu) {
                         return res.status(409).json({ message: `位置 '${req.body.location}' 已被其他菜单使用。` });
                     }
                 }
                 menu.location = req.body.location;
            }
        }

        // Completely replace the items array if provided in the request body
        // The frontend will send the full, updated structure
        if (req.body.items !== undefined) {
             menu.items = req.body.items;
        }

        // Add validation for the items structure if needed before saving

        const updatedMenu = await menu.save();
        res.json(updatedMenu);
    } catch (error) {
        console.error('Error updating menu:', error);
        if (error.code === 11000) { // Handle potential unique constraint violation if location is changed
            return res.status(409).json({ message: `Menu location '${req.body.location}' might already be in use.` });
        }
        res.status(400).json({ message: 'Error updating menu', error: error.message });
    }
});

// DELETE a menu by ID (admin only)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        // Simplified: find by string ID for check, then delete by that _id
        const menuToDelete = await Menu.findOne({ _id: req.params.id });

        if (!menuToDelete) {
            return res.status(404).json({ message: 'Menu not found' });
        }

        if (menuToDelete.location === 'header' || menuToDelete.location === 'footer') {
            return res.status(403).json({ message: `不允许删除默认的 ${menuToDelete.location} 菜单。` });
        }

        const deleteResult = await Menu.deleteOne({ _id: menuToDelete._id }); 

        if (deleteResult.deletedCount === 0) {
             // This case should ideally be caught by the checks above, but as a safeguard:
            return res.status(404).json({ message: 'Menu not found for deletion, or already deleted.' });
        }

        res.json({ message: 'Menu deleted successfully' });
    } catch (error) {
        console.error('Error deleting menu:', error);
        res.status(500).json({ message: 'Error deleting menu', error: error.message });
    }
});

// --- Public Route Removed --- 
// The /public/lookup route and populatePageRoutes function have been moved to routes/public.js

module.exports = router; 