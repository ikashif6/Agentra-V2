const express = require('express');
const { body } = require('express-validator');

const billingController = require('../controllers/billing.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

router.use(resolveTenant);
router.use(protect);
router.use(authorize('owner'));

router.get('/', billingController.getOverview);

router.post(
  '/checkout',
  body('billingCycle').optional().isIn(['monthly', 'yearly']),
  validate,
  billingController.createCheckout,
);

router.post('/portal', billingController.createPortal);

router.post('/cancel', billingController.cancelPlan);

router.post('/reactivate', billingController.reactivatePlan);

module.exports = router;
