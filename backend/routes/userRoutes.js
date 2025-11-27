const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const userController = require('../controllers/userController');

// @route   GET /api/users
// @desc    Get all real users (for recipient selection)
// @access  Private
router.get('/', auth, userController.getUsers);

// @route   GET /api/users/search
// @desc    Search users by username or email
// @access  Private
router.get('/search', auth, userController.searchUsers);

// @route   GET /api/users/dummy
// @desc    Get all dummy users created by logged-in user
// @access  Private
router.get('/dummy', auth, userController.getDummyUsers);

// @route   POST /api/users/dummy
// @desc    Create a new dummy user
// @access  Private
router.post('/dummy', auth, userController.createDummyUser);

module.exports = router;
