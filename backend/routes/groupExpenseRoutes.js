const express = require('express');
const router = express.Router({ mergeParams: true });
const groupExpenseController = require('../controllers/groupExpenseController');
const groupExpenseMetaController = require('../controllers/groupExpenseMetaController');
const auth = require('../middleware/auth');

router.post('/', auth, groupExpenseController.addExpense);
router.get('/', auth, groupExpenseController.getExpenses);
router.get('/balances', auth, groupExpenseController.getBalances);
router.get('/meta', auth, groupExpenseMetaController.getMyMetaForGroup);
router.put('/:expenseId/meta', auth, groupExpenseMetaController.upsertMeta);
router.put('/:expenseId', auth, groupExpenseController.updateExpense);
router.delete('/:expenseId', auth, groupExpenseController.deleteExpense);

module.exports = router;
