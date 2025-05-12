const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Article = require('../models/Article');
const Page = require('../models/Page'); // To verify parent page
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');

// Middleware to get a single article by ID
async function getArticle(req, res, next) {
  let article;
  const articleId = req.params.id;

  try {
    article = await Article.findOne({ _id: articleId });
    if (article == null) {
      return res.status(404).json({ message: '找不到指定的文章' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }

  res.article = article;
  next();
}

// GET /api/articles?pageId=... - 获取指定集合页面的文章列表 (管理员)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
  const pageId = req.query.pageId;

  if (!pageId || typeof pageId !== 'string' || pageId.trim() === '') {
      return res.status(400).json({ message: '缺少有效的目标页面 ID (pageId)' });
  }

  try {
    // 可选：检查父页面是否存在且为 collection 类型
    // const parentPage = await Page.findOne({ _id: pageId });
    // if (!parentPage || parentPage.type !== 'collection') {
    //     return res.status(404).json({ message: '指定的父页面不是有效的集合' });
    // }

    // 添加分页和排序
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15; // Default limit
    const skip = (page - 1) * limit;
    const sortField = req.query.sortField || 'createdAt';
    const sortOrder = req.query.sortOrder === 'ascend' ? 1 : -1;

    const query = { page: pageId };

    const articles = await Article.find(query)
                                  .sort({ [sortField]: sortOrder })
                                  .skip(skip)
                                  .limit(limit);
                                  // .populate('page', 'name route'); // Optionally populate parent page info

    // Optionally get total count for pagination
    // const totalCount = await Article.countDocuments(query);

    res.json(articles); // Send back list (and maybe totalCount)

  } catch (err) {
    console.error("Error fetching articles:", err);
    res.status(500).json({ message: '获取文章列表失败: ' + err.message });
  }
});

// POST /api/articles - 创建新文章 (管理员)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  // 从 req.body 中解构出 slug 和 excerpt
  const { title, slug, excerpt, page: pageId, content, author, status, publishDate } = req.body;

  // Basic validation
  if (!title || !pageId || !content) {
    return res.status(400).json({ message: '文章标题、所属页面ID和内容不能为空' });
  }
  // --- Revision: Update pageId validation for String ID ---
  /*
  if (!mongoose.Types.ObjectId.isValid(pageId)) {
       return res.status(400).json({ message: '无效的所属页面 ID 格式' });
  }
  */
  // --- End Revision ---

  try {
    // Verify parent page exists and is a collection
    // --- Revision: Use findOne for parentPage check ---
    const parentPage = await Page.findOne({ _id: pageId });
    // --- End Revision ---
    if (!parentPage) {
        return res.status(404).json({ message: '指定的所属页面不存在' });
    }
    if (parentPage.type !== 'collection') {
        return res.status(400).json({ message: '指定的所属页面不是集合类型' });
    }

    // TODO: Optional: Check if title is unique within this page
    // const existingArticle = await Article.findOne({ title: title, page: pageId });
    // if (existingArticle) return res.status(409).json({ message: '此页面下已存在同名文章' });

    const article = new Article({
      title,
      slug,
      excerpt,
      page: pageId,
      content,
      author: author || 'Admin', // Default author
      status: status || 'active',
      publishDate: publishDate || null
    });

    const newArticle = await article.save();
    res.status(201).json(newArticle);

  } catch (err) {
    if (err.name === 'ValidationError') {
       let errors = Object.values(err.errors).map(el => el.message);
       return res.status(400).json({ message: `创建文章验证失败: ${errors.join(', ')}` });
   }
   console.error("Error creating article:", err);
    res.status(500).json({ message: '创建文章失败: ' + err.message }); // Use 500 for unexpected errors
  }
});

// GET /api/articles/:id - 获取单个文章信息 (管理员)
router.get('/:id', authenticateToken, isAdmin, getArticle, (req, res) => {
  res.json(res.article);
});

// PUT /api/articles/:id - 更新文章信息 (管理员)
router.put('/:id', authenticateToken, isAdmin, getArticle, async (req, res) => {
  // 解构时加入 excerpt 和 slug
  const { title, slug, excerpt, content, author, status, publishDate } = req.body;
  const article = res.article;

  // Basic validation
  if (title === '') return res.status(400).json({ message: '标题不能为空' });
  if (content === '') return res.status(400).json({ message: '内容不能为空' });

  // Update fields
  if (title != null) article.title = title;
  // Slug 更新逻辑：仅当提供了新的、有效的 slug，并且它与旧的不同时才更新。
  // 注意：直接修改 slug 可能会导致 SEO 问题或断开的链接，除非有重定向机制。
  // 对于已发布的文章，通常不建议轻易修改 slug。
  // 这里的逻辑是如果提供了 slug，就尝试更新，Mongoose 的 unique 索引会处理冲突。
  if (slug != null && slug.trim() !== '' && slug !== article.slug) {
      article.slug = slug.trim();
  }
  if (excerpt != null) article.excerpt = excerpt; // 添加 excerpt 更新
  if (content != null) article.content = content;
  if (author != null) article.author = author;
  if (status != null) article.status = status;
  if (publishDate !== undefined) article.publishDate = publishDate; // Allow setting to null

  try {
    const updatedArticle = await article.save();
    res.json(updatedArticle);
  } catch (err) {
     if (err.name === 'ValidationError') {
       let errors = Object.values(err.errors).map(el => el.message);
       return res.status(400).json({ message: `更新文章验证失败: ${errors.join(', ')}` });
   }
   console.error("Error updating article:", err);
    res.status(500).json({ message: '更新文章失败: ' + err.message });
  }
});

// DELETE /api/articles/:id - 删除文章 (管理员)
router.delete('/:id', authenticateToken, isAdmin, getArticle, async (req, res) => {
  try {
    await Article.deleteOne({ _id: res.article._id });
    res.json({ message: '文章删除成功', articleId: res.article._id });
  } catch (err) {
     console.error("Error deleting article:", err);
    res.status(500).json({ message: '删除文章失败: ' + err.message });
  }
});

module.exports = router; 