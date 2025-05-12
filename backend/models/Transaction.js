const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transactionSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: ['top-up', 'usage', 'refund', 'adjustment'], // 交易类型：充值, 使用, 退款, 调整
        required: true,
        index: true,
    },
    amount: {
        type: Number, // 原始输入金额 (例如，充值时用户输入的 CNY 金额)
        required: true,
    },
    payableAmount: {
        type: Number, // 实际支付金额 (考虑折扣后)
        required: true,
    },
    creditsChange: {
        type: Number, // 积分变动数量 (正数为增加，负数为减少)
        required: true,
    },
    balanceAfter: {
        type: Number, // 本次交易后的用户积分余额
        required: true,
    },
    paymentMethod: { // 支付方式 (充值时使用)
        type: String,
        enum: ['alipay', 'wechat', 'unionpay', 'unifiedpay', null], // 允许 null 用于非充值类型
        default: null,
    },
    promotion: { // 使用的优惠活动 ID (如果适用)
        type: Schema.Types.ObjectId,
        ref: 'PromotionActivity',
        default: null,
        index: true,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled'], // 交易状态
        required: true,
        default: 'pending',
        index: true,
    },
    transactionIdExternal: { // 外部支付平台交易号 (如果适用)
        type: String,
        index: true,
        default: null,
    },
    remarks: { // 备注
        type: String,
        default: '',
    },
}, { timestamps: true }); // timestamps 会自动添加 createdAt 和 updatedAt 字段

// 索引优化查询
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ user: 1, createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction; 