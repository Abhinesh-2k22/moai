const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

// Get all transactions for user
exports.getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.id }).sort({ date: -1 });
        res.json(transactions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Add new transaction
exports.addTransaction = async (req, res) => {
    const { amount, type, category, description, date, investmentType, recipientUserId, recipientDummyId } = req.body;

    try {
        // Handle lend/borrow transactions
        if (type === 'lend' || type === 'borrow') {
            const Notification = require('../models/Notification');
            const DummyUser = require('../models/DummyUser');

            // Check if recipient is a dummy user
            const isDummyUser = !!recipientDummyId;

            if (isDummyUser) {
                // AUTO-CONFIRM for dummy users
                const newTransaction = new Transaction({
                    userId: req.user.id,
                    amount,
                    type,
                    description,
                    date,
                    recipientDummyId,
                    status: 'confirmed'
                });

                const transaction = await newTransaction.save();

                // Immediately create reciprocal transaction for dummy user
                const reciprocalType = type === 'lend' ? 'borrow' : 'lend';
                const reciprocalTx = new Transaction({
                    userId: req.user.id, // Dummy transactions still belong to the creator
                    amount,
                    type: reciprocalType,
                    description,
                    date,
                    recipientDummyId,
                    status: 'confirmed',
                    linkedTransactionId: transaction._id
                });

                await reciprocalTx.save();

                // Link back
                transaction.linkedTransactionId = reciprocalTx._id;
                await transaction.save();

                return res.json(transaction);
            } else {
                // PENDING for real users - requires confirmation
                const newTransaction = new Transaction({
                    userId: req.user.id,
                    amount,
                    type,
                    description,
                    date,
                    recipientUserId,
                    status: 'pending'
                });

                const transaction = await newTransaction.save();

                // Create notification for recipient
                const notification = new Notification({
                    userId: recipientUserId,
                    type: type === 'lend' ? 'lend_request' : 'borrow_request',
                    transactionId: transaction._id,
                    fromUserId: req.user.id,
                    amount,
                    description,
                    status: 'pending'
                });

                await notification.save();

                return res.json(transaction);
            }
        }

        // Regular transactions (income, expense, investment)
        const newTransaction = new Transaction({
            userId: req.user.id,
            amount,
            type,
            category,
            description,
            date,
            investmentType
        });

        const transaction = await newTransaction.save();
        res.json(transaction);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Delete transaction
exports.deleteTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({ msg: 'Transaction not found' });
        }

        // Ensure user owns transaction
        if (transaction.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        await transaction.deleteOne();
        res.json({ msg: 'Transaction removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Get Analysis Data
exports.getAnalysis = async (req, res) => {
    try {
        const income = await Transaction.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.user.id), type: 'income' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const expense = await Transaction.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.user.id), type: 'expense' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const investmentBuy = await Transaction.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.user.id), type: 'investment', investmentType: 'buy' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const investmentSell = await Transaction.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.user.id), type: 'investment', investmentType: 'sell' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        res.json({
            totalIncome: income[0]?.total || 0,
            totalExpense: expense[0]?.total || 0,
            totalInvestmentBuy: investmentBuy[0]?.total || 0,
            totalInvestmentSell: investmentSell[0]?.total || 0
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
