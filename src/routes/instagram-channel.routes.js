const express = require('express');
const { body } = require('express-validator');

const instagramController = require('../controllers/instagram.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

router.get('/oauth/callback', instagramController.oauthCallback);

router.get(
  '/',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  instagramController.getStatus,
);

router.get(
  '/oauth/url',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  instagramController.getOAuthUrl,
);

router.post(
  '/connect',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  body('igUserId').trim().notEmpty().withMessage('igUserId is required'),
  validate,
  instagramController.connectAccount,
);

router.delete(
  '/',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  instagramController.disconnect,
);

module.exports = router;
