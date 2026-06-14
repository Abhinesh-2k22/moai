const express = require('express');
const router = express.Router();
const settlementController = require('../controllers/settlementController');
const auth = require('../middleware/auth');

router.get('/', auth, settlementController.getSettlements);
router.get('/contacts', auth, settlementController.getDummyBalances);
router.get('/history', auth, settlementController.getSettlementHistory);
router.post('/settle-all', auth, settlementController.settleAll);
router.post('/settle-contact', auth, settlementController.settleContact);
// router.post('/personal', auth, settlementController.addPersonalTransaction);
// router.delete('/personal/:id', auth, settlementController.deletePersonalTransaction);
router.post('/', auth, settlementController.createSettlement);

module.exports = router;
