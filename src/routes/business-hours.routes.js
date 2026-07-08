const express = require('express');
const { body } = require('express-validator');

const businessHoursController = require('../controllers/business-hours.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

const defaultRules = [
  body('enabled').optional().isBoolean(),
  body('timezone').optional().isString().trim().notEmpty(),
  body('schedule').optional().isObject(),
];

const customRules = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('targets').optional().isArray(),
  body('timezone').trim().notEmpty().withMessage('timezone is required'),
  body('schedule').isObject().withMessage('schedule is required'),
];

const customUpdateRules = [
  body('name').optional().trim().notEmpty(),
  body('targets').optional().isArray(),
  body('timezone').optional().trim().notEmpty(),
  body('schedule').optional().isObject(),
];

router.get(
  '/',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  businessHoursController.getHours,
);

router.put(
  '/default',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  defaultRules,
  validate,
  businessHoursController.updateDefault,
);

router.post(
  '/custom',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  customRules,
  validate,
  businessHoursController.createCustom,
);

router.patch(
  '/custom/:id',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  customUpdateRules,
  validate,
  businessHoursController.updateCustom,
);

router.delete(
  '/custom/:id',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  businessHoursController.deleteCustom,
);

module.exports = router;
