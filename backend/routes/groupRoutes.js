const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const auth = require('../middleware/auth');
const groupExpenseRoutes = require('./groupExpenseRoutes');

// Mount expense routes
router.use('/:groupId/expenses', groupExpenseRoutes);

router.post('/', auth, groupController.createGroup);
router.get('/', auth, groupController.getGroups);
router.get('/:id', auth, groupController.getGroup);
router.post('/:id/members', auth, groupController.addMember);
router.patch('/:id/status', auth, groupController.updateGroupStatus);

module.exports = router;
