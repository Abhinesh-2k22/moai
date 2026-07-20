const mongoose = require('mongoose');

const SettlementSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group'
    },
    type: {
        type: String,
        enum: ['group', 'personal'],
        default: 'group'
    },
    fromUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    fromGuestName: {
        type: String
    },
    toUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    toGuestName: {
        type: String
    },
    amount: {
        type: Number,
        required: true
    },
    paymentMethodId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentMethod'
    },
    date: {
        type: Date,
        default: Date.now
    },
    confirmed: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('Settlement', SettlementSchema);
