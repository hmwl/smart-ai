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

    const { page = 1, limit = 20, userId: userIdSearchTerm, transactionId, type, startDate, endDate, sort = '-createdAt' } = req.query;
    let query = {};
    const currentUser = req.user; 
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);

    // --- Build Filter Query ---

    // Rule for non-admin: always filter by their own userId
    if (!currentUser.isAdmin) {
        query.user = currentUser.userId;
    }

    // 1. Handle Transaction ID Search (if provided)
    if (transactionId) { 
        // Assuming CreditTransaction._id is a string (e.g., "CTnPMMhg") based on provided example.
        // If it could be a Mongo ObjectId OR a custom string, this logic might need to be more robust.
        query._id = transactionId;
    }

    // 2. Handle User Search (for admins, if userIdSearchTerm is provided)
    // This search is ANDed with transactionId if both are provided.
    if (currentUser.isAdmin && userIdSearchTerm) {
        const userSearchConditions = [
            { username: new RegExp(userIdSearchTerm, 'i') }, // Search by username
            { _id: userIdSearchTerm } // Search by User._id (assuming it can be a string like USE3ecxQ)
        ];
        // If User._id could be a mix of Mongo ObjectIds and custom strings, the following would be more robust:
        // const userSearchConditions = [
        //     { username: new RegExp(userIdSearchTerm, 'i') }
        // ];
        // if (mongoose.Types.ObjectId.isValid(userIdSearchTerm)) {
        //     userSearchConditions.push({ _id: mongoose.Types.ObjectId(userIdSearchTerm) });
        // } else {
        //     userSearchConditions.push({ _id: userIdSearchTerm }); // For custom string IDs
        // }

        try {
            const matchedUsers = await User.find({ $or: userSearchConditions }).select('_id').lean();
            if (matchedUsers.length > 0) {
                // If query.user is already set (by non-admin), this logic path (isAdmin && userIdSearchTerm) shouldn't be hit.
                // So, we can directly assign.
                query.user = { $in: matchedUsers.map(u => u._id) };
            } else {
                // Admin searched for a user, and no user matched. This means the overall query should yield no results.
                return res.json({ transactions: [], total: 0, currentPage: pageInt, totalPages: 0 });
            }
        } catch (userSearchError) {
            console.error('Error searching users for credit transaction filter:', userSearchError);
            return res.status(500).json({ message: '搜索用户信息时出错' });
        }
    }

    // 3. Handle other filters (type, date) - these are ANDed with previous conditions
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
        let transactions = await CreditTransaction.find(query)
            .populate('user', 'username email _id') 
            .populate('aiApplication', 'name _id') 
            .populate('promotionActivity', 'name _id') 
            .sort(sort) 
            .skip((pageInt - 1) * limitInt)
            .limit(limitInt)
            .lean(); // Use .lean() for plain JS objects, as we will modify them

        const total = await CreditTransaction.countDocuments(query);

        // --- Populate Operator --- 
        const adminOpPrefix = 'ADMIN_OP_BY_';
        const adminUserIdsToFetch = new Set();

        transactions.forEach(transaction => {
            if (transaction.referenceId && transaction.referenceId.startsWith(adminOpPrefix)) {
                const adminId = transaction.referenceId.substring(adminOpPrefix.length);
                if (adminId) {
                    adminUserIdsToFetch.add(adminId);
                }
            }
        });

        let adminUsersMap = new Map();
        if (adminUserIdsToFetch.size > 0) {
            const adminUsers = await User.find({ '_id': { $in: Array.from(adminUserIdsToFetch) } }).select('username _id').lean();
            adminUsers.forEach(admin => adminUsersMap.set(admin._id.toString(), admin));
        }
        
        transactions = transactions.map(transaction => {
            let operator = null; 
            // Default operator to the user who owns the transaction, if user is populated
            if (transaction.user) {
                 operator = {
                    username: transaction.user.username,
                    _id: transaction.user._id.toString() 
                };
            }

            if (transaction.referenceId && transaction.referenceId.startsWith(adminOpPrefix)) {
                const adminId = transaction.referenceId.substring(adminOpPrefix.length);
                const adminUser = adminUsersMap.get(adminId);
                if (adminUser) {
                    operator = { // Override if admin operator found
                        username: adminUser.username,
                        _id: adminUser._id.toString()
                    };
                }
            }
            return { ...transaction, operator }; // Add operator to the transaction object
        });
        // --- End Populate Operator ---

        res.json({
            transactions,
            total,
            currentPage: pageInt,
            totalPages: Math.ceil(total / limitInt)
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

            // Use findOne with the custom string _id instead of findById
            promotion = await PromotionActivity.findOne({ _id: promotionId });

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
                    }
                }
            }
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