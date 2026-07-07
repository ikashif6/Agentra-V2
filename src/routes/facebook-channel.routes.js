const express = require('express');
const { body } = require('express-validator');

const facebookController = require('../controllers/facebook.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

router.get('/oauth/callback', facebookController.oauthCallback);

router.get(
  '/',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  facebookController.getStatus,
);

router.get(
  '/oauth/url',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  facebookController.getOAuthUrl,
);

router.post(
  '/connect',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  body('pageId').trim().notEmpty().withMessage('pageId is required'),
  validate,
  facebookController.connectPage,
);

router.delete(
  '/',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  facebookController.disconnect,
);

module.exports = router;
