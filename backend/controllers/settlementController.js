const Settlement = require('../models/Settlement');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const DummyUser = require('../models/DummyUser');
const GroupExpense = require('../models/GroupExpense');
const Group = require('../models/Group');
const mongoose = require('mongoose');

const calculateAllBalances = async (req, perspective = null) => {
    try {
        const isDummy = !!perspective;
        const userIdStr = isDummy ? null : req.user.id;
        const userIdObj = isDummy ? null : new mongoose.Types.ObjectId(userIdStr);
        let user, userName;
        if (isDummy) {
            userName = perspective.name;
        } else {
            user = await User.findById(userIdObj);
            userName = user ? user.name : null;
        }

        // 1. Fetch all expenses where user/dummy is involved
        const expenses = await GroupExpense.find({
            $or: [
                { payerId: isDummy ? null : userIdObj },
                { payerGuestName: userName },
                { 'splits.userId': isDummy ? null : userIdObj },
                { 'splits.guestName': userName }
            ]
        }).populate('groupId', 'name').populate('payerId', 'name').populate('splits.userId', 'name');

        // 2. Fetch confirmed GROUP settlements only (personal settlements are handled by isSettled flag on transactions)
        const settlements = await Settlement.find({
            $or: [
                { fromUserId: isDummy ? null : userIdObj },
                { toUserId: isDummy ? null : userIdObj },
                { fromGuestName: userName },
                { toGuestName: userName }
            ],
            confirmed: true,
            type: { $ne: 'personal' }
        }).populate('fromUserId', 'name').populate('toUserId', 'name');

        // 2.5 Fetch Personal Transactions (Lend/Borrow)
        const personalTx = isDummy
            ? await Transaction.find({
                recipientDummyId: new mongoose.Types.ObjectId(perspective.id),
                $or: [{ type: 'lend' }, { type: 'borrow' }],
                isSettled: false
            }).populate('userId', 'name')
            : await Transaction.find({
                userId: userIdObj,
                $or: [{ type: 'lend' }, { type: 'borrow' }],
                isSettled: false
            }).populate('recipientUserId', 'name').populate('recipientDummyId', 'name');

        // 0. Name-to-ID Mapping (Bucket Unification)
        const groups = isDummy
            ? await mongoose.model('Group').find({ 'members.dummyUserId': new mongoose.Types.ObjectId(perspective.id) })
            : await mongoose.model('Group').find({ 'members.userId': userIdObj });

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
                    userId: id.startsWith('guest:') || id.startsWith('dummy:') ? null : id,
                    guestName: id.startsWith('guest:') ? id.split(':')[1] : null,
                    dummyId: id.startsWith('dummy:') ? id.split(':')[1] : null,
                    name: name,
                    total: 0,
                    breakdown: []
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
            if (settle.type === 'personal') return;

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
            let otherId, otherName;
            let amount;

            if (isDummy) {
                // In dummy perspective, transactions are created by the owner (`userId`).
                // Since the query filtered by `recipientDummyId == this dummy`, `userId` is the other person (the owner).
                const ownerObj = tx.userId;
                otherId = getCanonicalKey(ownerObj, null);
                otherName = ownerObj ? ownerObj.name : 'Owner';

                // If Owner lent 100 to Dummy, Dummy borrowed 100 from Owner. So Dummy owes Owner.
                // Owner's type='lend' -> Dummy's type='borrow'.
                // If Owner borrowed 100 from Dummy, Dummy lent 100 to Owner. So Owner owes Dummy.
                amount = tx.type === 'lend' ? -tx.amount : tx.amount;
            } else {
                if (tx.recipientDummyId) {
                    otherId = `dummy:${tx.recipientDummyId._id || tx.recipientDummyId}`;
                    otherName = tx.recipientDummyId.name || 'Contact';
                } else if (tx.recipientUserId) {
                    const recipientObj = tx.recipientUserId;
                    otherId = getCanonicalKey(recipientObj, null);
                    otherName = recipientObj.name || recipientObj;
                } else {
                    return;
                }

                // Lend: I gave money. Active asset.
                amount = tx.type === 'lend' ? tx.amount : -tx.amount;
            }

            initBalance(otherId, otherName);
            updateBreakdown(otherId, 'personal', null, 'Personal Expenses', amount, tx._id.toString());
        });

        // Skipped redundant legacy processing (merged above)

        return Object.values(balances);

    } catch (err) {
        console.error(err.message);
        throw err;
    }
};

exports.getSettlements = async (req, res) => {
    try {
        const balances = await calculateAllBalances(req);
        const result = balances
            .filter(b => Math.abs(b.total) > 0.01)
            .map(b => ({
                userId: b.userId,
                dummyId: b.dummyId,
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

exports.getDummyBalances = async (req, res) => {
    try {
        const dummyUsers = await DummyUser.find({ createdBy: req.user.id });
        const allBalances = [];

        for (const dummy of dummyUsers) {
            const perspective = { id: dummy._id.toString(), name: dummy.name };
            const balancesForDummy = await calculateAllBalances(req, perspective);
            allBalances.push({
                contact: dummy,
                balancesWithOthers: balancesForDummy.filter(b => Math.abs(b.total) > 0.01)
            });
        }
        res.json(allBalances);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Settle All Balances with a User
exports.settleAll = async (req, res) => {
    const { toUserId, userName, paymentMethodId, paymentMethodName } = req.body; // userName comes from frontend Settlements.jsx
    const fromUserId = req.user.id;
    // We also need the current user's name to match them as a Guest in other records
    const currentUser = await User.findById(fromUserId);
    const fromUserName = currentUser ? currentUser.name : null;

    try {
        // 1. Personal Transactions
        // Only fetch fromUser's own transactions to avoid double-counting linked pairs.
        // Each lend/borrow pair has a linkedTransactionId — we settle both sides here.
        const personalTxQuery = {
            userId: fromUserId,
            $or: [
                { recipientUserId: toUserId }
            ],
            type: { $in: ['lend', 'borrow'] },
            isSettled: false
        };

        // Also catch transactions where toUserId created the lend/borrow directed at fromUserId
        // but with no linked transaction (i.e., toUser created a standalone lend to fromUser)
        const partnerTxQuery = {
            userId: toUserId,
            recipientUserId: fromUserId,
            type: { $in: ['lend', 'borrow'] },
            isSettled: false,
            linkedTransactionId: { $exists: false }  // only unlinked ones (linked ones are covered by fromUser side)
        };

        const [myDebts, partnerStandaloneDebts] = await Promise.all([
            Transaction.find(personalTxQuery),
            Transaction.find(partnerTxQuery)
        ]);

        const personalDebts = [...myDebts, ...partnerStandaloneDebts];

        let personalNetAmount = 0; // positive = fromUser owes toUser, negative = toUser owes fromUser

        for (let tx of personalDebts) {
            tx.isSettled = true;
            await tx.save();

            // Also settle the linked counterpart if it exists
            if (tx.linkedTransactionId) {
                const linkedTx = await Transaction.findById(tx.linkedTransactionId);
                if (linkedTx && !linkedTx.isSettled) {
                    linkedTx.isSettled = true;
                    await linkedTx.save();
                }
            }

            // Accumulate net personal amount (from fromUser's perspective)
            const iAmCreator = tx.userId.toString() === fromUserId;
            const isBorrow = tx.type === 'borrow';
            const iOwe = (iAmCreator && isBorrow) || (!iAmCreator && !isBorrow);
            if (iOwe) {
                personalNetAmount += tx.amount; // fromUser owes
            } else {
                personalNetAmount -= tx.amount; // toUser owes fromUser
            }
        }

        // Create ONE consolidated Settlement record for the personal debt history
        if (personalDebts.length > 0 && Math.abs(personalNetAmount) > 0.01) {
            const iOweNet = personalNetAmount > 0;
            const consolidatedSettlement = new Settlement({
                type: 'personal',
                fromUserId: iOweNet ? fromUserId : toUserId,
                toUserId: iOweNet ? toUserId : fromUserId,
                amount: Math.abs(personalNetAmount),
                paymentMethodId: paymentMethodId || undefined,
                confirmed: true
            });
            await consolidatedSettlement.save();
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

        // Subtract existing confirmed GROUP settlements (exclude personal type)
        const existingSettlements = await Settlement.find({
            $or: [
                { fromUserId: fromUserId, toUserId: toUserId },
                { fromUserId: toUserId, toUserId: fromUserId },
                { fromGuestName: fromUserName, toUserId: toUserId },
                { fromUserId: toUserId, toGuestName: fromUserName },
                { fromUserId: fromUserId, toGuestName: userName },
                { fromGuestName: userName, toUserId: fromUserId }
            ],
            confirmed: true,
            type: { $ne: 'personal' }
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
                    groupId: gid === 'general' ? undefined : gid,
                    fromUserId: sFrom,
                    toUserId: sTo,
                    amount: sAmount,
                    paymentMethodId: paymentMethodId,
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

exports.settleContact = async (req, res) => {
    const { dummyId, guestName, otherUserId, otherGuestName } = req.body;

    // The Contact (Dummy) is Party 1
    const party1Name = guestName;

    // The Other Entity is Party 2 (defaults to Current User if not provided)
    const party2Id = otherGuestName ? null : (otherUserId || req.user.id);
    let party2Name = otherGuestName || null;

    if (party2Id && !party2Name) {
        const currentUser = await User.findById(party2Id);
        party2Name = currentUser ? currentUser.name : null;
    }

    try {
        // 1. Personal Transactions with DummyUser
        if (dummyId && party2Id) {
            const personalDebts = await Transaction.find({
                userId: party2Id,
                recipientDummyId: dummyId,
                type: { $in: ['lend', 'borrow'] },
                isSettled: false
            });

            for (let tx of personalDebts) {
                tx.isSettled = true;
                await tx.save();
            }
        }

        // 2. Group Expenses
        if (party1Name) {
            const expensesQuery = {
                $or: []
            };

            // Party 2 paid, Party 1 in splits
            if (party2Id) expensesQuery.$or.push({ payerId: party2Id, 'splits.guestName': party1Name });
            if (party2Name) expensesQuery.$or.push({ payerGuestName: party2Name, 'splits.guestName': party1Name });

            // Party 1 paid, Party 2 in splits
            if (party2Id) expensesQuery.$or.push({ payerGuestName: party1Name, 'splits.userId': party2Id });
            if (party2Name) expensesQuery.$or.push({ payerGuestName: party1Name, 'splits.guestName': party2Name });

            const expenses = await GroupExpense.find(expensesQuery).populate('groupId');

            const groupBalances = {};

            // Calculate
            expenses.forEach(exp => {
                if (!exp.groupId) return;
                const gid = exp.groupId._id.toString();
                if (!groupBalances[gid]) groupBalances[gid] = 0;

                const party2Paid = (exp.payerId && party2Id && exp.payerId.toString() === party2Id.toString()) ||
                    (exp.payerGuestName && party2Name && exp.payerGuestName === party2Name);

                if (party2Paid) {
                    // Party 2 paid, Party 1 owes Party 2.
                    // From Party 2's perspective: Party 1 owes Party 2 (Positive for Party 2).
                    // We need to decide perspective. Let's use Party 2's perspective for calculation,
                    // just like original code used `fromUserId`'s perspective.
                    const split = exp.splits.find(s => s.guestName === party1Name);
                    if (split) groupBalances[gid] += split.amount;
                } else if (exp.payerGuestName === party1Name) {
                    // Party 1 paid, Party 2 owes Party 1.
                    // From Party 2's perspective: Party 2 owes Party 1 (Negative for Party 2).
                    const split = exp.splits.find(s =>
                        (s.userId && party2Id && s.userId.toString() === party2Id.toString()) ||
                        (s.guestName && party2Name && s.guestName === party2Name)
                    );
                    if (split) groupBalances[gid] -= split.amount;
                }
            });

            // Subtract existing confirmed settlements
            const settlementQuery = {
                $or: [],
                confirmed: true,
                type: { $ne: 'personal' }
            };

            if (party2Id) {
                settlementQuery.$or.push(
                    { fromUserId: party2Id, toGuestName: party1Name },
                    { fromGuestName: party1Name, toUserId: party2Id }
                );
            }
            if (party2Name) {
                settlementQuery.$or.push(
                    { fromGuestName: party2Name, toGuestName: party1Name },
                    { fromGuestName: party1Name, toGuestName: party2Name }
                );
            }

            const existingSettlements = await Settlement.find(settlementQuery);

            existingSettlements.forEach(s => {
                const gid = s.groupId ? s.groupId.toString() : 'general';
                if (!groupBalances[gid]) groupBalances[gid] = 0;

                const sFromId = s.fromUserId ? s.fromUserId.toString() : null;

                if ((sFromId && party2Id && sFromId === party2Id.toString()) ||
                    (s.fromGuestName && party2Name && s.fromGuestName === party2Name)) {
                    // Party 2 paid previously. Reduced debt (add positive).
                    groupBalances[gid] += s.amount;
                } else if (s.fromGuestName === party1Name) {
                    // Party 1 paid. Reduced credit (subtract).
                    groupBalances[gid] -= s.amount;
                }
            });

            // Create new Settlements
            const settlementPromises = [];
            for (const [gid, amount] of Object.entries(groupBalances)) {
                if (Math.abs(amount) > 0.01) {
                    let sFrom, sFromGuest, sTo, sToGuest, sAmount;

                    if (amount > 0) {
                        // Party 1 owes Party 2. Party 1 pays Party 2.
                        sFrom = null;
                        sFromGuest = party1Name;
                        sTo = party2Id;
                        sToGuest = party2Name;
                        sAmount = amount;
                    } else {
                        // Party 2 owes Party 1. Party 2 pays Party 1.
                        sFrom = party2Id;
                        sFromGuest = party2Name;
                        sTo = null;
                        sToGuest = party1Name;
                        sAmount = Math.abs(amount);
                    }

                    const newSettlement = new Settlement({
                        groupId: gid === 'general' ? undefined : gid,
                        fromUserId: sFrom,
                        fromGuestName: sFromGuest,
                        toUserId: sTo,
                        toGuestName: sToGuest,
                        amount: sAmount,
                        confirmed: true
                    });
                    settlementPromises.push(newSettlement.save());
                }
            }

            await Promise.all(settlementPromises);
        }

        res.json({ msg: 'Contact balances settled' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.createSettlement = async (req, res) => {
    const { groupId, toUserId, toGuestName, fromUserId, fromGuestName, amount, paymentMethodId, type } = req.body;
    const currentUserId = req.user.id;

    try {
        if (groupId) {
            const group = await Group.findById(groupId);
            if (group) {
                const guestPartyName = fromGuestName || toGuestName;
                if (guestPartyName) {
                    const dummyMember = group.members.find(m =>
                        m.dummyUserId && m.guestName && m.guestName.toLowerCase() === guestPartyName.toLowerCase()
                    );
                    if (dummyMember && dummyMember.addedBy && dummyMember.addedBy.toString() !== currentUserId) {
                        return res.status(401).json({ msg: 'Only the contact owner can record settlements for this person' });
                    }
                }
            }
        }

        const newSettlement = new Settlement({
            groupId,
            type: type || 'group',
            fromUserId: fromUserId || currentUserId,
            fromGuestName: fromUserId ? undefined : (fromGuestName || undefined),
            toUserId: toUserId || currentUserId,
            toGuestName: toUserId ? undefined : (toGuestName || undefined),
            amount,
            paymentMethodId,
            confirmed: true
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

        const dummies = await DummyUser.find({ createdBy: userId });
        const dummyNames = dummies.map(d => d.name);

        const orConditions = [
            { fromUserId: userId },
            { toUserId: userId },
        ];

        if (userName) {
            orConditions.push({ fromGuestName: userName }, { toGuestName: userName });
        }

        for (const dName of dummyNames) {
            orConditions.push({ fromGuestName: dName }, { toGuestName: dName });
        }

        const history = await Settlement.find({
            $or: orConditions,
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
