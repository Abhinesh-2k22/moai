const mongoose = require('mongoose');
require('dotenv').config();
const Transaction = require('./models/Transaction');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const txs = await Transaction.find({ type: { $in: ['lend', 'borrow'] } }).sort({ date: -1 }).limit(20);
    console.log(JSON.stringify(txs.map(t => ({
        id: t._id,
        userId: t.userId,
        type: t.type,
        amount: t.amount,
        recipientUserId: t.recipientUserId,
        linked: t.linkedTransactionId,
        isSettled: t.isSettled
    })), null, 2));
    process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
