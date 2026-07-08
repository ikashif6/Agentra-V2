const express = require('express');

const billingController = require('../controllers/billing.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(resolveTenant);
router.use(protect);
router.use(authorize('owner'));

router.get('/', billingController.getOverview);

router.post('/cancel', billingController.cancelPlan);

router.post('/reactivate', billingController.reactivatePlan);

module.exports = router;
