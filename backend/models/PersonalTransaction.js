const mongoose = require('mongoose');

const PersonalTransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['lend', 'borrow'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    otherPersonName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    dueDate: {
        type: Date
    },
    date: {
        type: Date,
        default: Date.now
    },
    isSettled: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PersonalTransaction', PersonalTransactionSchema);
