const Transaction = require('../models/Transaction');
const GroupExpense = require('../models/GroupExpense');
const GroupExpenseUserMeta = require('../models/GroupExpenseUserMeta');
const mongoose = require('mongoose');

exports.getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.id }).lean();

        const groupExpenses = await GroupExpense.find({ 'splits.userId': req.user.id })
            .populate('groupId', 'name')
            .populate('payerId', 'name')
            .lean();

        const geIds = groupExpenses.map(ge => ge._id);
        const metaList = await GroupExpenseUserMeta.find({
            userId: req.user.id,
            groupExpenseId: { $in: geIds }
        }).lean();
        const metaMap = {};
        metaList.forEach(m => {
            metaMap[m.groupExpenseId.toString()] = m;
        });

        const groupTxns = groupExpenses.map(ge => {
            const mySplit = ge.splits.find(s => s.userId && s.userId.toString() === req.user.id);
            const amount = mySplit ? mySplit.amount : 0;
            const groupName = ge.groupId ? ge.groupId.name : 'Unknown Group';
            const meta = metaMap[ge._id.toString()];

            return {
                _id: ge._id,
                userId: req.user.id,
                amount: amount,
                type: 'expense',
                category: meta?.category || 'Group Expense',
                description: `${ge.description} (Group: ${groupName})`,
                date: ge.date,
                isGroupExpense: true,
                groupExpenseId: ge._id,
                groupId: ge.groupId ? ge.groupId._id : null,
                payerName: ge.payerId ? ge.payerId.name : ge.payerGuestName,
                paymentMethodId: meta?.paymentMethodId,
                paymentMethodName: meta?.paymentMethodName || 'Unspecified'
            };
        });

        const allTransactions = [...transactions, ...groupTxns].sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(allTransactions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.addTransaction = async (req, res) => {
    const { amount, type, category, description, date, investmentType, recipientUserId, recipientDummyId, paymentMethodId, paymentMethodName } = req.body;

    try {
        if (type === 'lend' || type === 'borrow') {
            if (!recipientUserId && !recipientDummyId) {
                return res.status(400).json({ msg: 'Recipient is required' });
            }

            const txData = {
                userId: req.user.id,
                amount,
                type,
                description,
                date,
                status: 'confirmed',
                category: type === 'lend' ? 'Lending' : 'Borrowing',
                paymentMethodName: paymentMethodName || 'Unspecified'
            };

            if (recipientDummyId) {
                txData.recipientDummyId = recipientDummyId;
            } else {
                txData.recipientUserId = recipientUserId;
            }

            if (paymentMethodId) txData.paymentMethodId = paymentMethodId;

            const newTransaction = new Transaction(txData);
            const transaction = await newTransaction.save();

            if (recipientDummyId) {
                return res.json(transaction);
            }

            const reciprocalType = type === 'lend' ? 'borrow' : 'lend';
            const reciprocalTxData = {
                userId: recipientUserId,
                amount,
                type: reciprocalType,
                description,
                date,
                status: 'confirmed',
                linkedTransactionId: transaction._id,
                recipientUserId: req.user.id,
                category: reciprocalType === 'lend' ? 'Lending' : 'Borrowing',
                paymentMethodName: 'Unspecified'
            };

            const reciprocalTx = new Transaction(reciprocalTxData);
            await reciprocalTx.save();

            transaction.linkedTransactionId = reciprocalTx._id;
            await transaction.save();

            return res.json(transaction);
        }

        const newTransaction = new Transaction({
            userId: req.user.id,
            amount,
            type,
            category,
            description,
            date,
            investmentType,
            paymentMethodId: paymentMethodId || undefined,
            paymentMethodName: paymentMethodName || 'Unspecified'
        });

        const transaction = await newTransaction.save();
        res.json(transaction);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.settleTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({ msg: 'Transaction not found' });
        }

        if (transaction.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        transaction.isSettled = true;
        await transaction.save();

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

exports.deleteTransaction = async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        if (transaction) {
            if (transaction.userId.toString() !== req.user.id) {
                return res.status(401).json({ msg: 'User not authorized' });
            }
            await transaction.deleteOne();
            return res.json({ msg: 'Transaction removed' });
        }

        const groupExpense = await GroupExpense.findById(req.params.id);
        if (groupExpense) {
            return res.status(400).json({ msg: 'Group expenses must be deleted from the group page' });
        }

        return res.status(404).json({ msg: 'Transaction not found' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

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
