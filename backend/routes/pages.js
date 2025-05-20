const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Page = require('../models/Page');
const Article = require('../models/Article');
const Template = require('../models/Template'); // Import Template model for validation
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');

// Middleware to get a single page by ID (with populated templates)
async function getPage(req, res, next) {
  let page;
  const pageId = req.params.id;

  try {
    // Populate all potential template fields
    page = await Page.findOne({ _id: pageId })
                    .populate('templateSingle', 'name type')
                    .populate('templateList', 'name type')
                    .populate('templateItem', 'name type');
    if (page == null) {
      return res.status(404).json({ message: '找不到指定的页面' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }

  res.page = page;
  next();
}

// Helper function to validate template assignment based on type
async function validateTemplate(templateId, expectedType, fieldName) {
    if (!templateId) { return { valid: false, message: `${fieldName} is required.` }; }
    try {
        const template = await Template.findOne({ _id: templateId });
        if (!template) {
            return { valid: false, message: `${fieldName} (ID: ${templateId}) not found.` };
        }
        if (template.type !== expectedType) {
            return { valid: false, message: `${fieldName} must be a '${expectedType}' template, but found '${template.type}'.` };
        }
        return { valid: true };
    } catch (err) {
        console.error(`Error validating template ${templateId}:`, err);
        return { valid: false, message: `Error checking ${fieldName}.` };
    }
}

// GET /api/pages - 获取所有页面列表 (管理员)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Populate all relevant template fields, selecting only name for the list view
    const pages = await Page.find({})
                          .populate('templateSingle', 'name')
                          .populate('templateList', 'name')
                          .populate('templateItem', 'name')
                          .sort({ createdAt: -1 })
                          .lean(); // Use .lean() for plain JS objects to allow adding properties

    // For each page, if it's a collection, count its articles
    const pagesWithArticleCounts = await Promise.all(pages.map(async (page) => {
      if (page.type === 'collection') {
        const articleCount = await Article.countDocuments({ page: page._id });
        return { ...page, articleCount };
      }
      return page;
    }));
    
    res.json(pagesWithArticleCounts);
  } catch (err) {
    res.status(500).json({ message: '获取页面列表失败: ' + err.message });
  }
});

// POST /api/pages - 创建新页面 (管理员)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  const { name, type, route, content, status, templateSingle, templateList, templateItem } = req.body;

  if (!name || !type) {
      return res.status(400).json({ message: '页面名称和类型不能为空' });
  }

  const pageData = {
    name: name,
    type: type,
    status: status || 'active',
    content: content || ''
  };

  if (type === 'single') {
      if (!route) return res.status(400).json({ message: `'Single' type requires a Route.` });
      pageData.route = route;
      const templateValidation = await validateTemplate(templateSingle, 'single', 'templateSingle');
      if (!templateValidation.valid) {
          return res.status(400).json({ message: templateValidation.message });
      }
      pageData.templateSingle = templateSingle;
  } else if (type === 'collection') {
      if (!route) return res.status(400).json({ message: `'Collection' type requires a Route.` });
      pageData.route = route;
      const listValidation = await validateTemplate(templateList, 'list', 'templateList');
      if (!listValidation.valid) return res.status(400).json({ message: listValidation.message });
      const itemValidation = await validateTemplate(templateItem, 'item', 'templateItem');
      if (!itemValidation.valid) return res.status(400).json({ message: itemValidation.message });
      pageData.templateList = templateList;
      pageData.templateItem = templateItem;
  } else {
      return res.status(400).json({ message: 'Invalid page type specified.'});
  }

  // Route uniqueness check (only if route is present)
  if (pageData.route) { 
  try {
        const existingPage = await Page.findOne({ route: pageData.route });
      if (existingPage) {
          return res.status(409).json({ message: '页面路由已存在' });
      }
  } catch (err) {
        console.error("Error checking route uniqueness:", err);
      return res.status(500).json({ message: '检查路由失败: ' + err.message });
  }
  }

  const page = new Page(pageData);

  try {
    await page.save();
    const populatedPage = await Page.findOne({ _id: page._id })
                                   .populate('templateSingle', 'name type')
                                   .populate('templateList', 'name type')
                                   .populate('templateItem', 'name type');
    res.status(201).json(populatedPage);
  } catch (err) {
    if (err.name === 'ValidationError') {
       let errors = Object.values(err.errors).map(el => el.message);
       return res.status(400).json({ message: `创建页面验证失败: ${errors.join(', ')}` });
    }
    if (err.code === 11000 && err.keyPattern?.route) {
         return res.status(409).json({ message: '页面路由已存在 (DB index)' });
    }
    console.error("Error creating page:", err);
    res.status(400).json({ message: '创建页面失败: ' + err.message });
  }
});

// IMPORTANT: Define more specific routes before general ones

// GET /api/pages/:pageId/articles - 获取指定集合页面的文章列表 (管理员)
// Placeholder for the actual route definition if it exists later in the file or to ensure its position
// The actual implementation for this route should be here.
// router.get('/:pageId/articles', authenticateToken, isAdmin, async (req, res) => { ... });
// If the route is already defined below, this comment serves as a structural guide.
// We will assume the full definition as previously seen is intended to be here:
router.get('/:pageId/articles', authenticateToken, isAdmin, async (req, res) => {
    const pageId = req.params.pageId;
    try {
        const parentPage = await Page.findOne({ _id: pageId });
        if (!parentPage) {
            return res.status(404).json({ message: '指定的父页面不存在 (pre-check)' });
        }
        if (parentPage.type !== 'collection') {
            return res.status(400).json({ message: '指定的父页面不是集合类型，无法获取文章' });
        }

        const pageQuery = parseInt(req.query.page) || 1;
        const limitQuery = parseInt(req.query.limit) || 15;
        const skip = (pageQuery - 1) * limitQuery;
        
        const sortField = req.query.sortField || 'createdAt';
        const sortOrder = req.query.sortOrder === 'ascend' ? 1 : -1;
        
        const query = { page: pageId }; 

        const totalRecords = await Article.countDocuments(query);
        const articles = await Article.find(query)
            .sort({ [sortField]: sortOrder })
            .skip(skip)
            .limit(limitQuery);

        res.json({
            data: articles,
            totalRecords: totalRecords,
            currentPage: pageQuery,
            totalPages: Math.ceil(totalRecords / limitQuery)
        });

    } catch (err) {
        console.error(`Error fetching articles for page ${pageId}:`, err);
        res.status(500).json({ message: '获取文章列表失败: ' + err.message });
    }
});

// GET /api/pages/:id - 获取单个页面信息 (管理员) - uses getPage middleware
router.get('/:id', authenticateToken, isAdmin, getPage, (req, res) => {
  res.json(res.page);
});

// PUT /api/pages/:id - 更新页面信息 (管理员)
router.put('/:id', authenticateToken, isAdmin, getPage, async (req, res) => {
  const { name, type, route, content, status, templateSingle, templateList, templateItem } = req.body;
  const currentPage = res.page;

  // --- Basic Validation ---
  if (name === '') return res.status(400).json({ message: '页面名称不能为空'});
  const effectiveType = type || currentPage.type;
  if (!['single', 'collection'].includes(effectiveType)) return res.status(400).json({ message: '无效的类型'});
  if (status && !['active', 'disabled'].includes(status)) return res.status(400).json({ message: '无效的状态'});

  // --- Update Fields --- 
  currentPage.name = name !== undefined ? name : currentPage.name;
  currentPage.status = status !== undefined ? status : currentPage.status;
  currentPage.content = content !== undefined ? content : currentPage.content;
  
  // --- Type-Specific Updates and Validation ---
  let newRoute = route !== undefined ? route : currentPage.route;
  
  if (effectiveType === 'single') {
      if (!newRoute) return res.status(400).json({ message: `'Single' type requires a Route.` });
      currentPage.route = newRoute;
      
      const effectiveTemplate = templateSingle !== undefined ? templateSingle : currentPage.templateSingle?._id;
      const templateValidation = await validateTemplate(effectiveTemplate, 'single', 'templateSingle');
      if (!templateValidation.valid) return res.status(400).json({ message: templateValidation.message });
      currentPage.templateSingle = effectiveTemplate;
      currentPage.templateList = null;
      currentPage.templateItem = null;
      
  } else if (effectiveType === 'collection') {
      if (!newRoute) return res.status(400).json({ message: `'Collection' type requires a Route.` });
      currentPage.route = newRoute;
      
      const effectiveListTemplate = templateList !== undefined ? templateList : currentPage.templateList?._id;
      const listValidation = await validateTemplate(effectiveListTemplate, 'list', 'templateList');
      if (!listValidation.valid) return res.status(400).json({ message: listValidation.message });
      currentPage.templateList = effectiveListTemplate;

      const effectiveItemTemplate = templateItem !== undefined ? templateItem : currentPage.templateItem?._id;
      const itemValidation = await validateTemplate(effectiveItemTemplate, 'item', 'templateItem');
      if (!itemValidation.valid) return res.status(400).json({ message: itemValidation.message });
      currentPage.templateItem = effectiveItemTemplate;
      currentPage.templateSingle = null;
  }
  
  // Update type *after* validation checks based on effectiveType
  if (type) currentPage.type = type;

  // Route uniqueness check if route changed
  if (newRoute && currentPage.isModified('route')) {
      try {
          const existingPage = await Page.findOne({ route: newRoute, _id: { $ne: currentPage._id } });
          if (existingPage) {
              return res.status(409).json({ message: '更新后的页面路由已存在' });
          }
      } catch (err) {
          console.error("Error checking route uniqueness on update:", err);
          return res.status(500).json({ message: '检查路由冲突失败: ' + err.message });
      }
  }

  try {
    await currentPage.save();
    const populatedPage = await Page.findOne({ _id: currentPage._id })
                                   .populate('templateSingle', 'name type')
                                   .populate('templateList', 'name type')
                                   .populate('templateItem', 'name type');
    res.json(populatedPage);
  } catch (err) {
    if (err.name === 'ValidationError') {
       let errors = Object.values(err.errors).map(el => el.message);
       return res.status(400).json({ message: `更新页面验证失败: ${errors.join(', ')}` });
   }
    if (err.code === 11000 && err.keyPattern?.route) {
         return res.status(409).json({ message: '页面路由已存在 (DB index)' });
   }
   console.error("Error updating page:", err);
    res.status(400).json({ message: '更新页面失败: ' + err.message });
  }
});

// DELETE /api/pages/:id - 删除页面 (管理员) - uses getPage middleware
router.delete('/:id', authenticateToken, isAdmin, getPage, async (req, res) => {
  try {
    // Check if the page being deleted has the route / or /index
    if (res.page.route === '/index' || res.page.route === '/') {
      return res.status(403).json({ message: '不允许删除首页 ( / 或 /index ) 页面' });
    }
    
    // Check for associated articles if it's a collection page
    if (res.page.type === 'collection') {
        const articleCount = await Article.countDocuments({ page: res.page._id });
        if (articleCount > 0) {
             return res.status(400).json({ message: `Cannot delete collection page: It contains ${articleCount} article(s). Delete articles first.` });
        }
    }

    await Page.deleteOne({ _id: res.page._id });
    res.json({ message: '页面删除成功', pageId: res.page._id });
  } catch (err) {
    console.error("Error deleting page:", err);
    res.status(500).json({ message: '删除页面失败: ' + err.message });
  }
});

// GET /api/pages/route/:route(*) - 获取公共可访问的页面通过路由
// THIS ROUTE MUST BE AFTER ADMIN SPECIFIC :id routes to avoid conflict
// router.get('/route/:route(*)', async (req, res) => { ... }); // Assuming this route exists further down

module.exports = router; 