const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Page = require('../models/Page');
const Article = require('../models/Article');
const Menu = require('../models/Menu');
const Template = require('../models/Template');
const AiApplication = require('../models/AiApplication');
const PromotionActivity = require('../models/PromotionActivity'); // For potential future use

// Helper function to populate page routes within menu items
// Moved from menus.js
async function populatePageRoutes(items) {
    if (!items || items.length === 0) {
        return [];
    }
    // console.log('[DEBUG] populatePageRoutes received items:', JSON.stringify(items, null, 2));
    const populatedItems = [];
    for (const item of items) {
        let populatedItem = { ...item }; 
        if (item.type === 'page' && item.pageId) {
            // console.log(`[DEBUG] Processing page item: ${item.title}, pageId: ${item.pageId}`);
            try {
                const page = await Page.findOne({ _id: item.pageId, status: 'active' }).select('route').lean(); 
                if (page) {
                    // console.log(`[DEBUG] Found active page for ${item.pageId}:`, page);
                    populatedItem.route = page.route; 
                } else {
                    console.warn(`[WARN] Menu item '${item.title}' (pageId: ${item.pageId}): Corresponding active page not found or route missing. Skipping.`);
                    continue; 
                }
            } catch (pageError) {
                console.error(`[ERROR] Error finding page ${item.pageId} for menu item '${item.title}':`, pageError);
                continue; 
            }
        } else if (item.type === 'submenu' && item.children && item.children.length > 0) {
            // console.log(`[DEBUG] Processing submenu: ${item.title}`);
            populatedItem.children = await populatePageRoutes(item.children);
        }
        delete populatedItem.pageId; 
        populatedItems.push(populatedItem.toObject ? populatedItem.toObject() : populatedItem);
    }
    // console.log('[DEBUG] populatePageRoutes returning items:', JSON.stringify(populatedItems, null, 2));
    return populatedItems;
}

// GET /api/public/pages/lookup?route=... - Find active page by route AND include template content
router.get('/pages/lookup', async (req, res) => {
    const route = req.query.route;
    if (!route) {
        return res.status(400).json({ message: 'Missing route query parameter' });
    }
    try {
        // Find the page and populate the relevant template fields
        const page = await Page.findOne({ route: route, status: 'active' })
                             .populate('templateSingle', 'content') // Populate single template content
                             .populate('templateList', 'content')   // Populate list template content
                             // .populate('templateItem') // Item template not needed for page lookup itself
                             .select('+templateSingle +templateList name type content status route createdAt updatedAt') // Select necessary page fields + populated templates
                             .lean(); // Use lean for plain JS object

        if (!page) {
            return res.status(404).json({ message: 'Page not found or not active' });
        }

        let responseData = { 
            page: { ...page }, // Copy page data
            templateContent: null,
            articles: []
        };
        delete responseData.page.templateSingle; // Remove full template object from page data
        delete responseData.page.templateList;
        delete responseData.page.templateItem; // Ensure this is removed too

        // Determine which template content to send
        if (page.type === 'single' && page.templateSingle) {
            responseData.templateContent = page.templateSingle.content;
        } else if (page.type === 'collection' && page.templateList) {
            responseData.templateContent = page.templateList.content;
            // Fetch associated active articles for collection pages
            try {
                const articles = await Article.find({ page: page._id, status: 'active' })
                                              .sort({ publishDate: -1, createdAt: -1 })
                                              .select('title author publishDate createdAt slug excerpt') // Added excerpt
                                              .lean(); 
                responseData.articles = articles;
            } catch (articleError) {
                 console.error(`Error fetching articles for collection page ${page._id}:`, articleError);
                 // Decide how to handle: send empty articles or error? Send empty for now.
                 responseData.articles = []; 
            }
        } else {
            // Handle case where page type is valid but required template is missing/not populated
            console.warn(`Page ${page._id} (${page.type}) is missing its required template content.`);
            // Send null templateContent, frontend should handle this
        }
        
        res.json(responseData);

    } catch (err) {
        console.error(`Error fetching page by route ${route}:`, err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// GET /api/public/pages/navigation?location=... - Get active navigation links
router.get('/pages/navigation', async (req, res) => {
    const location = req.query.location;
    if (!location || !['header', 'footer'].includes(location)) {
        return res.status(400).json({ message: 'Invalid or missing location query parameter (header/footer)' });
    }
    try {
        const pages = await Page.find({ location: location, status: 'active' })
                              .sort({ createdAt: 1 }) // Or add a sortOrder field later
                              .select('name type route externalUrl'); // Select needed fields
        res.json(pages);
    } catch (err) {
        console.error(`Error fetching navigation for ${location}:`, err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// GET /api/public/articles?pageId=... - Get active articles for a collection page
router.get('/articles', async (req, res) => {
    const pageId = req.query.pageId;
    if (!pageId || !mongoose.Types.ObjectId.isValid(pageId)) {
        return res.status(400).json({ message: 'Missing or invalid pageId query parameter' });
    }

    try {
        // Verify parent page exists and is an active collection (optional but good practice)
        const parentPage = await Page.findOne({ _id: pageId, status: 'active', type: 'collection' });
        if (!parentPage) {
             return res.status(404).json({ message: 'Collection page not found or not active' });
        }

        // Fetch active articles, sort by publishDate descending (or createdAt)
        const articles = await Article.find({ page: pageId, status: 'active' })
                                      .sort({ publishDate: -1, createdAt: -1 })
                                      .select('title content author publishDate createdAt'); // Select needed fields
        res.json(articles);
    } catch (err) {
        console.error(`Error fetching articles for page ${pageId}:`, err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// GET /api/public/articles/:id - Get a single active article by ID AND its item template content
router.get('/articles/:id', async (req, res) => {
    const articleId = req.params.id;
    if (!articleId || !mongoose.Types.ObjectId.isValid(articleId)) {
        return res.status(400).json({ message: 'Invalid Article ID format' });
    }

    try {
        const article = await Article.findOne({ _id: articleId, status: 'active' })
                                     .populate({ // Populate page and then the item template on the page
                                         path: 'page',
                                         select: 'name route templateItem', // Select necessary page fields
                                         populate: {
                                             path: 'templateItem',
                                             select: 'content' // Select only the item template content
                                         }
                                     })
                                     .select('+content +author +publishDate') // Ensure all needed fields are selected
                                     .lean();

        if (!article) {
            return res.status(404).json({ message: 'Article not found or not active' });
        }

        // Check if parent page exists and has the item template
        if (!article.page || !article.page.templateItem || !article.page.templateItem.content) {
             console.warn(`Article ${article._id} is missing its parent page or item template content.`);
             // Decide how to handle this - maybe return 404 or a specific error?
             // Returning article without template content for now.
             return res.status(404).json({ message: 'Article template configuration missing' });
        }

        let responseData = {
            article: { ...article },
            page: { // Include necessary parent page info
                _id: article.page._id,
                name: article.page.name,
                route: article.page.route
            },
            templateContent: article.page.templateItem.content
        };
        // Clean up nested populated objects in the main article object if necessary
        delete responseData.article.page; 

        res.json(responseData);

    } catch (err) {
        console.error(`Error fetching article ${articleId}:`, err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// GET /api/public/articles/by-slug/:slug - Get a single active article by SLUG AND its item template content
router.get('/articles/by-slug/:slug', async (req, res) => {
    const slug = req.params.slug;
    if (!slug || typeof slug !== 'string' || slug.trim() === '') {
        return res.status(400).json({ message: 'Invalid Article Slug' });
    }

    try {
        const article = await Article.findOne({ slug: slug, status: 'active' })
                                     .populate({
                                         path: 'page',
                                         select: 'name route templateItem',
                                         populate: {
                                             path: 'templateItem',
                                             select: 'content'
                                         }
                                     })
                                     .select('+content +author +publishDate +excerpt') // Ensure excerpt is also selected
                                     .lean();

        if (!article) {
            return res.status(404).json({ message: 'Article not found or not active' });
        }

        if (!article.page || !article.page.templateItem || !article.page.templateItem.content) {
             console.warn(`Article with slug '${slug}' is missing its parent page or item template content.`);
             return res.status(404).json({ message: 'Article template configuration missing' });
        }

        let responseData = {
            article: { ...article },
            page: {
                _id: article.page._id,
                name: article.page.name,
                route: article.page.route
            },
            templateContent: article.page.templateItem.content
        };
        delete responseData.article.page;

        res.json(responseData);

    } catch (err) {
        console.error(`Error fetching article by slug ${slug}:`, err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// GET /api/public/menus/lookup?location=... (New Route)
router.get('/menus/lookup', async (req, res) => {
    const location = req.query.location;
    if (!location) {
        return res.status(400).json({ message: 'Menu location query parameter is required.' });
    }
    try {
        const menu = await Menu.findOne({ location: location }).lean();
        if (!menu) {
            return res.json([]); // Return empty array if menu for location not found
        }
        const populatedItems = await populatePageRoutes(menu.items);
        res.json(populatedItems);
    } catch (error) {
        console.error(`Error fetching public menu for location ${location}:`, error);
        res.status(500).json({ message: 'Error fetching menu data', error: error.message });
    }
});

// GET /api/public/ai-applications/active - Get active AI applications for client display
router.get('/ai-applications/active', async (req, res) => {
  try {
    const activeApplications = await AiApplication.find({ status: 'active' })
      .populate('type', 'name uri _id') // Populate type with specific fields
      .select('name description coverImageUrl type tags creditsConsumed createdAt') // Select fields needed for client display
      .sort({ createdAt: -1 }); // Or sort by name, etc.

    res.json(activeApplications);
  } catch (error) {
    console.error('Error fetching active AI applications for public:', error);
    res.status(500).json({ message: 'Failed to retrieve AI applications' });
  }
});

// GET /api/public/ai-applications/:id - Get a single active AI application by ID
router.get('/ai-applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Removed ObjectId validation: if (!mongoose.Types.ObjectId.isValid(id)) {
    //   return res.status(400).json({ message: '无效的应用ID格式' });
    // }

    const application = await AiApplication.findOne({ _id: id /*, status: 'active' */ }) // Temporarily allow fetching any status for detail view
      .populate('type', 'name uri _id')
      // .populate('apis', 'platformName apiUrl description creditsPerCall _id') // Populate API details
      .select('-__v -apis'); // Exclude version key, select all other fields by default

    if (!application) {
      return res.status(404).json({ message: '未找到指定的AI应用' });
    }

    res.json(application);
  } catch (error) {
    console.error(`Error fetching AI application by ID ${req.params.id}:`, error);
    res.status(500).json({ message: '获取AI应用详情失败' });
  }
});

// GET /api/public/recharge-promotions - Get available and active recharge promotions
router.get('/recharge-promotions', async (req, res) => {
  try {
    const now = new Date();
    const activeRechargePromotions = await PromotionActivity.find({
      activityType: 'recharge_discount',
      isEnabled: true,
      startTime: { $lte: now },
      endTime: { $gte: now }
    }).lean(); // Use .lean() for plain JS objects if no model methods are needed later

    if (!activeRechargePromotions || activeRechargePromotions.length === 0) {
      return res.json([]); // Return empty array if no active recharge promotions found
    }

    const formattedPromotions = activeRechargePromotions.map(promo => {
      let displayInfo = promo.description || promo.name;
      let type = 'generic_recharge_promo'; // Default type
      let value = null;
      let minAmount = 0.01; // Default minimum
      const details = promo.activityDetails || {};

      if (details.rechargeDiscountSubType === 'gradient_discount') {
        type = 'gradient_discount';
        displayInfo = `梯度充值优惠: ${promo.name}`;
        // For simplicity, we just provide a general description.
        // Frontend could potentially receive all tiers if needed for complex display.
        if (details.tiers && details.tiers.length > 0) {
          minAmount = Math.min(...details.tiers.map(t => t.minAmountRMB || 0.01));
        }
      } else if (details.rechargeDiscountSubType === 'full_reduction_discount' && details.fullReduction) {
        const fr = details.fullReduction;
        minAmount = fr.everyAmountRMB || 0.01;
        if (fr.type === 'discount' && fr.discountRate) {
          type = 'full_reduction_discount_rate';
          value = fr.discountRate; // e.g., 90 for 90%
          displayInfo = `每满 ${fr.everyAmountRMB}元 打 ${(fr.discountRate / 10).toFixed(1)}折`;
          if (fr.maxDiscountCapRMB && fr.maxDiscountCapRMB > 0) {
            displayInfo += ` (最高优惠 ${fr.maxDiscountCapRMB}元)`;
          }
        } else if (fr.type === 'points' && fr.giftPoints) {
          type = 'full_reduction_gift_points';
          value = fr.giftPoints;
          displayInfo = `每满 ${fr.everyAmountRMB}元 赠送 ${fr.giftPoints}积分`;
           if (fr.maxDiscountCapRMB && fr.maxDiscountCapRMB > 0) {
            // Note: maxDiscountCapRMB for points type means the cap is on the value of the gifted points if 1 point = 1 RMB equivalent or similar logic needed.
            // For now, we just display it. Or it might mean cap on how many times this can be triggered to give points related to a total discount value.
            // Let's assume it means the equivalent value of points should not exceed this cap.
            displayInfo += ` (优惠价值上限 ${fr.maxDiscountCapRMB}元)`; 
          }
        }
      }

      return {
        id: promo._id,
        name: promo.name,
        description: promo.description || displayInfo, // Use original description or formatted one
        type: type,
        value: value,
        minAmount: minAmount,
        maxAmount: null, // This might need to come from promo details if relevant for recharge promos
        displayInfo: displayInfo,
        // Add other fields if the frontend expects them from the previous hardcoded list
        // e.g., applicableTo (might need a new field in PromotionActivity or derive it)
      };
    });

    res.json(formattedPromotions);

  } catch (error) {
    console.error('Error fetching recharge promotions:', error);
    res.status(500).json({ message: '获取充值优惠信息失败' });
  }
});

module.exports = router; 