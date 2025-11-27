const GroupExpense = require('../models/GroupExpense');
const Group = require('../models/Group');
const Settlement = require('../models/Settlement');

// Add Group Expense
exports.addExpense = async (req, res) => {
    const { description, amount, splits, payerGuestName } = req.body; // splits: [{ userId, guestName, amount }]
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

        const newExpense = new GroupExpense({
            groupId,
            payerId: req.user.id, // Assuming logged in user pays, or we can allow specifying payer
            payerGuestName, // If payer is a guest (advanced case, usually user pays)
            amount,
            description,
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

        // Calculate balances
        // Map of userId/guestName -> balance (positive = owed to them, negative = they owe)
        let balances = {};

        const getKey = (userId, guestName) => userId ? userId.toString() : `guest:${guestName}`;

        // Process expenses
        expenses.forEach(exp => {
            const payerKey = getKey(exp.payerId, exp.payerGuestName);
            if (!balances[payerKey]) balances[payerKey] = 0;
            balances[payerKey] += exp.amount; // They paid, so they are owed this amount initially

            exp.splits.forEach(split => {
                const debtorKey = getKey(split.userId, split.guestName);
                if (!balances[debtorKey]) balances[debtorKey] = 0;
                balances[debtorKey] -= split.amount; // They owe this amount
            });
        });

        // Process settlements (payments made)
        settlements.forEach(set => {
            const fromKey = getKey(set.fromUserId, set.fromGuestName);
            const toKey = getKey(set.toUserId, set.toGuestName);

            if (!balances[fromKey]) balances[fromKey] = 0;
            if (!balances[toKey]) balances[toKey] = 0;

            balances[fromKey] += set.amount; // They paid, so their debt decreases (or credit increases)
            balances[toKey] -= set.amount;   // They received, so their credit decreases
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
