const GroupExpense = require('../models/GroupExpense');
const Group = require('../models/Group');
const Settlement = require('../models/Settlement');
const GroupExpenseUserMeta = require('../models/GroupExpenseUserMeta');
const PaymentMethod = require('../models/PaymentMethod');
const groupExpenseMetaController = require('./groupExpenseMetaController');
const mongoose = require('mongoose');

const assertGroupWritable = (group) => {
    if (group.status === 'closed') {
        throw Object.assign(new Error('Group is frozen'), { statusCode: 400, msg: 'Group is frozen. Resume the group to modify expenses.' });
    }
};

const saveUserMeta = async (userId, groupExpenseId, { category, paymentMethodId, paymentMethodName }) => {
    if (!category && !paymentMethodId && !paymentMethodName) return;

    let resolvedPaymentName = paymentMethodName || 'Unspecified';
    if (paymentMethodId) {
        const pm = await PaymentMethod.findById(paymentMethodId);
        if (pm && pm.userId.toString() === userId.toString()) {
            resolvedPaymentName = pm.name;
        }
    }

    await GroupExpenseUserMeta.findOneAndUpdate(
        { userId, groupExpenseId },
        {
            category: category || undefined,
            paymentMethodId: paymentMethodId || undefined,
            paymentMethodName: resolvedPaymentName,
            updatedAt: new Date()
        },
        { upsert: true, new: true }
    );
};

exports.addExpense = async (req, res) => {
    const { description, amount, splits, payerId, payerGuestName, date, userMeta } = req.body;
    const groupId = req.params.groupId;

    try {
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ msg: 'Group not found' });
        }

        assertGroupWritable(group);

        if (!group.members.some(m => m.userId && m.userId.toString() === req.user.id)) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        let finalPayerId = undefined;
        let finalPayerGuestName = undefined;

        if (payerId) {
            if (payerId.startsWith('guest:')) {
                finalPayerGuestName = payerId.split(':')[1];
            } else {
                finalPayerId = payerId;
            }
        } else if (payerGuestName) {
            finalPayerGuestName = payerGuestName;
        } else {
            finalPayerId = req.user.id;
        }

        const newExpense = new GroupExpense({
            groupId,
            payerId: finalPayerId,
            payerGuestName: finalPayerGuestName,
            amount,
            description,
            date,
            splits
        });

        await newExpense.save();

        if (userMeta) {
            await saveUserMeta(req.user.id, newExpense._id, userMeta);
        }

        res.json(newExpense);
    } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ msg: err.msg });
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.getExpenses = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const query = { groupId: req.params.groupId };

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.date.$lte = end;
            }
        }

        const expenses = await GroupExpense.find(query)
            .populate('payerId', 'name profilePic')
            .populate('splits.userId', 'name profilePic')
            .sort({ date: -1 });
        res.json(expenses);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.getBalances = async (req, res) => {
    const groupId = req.params.groupId;
    const userIdStr = req.user.id;
    try {
        const expenses = await GroupExpense.find({ groupId });
        const settlements = await Settlement.find({ groupId, confirmed: true });

        const group = await mongoose.model('Group').findById(groupId);
        const nameToId = {};
        if (group) {
            group.members.forEach(m => {
                if (m.userId && m.guestName) {
                    nameToId[m.guestName.toLowerCase()] = m.userId.toString();
                }
            });
        }

        const getCanonicalKey = (id, guestName) => {
            const idStr = id ? (id._id || id).toString() : null;
            if (idStr) return idStr;
            if (guestName && nameToId[guestName.toLowerCase()]) {
                return nameToId[guestName.toLowerCase()];
            }
            return guestName ? `guest:${guestName.toLowerCase()}` : 'unknown';
        };

        const isMe = (key, guestName) => {
            if (key === userIdStr) return true;
            const userMember = group?.members.find(m => m.userId && m.userId.toString() === userIdStr);
            if (userMember?.guestName && guestName && userMember.guestName.toLowerCase() === guestName.toLowerCase()) return true;
            return false;
        };

        let balances = {};
        let pairwise = {};

        expenses.forEach(exp => {
            const payerKey = getCanonicalKey(exp.payerId, exp.payerGuestName);
            if (!balances[payerKey]) balances[payerKey] = 0;
            balances[payerKey] += exp.amount;

            exp.splits.forEach(split => {
                const debtorKey = getCanonicalKey(split.userId, split.guestName);
                if (!balances[debtorKey]) balances[debtorKey] = 0;
                balances[debtorKey] -= split.amount;

                const payerIsMe = isMe(payerKey, exp.payerGuestName);
                const debtorIsMe = isMe(debtorKey, split.guestName);

                if (payerIsMe && !debtorIsMe) {
                    if (!pairwise[debtorKey]) pairwise[debtorKey] = 0;
                    pairwise[debtorKey] += split.amount;
                } else if (!payerIsMe && debtorIsMe) {
                    if (!pairwise[payerKey]) pairwise[payerKey] = 0;
                    pairwise[payerKey] -= split.amount;
                }
            });
        });

        settlements.forEach(set => {
            const fromKey = getCanonicalKey(set.fromUserId, set.fromGuestName);
            const toKey = getCanonicalKey(set.toUserId, set.toGuestName);

            if (!balances[fromKey]) balances[fromKey] = 0;
            if (!balances[toKey]) balances[toKey] = 0;

            balances[fromKey] += set.amount;
            balances[toKey] -= set.amount;

            const fromIsMe = isMe(fromKey, set.fromGuestName);
            const toIsMe = isMe(toKey, set.toGuestName);

            if (fromIsMe && !toIsMe) {
                if (!pairwise[toKey]) pairwise[toKey] = 0;
                pairwise[toKey] += set.amount;
            } else if (!fromIsMe && toIsMe) {
                if (!pairwise[fromKey]) pairwise[fromKey] = 0;
                pairwise[fromKey] -= set.amount;
            }
        });

        const formattedBalances = [];
        for (const [key, amount] of Object.entries(balances)) {
            const entry = { key, amount };
            if (key !== userIdStr && !isMe(key, key.startsWith('guest:') ? key.split(':')[1] : null)) {
                entry.relativeToMe = pairwise[key] || 0;
            }
            formattedBalances.push(entry);
        }

        res.json(formattedBalances);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.updateExpense = async (req, res) => {
    const { description, amount, splits, payerId, payerGuestName, date } = req.body;
    const expenseId = req.params.expenseId;

    try {
        const expense = await GroupExpense.findById(expenseId);
        if (!expense) {
            return res.status(404).json({ msg: 'Expense not found' });
        }

        const group = await Group.findById(expense.groupId);
        if (!group) {
            return res.status(404).json({ msg: 'Group not found' });
        }

        assertGroupWritable(group);

        if (!group.members.some(m => m.userId && m.userId.toString() === req.user.id)) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        expense.description = description;
        expense.amount = amount;
        expense.splits = splits;
        expense.date = date;

        if (payerId) {
            if (payerId.startsWith('guest:')) {
                expense.payerGuestName = payerId.split(':')[1];
                expense.payerId = undefined;
            } else {
                expense.payerId = payerId;
                expense.payerGuestName = undefined;
            }
        } else if (payerGuestName) {
            expense.payerGuestName = payerGuestName;
            expense.payerId = undefined;
        }

        await expense.save();
        res.json(expense);
    } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ msg: err.msg });
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.deleteExpense = async (req, res) => {
    const expenseId = req.params.expenseId;

    try {
        const expense = await GroupExpense.findById(expenseId);
        if (!expense) {
            return res.status(404).json({ msg: 'Expense not found' });
        }

        const group = await Group.findById(expense.groupId);
        if (group) {
            assertGroupWritable(group);
        }

        if (group && !group.members.some(m => m.userId && m.userId.toString() === req.user.id)) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        await groupExpenseMetaController.deleteMetaForExpense(expenseId);
        await expense.deleteOne();
        res.json({ msg: 'Expense removed' });
    } catch (err) {
        if (err.statusCode) return res.status(err.statusCode).json({ msg: err.msg });
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
