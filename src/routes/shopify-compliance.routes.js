const express = require('express');
const shopifyComplianceController = require('../controllers/shopify-compliance.controller');

const router = express.Router();

// Mandatory Shopify App Store compliance webhooks (fixed URLs, not company-scoped).
router.post('/customers-data-request', shopifyComplianceController.customersDataRequest);
router.post('/customers-redact', shopifyComplianceController.customersRedact);
router.post('/shop-redact', shopifyComplianceController.shopRedact);
router.post('/app-uninstalled', shopifyComplianceController.appUninstalled);

module.exports = router;
