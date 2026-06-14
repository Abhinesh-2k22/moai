const Group = require('../models/Group');
const User = require('../models/User');
const DummyUser = require('../models/DummyUser');
const GroupExpense = require('../models/GroupExpense');
const Settlement = require('../models/Settlement');

const isGroupSettled = async (groupId) => {
    const expenses = await GroupExpense.find({ groupId });
    const settlements = await Settlement.find({ groupId, confirmed: true });

    let balances = {};
    const group = await Group.findById(groupId);
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

    settlements.forEach(set => {
        const fromKey = getCanonicalKey(set.fromUserId, set.fromGuestName);
        const toKey = getCanonicalKey(set.toUserId, set.toGuestName);

        if (!balances[fromKey]) balances[fromKey] = 0;
        if (!balances[toKey]) balances[toKey] = 0;

        balances[fromKey] += set.amount;
        balances[toKey] -= set.amount;
    });

    for (const amount of Object.values(balances)) {
        if (Math.abs(amount) > 0.01) return false;
    }
    return true;
};

exports.createGroup = async (req, res) => {
    const { name } = req.body;

    try {
        const newGroup = new Group({
            name,
            createdBy: req.user.id,
            members: [{ userId: req.user.id }]
        });

        const group = await newGroup.save();
        res.json(group);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.getGroups = async (req, res) => {
    try {
        const groups = await Group.find({ 'members.userId': req.user.id })
            .populate('members.userId', 'name email profilePic')
            .populate('members.dummyUserId', 'name description')
            .populate('members.addedBy', 'name')
            .sort({ createdAt: -1 });
        res.json(groups);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.addMember = async (req, res) => {
    const { email, guestName, dummyUserId } = req.body;
    const groupId = req.params.id;

    try {
        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ msg: 'Group not found' });
        }

        if (group.status === 'closed') {
            return res.status(400).json({ msg: 'Group is frozen. Resume the group to add members.' });
        }

        if (group.createdBy.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Only the group owner can add members' });
        }

        const expenseCount = await GroupExpense.countDocuments({ groupId });

        if (expenseCount > 0) {
            const settled = await isGroupSettled(groupId);
            if (!settled) {
                return res.status(400).json({ msg: 'Cannot add members because the group has unsettled balances. Please settle all debts first.' });
            }
        }

        if (dummyUserId) {
            const contact = await DummyUser.findById(dummyUserId);
            if (!contact || contact.createdBy.toString() !== req.user.id) {
                return res.status(404).json({ msg: 'Contact not found' });
            }

            const alreadyMember = group.members.some(m =>
                m.dummyUserId && m.dummyUserId.toString() === dummyUserId
            );
            if (alreadyMember) {
                return res.status(400).json({ msg: 'Contact already in group' });
            }

            group.members.push({
                guestName: contact.name,
                dummyUserId: contact._id,
                addedBy: req.user.id
            });
        } else {
            if (email) {
                const userToAdd = await User.findOne({ email });
                if (!userToAdd) {
                    return res.status(404).json({ msg: 'User not found' });
                }

                if (group.members.some(member => member.userId && member.userId.toString() === userToAdd.id)) {
                    return res.status(400).json({ msg: 'User already in group' });
                }

                group.members.push({ userId: userToAdd.id });
            } else if (guestName) {
                const lowerName = guestName.toLowerCase();
                if (group.members.some(m => m.guestName && m.guestName.toLowerCase() === lowerName && !m.dummyUserId)) {
                    return res.status(400).json({ msg: 'Guest already in group' });
                }
                group.members.push({ guestName, addedBy: req.user.id });
            } else {
                return res.status(400).json({ msg: 'Please provide email, guestName, or dummyUserId' });
            }
        }

        await group.save();

        const updatedGroup = await Group.findById(groupId)
            .populate('members.userId', 'name email profilePic')
            .populate('members.dummyUserId', 'name description')
            .populate('members.addedBy', 'name');
        res.json(updatedGroup);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.getGroup = async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
            .populate('members.userId', 'name email profilePic')
            .populate('members.dummyUserId', 'name description')
            .populate('members.addedBy', 'name');

        if (!group) {
            return res.status(404).json({ msg: 'Group not found' });
        }

        if (!group.members.some(member => member.userId && member.userId._id.toString() === req.user.id)) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        res.json(group);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.updateGroupStatus = async (req, res) => {
    const { status } = req.body;
    const groupId = req.params.id;

    if (!['open', 'closed'].includes(status)) {
        return res.status(400).json({ msg: 'Status must be open or closed' });
    }

    try {
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ msg: 'Group not found' });
        }

        if (group.createdBy.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Only the group owner can change group status' });
        }

        group.status = status;
        await group.save();
        res.json(group);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
