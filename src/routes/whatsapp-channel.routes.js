const express = require('express');
const { body } = require('express-validator');

const whatsappController = require('../controllers/whatsapp.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

router.get('/', resolveTenant, protect, authorize('owner', 'admin'), whatsappController.getStatus);

router.get(
  '/config',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  whatsappController.getConfig,
);

router.post(
  '/connect',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  body('code').trim().notEmpty().withMessage('code is required'),
  body('wabaId').trim().notEmpty().withMessage('wabaId is required'),
  body('phoneNumberId').trim().notEmpty().withMessage('phoneNumberId is required'),
  validate,
  whatsappController.connect,
);

router.post(
  '/connect-manual',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  body('accessToken').trim().notEmpty().withMessage('accessToken is required'),
  body('wabaId').trim().notEmpty().withMessage('wabaId is required'),
  body('phoneNumberId').trim().notEmpty().withMessage('phoneNumberId is required'),
  validate,
  whatsappController.connectManual,
);

router.delete(
  '/',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  whatsappController.disconnect,
);

module.exports = router;
