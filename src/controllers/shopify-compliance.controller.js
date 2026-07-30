const { verifyShopifyWebhook } = require('../services/store-oauth.service');
const {
  handleCustomersDataRequest,
  handleCustomersRedact,
  handleShopRedact,
  handleAppUninstalled,
} = require('../services/shopify-compliance.service');

function verifyOrReject(req, res) {
  if (!verifyShopifyWebhook(req.rawBody, req.get('x-shopify-hmac-sha256'))) {
    res.sendStatus(401);
    return false;
  }
  return true;
}

function shopDomainFrom(req) {
  return req.get('x-shopify-shop-domain') || req.body?.shop_domain || '';
}

/**
 * Mandatory App Store compliance webhooks + app/uninstalled.
 * Always acknowledge quickly after HMAC verification.
 */

exports.customersDataRequest = async (req, res) => {
  if (!verifyOrReject(req, res)) return;
  res.sendStatus(200);
  try {
    await handleCustomersDataRequest(req.body || {}, shopDomainFrom(req));
  } catch (err) {
    console.error('[shopify customers/data_request]', err.message);
  }
};

exports.customersRedact = async (req, res) => {
  if (!verifyOrReject(req, res)) return;
  res.sendStatus(200);
  try {
    await handleCustomersRedact(req.body || {}, shopDomainFrom(req));
  } catch (err) {
    console.error('[shopify customers/redact]', err.message);
  }
};

exports.shopRedact = async (req, res) => {
  if (!verifyOrReject(req, res)) return;
  res.sendStatus(200);
  try {
    await handleShopRedact(req.body || {}, shopDomainFrom(req));
  } catch (err) {
    console.error('[shopify shop/redact]', err.message);
  }
};

exports.appUninstalled = async (req, res) => {
  if (!verifyOrReject(req, res)) return;
  res.sendStatus(200);
  try {
    await handleAppUninstalled(req.body || {}, shopDomainFrom(req));
  } catch (err) {
    console.error('[shopify app/uninstalled]', err.message);
  }
};
