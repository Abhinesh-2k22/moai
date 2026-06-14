const mongoose = require('mongoose');
const Group = require('./models/Group');
const GroupExpense = require('./models/GroupExpense');
const Settlement = require('./models/Settlement');
require('dotenv').config({ path: './.env' });

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        const groupId = 'YOUR_GROUP_ID'; // We need to find the latest group
        const group = await Group.findOne().sort({ createdAt: -1 });
        if (!group) {
            console.log("No group found");
            process.exit(0);
        }
        console.log("Testing Group:", group.name, group._id);
        
        const expenses = await GroupExpense.find({ groupId: group._id });
        const settlements = await Settlement.find({ groupId: group._id, confirmed: true });

        let balances = {};
        const nameToId = {};
        group.members.forEach(m => {
            if (m.userId && m.guestName) {
                nameToId[m.guestName.toLowerCase()] = m.userId.toString();
            }
        });

        const getCanonicalKey = (id, guestName) => {
            const idStr = id ? (id._id || id).toString() : null;
            if (idStr) return idStr;
            if (guestName && nameToId[guestName.toLowerCase()]) {
                return nameToId[guestName.toLowerCase()];
            }
            return guestName ? `guest:${guestName.toLowerCase()}` : 'unknown';
        };

        expenses.forEach(exp => {
            const payerKey = getCanonicalKey(exp.payerId, exp.payerGuestName);
            if (!balances[payerKey]) balances[payerKey] = 0;
            balances[payerKey] += exp.amount;

            exp.splits.forEach(split => {
                const debtorKey = getCanonicalKey(split.userId, split.guestName);
                if (!balances[debtorKey]) balances[debtorKey] = 0;
                balances[debtorKey] -= split.amount;
            });
        });

        console.log("After expenses:", balances);

        settlements.forEach(set => {
            const fromKey = getCanonicalKey(set.fromUserId, set.fromGuestName);
            const toKey = getCanonicalKey(set.toUserId, set.toGuestName);

            if (!balances[fromKey]) balances[fromKey] = 0;
            if (!balances[toKey]) balances[toKey] = 0;

            balances[fromKey] += set.amount;
            balances[toKey] -= set.amount;
        });

        console.log("After settlements:", balances);
        
        let settled = true;
        for (const amount of Object.values(balances)) {
            if (Math.abs(amount) > 0.01) settled = false;
        }
        console.log("Is settled?", settled);

        process.exit(0);
    })
    .catch(console.error);
