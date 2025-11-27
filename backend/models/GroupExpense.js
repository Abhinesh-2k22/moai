const mongoose = require('mongoose');

const GroupExpenseSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    payerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    payerGuestName: {
        type: String
    },
    amount: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    // Array of who owes what
    splits: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        guestName: {
            type: String
        },
        amount: {
            type: Number,
            required: true
        }
    }]
});

module.exports = mongoose.model('GroupExpense', GroupExpenseSchema);
