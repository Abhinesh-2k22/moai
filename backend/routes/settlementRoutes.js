const express = require('express');
const router = express.Router();
const settlementController = require('../controllers/settlementController');
const auth = require('../middleware/auth');

router.get('/', auth, settlementController.getSettlements);
router.get('/history', auth, settlementController.getSettlementHistory);
router.post('/personal', auth, settlementController.addPersonalTransaction);
router.delete('/personal/:id', auth, settlementController.deletePersonalTransaction);
router.post('/', auth, settlementController.createSettlement);

module.exports = router;
