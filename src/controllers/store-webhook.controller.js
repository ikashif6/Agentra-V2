const Company = require('../models/Company');
const {
  getStoreSecrets,
  normalizeShopifyOrder,
  normalizeWooOrder,
  normalizeCustomOrder,
} = require('../services/store.service');
const { verifyShopifyWebhook, verifyHmacSignature } = require('../services/store-oauth.service');
const { upsertOrder } = require('../services/store-sync.service');

const SECRET_SELECT =
  '+storeIntegration.woocommerce.webhookSecret +storeIntegration.custom.webhookSecret';

/**
 * POST /webhooks/store/shopify/:companyId
 */
exports.shopifyWebhook = async (req, res) => {
  // Shopify HMAC uses the app secret over the raw body.
  if (!verifyShopifyWebhook(req.rawBody, req.get('x-shopify-hmac-sha256'))) {
    return res.sendStatus(401);
  }
  res.sendStatus(200); // acknowledge fast

  try {
    const company = await Company.findById(req.params.companyId);
    const integration = company?.storeIntegration;
    if (!integration || integration.provider !== 'shopify') return;

    const shopDomain = integration.shopify?.shopDomain;
    // Guard: ensure the event is from the shop we connected.
    if (shopDomain && req.get('x-shopify-shop-domain') && req.get('x-shopify-shop-domain') !== shopDomain) {
      return;
    }

    const normalized = normalizeShopifyOrder(req.body, shopDomain);
    await upsertOrder(company._id, normalized);
  } catch (err) {
    console.error('[shopify webhook]', err.message);
  }
};

/**
 * POST /webhooks/store/woocommerce/:companyId
 */
exports.wooWebhook = async (req, res) => {
  // WooCommerce sends a plain-text ping when a webhook is first created.
  const signature = req.get('x-wc-webhook-signature');

  try {
    const company = await Company.findById(req.params.companyId).select(SECRET_SELECT);
    const integration = company?.storeIntegration;
    if (!integration || integration.provider !== 'woocommerce') {
      return res.sendStatus(200);
    }

    const secrets = getStoreSecrets(integration);
    const secret = secrets.woocommerce.webhookSecret;

    // Verify only when we have both a signature and body (skip the setup ping).
    if (signature && req.rawBody) {
      if (!verifyHmacSignature(req.rawBody, signature, secret)) {
        return res.sendStatus(401);
      }
    }

    res.sendStatus(200);

    const order = req.body;
    if (order && order.id) {
      const normalized = normalizeWooOrder(order, integration.woocommerce?.storeUrl);
      await upsertOrder(company._id, normalized);
    }
  } catch (err) {
    console.error('[woo webhook]', err.message);
    if (!res.headersSent) res.sendStatus(200);
  }
};

/**
 * POST /webhooks/store/custom/:companyId
 */
exports.customWebhook = async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId).select(SECRET_SELECT);
    const integration = company?.storeIntegration;
    if (!integration || integration.provider !== 'custom') {
      return res.sendStatus(404);
    }

    const secrets = getStoreSecrets(integration);
    const secret = secrets.custom.webhookSecret;
    const signature = req.get('x-agentra-signature');

    if (!verifyHmacSignature(req.rawBody, signature, secret)) {
      return res.sendStatus(401);
    }

    res.sendStatus(200);

    const order = req.body?.order || req.body;
    if (order) {
      const normalized = normalizeCustomOrder(order);
      if (normalized.externalId) await upsertOrder(company._id, normalized);
    }
  } catch (err) {
    console.error('[custom webhook]', err.message);
    if (!res.headersSent) res.sendStatus(500);
  }
};
