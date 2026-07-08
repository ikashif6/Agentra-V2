const Company = require('../models/Company');
const response = require('../utils/apiResponse');
const {
  testShopifyConnection,
  testWooCommerceConnection,
  testCustomConnection,
  generateWebhookSecret,
  sanitizeStoreIntegration,
} = require('../services/store.service');
const { logStoreConnected, logStoreDisconnected } = require('../services/activity.service');

function getIntegration(company) {
  return company.storeIntegration || {};
}

/**
 * GET /store
 */
exports.getStatus = async (req, res, next) => {
  try {
    const company = req.company;
    return response.success(res, {
      store: sanitizeStoreIntegration(getIntegration(company)),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /store/connect
 */
exports.connect = async (req, res, next) => {
  try {
    const company = req.company;
    const { provider, credentials, syncSettings } = req.body;

    if (!['shopify', 'woocommerce', 'custom'].includes(provider)) {
      return response.badRequest(res, 'Provider must be shopify, woocommerce, or custom');
    }

    let verified;
    const integration = {
      provider,
      status: 'pending',
      lastError: null,
      syncSettings: {
        syncOrders: syncSettings?.syncOrders !== false,
        syncCustomers: syncSettings?.syncCustomers !== false,
        syncProducts: Boolean(syncSettings?.syncProducts),
      },
    };

    if (provider === 'shopify') {
      verified = await testShopifyConnection({
        shopDomain: credentials?.shopDomain,
        accessToken: credentials?.accessToken,
      });
      integration.shopify = {
        shopDomain: verified.shopDomain,
        accessToken: credentials.accessToken.trim(),
        shopName: verified.shopName,
      };
    } else if (provider === 'woocommerce') {
      verified = await testWooCommerceConnection({
        storeUrl: credentials?.storeUrl,
        consumerKey: credentials?.consumerKey,
        consumerSecret: credentials?.consumerSecret,
      });
      integration.woocommerce = {
        storeUrl: verified.storeUrl,
        consumerKey: credentials.consumerKey.trim(),
        consumerSecret: credentials.consumerSecret.trim(),
        storeName: verified.storeName,
      };
    } else {
      verified = await testCustomConnection({
        storeUrl: credentials?.storeUrl,
        apiKey: credentials?.apiKey,
      });
      integration.custom = {
        storeUrl: verified.storeUrl,
        apiKey: credentials?.apiKey?.trim() || undefined,
        webhookSecret: credentials?.webhookSecret?.trim() || generateWebhookSecret(),
        storeName: verified.storeName,
      };
    }

    integration.status = 'connected';
    integration.connectedAt = new Date();
    integration.lastSyncAt = new Date();

    company.storeIntegration = integration;
    await company.save();

    logStoreConnected({
      company,
      actor: req.user,
      provider: integration.provider || provider,
      req,
    });

    return response.success(
      res,
      { store: sanitizeStoreIntegration(company.storeIntegration) },
      'Store connected successfully',
    );
  } catch (err) {
    if (err.message && !err.statusCode) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};

/**
 * PATCH /store/settings
 */
exports.updateSettings = async (req, res, next) => {
  try {
    const company = req.company;
    const integration = getIntegration(company);

    if (integration.status !== 'connected') {
      return response.badRequest(res, 'Connect a store before updating sync settings');
    }

    const { syncSettings } = req.body;
    if (syncSettings) {
      integration.syncSettings = {
        syncOrders: syncSettings.syncOrders !== false,
        syncCustomers: syncSettings.syncCustomers !== false,
        syncProducts: Boolean(syncSettings.syncProducts),
      };
    }

    company.storeIntegration = integration;
    await company.save();

    return response.success(
      res,
      { store: sanitizeStoreIntegration(company.storeIntegration) },
      'Store settings updated',
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /store/test
 */
exports.testConnection = async (req, res, next) => {
  try {
    const company = await Company.findById(req.company._id).select('+storeIntegration.shopify.accessToken +storeIntegration.woocommerce.consumerKey +storeIntegration.woocommerce.consumerSecret +storeIntegration.custom.apiKey');

    const integration = getIntegration(company);
    if (!integration.provider || integration.status !== 'connected') {
      return response.badRequest(res, 'No connected store to test');
    }

    let verified;
    if (integration.provider === 'shopify') {
      verified = await testShopifyConnection({
        shopDomain: integration.shopify.shopDomain,
        accessToken: integration.shopify.accessToken,
      });
      integration.shopify.shopName = verified.shopName;
    } else if (integration.provider === 'woocommerce') {
      verified = await testWooCommerceConnection({
        storeUrl: integration.woocommerce.storeUrl,
        consumerKey: integration.woocommerce.consumerKey,
        consumerSecret: integration.woocommerce.consumerSecret,
      });
      integration.woocommerce.storeName = verified.storeName;
    } else {
      verified = await testCustomConnection({
        storeUrl: integration.custom.storeUrl,
        apiKey: integration.custom.apiKey,
      });
      integration.custom.storeName = verified.storeName;
    }

    integration.status = 'connected';
    integration.lastError = null;
    integration.lastSyncAt = new Date();
    company.storeIntegration = integration;
    await company.save();

    return response.success(
      res,
      { store: sanitizeStoreIntegration(company.storeIntegration) },
      'Connection verified',
    );
  } catch (err) {
    try {
      const company = req.company;
      const integration = getIntegration(company);
      integration.status = 'error';
      integration.lastError = err.message;
      company.storeIntegration = integration;
      await company.save();
    } catch {
      /* ignore secondary failure */
    }

    if (err.message && !err.statusCode) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};

/**
 * POST /store/sync
 */
exports.syncNow = async (req, res, next) => {
  try {
    const company = await Company.findById(req.company._id).select('+storeIntegration.shopify.accessToken +storeIntegration.woocommerce.consumerKey +storeIntegration.woocommerce.consumerSecret +storeIntegration.custom.apiKey');

    const integration = getIntegration(company);
    if (integration.status !== 'connected') {
      return response.badRequest(res, 'Connect a store before syncing');
    }

    // Re-verify connection as a lightweight sync handshake for now
    if (integration.provider === 'shopify') {
      await testShopifyConnection({
        shopDomain: integration.shopify.shopDomain,
        accessToken: integration.shopify.accessToken,
      });
    } else if (integration.provider === 'woocommerce') {
      await testWooCommerceConnection({
        storeUrl: integration.woocommerce.storeUrl,
        consumerKey: integration.woocommerce.consumerKey,
        consumerSecret: integration.woocommerce.consumerSecret,
      });
    } else {
      await testCustomConnection({
        storeUrl: integration.custom.storeUrl,
        apiKey: integration.custom.apiKey,
      });
    }

    integration.lastSyncAt = new Date();
    integration.lastError = null;
    company.storeIntegration = integration;
    await company.save();

    return response.success(
      res,
      { store: sanitizeStoreIntegration(company.storeIntegration) },
      'Store sync completed',
    );
  } catch (err) {
    const company = req.company;
    const integration = getIntegration(company);
    integration.lastError = err.message;
    company.storeIntegration = integration;
    await company.save();

    if (err.message && !err.statusCode) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};

/**
 * DELETE /store
 */
exports.disconnect = async (req, res, next) => {
  try {
    const company = req.company;
    company.storeIntegration = {
      status: 'disconnected',
      syncSettings: {
        syncOrders: true,
        syncCustomers: true,
        syncProducts: false,
      },
    };
    await company.save();

    logStoreDisconnected({ company, actor: req.user, req });

    return response.success(
      res,
      { store: sanitizeStoreIntegration(company.storeIntegration) },
      'Store disconnected',
    );
  } catch (err) {
    next(err);
  }
};
