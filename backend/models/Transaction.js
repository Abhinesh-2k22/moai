const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['income', 'expense', 'investment', 'lend', 'borrow'],
        required: true
    },
    investmentType: {
        type: String,
        enum: ['buy', 'sell'],
        required: function () { return this.type === 'investment'; }
    },
    category: {
        type: String,
        required: function () { return !['lend', 'borrow'].includes(this.type); }
    },
    description: {
        type: String
    },
    date: {
        type: Date,
        default: Date.now
    },
    // Lend/Borrow specific fields
    recipientUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function () { return ['lend', 'borrow'].includes(this.type); }
    },
    recipientDummyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DummyUser'
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'rejected'],
        default: function () {
            return ['lend', 'borrow'].includes(this.type) ? 'pending' : 'confirmed';
        }
    },
    linkedTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    },
    isSettled: {
        type: Boolean,
        default: false
    },
    settlementStatus: {
        type: String,
        enum: ['none', 'requested', 'confirmed'],
        default: 'none'
    }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
