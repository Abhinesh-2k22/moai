const express = require('express');
const router = express.Router({ mergeParams: true }); // Important for accessing :groupId
const groupExpenseController = require('../controllers/groupExpenseController');
const auth = require('../middleware/auth');

router.post('/', auth, groupExpenseController.addExpense);
router.get('/', auth, groupExpenseController.getExpenses);
router.get('/balances', auth, groupExpenseController.getBalances);

module.exports = router;
