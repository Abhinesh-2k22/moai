const Category = require('../models/Category');

// Get all categories for user (including defaults)
exports.getCategories = async (req, res) => {
    try {
        const categories = await Category.find({
            $or: [
                { userId: req.user.id },
                { userId: null } // Default categories
            ]
        });
        res.json(categories);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Add new category
exports.addCategory = async (req, res) => {
    const { name, type } = req.body;

    try {
        const newCategory = new Category({
            userId: req.user.id,
            name,
            type
        });

        const category = await newCategory.save();
        res.json(category);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Delete category
exports.deleteCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).json({ msg: 'Category not found' });
        }

        // Ensure user owns category
        if (!category.userId || category.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized or cannot delete default category' });
        }

        await category.deleteOne();
        res.json({ msg: 'Category removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
