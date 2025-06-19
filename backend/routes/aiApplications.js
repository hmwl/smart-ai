const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AiApplication = require('../models/AiApplication');
const AiType = require('../models/AiType'); // Needed for validation
const ApiEntry = require('../models/ApiEntry'); // Needed for validation
const User = require('../models/User'); // Added User model
const CreditTransaction = require('../models/CreditTransaction'); // Added CreditTransaction model
const EnumConfig = require('../models/EnumConfig'); // Import EnumConfig model
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PromotionActivity = require('../models/PromotionActivity'); // Added PromotionActivity model

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
        fileSize: 1024 * 1024 // 1MB limit
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

// Helper function to extract all enumOptionIds from a form schema
function extractEnumOptionIds(schema) {
    const ids = []; // Changed from Set to Array to count occurrences
    if (schema && schema.fields && Array.isArray(schema.fields)) {
        schema.fields.forEach(field => {
            // From field.config.enumOptionIds
            if (field.config && field.config.dataSourceType === 'enum' && field.config.enumOptionIds) {
                if (Array.isArray(field.config.enumOptionIds)) {
                    field.config.enumOptionIds.forEach(id => {
                        if (id && typeof id === 'string') { 
                            ids.push(id); // Changed from add to push
                        }
                    });
                } else if (typeof field.config.enumOptionIds === 'string' && field.config.enumOptionIds) { 
                    ids.push(field.config.enumOptionIds); // Changed from add to push
                }
            }

            // From field.props.defaultValue if it's an enumOptionId or array of them
            if (field.config && field.config.dataSourceType === 'enum' && field.props && field.props.defaultValue) {
                const defaultValue = field.props.defaultValue;
                if (Array.isArray(defaultValue)) {
                    defaultValue.forEach(val => {
                        if (val && typeof val === 'string') { 
                            ids.push(val); // Changed from add to push
                        }
                    });
                } else if (typeof defaultValue === 'string' && defaultValue) {
                    ids.push(defaultValue); // Changed from add to push
                }
            }

            // From field.config.conditionalLogicRules.conditionValue
            if (field.config && field.config.conditionalLogicRules && Array.isArray(field.config.conditionalLogicRules)) {
                field.config.conditionalLogicRules.forEach(rule => {
                    const triggerField = schema.fields.find(f => f.id === rule.triggerFieldId);
                    if (triggerField && triggerField.config && triggerField.config.dataSourceType === 'enum') {
                        if (rule.conditionValue) {
                            if (Array.isArray(rule.conditionValue)) {
                                rule.conditionValue.forEach(val => {
                                    if (val && typeof val === 'string') { 
                                        ids.push(val); // Changed from add to push
                                    }
                                });
                            } else if (typeof rule.conditionValue === 'string' && rule.conditionValue) { 
                                ids.push(rule.conditionValue); // Changed from add to push
                            }
                        }
                    }
                });
            }
        });
    }
    return ids; // Returns an array of all occurrences
}

// Helper function to get a frequency map of IDs from an array
function getCountsMap(idsArray) {
    const counts = new Map();
    if (idsArray && Array.isArray(idsArray)) {
        for (const id of idsArray) {
            counts.set(id, (counts.get(id) || 0) + 1);
        }
    }
    return counts;
}

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

// --- Form Configuration Routes ---

// GET /:id/form-config - Get form configuration for an AI Application
router.get('/:id/form-config', authenticateToken, isAdmin, getAiApplication, async (req, res) => {
    try {
        const aiApp = res.aiApp; // From getAiApplication middleware
        if (aiApp.formSchema) {
            res.json(aiApp.formSchema);
        } else {
            // If no formSchema exists, return an empty object or a default structure.
            // The frontend expects to be able to load this even if it's "new".
            // A 404 was previously handled, but returning an empty schema might be cleaner.
            res.status(200).json({}); 
        }
    } catch (error) {
        console.error('Error fetching form configuration:', error);
        res.status(500).json({ message: '获取表单配置失败: ' + error.message });
    }
});

// POST /:id/form-config - Save form configuration for an AI Application
router.post('/:id/form-config', authenticateToken, isAdmin, getAiApplication, async (req, res) => {
    const newFormSchema = req.body; 
    const aiApp = res.aiApp;


    try {
        const oldFormSchema = aiApp.formSchema || { fields: [] }; 
        
        const oldEnumOptionIdsArray = extractEnumOptionIds(oldFormSchema);
        const newEnumOptionIdsArray = extractEnumOptionIds(newFormSchema);

        const oldCountMap = getCountsMap(oldEnumOptionIdsArray);
        const newCountMap = getCountsMap(newEnumOptionIdsArray);

        const allUniqueIds = new Set([...oldCountMap.keys(), ...newCountMap.keys()]);
        
        const updateOperations = [];

        for (const optionId of allUniqueIds) {
            const oldCount = oldCountMap.get(optionId) || 0;
            const newCount = newCountMap.get(optionId) || 0;
            const delta = newCount - oldCount;

            if (delta !== 0) {
                updateOperations.push({
                    updateOne: {
                        filter: { _id: optionId },
                        update: { $inc: { usageCount: delta } }
                    }
                });
            }
        }
        
        if (updateOperations.length > 0) {
            await EnumConfig.bulkWrite(updateOperations);
            
            // Safeguard: Ensure usageCount doesn't go below 0 for affected IDs
            const affectedIdsForSafeguard = updateOperations.map(op => op.updateOne.filter._id);
            if (affectedIdsForSafeguard.length > 0) {
                 await EnumConfig.updateMany(
                    { _id: { $in: affectedIdsForSafeguard }, usageCount: { $lt: 0 } },
                    { $set: { usageCount: 0 } }
                );
            }
        } else {
        }
        
        aiApp.formSchema = newFormSchema;
        await aiApp.save();
        res.status(200).json(aiApp.formSchema);
    } catch (error) {
        console.error(`[UsageCount Update] APP ID: ${aiApp._id} - Error saving form configuration or updating enum usage count:`, error);
        res.status(500).json({ message: '保存表单配置或更新枚举使用计数时出错: ' + error.message });
    }
});
// --- End Form Configuration Routes ---

// POST /:id/consume - Consume credits for an AI Application
router.post('/:id/consume', authenticateToken, getAiApplication, async (req, res) => {
    const aiApp = res.aiApp; // From getAiApplication middleware
    const userMakingRequest = req.user; // From authenticateToken middleware


    // 1. Check if AI Application is active
    if (aiApp.status !== 'active') {
        return res.status(400).json({ message: `AI 应用 '${aiApp.name}' 当前未激活，无法使用。` });
    }

    let originalCreditsToConsume = aiApp.creditsConsumed;
    let finalCreditsToConsume = originalCreditsToConsume;
    let appliedPromotionId = null;
    let appliedPromotionName = null; // For logging

    // 2. Check for applicable 'AI应用折扣' promotions
    const now = new Date();
    const promotionQuery = {
        isEnabled: true,
        startTime: { $lte: now },
        endTime: { $gte: now },
        activityType: 'usage_discount',
        'activityDetails.usageDiscountSubType': 'app_specific_discount',
        'activityDetails.appSpecific.targetAppIds': aiApp._id.toString() // Ensure aiApp._id is a string for matching
    };

    const applicablePromotions = await PromotionActivity.find(promotionQuery)
        .sort({ createdAt: -1 }); 


    if (applicablePromotions.length > 0) {
        const promotion = applicablePromotions[0]; // Apply the first found (e.g., latest)
        appliedPromotionId = promotion._id;
        appliedPromotionName = promotion.name; // For logging
        const appSpecificDetails = promotion.activityDetails.appSpecific;

        if (appSpecificDetails.discountType === 'percentage') {
            const discountRate = parseFloat(appSpecificDetails.discountValue);
            if (discountRate > 0 && discountRate <= 100) {
                finalCreditsToConsume = Math.max(0, Math.round(originalCreditsToConsume * (1 - discountRate / 100)));
            }
        } else if (appSpecificDetails.discountType === 'fixed_reduction') {
            const reductionAmount = parseInt(appSpecificDetails.discountValue, 10);
            if (reductionAmount > 0) {
                finalCreditsToConsume = Math.max(0, originalCreditsToConsume - reductionAmount);
            }
        }
    } else {
    }

    // 3. Check if the application (after potential discount) costs anything
    if (finalCreditsToConsume <= 0) {
        // Log a zero-cost transaction if a promotion made it free or it was already free
        try {
            const transactionDescription = appliedPromotionId ? 
                `使用AI应用: ${aiApp.name} (ID: ${aiApp._id}) (促销活动: ${appliedPromotionName} - ${appliedPromotionId})` :
                `使用免费AI应用: ${aiApp.name} (ID: ${aiApp._id})`;

            const userForBalance = await User.findById(userMakingRequest.userId).select('creditsBalance').lean();
            const currentBalance = userForBalance ? userForBalance.creditsBalance : 0;

            const transaction = new CreditTransaction({
                user: userMakingRequest.userId,
                type: 'consumption',
                aiApplication: aiApp._id,
                creditsChanged: 0, // Zero cost
                balanceBefore: currentBalance, 
                balanceAfter: currentBalance,
                description: transactionDescription,
                promotionActivity: appliedPromotionId // Log promotion ID if applied
            });
            await transaction.save();
        } catch (transactionError) {
            console.error('[Consume API] Error logging zero-cost transaction:', transactionError);
            // Non-critical if zero-cost logging fails, proceed to inform user.
        }
        return res.status(200).json({
            message: `成功使用AI应用: ${aiApp.name}${appliedPromotionId ? ` (已应用促销: ${appliedPromotionName})` : ''}`,
            creditsConsumed: 0,
            promotionApplied: !!appliedPromotionId,
            promotionName: appliedPromotionId ? appliedPromotionName : undefined,
        });
    }

    let updatedUser;
    try {
        // 4. Atomically find user and update balance if sufficient
        updatedUser = await User.findOneAndUpdate(
            { 
                _id: userMakingRequest.userId,
                creditsBalance: { $gte: finalCreditsToConsume } 
            },
            { 
                $inc: { creditsBalance: -finalCreditsToConsume },
                $set: { lastLoginAt: new Date() } // Optionally update last activity timestamp
            },
            { new: true, runValidators: true } // new: true returns the updated document, runValidators ensures model validations are checked
        );

        if (!updatedUser) {
            // If updatedUser is null, it means either user not found (unlikely if authenticated)
            // or creditsBalance was less than finalCreditsToConsume
            // Fetch current balance to give accurate message, though this is an extra DB call
            const currentUserForBalanceCheck = await User.findById(userMakingRequest.userId).select('creditsBalance username');
            const currentBalance = currentUserForBalanceCheck ? currentUserForBalanceCheck.creditsBalance : '未知';
            console.warn(`[Consume API] Insufficient credits for user ${userMakingRequest.userId}. Required: ${finalCreditsToConsume}, Available: ${currentBalance}`);
            return res.status(402).json({ // 402 Payment Required is fitting
                message: '积分不足',
                required: finalCreditsToConsume,
                currentBalance: currentBalance
            });
        }

    } catch (error) {
        console.error('[Consume API] Error during user credit update:', error);
        return res.status(500).json({ message: '更新用户积分失败: ' + error.message });
    }

    // 5. Create CreditTransaction record if deduction was successful
    try {
        const balanceBeforeDeduction = updatedUser.creditsBalance + finalCreditsToConsume; // Calculate what balance was before $inc
        
        const transactionDescription = appliedPromotionId ? 
            `使用AI应用: ${aiApp.name} (ID: ${aiApp._id}) (促销活动: ${appliedPromotionName} - ${appliedPromotionId})` :
            `使用AI应用: ${aiApp.name} (ID: ${aiApp._id})`;

        const transaction = new CreditTransaction({
            user: updatedUser._id,
            type: 'consumption',
            aiApplication: aiApp._id,
            creditsChanged: -finalCreditsToConsume,
            balanceBefore: balanceBeforeDeduction,
            balanceAfter: updatedUser.creditsBalance,
            description: transactionDescription,
            promotionActivity: appliedPromotionId // Log promotion ID if applied
        });
        await transaction.save();

        res.status(200).json({
            message: `成功使用AI应用: ${aiApp.name}，已消耗 ${finalCreditsToConsume} 积分。${appliedPromotionId ? ` (已应用促销: ${appliedPromotionName})` : ''}`,
            remainingBalance: updatedUser.creditsBalance,
            transactionId: transaction._id,
            creditsConsumed: finalCreditsToConsume,
            promotionApplied: !!appliedPromotionId,
            promotionName: appliedPromotionId ? appliedPromotionName : undefined,
        });

    } catch (error) {
        console.error('Error creating credit transaction record:', error);
        try {
            await User.findByIdAndUpdate(updatedUser._id, { $inc: { creditsBalance: finalCreditsToConsume }});
            console.error(`CRITICAL: Credit transaction save failed for user ${updatedUser._id} after debiting ${finalCreditsToConsume}. Attempted refund. Please verify.`);
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

        // --- Update EnumConfig usage counts before deleting the application --- 
        if (aiApp.formSchema && aiApp.formSchema.fields && aiApp.formSchema.fields.length > 0) {
            const enumOptionIdsInForm = extractEnumOptionIds(aiApp.formSchema);
            const countsInThisFormMap = getCountsMap(enumOptionIdsInForm);

            const updateOperations = [];
            if (countsInThisFormMap.size > 0) {
                for (const [optionId, countInThisForm] of countsInThisFormMap) {
                    if (countInThisForm > 0) {
                        updateOperations.push({
                            updateOne: {
                                filter: { _id: optionId },
                                update: { $inc: { usageCount: -countInThisForm } } 
                            }
                        });
                    }
                }
            }

            if (updateOperations.length > 0) {
                await EnumConfig.bulkWrite(updateOperations);
                
                const affectedIdsForSafeguard = updateOperations.map(op => op.updateOne.filter._id);
                if (affectedIdsForSafeguard.length > 0) {
                    await EnumConfig.updateMany(
                        { _id: { $in: affectedIdsForSafeguard }, usageCount: { $lt: 0 } },
                        { $set: { usageCount: 0 } }
                    );
                }
            } else {
            }
        } else {
        }
        // --- End EnumConfig usage count update ---

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
        console.error(`[UsageCount Update] DELETING APP ID: ${req.params.id} - Error during AI application deletion or enum usage count update:`, err);
        res.status(500).json({ message: '删除 AI 应用失败: ' + err.message });
    }
});

module.exports = router; 