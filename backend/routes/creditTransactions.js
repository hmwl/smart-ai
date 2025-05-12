const express = require('express');
const router = express.Router();
const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');
const PromotionActivity = require('../models/PromotionActivity');
const CreditSetting = require('../models/CreditSetting');
const mongoose = require('mongoose');
const authenticateToken = require('../middleware/authenticateToken');
const isAdmin = require('../middleware/isAdmin');

// Helper for payment method names (similar to frontend)
const platformNames = {
  wechat: '微信支付',
  alipay: '支付宝',
  unionpay: '云闪付',
  unifiedpay: '融合支付',
};

// GET Credit Transactions (Protected - Admin can see all/filter, User sees own)
router.get('/', authenticateToken, async (req, res) => {

    const { page = 1, limit = 20, userId: queryUserId, type, startDate, endDate, sort = '-createdAt' } = req.query;
    const query = {};
    const currentUser = req.user; // From authenticateToken { userId, username, isAdmin, ... }

    // --- Build Filter Query ---
    if (currentUser.isAdmin) {
        // Admin can filter by a specific userId if provided
        if (queryUserId) {
            query.user = queryUserId;
        }
        // Admin can also see all transactions if no queryUserId is specified
    } else {
        // Non-admin user: ALWAYS filter by their own userId
        query.user = currentUser.userId;
    }
    
    if (type) {
        query.type = type;
    }
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
            query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            query.createdAt.$lte = endOfDay;
        }
    }
    // --- End Build Filter Query ---

    try {
        const transactions = await CreditTransaction.find(query)
            .populate('user', 'username email _id') // Populate user with specific fields
            .populate('aiApplication', 'name _id') // Populate AI application with specific fields
            .populate('promotionActivity', 'name _id') // Populate Promotion Activity with name and ID
            .sort(sort) // Sort based on query param, default to newest first
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await CreditTransaction.countDocuments(query);

        res.json({
            transactions,
            total,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });

    } catch (err) {
        console.error(`[ERROR /api/credit-transactions GET - ${new Date().toISOString()}] Error fetching credit transactions:`, err); // ERROR LOG
        res.status(500).json({ message: '获取积分交易流水失败: ' + err.message });
    }
});

// POST /api/credit-transactions - Create a new Credit Transaction (e.g., Top-up)
router.post('/', authenticateToken, async (req, res) => {
    try {
        // Extract data from request body and authenticated user
        const { amount, paymentMethod, promotionId, payableAmount, estimatedCredits } = req.body;
        const userId = req.user.userId; // Assuming authenticateToken adds userId

        // Basic Validations
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ message: '无效的充值金额' });
        }
        if (!payableAmount || typeof payableAmount !== 'number' || payableAmount <= 0) {
            return res.status(400).json({ message: '无效的支付金额' });
        }
        if (!paymentMethod) {
            return res.status(400).json({ message: '请选择支付方式' });
        }

        // 1. Get current user balance and exchange rate
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: '用户不存在' });
        }
        const balanceBefore = user.creditsBalance || 0;

        const creditSettings = await CreditSetting.findOne().sort({ createdAt: -1 });
        const exchangeRate = creditSettings ? creditSettings.exchangeRate : 100; // Default 1 CNY = 100 credits

        let actualCreditsEarned = Math.floor(amount * exchangeRate);

        // 2. Validate and apply promotion if provided
        let promotion = null;
        if (promotionId) {
            console.log(`[CreditTX] Received promotionId: ${promotionId}, Type: ${typeof promotionId}`);

            // Use findOne with the custom string _id instead of findById
            promotion = await PromotionActivity.findOne({ _id: promotionId });
            console.log('[CreditTX] Promotion found by custom ID lookup (_id):', promotion);

            if (!promotion || !promotion.isEnabled || promotion.activityType !== 'recharge_discount' || promotion.effectiveStatus !== 'ongoing') {
                console.error('[CreditTX] Promotion not valid, expired, or wrong type:', promotion);
                // Provide more specific feedback if promotion was found but invalid vs not found at all
                const errorMessage = promotion 
                    ? '选择的优惠活动当前不可用、已过期或类型不符' 
                    : '未找到指定的优惠活动';
                return res.status(400).json({ message: errorMessage });
            }

            // Recalculate credits earned based on promotion (backend authoritative calculation)
            const promoDetails = promotion.activityDetails;
            if (promoDetails && promoDetails.rechargeDiscountSubType === 'full_reduction_discount' && promoDetails.fullReduction) {
                const frDetails = promoDetails.fullReduction;
                if (amount >= frDetails.everyAmountRMB) {
                    if (frDetails.type === 'points') {
                        const times = Math.floor(amount / frDetails.everyAmountRMB);
                        actualCreditsEarned += times * (frDetails.giftPoints || 0);
                        console.log(`[CreditTX] Applied points promotion: Added ${times * (frDetails.giftPoints || 0)} credits.`);
                    }
                }
            }
            console.log(`[CreditTX] Base credits: ${Math.floor(amount * exchangeRate)}, Final calculated credits (with promo): ${actualCreditsEarned}`);
        }

        // 3. Update user's credit balance
        const balanceAfter = balanceBefore + actualCreditsEarned;
        user.creditsBalance = balanceAfter;
        await user.save();

        // --- Construct detailed description for top-up ---
        const paymentMethodName = platformNames[paymentMethod] || paymentMethod; // Get display name or use key
        const timestamp = new Date().toISOString(); // Use ISO timestamp as placeholder for external ID
        let transactionDescription = `【账户充值】${paymentMethodName}，充值金额 ￥${amount.toFixed(2)}，流水号: ${timestamp}`;
        if (promotion) {
            transactionDescription += ` (使用优惠: ${promotion.name})`;
        }
        // --- End construct description ---

        // 4. Create the Credit Transaction record
        const newTransaction = new CreditTransaction({
            user: userId,
            type: 'topup',
            creditsChanged: actualCreditsEarned,
            balanceBefore: balanceBefore,
            balanceAfter: balanceAfter,
            description: transactionDescription, // Use the new detailed description
            promotionActivity: promotion ? promotion._id : null, // Use promotion._id
            transactionDetails: {
                originalAmountCNY: amount,
                payableAmountCNY: payableAmount,
                paymentMethod: paymentMethod,
                exchangeRate: exchangeRate,
                promotionName: promotion ? promotion.name : null
            }
        });
        await newTransaction.save();

        // Return success response
        res.status(201).json({
            message: `充值成功！获得 ${actualCreditsEarned} 积分。`,
            transactionId: newTransaction._id, // Use the generated ID
            earnedCredits: actualCreditsEarned,
            updatedCreditsBalance: balanceAfter,
        });

    } catch (error) {
        console.error('[ERROR /api/credit-transactions POST]', error);
        res.status(500).json({ message: '服务器内部错误，充值失败', error: error.message });
    }
});

// We can add other routes later (e.g., GET /:id, POST /adjust for admin)

module.exports = router; 