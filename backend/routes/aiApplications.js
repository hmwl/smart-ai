const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AiApplication = require('../models/AiApplication');
const AiType = require('../models/AiType'); // Needed for validation
const ApiEntry = require('../models/ApiEntry'); // Needed for validation
const { PLATFORM_TYPES } = require('../models/ApiEntry'); // Import PLATFORM_TYPES
const User = require('../models/User'); // Added User model
const CreditTransaction = require('../models/CreditTransaction'); // Added CreditTransaction model
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Multer Configuration for Cover Image Upload ---
const UPLOADS_DIR = 'uploads/ai-covers';

// Ensure upload directory exists
fs.mkdirSync(path.join(__dirname, '..', UPLOADS_DIR), { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', UPLOADS_DIR));
    },
    filename: function (req, file, cb) {
        // Create a unique filename: fieldname-timestamp.extension
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 // 100 KB limit
    },
    fileFilter: function (req, file, cb) {
        // Accept only images
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('只允许上传图片文件！'), false);
        }
        cb(null, true);
    }
});
// --- End Multer Configuration ---

// Middleware to get AiApplication by ID
async function getAiApplication(req, res, next) {
    let aiApp;
    try {
        aiApp = await AiApplication.findOne({ _id: req.params.id })
                           .populate('type', 'name uri')
                           .populate('apis', '_id name platformName platformType apiUrl config');
        if (aiApp == null) {
            return res.status(404).json({ message: '找不到指定的 AI 应用' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.aiApp = aiApp;
    next();
}

// Helper: Validate if referenced Type and APIs exist AND if APIs match platformType
async function validateReferencesAndPlatform(typeId, apiIds, appPlatformType) {
    try {
        if (typeId) {
            const typeExists = await AiType.findOne({ _id: typeId });
            if (!typeExists) return { valid: false, message: `指定的AI类型 (ID: ${typeId}) 不存在` };
        }
        if (apiIds && apiIds.length > 0) {
            const validApiIds = apiIds.filter(id => typeof id === 'string' && id.length > 0);
            const associatedApiEntries = await ApiEntry.find({ _id: { $in: validApiIds } }).lean();
            
            if (associatedApiEntries.length !== validApiIds.length) {
                return { valid: false, message: '提供的 API ID 列表中包含不存在的 API 条目' };
            }

            if (appPlatformType) { // Only validate if appPlatformType is provided
                for (const apiEntry of associatedApiEntries) {
                    if (apiEntry.platformType !== appPlatformType) {
                        return { 
                            valid: false, 
                            message: `API 条目 '${apiEntry.platformName}' (类型: ${apiEntry.platformType}) 与应用的平台类型 '${appPlatformType}' 不匹配。` 
                        };
                    }
                }
            }
        }
        return { valid: true };
    } catch (error) {
         console.error("Reference and platform validation error:", error);
        return { valid: false, message: '检查关联的类型、API或平台兼容性时出错' };
    }
}


// GET all AI Applications
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15; // Default limit
        const skip = (page - 1) * limit;

        // Build query object for potential filtering (if needed in future)
        let query = {};
        // Example: if (req.query.name) query.name = new RegExp(req.query.name, 'i');
        
        const totalRecords = await AiApplication.countDocuments(query);
        const aiApps = await AiApplication.find(query)
                                        .populate('type', 'name uri')
                                        .populate('apis', '_id name platformName platformType apiUrl config')
                                        .sort({ name: 1 })
                                        .skip(skip)
                                        .limit(limit);
        
        res.json({
            data: aiApps,
            totalRecords: totalRecords,
            currentPage: page,
            totalPages: Math.ceil(totalRecords / limit)
        });
    } catch (err) {
        res.status(500).json({ message: '获取 AI 应用列表失败: ' + err.message });
    }
});

// POST create a new AI Application
// Use upload.single('coverImage') middleware for the file field
router.post('/', authenticateToken, isAdmin, upload.single('coverImage'), async (req, res) => {
    const { name, description, tags, apis, type, platformType, status, creditsConsumed } = req.body;

    // Basic validation
    if (!name || !type || !platformType) {
        // If validation fails and a file was uploaded, delete it
        if (req.file) {
            fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting uploaded file after validation fail:", err); });
        }
        return res.status(400).json({ message: 'AI 应用名称、类型和平台类型不能为空' });
    }

    // Reference validation
    const parsedApis = apis ? (Array.isArray(apis) ? apis.filter(id => id) : [apis].filter(id=>id)) : [];
    const refValidation = await validateReferencesAndPlatform(type, parsedApis, platformType);
    if (!refValidation.valid) {
        if (req.file) {
            fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting file after ref validation fail:", err); });
        }
        return res.status(400).json({ message: refValidation.message });
    }

    // Construct data
    const appData = {
        name,
        description: description || '',
        tags: tags ? (Array.isArray(tags) ? tags.filter(t=>t) : tags.split(',').map(t => t.trim()).filter(t=>t)) : [],
        platformType,
        apis: parsedApis,
        type,
        status: status || 'active',
        creditsConsumed: creditsConsumed === undefined ? 0 : Number(creditsConsumed),
    };

    // Add cover image URL if uploaded
    if (req.file) {
        // Store the relative path accessible by the server
        appData.coverImageUrl = `/${UPLOADS_DIR}/${req.file.filename}`;
    }

    const aiApp = new AiApplication(appData);

    try {
        const newAiApp = await aiApp.save();
        // Populate references before sending back
        await newAiApp.populate('type', 'name uri');
        await newAiApp.populate('apis', 'name url');
        res.status(201).json(newAiApp);
    } catch (err) {
        // If save fails, delete uploaded file
        if (req.file) {
             fs.unlink(req.file.path, (unlinkErr) => { if (unlinkErr) console.error("Error deleting file after DB save fail:", unlinkErr); });
        }
        if (err.name === 'ValidationError') {
           let errors = Object.values(err.errors).map(el => el.message);
           return res.status(400).json({ message: `创建 AI 应用验证失败: ${errors.join(', ')}` });
        }
        console.error("Error creating AI App:", err);
        res.status(400).json({ message: '创建 AI 应用失败: ' + err.message });
    }
});

// GET a single AI Application by ID
router.get('/:id', authenticateToken, isAdmin, getAiApplication, (req, res) => {
    res.json(res.aiApp);
});

// PUT update an AI Application
router.put('/:id', authenticateToken, isAdmin, getAiApplication, upload.single('coverImage'), async (req, res) => {
    const { name, description, tags, apis, type, platformType, status, creditsConsumed } = req.body;
    const aiApp = res.aiApp; // Get from middleware
    const oldImagePath = aiApp.coverImageUrl ? path.join(__dirname, '..', aiApp.coverImageUrl) : null;

    // Reference validation
    const parsedApis = apis ? (Array.isArray(apis) ? apis.filter(id => id) : [apis].filter(id=>id)) : [];
    const effectiveType = type || aiApp.type._id;
    const effectiveApis = parsedApis === undefined ? aiApp.apis.map(a => a._id) : parsedApis;
    const effectivePlatformType = platformType || aiApp.platformType;

    // Validate references against the *final* effective platform type
    const refValidation = await validateReferencesAndPlatform(effectiveType, effectiveApis, effectivePlatformType);
    if (!refValidation.valid) {
        if (req.file) {
            fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting new file after ref validation fail:", err); });
        }
        return res.status(400).json({ message: refValidation.message });
    }

    // Update fields
    if (name !== undefined) aiApp.name = name;
    if (description !== undefined) aiApp.description = description;
    if (status !== undefined) aiApp.status = status;
    if (tags !== undefined) aiApp.tags = Array.isArray(tags) ? tags.filter(t=>t) : tags.split(',').map(t => t.trim()).filter(t=>t);
    if (type !== undefined) aiApp.type = type;
    if (platformType !== undefined) aiApp.platformType = platformType;
    if (parsedApis !== undefined) aiApp.apis = parsedApis;
    if (creditsConsumed !== undefined) aiApp.creditsConsumed = Number(creditsConsumed);

    // Handle new cover image upload
    if (req.file) {
        aiApp.coverImageUrl = `/${UPLOADS_DIR}/${req.file.filename}`;
        // Delete old image if a new one is uploaded and an old one exists
        if (oldImagePath && fs.existsSync(oldImagePath)) {
            fs.unlink(oldImagePath, (err) => { if (err) console.error("Error deleting old cover image:", err); });
        }
    } else if (req.body.removeCoverImage === 'true') {
         // Handle explicit removal without new upload
         aiApp.coverImageUrl = null;
         if (oldImagePath && fs.existsSync(oldImagePath)) {
            fs.unlink(oldImagePath, (err) => { if (err) console.error("Error deleting old cover image on removal:", err); });
        }
    }

    try {
        const updatedAiApp = await aiApp.save();
        // Populate references before sending back
        await updatedAiApp.populate('type', 'name uri');
        await updatedAiApp.populate('apis', 'name url');
        res.json(updatedAiApp);
    } catch (err) {
         // If save fails and a new file was uploaded, delete the new file
        if (req.file) {
             fs.unlink(req.file.path, (unlinkErr) => { if (unlinkErr) console.error("Error deleting new file after DB update fail:", unlinkErr); });
        }
        if (err.name === 'ValidationError') {
           let errors = Object.values(err.errors).map(el => el.message);
           return res.status(400).json({ message: `更新 AI 应用验证失败: ${errors.join(', ')}` });
        }
        console.error("Error updating AI App:", err);
        res.status(400).json({ message: '更新 AI 应用失败: ' + err.message });
    }
});

// POST /:id/consume - Consume credits for an AI Application
router.post('/:id/consume', authenticateToken, getAiApplication, async (req, res) => {
    const aiApp = res.aiApp; // From getAiApplication middleware
    const userMakingRequest = req.user; // From authenticateToken middleware

    // ---- START DEBUG LOGGING ----
    console.log('[DEBUG] /consume - Timestamp:', new Date().toISOString());
    console.log('[DEBUG] /consume - aiApp._id:', aiApp ? aiApp._id : 'AI App not found by middleware');
    console.log('[DEBUG] /consume - userMakingRequest object (raw req.user):', JSON.stringify(userMakingRequest, null, 2));
    if (userMakingRequest) {
        console.log('[DEBUG] /consume - userMakingRequest.userId (instead of _id):', userMakingRequest.userId);
        console.log('[DEBUG] /consume - userMakingRequest type of userId:', typeof userMakingRequest.userId);
    } else {
        console.log('[DEBUG] /consume - userMakingRequest (req.user) is undefined or null');
    }
    // ---- END DEBUG LOGGING ----

    // 1. Check if AI Application is active
    if (aiApp.status !== 'active') {
        return res.status(400).json({ message: `AI 应用 '${aiApp.name}' 当前未激活，无法使用。` });
    }

    // 2. Check if the application costs anything
    const creditsToConsume = aiApp.creditsConsumed;
    if (creditsToConsume <= 0) {
        // Free to use, no transaction needed, or log a zero-cost transaction if required
        // For now, just return success. Potentially, one might want to log this usage.
        return res.status(200).json({
            message: `成功使用免费AI应用: ${aiApp.name}`,
            // currentBalance: userMakingRequest.creditsBalance // req.user might not be fully up-to-date after findOneAndUpdate elsewhere
        });
    }

    let updatedUser;
    try {
        // 3. Atomically find user and update balance if sufficient
        // Ensure req.user.userId is the correct path to the user's ID from the token payload
        updatedUser = await User.findOneAndUpdate(
            { 
                _id: userMakingRequest.userId,
                creditsBalance: { $gte: creditsToConsume } 
            },
            { 
                $inc: { creditsBalance: -creditsToConsume },
                $set: { lastLoginAt: new Date() } // Optionally update last activity timestamp
            },
            { new: true, runValidators: true } // new: true returns the updated document, runValidators ensures model validations are checked
        );

        if (!updatedUser) {
            // If updatedUser is null, it means either user not found (unlikely if authenticated)
            // or creditsBalance was less than creditsToConsume
            // Fetch current balance to give accurate message, though this is an extra DB call
            const currentUserForBalanceCheck = await User.findById(userMakingRequest.userId).select('creditsBalance username');
            return res.status(402).json({ // 402 Payment Required is fitting
                message: '积分不足',
                required: creditsToConsume,
                currentBalance: currentUserForBalanceCheck ? currentUserForBalanceCheck.creditsBalance : '未知'
            });
        }

    } catch (error) {
        console.error('Error during user credit update:', error);
        return res.status(500).json({ message: '更新用户积分失败: ' + error.message });
    }

    // 4. Create CreditTransaction record if deduction was successful
    try {
        const balanceBeforeDeduction = updatedUser.creditsBalance + creditsToConsume; // Calculate what balance was before $inc
        
        const transaction = new CreditTransaction({
            user: updatedUser._id,
            type: 'consumption',
            aiApplication: aiApp._id,
            creditsChanged: -creditsToConsume,
            balanceBefore: balanceBeforeDeduction,
            balanceAfter: updatedUser.creditsBalance,
            description: `使用AI应用: ${aiApp.name} (ID: ${aiApp._id})`,
        });
        await transaction.save();

        res.status(200).json({
            message: `成功使用AI应用: ${aiApp.name}，已消耗 ${creditsToConsume} 积分。`,
            remainingBalance: updatedUser.creditsBalance,
            transactionId: transaction._id
        });

    } catch (error) {
        console.error('Error creating credit transaction record:', error);
        // IMPORTANT: Potentially need to refund the user if transaction record fails
        // This part makes the operation non-atomic across collections without MongoDB transactions.
        // For now, we'll log the error. A more robust system might queue a refund.
        // Or, if User.findOneAndUpdate failed, we wouldn't reach here.
        // If transaction.save() fails, the user's balance IS already debited.
        // This is a critical point for data consistency.
        
        // Attempt to refund (best effort without full transaction safety)
        try {
            await User.findByIdAndUpdate(updatedUser._id, { $inc: { creditsBalance: creditsToConsume }});
            console.error(`CRITICAL: Credit transaction save failed for user ${updatedUser._id} after debiting ${creditsToConsume}. Attempted refund. Please verify.`);
             return res.status(500).json({
                message: '记录消费流水失败，但积分可能已扣除。已尝试回退积分，请联系管理员核实。',
                error: error.message
            });
        } catch (refundError) {
            console.error(`CRITICAL: Credit transaction save FAILED AND REFUND FAILED for user ${updatedUser._id}. Manual intervention required. Error: ${refundError.message}`);
            return res.status(500).json({
                message: '记录消费流水失败，积分已扣除，且自动回退失败！请立即联系管理员。',
                error: error.message
            });
        }
    }
});

// DELETE an AI Application
router.delete('/:id', authenticateToken, isAdmin, getAiApplication, async (req, res) => {
    try {
        const aiApp = res.aiApp;
        const imagePath = aiApp.coverImageUrl ? path.join(__dirname, '..', aiApp.coverImageUrl) : null;

        await AiApplication.deleteOne({ _id: aiApp._id });

        // Delete associated cover image file
        if (imagePath && fs.existsSync(imagePath)) {
            fs.unlink(imagePath, (err) => {
                if (err) console.error("Error deleting cover image file:", err);
                else console.log(`Deleted cover image: ${imagePath}`);
            });
        }

        res.json({ message: 'AI 应用删除成功', appId: aiApp._id });
    } catch (err) {
        res.status(500).json({ message: '删除 AI 应用失败: ' + err.message });
    }
});

module.exports = router; 