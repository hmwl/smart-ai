const express = require('express');
const router = express.Router();
const Template = require('../models/Template');
const Page = require('../models/Page');
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');

// --- Admin Routes --- 

// GET all templates
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const skip = (page - 1) * limit;

        // Add filtering capabilities (example by name or type)
        let query = {};
        if (req.query.name) {
            query.name = new RegExp(req.query.name, 'i'); // Case-insensitive search
        }
        if (req.query.type && ['single', 'list', 'item'].includes(req.query.type)) {
            query.type = req.query.type;
        }

        const totalRecords = await Template.countDocuments(query);
        const templates = await Template.find(query)
                                      .sort({ type: 1, name: 1 })
                                      .skip(skip)
                                      .limit(limit)
                                      .lean(); // Use .lean() for performance and easy modification
        
        // For each template in the current page, calculate its usage count by Pages
        const templatesWithUsage = await Promise.all(templates.map(async (template) => {
            const usageCount = await Page.countDocuments({
                $or: [
                    { templateSingle: template._id },
                    { templateList: template._id },
                    { templateItem: template._id }
                ]
            });
            return { ...template, usageCount }; // Add usageCount to the lean object
        }));
        
        res.json({
            data: templatesWithUsage,
            totalRecords: totalRecords,
            currentPage: page,
            totalPages: Math.ceil(totalRecords / limit)
        });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ message: 'Error fetching templates', error: error.message });
    }
});

// GET a single template by ID
router.get('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }
        res.json(template);
    } catch (error) {
        console.error('Error fetching template:', error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid template ID format' });
        }
        res.status(500).json({ message: 'Error fetching template', error: error.message });
    }
});

// POST create a new template
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    // Destructure all possible fields from the body
    const { name, type, content, customJs, emailSubType, emailConfig } = req.body;

    if (!name || !type || !content) {
        return res.status(400).json({ message: 'Template name, type, and content are required.' });
    }

    // Construct the template data object dynamically
    const templateData = {
        name,
        type,
        content,
        customJs,
    };
    if (type === 'email') {
        templateData.emailSubType = emailSubType;
        templateData.emailConfig = emailConfig;
    }

    const template = new Template(templateData);

    try {
        const newTemplate = await template.save();
        res.status(201).json(newTemplate);
    } catch (error) {
        console.error('Error creating template:', error);
        if (error.code === 11000) { // Handle duplicate name error
            return res.status(409).json({ message: `Template with name '${name}' already exists.` });
        }
         if (error.name === 'ValidationError') {
            let errors = Object.values(error.errors).map(el => el.message);
            return res.status(400).json({ message: `创建模板验证失败: ${errors.join(', ')}` });
        }
        res.status(400).json({ message: 'Error creating template', error: error.message });
    }
});

// PUT update an existing template by ID
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        const { name, type, content, customJs, emailSubType, emailConfig } = req.body;

        // Update fields if they exist in the request body
        if (name !== undefined) template.name = name;
        if (type !== undefined) template.type = type;
        if (content !== undefined) template.content = content;
        if (customJs !== undefined) template.customJs = customJs;

        // Handle email-specific fields
        if (type === 'email') {
            if (emailSubType !== undefined) template.emailSubType = emailSubType;
            if (emailConfig !== undefined) template.emailConfig = emailConfig;
        } else {
            // If type is changed from 'email' to something else, clear the fields
            template.emailSubType = undefined;
            template.emailConfig = undefined;
        }

        const updatedTemplate = await template.save();
        res.json(updatedTemplate);
    } catch (error) {
        console.error('Error updating template:', error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid template ID format' });
        }
        if (error.code === 11000) { 
            return res.status(409).json({ message: `Template name '${req.body.name}' might already be in use.` });
        }
         if (error.name === 'ValidationError') {
            let errors = Object.values(error.errors).map(el => el.message);
            return res.status(400).json({ message: `更新模板验证失败: ${errors.join(', ')}` });
        }
        res.status(400).json({ message: 'Error updating template', error: error.message });
    }
});

// DELETE a template by ID
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const templateId = req.params.id;

        // Check if this template is currently used by any Page
        const pagesUsingTemplate = await Page.countDocuments({ 
           $or: [
               { templateSingle: templateId }, 
               { templateList: templateId }, 
               { templateItem: templateId }]
        });
        
        if (pagesUsingTemplate > 0) {
            return res.status(400).json({ 
                message: `无法删除：该模板正在被 ${pagesUsingTemplate} 个页面使用。请先解除这些页面的模板关联。` 
            });
        }

        const template = await Template.findByIdAndDelete(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }
        res.json({ message: 'Template deleted successfully' });
    } catch (error) {
        console.error('Error deleting template:', error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid template ID format' });
        }
        res.status(500).json({ message: 'Error deleting template', error: error.message });
    }
});

module.exports = router; 