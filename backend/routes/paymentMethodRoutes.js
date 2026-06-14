const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const paymentMethodController = require('../controllers/paymentMethodController');

router.get('/', auth, paymentMethodController.getPaymentMethods);
router.get('/ensure-defaults', auth, paymentMethodController.ensureDefault);
router.post('/', auth, paymentMethodController.addPaymentMethod);
router.put('/:id', auth, paymentMethodController.updatePaymentMethod);
router.delete('/:id', auth, paymentMethodController.deletePaymentMethod);

module.exports = router;
