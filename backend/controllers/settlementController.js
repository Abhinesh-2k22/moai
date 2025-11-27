const Settlement = require('../models/Settlement');
const User = require('../models/User');
const PersonalTransaction = require('../models/PersonalTransaction');
const mongoose = require('mongoose');

exports.getSettlements = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Fetch all expenses where user is involved
        const expenses = await GroupExpense.find({
            $or: [
                { payerId: userId },
                { 'splits.userId': userId }
            ]
        }).populate('groupId', 'name').populate('payerId', 'name').populate('splits.userId', 'name');

        // 2. Fetch all settlements where user is involved
        const settlements = await Settlement.find({
            $or: [
                { fromUserId: userId },
                { toUserId: userId }
            ]
        });

        // 2.5 Fetch Personal Transactions (Lending/Borrowing)
        const personalTx = await PersonalTransaction.find({ userId: userId, isSettled: false });

        // 3. Calculate Net Balances
        // Map<OtherUserId | Name, { name: String, total: Number, breakdown: Map<GroupId | 'Personal', Number> }>
        const balances = {};

        const initBalance = (id, name) => {
            if (!balances[id]) {
                balances[id] = {
                    userId: id.startsWith('personal_') ? null : id, // Handle virtual IDs for personal contacts
                    name: name,
                    total: 0,
                    breakdown: {} // groupId -> amount
                };
            }
        };

        const updateBreakdown = (otherId, groupId, groupName, amount) => {
            if (!balances[otherId].breakdown[groupId]) {
                balances[otherId].breakdown[groupId] = {
                    groupName: groupName,
                    amount: 0
                };
            }
            balances[otherId].breakdown[groupId].amount += amount;
            balances[otherId].total += amount;
        };

        // Process Expenses
        expenses.forEach(exp => {
            const payerId = exp.payerId._id.toString();
            const groupId = exp.groupId._id.toString();
            const groupName = exp.groupId.name;

            if (payerId === userId) {
                // I paid, others owe me (Positive)
                exp.splits.forEach(split => {
                    if (split.userId && split.userId._id.toString() !== userId) {
                        const debtorId = split.userId._id.toString();
                        initBalance(debtorId, split.userId.name);
                        updateBreakdown(debtorId, groupId, groupName, split.amount);
                    }
                });
            } else {
                // Someone else paid
                // Check if I am in splits
                const mySplit = exp.splits.find(s => s.userId && s.userId._id.toString() === userId);
                if (mySplit) {
                    // I owe payer (Negative)
                    initBalance(payerId, exp.payerId.name);
                    updateBreakdown(payerId, groupId, groupName, -mySplit.amount);
                }
            }
        });

        // Process Personal Transactions
        personalTx.forEach(tx => {
            // Create a virtual ID for the person if they are just a name
            // If we want to merge with existing users, we'd need to match by name, which is risky.
            // For now, treat them as separate entries unless we have a robust way to link.
            // But the user might want to see "Alice" (Group) and "Alice" (Personal) merged.
            // Let's try to match by name if possible, or just use a unique key.
            // Given the schema only has `otherPersonName`, we use that as the key.

            // To avoid collision with ObjectIds, prefix or use name as ID if no collision?
            // Let's use `personal_${name}` as ID.

            const personId = `personal_${tx.otherPersonName}`;
            initBalance(personId, tx.otherPersonName);

            const amount = tx.type === 'lend' ? tx.amount : -tx.amount;
            const desc = tx.description + (tx.dueDate ? ` (Due: ${new Date(tx.dueDate).toLocaleDateString()})` : '');

            updateBreakdown(personId, 'personal', 'Personal Lending', amount);

            // If we want to show the specific description in the breakdown instead of just "Personal Lending"
            // We can append to the groupName or create unique "groups" for each transaction?
            // Better: "Personal: Description"
            // balances[personId].breakdown[`personal_${tx._id}`] = { groupName: desc, amount: amount };
            // But `updateBreakdown` aggregates by groupId. Let's stick to aggregation for now.
        });

        // Process Settlements (Payments already made)
        settlements.forEach(settle => {
            const fromId = settle.fromUserId ? settle.fromUserId.toString() : null;
            const toId = settle.toUserId ? settle.toUserId.toString() : null;
            const groupId = settle.groupId.toString(); // We might not have group name populated, but it's fine for calculation

            // If I paid (fromId === userId), I reduced my debt (add positive to balance)
            // Wait, if I owe -100, and I pay 100, balance becomes 0. So yes, add 100.

            if (fromId === userId && toId) {
                // I paid 'toId'
                if (balances[toId]) {
                    // We don't strictly track settlements per group in the breakdown for simplification in this view, 
                    // OR we can try to attribute it. 
                    // For now, let's add a "Settled" entry in breakdown or just adjust total.
                    // To keep breakdown accurate, we should probably show "Settlements" as a separate line item or adjust the specific group if we tracked it.
                    // The Settlement model HAS groupId. So we can adjust that specific group's debt.

                    // We need to fetch group name if not populated, but let's assume we just adjust the total for now 
                    // or try to find the group entry.

                    if (balances[toId].breakdown[groupId]) {
                        balances[toId].breakdown[groupId].amount += settle.amount;
                    } else {
                        // Fallback if group not in expenses (rare)
                        // balances[toId].breakdown[groupId] = { groupName: 'Settlement', amount: settle.amount };
                    }
                    balances[toId].total += settle.amount;
                }
            } else if (toId === userId && fromId) {
                // 'fromId' paid me. They reduced their debt to me (subtract from positive).
                if (balances[fromId]) {
                    if (balances[fromId].breakdown[groupId]) {
                        balances[fromId].breakdown[groupId].amount -= settle.amount;
                    }
                    balances[fromId].total -= settle.amount;
                }
            }
        });

        // Format for response
        const result = Object.values(balances)
            .filter(b => Math.abs(b.total) > 0.01) // Filter out settled/zero balances
            .map(b => ({
                userId: b.userId,
                name: b.name,
                total: b.total,
                breakdown: Object.values(b.breakdown).filter(g => Math.abs(g.amount) > 0.01)
            }));

        res.json(result);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.addPersonalTransaction = async (req, res) => {
    const { type, amount, otherPersonName, description, dueDate, date } = req.body;
    try {
        const newTx = new PersonalTransaction({
            userId: req.user.id,
            type,
            amount,
            otherPersonName,
            description,
            dueDate,
            date: date || Date.now()
        });
        const savedTx = await newTx.save();
        res.json(savedTx);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.deletePersonalTransaction = async (req, res) => {
    try {
        const tx = await PersonalTransaction.findById(req.params.id);
        if (!tx) return res.status(404).json({ msg: 'Transaction not found' });

        if (tx.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        await tx.deleteOne();
        res.json({ msg: 'Transaction removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Create Settlement
exports.createSettlement = async (req, res) => {
    const { groupId, toUserId, toGuestName, amount } = req.body;
    const fromUserId = req.user.id;

    try {
        // 1. Create Settlement Record
        const settlement = new Settlement({
            groupId,
            fromUserId,
            toUserId: toUserId || undefined,
            toGuestName: toGuestName || undefined,
            amount,
            confirmed: true // Auto-confirm for now as it's a direct action
        });
        await settlement.save();

        // 2. Mark relevant transactions as settled
        // We need to find "Borrow" transactions where I (fromUserId) owe "toUserId"
        // AND "Lend" transactions where "toUserId" lent to me.

        if (toUserId) {
            // My Borrowings from them
            await Transaction.updateMany(
                {
                    userId: fromUserId,
                    recipientUserId: toUserId,
                    type: 'borrow',
                    isSettled: false
                },
                { isSettled: true, settlementStatus: 'confirmed' }
            );

            // Their Lendings to me
            await Transaction.updateMany(
                {
                    userId: toUserId,
                    recipientUserId: fromUserId,
                    type: 'lend',
                    isSettled: false
                },
                { isSettled: true, settlementStatus: 'confirmed' }
            );
        }

        // Note: For guest settlements, we don't have Transactions to update (as guests don't have accounts/txs)
        // The balance calculation relies on the Settlement record itself to offset the expense splits.

        res.json(settlement);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.getSettlementHistory = async (req, res) => {
    try {
        const settlements = await Settlement.find({
            $or: [
                { fromUserId: req.user.id },
                { toUserId: req.user.id }
            ]
        }).sort({ date: -1 });
        res.json(settlements);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
