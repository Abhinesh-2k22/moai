const PaymentMethod = require('../models/PaymentMethod');

exports.getPaymentMethods = async (req, res) => {
    try {
        const methods = await PaymentMethod.find({ userId: req.user.id }).sort({ name: 1 });
        res.json(methods);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.addPaymentMethod = async (req, res) => {
    const { name, type } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ msg: 'Name is required' });
    }

    try {
        const method = new PaymentMethod({
            userId: req.user.id,
            name: name.trim(),
            type: type || 'other'
        });
        await method.save();
        res.json(method);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.updatePaymentMethod = async (req, res) => {
    const { name, type } = req.body;

    try {
        const method = await PaymentMethod.findById(req.params.id);
        if (!method) return res.status(404).json({ msg: 'Payment method not found' });
        if (method.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        if (name) method.name = name.trim();
        if (type) method.type = type;
        await method.save();
        res.json(method);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.deletePaymentMethod = async (req, res) => {
    try {
        const method = await PaymentMethod.findById(req.params.id);
        if (!method) return res.status(404).json({ msg: 'Payment method not found' });
        if (method.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        await method.deleteOne();
        res.json({ msg: 'Payment method removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.ensureDefault = async (req, res) => {
    try {
        const count = await PaymentMethod.countDocuments({ userId: req.user.id });
        if (count === 0) {
            const defaults = [
                { name: 'Unspecified', type: 'other' },
                { name: 'Cash', type: 'cash' }
            ];
            await PaymentMethod.insertMany(defaults.map(d => ({ ...d, userId: req.user.id })));
        }
        const methods = await PaymentMethod.find({ userId: req.user.id }).sort({ name: 1 });
        res.json(methods);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
