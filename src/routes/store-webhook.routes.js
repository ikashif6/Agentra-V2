const express = require('express');

const storeWebhookController = require('../controllers/store-webhook.controller');

const router = express.Router();

// Provider → Agentra order webhooks. No auth: verified via HMAC signatures.
router.post('/shopify/:companyId', storeWebhookController.shopifyWebhook);
router.post('/woocommerce/:companyId', storeWebhookController.wooWebhook);
router.post('/custom/:companyId', storeWebhookController.customWebhook);

module.exports = router;
