const express = require('express');
const { body } = require('express-validator');

const storeController = require('../controllers/store.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

const connectRules = [
  body('provider')
    .isIn(['shopify', 'woocommerce', 'custom'])
    .withMessage('provider must be shopify, woocommerce, or custom'),
  body('credentials').isObject().withMessage('credentials object is required'),
];

const settingsRules = [
  body('syncSettings.syncOrders').optional().isBoolean(),
  body('syncSettings.syncCustomers').optional().isBoolean(),
  body('syncSettings.syncProducts').optional().isBoolean(),
];

// ── OAuth: Shopify (install redirect + callback) ─────────────────────────────
router.get(
  '/shopify/oauth/url',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  storeController.shopifyOAuthUrl,
);
router.get('/shopify/oauth/callback', storeController.shopifyOAuthCallback);

// ── OAuth: WooCommerce (wc-auth authorize + key callback) ────────────────────
router.get(
  '/woocommerce/oauth/url',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  storeController.wooOAuthUrl,
);
router.post('/woocommerce/oauth/callback', storeController.wooOAuthCallback);

router.get(
  '/',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  storeController.getStatus,
);

// Orders lookup for the inbox — available to any authenticated member.
router.get('/orders', resolveTenant, protect, storeController.listOrders);

router.post(
  '/orders/:orderId/cancel',
  resolveTenant,
  protect,
  storeController.cancelOrder,
);

router.post(
  '/orders/:orderId/fulfill',
  resolveTenant,
  protect,
  storeController.fulfillOrder,
);

router.post(
  '/connect',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  connectRules,
  validate,
  storeController.connect,
);

router.patch(
  '/settings',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  settingsRules,
  validate,
  storeController.updateSettings,
);

router.post(
  '/test',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  storeController.testConnection,
);

router.post(
  '/sync',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  storeController.syncNow,
);

router.delete(
  '/',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  storeController.disconnect,
);

module.exports = router;
