const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth'); // Will create this next

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/users', auth, authController.getUsers); // Protected route example

module.exports = router;
