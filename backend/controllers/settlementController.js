const Settlement = require('../models/Settlement');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const GroupExpense = require('../models/GroupExpense');
const mongoose = require('mongoose');

exports.getSettlements = async (req, res) => {
    try {
        const userIdStr = req.user.id;
        const userIdObj = new mongoose.Types.ObjectId(userIdStr);

        // 1. Fetch all expenses where user is involved
        // Using explicit ObjectId for reliable matching
        const expenses = await GroupExpense.find({
            $or: [
                { payerId: userIdObj },
                { 'splits.userId': userIdObj }
            ]
        }).populate('groupId', 'name').populate('payerId', 'name').populate('splits.userId', 'name');

        // 2. Fetch all settlements where user is involved
        const settlements = await Settlement.find({
            $or: [
                { fromUserId: userIdObj },
                { toUserId: userIdObj }
            ]
        });

        // 2.5 Fetch Personal Transactions (Lend/Borrow) - UNSETTLED ONLY
        // Remove status: 'confirmed' filter to include all legacy/pending transactions
        const personalTx = await Transaction.find({
            userId: userIdObj,
            $or: [{ type: 'lend' }, { type: 'borrow' }],
            isSettled: false
        }).populate('recipientUserId', 'name');

        // 3. Calculate Net Balances
        // Map<OtherUserId | Name, { userId: String, name: String, total: Number, breakdown: Array }>
        const balances = {};

        const initBalance = (id, name) => {
            if (!balances[id]) {
                balances[id] = {
                    userId: id.startsWith('guest:') ? null : id,
                    guestName: id.startsWith('guest:') ? id.split(':')[1] : null,
                    name: name,
                    total: 0,
                    breakdown: [] // { type: 'group'|'personal', groupId?, groupName, amount }
                };
            }
        };

        const updateBreakdown = (otherId, type, groupId, groupName, amount, txId = null) => {
            // Check if entry exists for this group/type
            let entry = balances[otherId].breakdown.find(b =>
                b.type === type && (type === 'group' ? b.groupId === groupId : b.groupName === groupName)
            );

            if (entry) {
                entry.amount += amount;
                if (txId) {
                    if (!entry.transactionIds) entry.transactionIds = [];
                    entry.transactionIds.push(txId);
                }
            } else {
                const newEntry = {
                    type,
                    groupName,
                    amount
                };
                if (groupId) newEntry.groupId = groupId;
                if (txId) newEntry.transactionIds = [txId];

                balances[otherId].breakdown.push(newEntry);
            }
            balances[otherId].total += amount;
        };

        // Process Expenses
        expenses.forEach(exp => {
            // Safety checks for populated fields to prevent crashes if data is missing
            if ((!exp.payerId && !exp.payerGuestName)) return;

            const payerId = exp.payerId ? exp.payerId._id.toString() : `guest:${exp.payerGuestName}`;
            const payerName = exp.payerId ? exp.payerId.name : `${exp.payerGuestName} (Guest)`;
            const groupId = exp.groupId ? exp.groupId._id.toString() : 'unknown';
            const groupName = exp.groupId ? exp.groupId.name : 'Unknown Group';

            if (payerId === userIdStr) {
                // I paid, others owe me (Positive)
                exp.splits.forEach(split => {
                    const debtorId = split.userId ? split.userId._id.toString() : `guest:${split.guestName}`;
                    // Skip if split is with myself
                    if (debtorId !== userIdStr) {
                        const debtorName = split.userId ? split.userId.name : `${split.guestName} (Guest)`;
                        initBalance(debtorId, debtorName);
                        updateBreakdown(debtorId, 'group', groupId, groupName, split.amount);
                    }
                });
            } else {
                // Someone else paid
                // Check if I am in splits
                const mySplit = exp.splits.find(s =>
                    (s.userId && s.userId._id.toString() === userIdStr)
                );

                if (mySplit) {
                    // I owe payer (Negative)
                    initBalance(payerId, payerName);
                    updateBreakdown(payerId, 'group', groupId, groupName, -mySplit.amount);
                }
            }
        });

        // Process Personal Transactions
        personalTx.forEach(tx => {
            // Determine other party
            let otherId, otherName;

            if (tx.recipientUserId) {
                otherId = tx.recipientUserId._id.toString();
                otherName = tx.recipientUserId.name;
            } else {
                return; // Should not happen for lend/borrow if correctly created
            }

            // Note: If I Lend 100, they owe me (+100).
            // If I Borrow 100, I owe them (-100).

            // However, Transaction stores `userId` as ME. 
            // `type` determines direction.
            // Lend: I gave money. Active asset.
            const amount = tx.type === 'lend' ? tx.amount : -tx.amount;

            initBalance(otherId, otherName);
            updateBreakdown(otherId, 'personal', null, 'Personal Expenses', amount, tx._id.toString());
        });

        // Process Settlements (Reduces debt/credit)
        settlements.forEach(settle => {
            const fromId = settle.fromUserId ? settle.fromUserId.toString() : `guest:${settle.fromGuestName}`;
            const toId = settle.toUserId ? settle.toUserId.toString() : `guest:${settle.toGuestName}`;
            const groupId = settle.groupId ? settle.groupId.toString() : null;
            const groupName = 'Settlement/Payment';

            // Simplified: Just adjust total. 
            // If I PAID (fromId === userId), I reduced what I OWE (negative balance becomes less negative -> Add positive).
            if (fromId === userIdStr) {
                if (balances[toId]) {
                    balances[toId].total += settle.amount;
                    // Apply to breakdown if group context exists
                    if (groupId) {
                        updateBreakdown(toId, 'group', groupId, groupName, settle.amount);
                    } else {
                        // General settlement? For now, maybe don't add to breakdown to avoid clutter, 
                        // OR add a 'General' entry. Let's add it to ensure Sum(Breakdown) ~= Total
                        updateBreakdown(toId, 'settlement', 'general', 'General Payment', settle.amount);
                    }
                }
            } else if (toId === userIdStr) {
                // I RECEIVED (toId === userId), I reduced what is OWED TO ME (positive balance becomes less positive -> Subtract).
                if (balances[fromId]) {
                    balances[fromId].total -= settle.amount;
                    // Apply to breakdown
                    if (groupId) {
                        updateBreakdown(fromId, 'group', groupId, groupName, -settle.amount);
                    } else {
                        updateBreakdown(fromId, 'settlement', 'general', 'General Payment', -settle.amount);
                    }
                }
            }
        });

        // Filter and Format
        const result = Object.values(balances)
            .filter(b => Math.abs(b.total) > 0.01) // Filter zero balances
            .map(b => ({
                userId: b.userId,
                name: b.name,
                total: b.total,
                breakdown: b.breakdown.filter(i => Math.abs(i.amount) > 0.01)
            }));

        res.json(result);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Settle All Balances with a User
exports.settleAll = async (req, res) => {
    const { toUserId, toGuestName } = req.body;
    const fromUserId = req.user.id;

    try {
        // 1. Personal Transactions
        const personalDebts = await Transaction.find({
            $or: [
                { userId: fromUserId, recipientUserId: toUserId }, // I lend/borrow with them
                { userId: toUserId, recipientUserId: fromUserId }  // They lend/borrow with me
            ],
            $or: [{ type: 'lend' }, { type: 'borrow' }],
            isSettled: false
        });

        for (let tx of personalDebts) {
            tx.isSettled = true;
            await tx.save();
        }

        // 2. Group Expenses
        // Calculate NET amount per group and create a Settlement for it.
        const expenses = await GroupExpense.find({
            $or: [
                { payerId: fromUserId, 'splits.userId': toUserId },
                { payerId: toUserId, 'splits.userId': fromUserId }
            ]
        }).populate('groupId');

        const groupBalances = {}; // groupId -> amount (stats from perspective of fromUserId)

        // Calculate
        expenses.forEach(exp => {
            if (!exp.groupId) return;
            const gid = exp.groupId._id.toString();
            if (!groupBalances[gid]) groupBalances[gid] = 0;

            if (exp.payerId.toString() === fromUserId) {
                // I paid, they owe me.
                const split = exp.splits.find(s => s.userId && s.userId.toString() === toUserId);
                if (split) groupBalances[gid] += split.amount;
            } else {
                // They paid, I owe.
                const split = exp.splits.find(s => s.userId && s.userId.toString() === fromUserId);
                if (split) groupBalances[gid] -= split.amount;
            }
        });

        // Subtract existing settlements
        const existingSettlements = await Settlement.find({
            $or: [
                { fromUserId: fromUserId, toUserId: toUserId },
                { fromUserId: toUserId, toUserId: fromUserId }
            ]
        });

        existingSettlements.forEach(s => {
            if (!s.groupId) return;
            const gid = s.groupId.toString();
            if (groupBalances[gid] !== undefined) {
                if (s.fromUserId.toString() === fromUserId) {
                    // I paid previously. Reduced debt (add positive).
                    groupBalances[gid] += s.amount;
                } else {
                    // They paid. Reduced credit (subtract).
                    groupBalances[gid] -= s.amount;
                }
            }
        });

        // Create new Settlements
        const settlementPromises = [];
        for (const [gid, amount] of Object.entries(groupBalances)) {
            if (Math.abs(amount) > 0.01) {
                let sFrom, sTo, sAmount;

                if (amount > 0) {
                    // They owe me. They pay ME.
                    sFrom = toUserId;
                    sTo = fromUserId;
                    sAmount = amount;
                } else {
                    // I owe them. I pay THEM.
                    sFrom = fromUserId;
                    sTo = toUserId;
                    sAmount = Math.abs(amount);
                }

                const newSettlement = new Settlement({
                    groupId: gid,
                    fromUserId: sFrom,
                    toUserId: sTo,
                    amount: sAmount,
                    confirmed: true
                });
                settlementPromises.push(newSettlement.save());
            }
        }

        await Promise.all(settlementPromises);

        res.json({ msg: 'All balances settled' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.createSettlement = async (req, res) => {
    // Keeping basic implementation if needed or placeholder
    res.status(501).send('Use settleAll for now');
};

exports.getSettlementHistory = async (req, res) => {
    res.status(501).send('Not implemented yet');
};
