const Group = require('../models/Group');
const User = require('../models/User');
const GroupExpense = require('../models/GroupExpense');
const Transaction = require('../models/Transaction');

// Create Group
exports.createGroup = async (req, res) => {
    const { name } = req.body;

    try {
        const newGroup = new Group({
            name,
            createdBy: req.user.id,
            members: [{ userId: req.user.id }] // Creator is first member
        });

        const group = await newGroup.save();
        res.json(group);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Get User's Groups
exports.getGroups = async (req, res) => {
    try {
        const groups = await Group.find({ 'members.userId': req.user.id })
            .populate('members.userId', 'name email')
            .sort({ createdAt: -1 });
        res.json(groups);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Add Member (Owner Only)
exports.addMember = async (req, res) => {
    const { email, guestName } = req.body;
    const groupId = req.params.id;

    try {
        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ msg: 'Group not found' });
        }

        // Check if user is owner
        if (group.createdBy.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Only the group owner can add members' });
        }

        // Check if group has expenses recorded
        const expenseCount = await GroupExpense.countDocuments({ groupId });
        if (expenseCount > 0) {
            return res.status(400).json({ msg: 'Cannot add members to a group with existing expenses. Please create a new group.' });
        }

        if (email) {
            // Add existing user
            const userToAdd = await User.findOne({ email });
            if (!userToAdd) {
                return res.status(404).json({ msg: 'User not found' });
            }

            // Check if already member
            if (group.members.some(member => member.userId && member.userId.toString() === userToAdd.id)) {
                return res.status(400).json({ msg: 'User already in group' });
            }

            group.members.push({ userId: userToAdd.id });
        } else if (guestName) {
            // Add guest member
            group.members.push({ guestName });
        } else {
            return res.status(400).json({ msg: 'Please provide email or guestName' });
        }

        await group.save();

        // Re-fetch to populate
        const updatedGroup = await Group.findById(groupId).populate('members.userId', 'name email');
        res.json(updatedGroup);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Get Group Details
exports.getGroup = async (req, res) => {
    try {
        const group = await Group.findById(req.params.id).populate('members.userId', 'name email');

        if (!group) {
            return res.status(404).json({ msg: 'Group not found' });
        }

        // Check if user is member
        // Since members.userId is populated, we need to access ._id
        if (!group.members.some(member => member.userId && member.userId._id.toString() === req.user.id)) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        res.json(group);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Add Group Expense
exports.addGroupExpense = async (req, res) => {
    const { description, amount, payerId, payerGuestName, date } = req.body;
    const groupId = req.params.id;

    try {
        const group = await Group.findById(groupId).populate('members.userId');
        if (!group) return res.status(404).json({ msg: 'Group not found' });

        // Validate payer
        let payer;
        if (payerId) {
            payer = group.members.find(m => m.userId && m.userId._id.toString() === payerId);
            if (!payer) return res.status(400).json({ msg: 'Payer must be a group member' });
        } else if (payerGuestName) {
            payer = group.members.find(m => m.guestName === payerGuestName);
            if (!payer) return res.status(400).json({ msg: 'Payer must be a group member' });
        } else {
            return res.status(400).json({ msg: 'Payer is required' });
        }

        const splitAmount = amount / group.members.length;
        const expenseDate = date ? new Date(date) : new Date();

        // 1. Create GroupExpense Record
        const groupExpense = new GroupExpense({
            groupId,
            payerId: payerId || undefined,
            payerGuestName: payerGuestName || undefined,
            amount,
            description,
            date: expenseDate,
            splits: group.members.map(m => ({
                userId: m.userId ? m.userId._id : undefined,
                guestName: m.guestName || undefined,
                amount: splitAmount
            }))
        });
        await groupExpense.save();

        // 2. Create Individual Transactions (ONLY for Registered Users)
        // If payer is a guest, they don't get transactions.
        // If member is a guest, they don't get transactions.

        for (const member of group.members) {
            // Skip if member is a guest
            if (!member.userId) continue;

            const memberId = member.userId._id.toString();

            // A. Create Expense Transaction for EVERYONE (their share)
            // Even if I paid, I have an expense of my share.
            await new Transaction({
                userId: memberId,
                amount: splitAmount,
                type: 'expense',
                category: 'Group Expense',
                description: `${description} (Group: ${group.name})`,
                date: expenseDate,
                status: 'confirmed'
            }).save();

            // B. Handle Settlement (Lend/Borrow)
            // Only if Payer is DIFFERENT from Member
            // AND Payer is ALSO a Registered User (otherwise we can't create Lend tx for payer)

            if (payerId && memberId !== payerId) {
                // We used to create Lend/Borrow transactions here.
                // REMOVED because:
                // 1. It causes double-counting in the Settlements tab (since Settlements already processes GroupExpenses).
                // 2. It creates sync issues when one is deleted/settled and the other isn't.
                // 3. User reported "ghost" records and "emerging records" due to this redundancy.
                // Group debts are now managed solely through GroupExpense and Settlement models.
            }
        }

        res.json(groupExpense);

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
};
