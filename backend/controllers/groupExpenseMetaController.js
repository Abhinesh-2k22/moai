const GroupExpenseUserMeta = require('../models/GroupExpenseUserMeta');
const GroupExpense = require('../models/GroupExpense');
const Group = require('../models/Group');
const PaymentMethod = require('../models/PaymentMethod');

exports.upsertMeta = async (req, res) => {
    const groupExpenseId = req.params.expenseId;
    const { category, paymentMethodId, paymentMethodName } = req.body;

    try {
        const expense = await GroupExpense.findById(groupExpenseId);
        if (!expense) return res.status(404).json({ msg: 'Expense not found' });

        const group = await Group.findById(expense.groupId);
        if (!group || !group.members.some(m => m.userId && m.userId.toString() === req.user.id)) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        let resolvedPaymentName = paymentMethodName || 'Unspecified';
        if (paymentMethodId) {
            const pm = await PaymentMethod.findById(paymentMethodId);
            if (pm && pm.userId.toString() === req.user.id) {
                resolvedPaymentName = pm.name;
            }
        }

        const meta = await GroupExpenseUserMeta.findOneAndUpdate(
            { userId: req.user.id, groupExpenseId },
            {
                category: category || undefined,
                paymentMethodId: paymentMethodId || undefined,
                paymentMethodName: resolvedPaymentName,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );

        res.json(meta);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.getMyMetaForGroup = async (req, res) => {
    const { groupId } = req.params;

    try {
        const group = await Group.findById(groupId);
        if (!group || !group.members.some(m => m.userId && m.userId.toString() === req.user.id)) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        const expenses = await GroupExpense.find({ groupId }).select('_id');
        const expenseIds = expenses.map(e => e._id);

        const metaList = await GroupExpenseUserMeta.find({
            userId: req.user.id,
            groupExpenseId: { $in: expenseIds }
        });

        res.json(metaList);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.deleteMetaForExpense = async (groupExpenseId) => {
    await GroupExpenseUserMeta.deleteMany({ groupExpenseId });
};
