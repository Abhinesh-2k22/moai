const DummyUser = require('../models/DummyUser');
const User = require('../models/User');

// Get all users (for recipient selection)
exports.getUsers = async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user.id } })
            .select('name email')
            .sort({ name: 1 });

        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get dummy users created by logged-in user
exports.getDummyUsers = async (req, res) => {
    try {
        const dummyUsers = await DummyUser.find({ createdBy: req.user.id })
            .sort({ name: 1 });

        res.json(dummyUsers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Create a new dummy user
exports.createDummyUser = async (req, res) => {
    const { name } = req.body;

    try {
        const newDummyUser = new DummyUser({
            name,
            createdBy: req.user.id
        });
        const dummyUser = await newDummyUser.save();
        res.json(dummyUser);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Search Users (by username or email)
exports.searchUsers = async (req, res) => {
    const { query } = req.query;
    if (!query) return res.json([]);

    try {
        const users = await User.find({
            $and: [
                { _id: { $ne: req.user.id } }, // Exclude self
                {
                    $or: [
                        { username: { $regex: query, $options: 'i' } },
                        { email: { $regex: query, $options: 'i' } }
                    ]
                }
            ]
        })
            .select('name username email')
            .limit(10);

        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};
