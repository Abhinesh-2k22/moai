const DummyUser = require('../models/DummyUser');
const User = require('../models/User');

exports.getUsers = async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user.id } })
            .select('name email profilePic')
            .sort({ name: 1 });

        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getDummyUsers = async (req, res) => {
    try {
        const dummyUsers = await DummyUser.find({
            createdBy: req.user.id,
            isDeleted: { $ne: true }
        }).sort({ name: 1 });

        res.json(dummyUsers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.createDummyUser = async (req, res) => {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Name is required' });
    }

    try {
        const existing = await DummyUser.findOne({
            createdBy: req.user.id,
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
        });
        if (existing) {
            return res.status(400).json({ message: 'Contact with this name already exists' });
        }

        const newDummyUser = new DummyUser({
            name: name.trim(),
            description: description || '',
            createdBy: req.user.id
        });
        const dummyUser = await newDummyUser.save();
        res.json(dummyUser);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateDummyUser = async (req, res) => {
    const { name, description } = req.body;

    try {
        const dummyUser = await DummyUser.findById(req.params.id);
        if (!dummyUser) {
            return res.status(404).json({ message: 'Contact not found' });
        }
        if (dummyUser.createdBy.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        if (name) dummyUser.name = name.trim();
        if (description !== undefined) dummyUser.description = description;
        await dummyUser.save();
        res.json(dummyUser);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteDummyUser = async (req, res) => {
    try {
        const dummyUser = await DummyUser.findById(req.params.id);
        if (!dummyUser) {
            return res.status(404).json({ message: 'Contact not found' });
        }
        if (dummyUser.createdBy.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        dummyUser.isDeleted = true;
        await dummyUser.save();
        res.json({ message: 'Contact removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.searchUsers = async (req, res) => {
    const { query } = req.query;
    if (!query) return res.json([]);

    try {
        const users = await User.find({
            $and: [
                { _id: { $ne: req.user.id } },
                {
                    $or: [
                        { username: { $regex: query, $options: 'i' } },
                        { email: { $regex: query, $options: 'i' } }
                    ]
                }
            ]
        })
            .select('name username email profilePic')
            .limit(10);

        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateProfile = async (req, res) => {
    const { name, profilePic } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (name) user.name = name.trim();

        if (profilePic) {
            const matches = profilePic.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return res.status(400).json({ message: 'Invalid image format' });
            }

            const contentType = matches[1];
            const data = Buffer.from(matches[2], 'base64');

            user.profilePic = { data, contentType };
        }

        await user.save();

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                profilePic: user.profilePic ? { contentType: user.profilePic.contentType } : undefined
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getAvatar = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('+profilePic.data');
        if (user && user.profilePic && user.profilePic.data) {
            res.set('Content-Type', user.profilePic.contentType);
            return res.send(user.profilePic.data);
        }
        res.status(404).json({ message: 'Avatar not found' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};
