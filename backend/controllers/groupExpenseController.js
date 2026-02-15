const GroupExpense = require('../models/GroupExpense');
const Group = require('../models/Group');
const Settlement = require('../models/Settlement');
const mongoose = require('mongoose');

// Add Group Expense
exports.addExpense = async (req, res) => {
    const { description, amount, splits, payerId, payerGuestName, date } = req.body; // splits: [{ userId, guestName, amount }]
    const groupId = req.params.groupId;

    try {
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ msg: 'Group not found' });
        }

        // Verify membership
        if (!group.members.some(m => m.userId && m.userId.toString() === req.user.id)) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Determine Payer
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
            // Default to current user
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
        res.json(newExpense);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Get Group Expenses
exports.getExpenses = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const query = { groupId: req.params.groupId };

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); // Include the entire end day
                query.date.$lte = end;
            }
        }

        const expenses = await GroupExpense.find(query)
            .populate('payerId', 'name')
            .populate('splits.userId', 'name')
            .sort({ date: -1 });
        res.json(expenses);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Get Tally / Balances
exports.getBalances = async (req, res) => {
    const groupId = req.params.groupId;
    try {
        const expenses = await GroupExpense.find({ groupId });
        const settlements = await Settlement.find({ groupId, confirmed: true });

        // Create Name-to-ID map for this group to unify buckets
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

        // Calculate balances
        // Map of userId/guestName -> balance (positive = owed to them, negative = they owe)
        let balances = {};

        // Process expenses
        expenses.forEach(exp => {
            const payerKey = getCanonicalKey(exp.payerId, exp.payerGuestName);
            if (!balances[payerKey]) balances[payerKey] = 0;
            balances[payerKey] += exp.amount; // They paid

            exp.splits.forEach(split => {
                const debtorKey = getCanonicalKey(split.userId, split.guestName);
                if (!balances[debtorKey]) balances[debtorKey] = 0;
                balances[debtorKey] -= split.amount; // They owe
            });
        });

        // Process settlements (payments made)
        settlements.forEach(set => {
            const fromKey = getCanonicalKey(set.fromUserId, set.fromGuestName);
            const toKey = getCanonicalKey(set.toUserId, set.toGuestName);

            if (!balances[fromKey]) balances[fromKey] = 0;
            if (!balances[toKey]) balances[toKey] = 0;

            balances[fromKey] += set.amount;
            balances[toKey] -= set.amount;
        });

        // Format output
        const formattedBalances = [];
        for (const [key, amount] of Object.entries(balances)) {
            formattedBalances.push({ key, amount });
        }

        res.json(formattedBalances);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
// Update Group Expense
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

        // Verify membership
        if (!group.members.some(m => m.userId && m.userId.toString() === req.user.id)) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Update fields
        expense.description = description;
        expense.amount = amount;
        expense.splits = splits;
        expense.date = date;

        // Update Payer Logic
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
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Delete Group Expense
exports.deleteExpense = async (req, res) => {
    const expenseId = req.params.expenseId;

    try {
        const expense = await GroupExpense.findById(expenseId);
        if (!expense) {
            return res.status(404).json({ msg: 'Expense not found' });
        }

        const group = await Group.findById(expense.groupId);
        // Verify membership (anyone in group can delete? or only creator? 
        // For simplicity in a shared group, usually anyone can delete is fine, or maybe check if user is in the group)
        if (group && !group.members.some(m => m.userId && m.userId.toString() === req.user.id)) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        await expense.deleteOne();
        res.json({ msg: 'Expense removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
