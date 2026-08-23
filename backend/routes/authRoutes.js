const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/users', auth, authController.getUsers); // Protected route example
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.put('/set-security-question', auth, authController.setSecurityQuestion); // Protected
router.put('/change-password', auth, authController.changePassword); // Protected

module.exports = router;
