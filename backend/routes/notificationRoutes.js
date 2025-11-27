const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

// @route   GET /api/notifications
// @desc    Get all notifications for logged-in user
// @access  Private
router.get('/', auth, notificationController.getNotifications);

// @route   POST /api/notifications
// @desc    Create a new notification
// @access  Private
router.post('/', auth, notificationController.createNotification);


// @route   POST /api/notifications/:id/confirm
// @desc    Confirm a lend/borrow transaction
// @access  Private
router.post('/:id/confirm', auth, notificationController.confirmTransaction);

// @route   POST /api/notifications/:id/reject
// @desc    Reject a lend/borrow transaction
// @access  Private
router.post('/:id/reject', auth, notificationController.rejectTransaction);

module.exports = router;
