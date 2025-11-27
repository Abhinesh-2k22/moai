const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const auth = require('../middleware/auth');

router.get('/', auth, categoryController.getCategories);
router.post('/', auth, categoryController.addCategory);
router.delete('/:id', auth, categoryController.deleteCategory);

module.exports = router;
