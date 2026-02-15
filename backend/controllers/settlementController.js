const Settlement = require('../models/Settlement');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const GroupExpense = require('../models/GroupExpense');
const Group = require('../models/Group');
const mongoose = require('mongoose');

exports.getSettlements = async (req, res) => {
    try {
        const userIdStr = req.user.id;
        const userIdObj = new mongoose.Types.ObjectId(userIdStr);
        const user = await User.findById(userIdObj);
        const userName = user ? user.name : null;

        // 1. Fetch all expenses where user is involved
        // Using explicit ObjectId for reliable matching
        const expenses = await GroupExpense.find({
            $or: [
                { payerId: userIdObj },
                { payerGuestName: userName },
                { 'splits.userId': userIdObj },
                { 'splits.guestName': userName }
            ]
        }).populate('groupId', 'name').populate('payerId', 'name').populate('splits.userId', 'name');

        // 2. Fetch all settlements where user is involved
        const settlements = await Settlement.find({
            $or: [
                { fromUserId: userIdObj },
                { toUserId: userIdObj },
                { fromGuestName: userName },
                { toGuestName: userName }
            ]
        }).populate('fromUserId', 'name').populate('toUserId', 'name');

        // 2.5 Fetch Personal Transactions (Lend/Borrow) - UNSETTLED ONLY
        // Remove status: 'confirmed' filter to include all legacy/pending transactions
        const personalTx = await Transaction.find({
            userId: userIdObj,
            $or: [{ type: 'lend' }, { type: 'borrow' }],
            isSettled: false
        }).populate('recipientUserId', 'name');

        // 0. Name-to-ID Mapping (Bucket Unification)
        const groups = await mongoose.model('Group').find({ 'members.userId': userIdObj });
        const nameToId = {};
        groups.forEach(g => {
            g.members.forEach(m => {
                if (m.userId && m.guestName) {
                    nameToId[m.guestName.toLowerCase()] = m.userId.toString();
                }
            });
        });

        const getCanonicalKey = (id, guestName) => {
            const idStr = id ? (id._id || id).toString() : null;
            if (idStr) return idStr;
            if (guestName && nameToId[guestName.toLowerCase()]) {
                return nameToId[guestName.toLowerCase()];
            }
            return guestName ? `guest:${guestName.toLowerCase()}` : 'unknown';
        };

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
            const payerKey = getCanonicalKey(exp.payerId, exp.payerGuestName);
            const payerName = exp.payerId ? (exp.payerId.name || exp.payerId) : `${exp.payerGuestName} (Guest)`;
            const groupId = exp.groupId ? (exp.groupId._id || exp.groupId).toString() : 'unknown';
            const groupName = exp.groupId ? exp.groupId.name : 'Unknown Group';

            const payerIsMe = payerKey === userIdStr || (exp.payerGuestName && userName && exp.payerGuestName.toLowerCase() === userName.toLowerCase());

            if (payerIsMe) {
                // I paid, others owe me (Positive)
                exp.splits.forEach(split => {
                    const debtorKey = getCanonicalKey(split.userId, split.guestName);
                    const debtorIsMe = debtorKey === userIdStr || (split.guestName && userName && split.guestName.toLowerCase() === userName.toLowerCase());

                    if (!debtorIsMe) {
                        const debtorName = split.userId ? (split.userId.name || split.userId) : `${split.guestName} (Guest)`;
                        initBalance(debtorKey, debtorName);
                        updateBreakdown(debtorKey, 'group', groupId, groupName, split.amount);
                    }
                });
            } else {
                // Someone else paid, check if I am in splits
                const mySplit = exp.splits.find(s => {
                    const k = getCanonicalKey(s.userId, s.guestName);
                    return k === userIdStr || (s.guestName && userName && s.guestName.toLowerCase() === userName.toLowerCase());
                });

                if (mySplit) {
                    // I owe payer (Negative)
                    initBalance(payerKey, payerName);
                    updateBreakdown(payerKey, 'group', groupId, groupName, -mySplit.amount);
                }
            }
        });

        // Adjust for Settlements (canonical keys)
        settlements.forEach(settle => {
            const fromKey = getCanonicalKey(settle.fromUserId, settle.fromGuestName);
            const toKey = getCanonicalKey(settle.toUserId, settle.toGuestName);
            const groupId = settle.groupId ? (settle.groupId._id || settle.groupId).toString() : null;
            const groupName = 'Settlement/Payment';

            const fromIsMe = fromKey === userIdStr || (settle.fromGuestName && userName && settle.fromGuestName.toLowerCase() === userName.toLowerCase());
            const toIsMe = toKey === userIdStr || (settle.toGuestName && userName && settle.toGuestName.toLowerCase() === userName.toLowerCase());

            // partyKey is the "other" person
            let partyKey = fromIsMe ? toKey : fromKey;

            let partyName = fromIsMe ?
                (settle.toUserId ? settle.toUserId.name : settle.toGuestName) :
                (settle.fromUserId ? settle.fromUserId.name : settle.fromGuestName);

            if (!balances[partyKey]) {
                initBalance(partyKey, partyName || 'Unknown');
            }

            if (fromIsMe) {
                // I PAID (Balance increases/Credit increases)
                // Note: balances[partyKey].total is updated inside updateBreakdown
                if (groupId) updateBreakdown(partyKey, 'group', groupId, groupName, settle.amount);
                else updateBreakdown(partyKey, 'settlement', 'general', 'General Settlement', settle.amount);
            } else if (toIsMe) {
                // I RECEIVED (Balance decreases/Credit decreases)
                if (groupId) updateBreakdown(partyKey, 'group', groupId, groupName, -settle.amount);
                else updateBreakdown(partyKey, 'settlement', 'general', 'General Settlement', -settle.amount);
            }
        });

        // Skip the separate settlements loop below as we unified it above

        // Process Personal Transactions
        personalTx.forEach(tx => {
            // Determine other party
            let otherId, otherName;

            if (tx.recipientUserId) {
                const recipientObj = tx.recipientUserId;
                otherId = getCanonicalKey(recipientObj, null);
                otherName = recipientObj.name || recipientObj;
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

        // Skipped redundant legacy processing (merged above)

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
    const { toUserId, userName } = req.body; // userName comes from frontend Settlements.jsx
    const fromUserId = req.user.id;
    // We also need the current user's name to match them as a Guest in other records
    const currentUser = await User.findById(fromUserId);
    const fromUserName = currentUser ? currentUser.name : null;

    try {
        // 1. Personal Transactions
        const personalTxQuery = {
            $or: [
                { userId: fromUserId, recipientUserId: toUserId },
                { userId: toUserId, recipientUserId: fromUserId }
            ],
            type: { $in: ['lend', 'borrow'] },
            isSettled: false
        };
        const personalDebts = await Transaction.find(personalTxQuery);

        for (let tx of personalDebts) {
            tx.isSettled = true;
            await tx.save();
        }

        // 2. Group Expenses
        // Match by ID OR Name for both parties
        const expenses = await GroupExpense.find({
            $or: [
                // I paid, they are in splits
                { payerId: fromUserId, 'splits.userId': toUserId },
                { payerGuestName: fromUserName, 'splits.userId': toUserId },
                { payerId: fromUserId, 'splits.guestName': userName },
                // They paid, I am in splits
                { payerId: toUserId, 'splits.userId': fromUserId },
                { payerGuestName: userName, 'splits.userId': fromUserId },
                { payerId: toUserId, 'splits.guestName': fromUserName }
            ]
        }).populate('groupId');

        const groupBalances = {}; // groupId -> amount (stats from perspective of fromUserId)

        // Calculate
        expenses.forEach(exp => {
            if (!exp.groupId) return;
            const gid = exp.groupId._id.toString();
            if (!groupBalances[gid]) groupBalances[gid] = 0;

            if (exp.payerId && exp.payerId.toString() === fromUserId || exp.payerGuestName === fromUserName) {
                // I paid, they owe me.
                const split = exp.splits.find(s =>
                    (s.userId && s.userId.toString() === toUserId) ||
                    (s.guestName === userName)
                );
                if (split) groupBalances[gid] += split.amount;
            } else {
                // They paid, I owe.
                const split = exp.splits.find(s =>
                    (s.userId && s.userId.toString() === fromUserId) ||
                    (s.guestName === fromUserName)
                );
                if (split) groupBalances[gid] -= split.amount;
            }
        });

        // Subtract existing settlements
        const existingSettlements = await Settlement.find({
            $or: [
                { fromUserId: fromUserId, toUserId: toUserId },
                { fromUserId: toUserId, toUserId: fromUserId },
                { fromGuestName: fromUserName, toUserId: toUserId },
                { fromUserId: toUserId, toGuestName: fromUserName },
                { fromUserId: fromUserId, toGuestName: userName },
                { fromGuestName: userName, toUserId: fromUserId }
            ]
        });

        existingSettlements.forEach(s => {
            const gid = s.groupId ? s.groupId.toString() : 'general';
            if (!groupBalances[gid]) groupBalances[gid] = 0;

            const fromId = s.fromUserId ? s.fromUserId.toString() : null;
            const toId = s.toUserId ? s.toUserId.toString() : null;

            if (fromId === fromUserId || s.fromGuestName === userName) {
                // I paid previously. Reduced debt (add positive).
                groupBalances[gid] += s.amount;
            } else if (toId === fromUserId || s.toGuestName === userName) {
                // They paid. Reduced credit (subtract).
                groupBalances[gid] -= s.amount;
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
    const { groupId, toUserId, toGuestName, amount } = req.body;
    const fromUserId = req.user.id;

    try {
        const newSettlement = new Settlement({
            groupId,
            fromUserId,
            toUserId,
            toGuestName,
            amount,
            confirmed: true // For now, auto-confirm when manually added from group
        });

        await newSettlement.save();
        res.json(newSettlement);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.getSettlementHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        const userName = user ? user.name : null;

        const history = await Settlement.find({
            $or: [
                { fromUserId: userId },
                { toUserId: userId },
                { fromGuestName: userName },
                { toGuestName: userName }
            ],
            confirmed: true
        })
            .populate('fromUserId', 'name')
            .populate('toUserId', 'name')
            .populate('groupId', 'name')
            .sort({ date: -1 });

        res.json(history);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
