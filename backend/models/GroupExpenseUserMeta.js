const mongoose = require('mongoose');

const GroupExpenseUserMetaSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    groupExpenseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GroupExpense',
        required: true
    },
    category: {
        type: String
    },
    paymentMethodId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentMethod'
    },
    paymentMethodName: {
        type: String,
        default: 'Unspecified'
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

GroupExpenseUserMetaSchema.index({ userId: 1, groupExpenseId: 1 }, { unique: true });

module.exports = mongoose.model('GroupExpenseUserMeta', GroupExpenseUserMetaSchema);
