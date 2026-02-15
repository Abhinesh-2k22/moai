const Transaction = require('../models/Transaction');
const GroupExpense = require('../models/GroupExpense');
const mongoose = require('mongoose');

// Get all transactions for user
exports.getTransactions = async (req, res) => {
    try {
        // 1. Fetch Personal Transactions
        const transactions = await Transaction.find({ userId: req.user.id }).lean();

        // 2. Fetch Group Expenses where user is involved
        const groupExpenses = await GroupExpense.find({ 'splits.userId': req.user.id })
            .populate('groupId', 'name')
            .populate('payerId', 'name')
            .lean();

        // 3. Transform Group Expenses into Transaction-like objects
        const groupTxns = groupExpenses.map(ge => {
            const mySplit = ge.splits.find(s => s.userId && s.userId.toString() === req.user.id);
            const amount = mySplit ? mySplit.amount : 0;
            const groupName = ge.groupId ? ge.groupId.name : 'Unknown Group';

            return {
                _id: ge._id, // Use GE ID
                userId: req.user.id,
                amount: amount,
                type: 'expense',
                category: 'Group Expense',
                description: `${ge.description} (Group: ${groupName})`,
                date: ge.date,
                isGroupExpense: true,
                payerName: ge.payerId ? ge.payerId.name : ge.payerGuestName
            };
        });

        // 4. Merge and Sort
        const allTransactions = [...transactions, ...groupTxns].sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(allTransactions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Add new transaction
exports.addTransaction = async (req, res) => {
    const { amount, type, category, description, date, investmentType, recipientUserId } = req.body;

    try {
        // Handle lend/borrow transactions
        if (type === 'lend' || type === 'borrow') {
            const txData = {
                userId: req.user.id,
                amount,
                type,
                description,
                date,
                status: 'confirmed',
                recipientUserId
            };

            const newTransaction = new Transaction(txData);
            const transaction = await newTransaction.save();

            // Create reciprocal transaction
            const reciprocalType = type === 'lend' ? 'borrow' : 'lend';
            const reciprocalTxData = {
                userId: recipientUserId,
                amount,
                type: reciprocalType,
                description,
                date,
                status: 'confirmed',
                linkedTransactionId: transaction._id,
                recipientUserId: req.user.id
            };

            const reciprocalTx = new Transaction(reciprocalTxData);
            await reciprocalTx.save();

            // Link back
            transaction.linkedTransactionId = reciprocalTx._id;
            await transaction.save();

            return res.json(transaction);
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

// Settle Transaction (Mark as Settled)
exports.settleTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({ msg: 'Transaction not found' });
        }

        if (transaction.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Mark as settled
        transaction.isSettled = true;
        await transaction.save();

        // Mark linked transaction as settled if exists
        if (transaction.linkedTransactionId) {
            const linkedTx = await Transaction.findById(transaction.linkedTransactionId);
            if (linkedTx) {
                linkedTx.isSettled = true;
                await linkedTx.save();
            }
        }

        res.json({ msg: 'Transaction settled', transaction });
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
