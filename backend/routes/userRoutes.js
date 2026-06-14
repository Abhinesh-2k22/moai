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

// @route   PUT /api/users/dummy/:id
// @desc    Update a contact
// @access  Private
router.put('/dummy/:id', auth, userController.updateDummyUser);

// @route   DELETE /api/users/dummy/:id
// @desc    Delete a contact
// @access  Private
router.delete('/dummy/:id', auth, userController.deleteDummyUser);

// @route   PUT /api/users/profile
// @desc    Update profile (name & base64 avatar)
// @access  Private
router.put('/profile', auth, userController.updateProfile);

// @route   GET /api/users/:id/avatar
// @desc    Get user's avatar image (public)
// @access  Public
router.get('/:id/avatar', userController.getAvatar);

module.exports = router;
