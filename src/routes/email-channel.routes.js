const express = require('express');
const { body } = require('express-validator');

const emailController = require('../controllers/email.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

router.get('/', resolveTenant, protect, authorize('owner', 'admin'), emailController.getStatus);

router.get(
  '/guess',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  emailController.guessSettings,
);

router.post(
  '/connect',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  body('email').trim().isEmail().withMessage('A valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
  emailController.connect,
);

router.delete('/', resolveTenant, protect, authorize('owner', 'admin'), emailController.disconnect);

module.exports = router;
