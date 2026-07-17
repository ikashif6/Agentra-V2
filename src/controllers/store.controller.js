const Company = require('../models/Company');
const StoreOrder = require('../models/StoreOrder');
const response = require('../utils/apiResponse');
const { verifyOAuthState } = require('../utils/token');
const {
  testShopifyConnection,
  testWooCommerceConnection,
  testCustomConnection,
  generateWebhookSecret,
  sanitizeStoreIntegration,
  encryptStoreIntegration,
  getStoreSecrets,
  normalizeShopDomain,
} = require('../services/store.service');
const { fetchCustomCapabilities } = require('../services/custom-store.service');
const {
  isShopifyOAuthConfigured,
  getShopifyRedirectUri,
  buildShopifyInstallUrl,
  buildShopifyAuthorizeUrl,
  verifyShopifyOAuthHmac,
  isValidShopDomain,
  exchangeShopifyCode,
  fetchShopifyShopName,
  registerShopifyWebhooks,
  revokeShopifyAppAccess,
  usesCustomInstallFlow,
  buildWooAuthUrl,
  registerWooWebhooks,
  buildStoreSettingsRedirect,
  customWebhookAddress,
} = require('../services/store-oauth.service');
const { syncStoreOrders, findOrdersForCustomer } = require('../services/store-sync.service');
const { syncStoreProducts } = require('../services/product-sync.service');
const { cancelStoreOrder, fulfillStoreOrder, getStoreOrderDetail, runStoreOrderAction, updateStoreOrder } = require('../services/store-order-actions.service');
const { logStoreConnected, logStoreDisconnected } = require('../services/activity.service');

const SECRET_SELECT =
  '+storeIntegration.shopify.accessToken ' +
  '+storeIntegration.woocommerce.consumerKey ' +
  '+storeIntegration.woocommerce.consumerSecret ' +
  '+storeIntegration.woocommerce.webhookSecret ' +
  '+storeIntegration.custom.apiKey ' +
  '+storeIntegration.custom.webhookSecret';

function loadCompanyWithStoreSecrets(companyId) {
  return Company.findById(companyId).select(SECRET_SELECT);
}

function getIntegration(company) {
  return company.storeIntegration || {};
}

/**
 * Patch storeIntegration fields without loading select:false secrets.
 * Assigning company.storeIntegration from req.company (secrets omitted) wipes the token.
 */
function patchStoreIntegrationFields(companyId, fields) {
  const $set = {};
  for (const [key, value] of Object.entries(fields || {})) {
    $set[`storeIntegration.${key}`] = value;
  }
  if (!Object.keys($set).length) return Promise.resolve();
  return Company.updateOne({ _id: companyId }, { $set });
}

// Fire-and-forget initial sync so the connect request returns quickly.
function runBackgroundSync(companyId) {
  loadCompanyWithStoreSecrets(companyId)
    .then((company) => (company ? syncStoreOrders(company) : null))
    .then((result) => {
      if (result?.synced != null) {
        console.log(`[store sync] company=${companyId} synced=${result.synced}`);
      }
    })
    .catch((err) => console.error('[store sync]', err.message));
}

/**
 * GET /store
 */
exports.getStatus = async (req, res, next) => {
  try {
    const integration = getIntegration(req.company);
    const store = sanitizeStoreIntegration(integration);
    return response.success(res, {
      store,
      shopifyConfigured: isShopifyOAuthConfigured(),
      shopifyRedirectUri: getShopifyRedirectUri(),
      customWebhookUrl:
        integration.provider === 'custom'
          ? customWebhookAddress(req.company._id)
          : undefined,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /store/connect  (WooCommerce / custom manual credential entry)
 */
exports.connect = async (req, res, next) => {
  try {
    const company = req.company;
    const { provider, credentials, syncSettings } = req.body;

    if (!['shopify', 'woocommerce', 'custom'].includes(provider)) {
      return response.badRequest(res, 'Provider must be shopify, woocommerce, or custom');
    }

    const integration = {
      provider,
      status: 'pending',
      lastError: null,
      encrypted: false,
      webhooksRegistered: false,
      syncSettings: {
        syncOrders: syncSettings?.syncOrders !== false,
        syncCustomers: syncSettings?.syncCustomers !== false,
        syncProducts: Boolean(syncSettings?.syncProducts),
      },
    };

    if (provider === 'shopify') {
      const verified = await testShopifyConnection({
        shopDomain: credentials?.shopDomain,
        accessToken: credentials?.accessToken,
      });
      integration.shopify = {
        shopDomain: verified.shopDomain,
        accessToken: credentials.accessToken.trim(),
        shopName: verified.shopName,
      };
      integration.webhooksRegistered = await registerShopifyWebhooks({
        shopDomain: verified.shopDomain,
        accessToken: credentials.accessToken.trim(),
        companyId: company._id,
      });
    } else if (provider === 'woocommerce') {
      const verified = await testWooCommerceConnection({
        storeUrl: credentials?.storeUrl,
        consumerKey: credentials?.consumerKey,
        consumerSecret: credentials?.consumerSecret,
      });
      const webhookSecret = generateWebhookSecret();
      integration.woocommerce = {
        storeUrl: verified.storeUrl,
        consumerKey: credentials.consumerKey.trim(),
        consumerSecret: credentials.consumerSecret.trim(),
        webhookSecret,
        storeName: verified.storeName,
      };
      integration.webhooksRegistered = await registerWooWebhooks({
        storeUrl: verified.storeUrl,
        consumerKey: credentials.consumerKey.trim(),
        consumerSecret: credentials.consumerSecret.trim(),
        companyId: company._id,
        secret: webhookSecret,
      });
    } else {
      const verified = await testCustomConnection({
        storeUrl: credentials?.storeUrl,
        apiKey: credentials?.apiKey,
      });
      const capabilities = await fetchCustomCapabilities({
        storeUrl: verified.storeUrl,
        apiKey: credentials?.apiKey?.trim(),
      });
      integration.custom = {
        storeUrl: verified.storeUrl,
        apiKey: credentials?.apiKey?.trim() || undefined,
        webhookSecret: credentials?.webhookSecret?.trim() || generateWebhookSecret(),
        storeName: verified.storeName,
        supportedActions: capabilities.actions,
        features: capabilities.features,
      };
    }

    integration.status = 'connected';
    integration.connectedAt = new Date();
    integration.lastSyncAt = new Date();

    encryptStoreIntegration(integration);
    company.storeIntegration = integration;
    await company.save();

    logStoreConnected({ company, actor: req.user, provider, req });
    runBackgroundSync(company._id);

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
 * GET /store/shopify/oauth/url?shopDomain=...
 */
exports.shopifyOAuthUrl = async (req, res, next) => {
  try {
    if (!isShopifyOAuthConfigured()) {
      return response.badRequest(
        res,
        'Shopify is not configured yet. Add SHOPIFY_API_KEY and SHOPIFY_API_SECRET to the server.',
      );
    }
    const shopDomain = req.query.shopDomain;
    if (!shopDomain) {
      return response.badRequest(res, 'shopDomain is required');
    }
    const returnOrigin = req.query.returnOrigin || req.headers.origin;
    const returnPath = typeof req.query.returnPath === 'string' ? req.query.returnPath : null;
    const url = buildShopifyInstallUrl({
      shopDomain,
      companyId: req.company._id,
      subdomain: req.company.subdomain,
      userId: req.user._id,
      returnOrigin,
      returnPath,
    });

    if (usesCustomInstallFlow()) {
      const domain = normalizeShopDomain(shopDomain);
      req.company.storeIntegration = {
        provider: 'shopify',
        status: 'pending',
        lastError: null,
        encrypted: false,
        webhooksRegistered: false,
        shopify: {
          shopDomain: domain,
          pendingUserId: req.user._id,
          pendingReturnOrigin:
            typeof returnOrigin === 'string' && returnOrigin.trim() ? returnOrigin.trim() : null,
          pendingReturnPath: returnPath,
        },
        syncSettings: req.company.storeIntegration?.syncSettings || {
          syncOrders: true,
          syncCustomers: true,
          syncProducts: false,
        },
      };
      req.company.markModified('storeIntegration');
      await req.company.save();
    }

    return response.success(res, { url });
  } catch (err) {
    if (err.message && !err.statusCode) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};

/**
 * Shopify App URL entry (after custom distribution install).
 * Partner Dashboard App URL should point here (or to API root which forwards here).
 * GET /store/shopify/app?shop=...&hmac=...
 */
exports.shopifyAppEntry = async (req, res, next) => {
  try {
    const shop = req.query.shop;
    const hmac = req.query.hmac;

    if (!shop || !hmac) {
      return res
        .status(400)
        .type('html')
        .send(
          '<html><body style="font-family:system-ui;padding:40px;max-width:520px">' +
            '<h2>Agentra</h2><p>Missing Shopify install parameters.</p>' +
            '<p>Open Agentra › Settings › Store and click Connect Shopify.</p>' +
            '</body></html>',
        );
    }

    if (!isValidShopDomain(shop)) {
      return res.status(400).send('Invalid shop domain');
    }
    if (!verifyShopifyOAuthHmac(req.query)) {
      return res.status(400).send('Invalid Shopify signature');
    }
    if (!isShopifyOAuthConfigured()) {
      return res.status(500).send('Shopify is not configured on this server');
    }

    const domain = normalizeShopDomain(shop);
    let company = await Company.findOne({
      'storeIntegration.provider': 'shopify',
      'storeIntegration.status': 'pending',
      'storeIntegration.shopify.shopDomain': domain,
    }).sort({ updatedAt: -1 });

    if (!company) {
      return res
        .status(400)
        .type('html')
        .send(
          '<html><body style="font-family:system-ui;padding:40px;max-width:560px">' +
            '<h2>Almost there</h2>' +
            '<p>Shopify installed Agentra, but no pending workspace connection was found for <strong>' +
            domain +
            '</strong>.</p>' +
            '<p>Go back to Agentra › <strong>Settings › Store</strong> › Connect Shopify (same store), then try again.</p>' +
            '</body></html>',
        );
    }

    const pendingUserId =
      company.storeIntegration?.shopify?.pendingUserId || company.owner || null;
    const User = require('../models/User');
    let userId = pendingUserId;
    if (!userId) {
      const owner = await User.findOne({ company: company._id, role: 'owner' }).select('_id');
      userId = owner?._id;
    }
    if (!userId) {
      return res.status(400).send('Could not determine workspace owner for OAuth');
    }

    const authorizeUrl = buildShopifyAuthorizeUrl({
      shopDomain: domain,
      companyId: company._id,
      subdomain: company.subdomain,
      userId,
      returnOrigin: company.storeIntegration?.shopify?.pendingReturnOrigin || null,
    });

    return res.redirect(authorizeUrl);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /store/shopify/oauth/callback
 */
exports.shopifyOAuthCallback = async (req, res, next) => {
  try {
    const { code, state, shop } = req.query;

    if (!code || !shop) {
      return res.status(400).send('Missing Shopify OAuth parameters');
    }
    if (!verifyShopifyOAuthHmac(req.query)) {
      return res.status(400).send('Invalid Shopify signature');
    }
    if (!isValidShopDomain(shop)) {
      return res.status(400).send('Invalid shop domain');
    }

    let company = null;
    let subdomain;
    let returnOrigin = null;
    let returnPath = null;

    if (state) {
      let payload;
      try {
        payload = verifyOAuthState(String(state));
      } catch {
        return res.status(400).send('OAuth session expired');
      }
      if (payload.purpose !== 'shopify_oauth' || payload.shopDomain !== shop) {
        return res.status(400).send('OAuth state mismatch');
      }
      company = await Company.findById(payload.companyId);
      if (!company) return res.status(400).send('Workspace not found');
      subdomain = payload.subdomain;
      returnOrigin = payload.returnOrigin;
      returnPath = payload.returnPath || null;
    } else if (usesCustomInstallFlow()) {
      company = await Company.findOne({
        'storeIntegration.provider': 'shopify',
        'storeIntegration.status': 'pending',
        'storeIntegration.shopify.shopDomain': String(shop),
      });
      if (!company) {
        return res.status(400).send('No pending Shopify connection for this store');
      }
      subdomain = company.subdomain;
      returnOrigin = company.storeIntegration?.shopify?.pendingReturnOrigin || null;
      returnPath = company.storeIntegration?.shopify?.pendingReturnPath || null;
    } else {
      return res.status(400).send('Missing OAuth state');
    }

    try {
      const { accessToken, scope } = await exchangeShopifyCode(String(shop), String(code));
      const shopName = await fetchShopifyShopName({ shopDomain: String(shop), accessToken });
      const webhooksRegistered = await registerShopifyWebhooks({
        shopDomain: String(shop),
        accessToken,
        companyId: company._id,
      });

      const integration = {
        provider: 'shopify',
        status: 'connected',
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        lastError: null,
        encrypted: false,
        webhooksRegistered,
        shopify: { shopDomain: String(shop), accessToken, scope, shopName },
        syncSettings: company.storeIntegration?.syncSettings || {
          syncOrders: true,
          syncCustomers: true,
          syncProducts: false,
        },
      };
      encryptStoreIntegration(integration);
      company.storeIntegration = integration;
      await company.save();

      logStoreConnected({ company, provider: 'shopify', req });
      runBackgroundSync(company._id);

      return res.redirect(
        buildStoreSettingsRedirect(
          subdomain,
          { store: 'connected', name: shopName },
          returnOrigin,
          returnPath,
        ),
      );
    } catch (connectErr) {
      console.error('[shopify oauth callback]', connectErr);
      return res.redirect(
        buildStoreSettingsRedirect(
          subdomain,
          { store: 'error', message: connectErr.message || 'Could not connect Shopify' },
          returnOrigin,
          returnPath,
        ),
      );
    }
  } catch (err) {
    next(err);
  }
};

/**
 * GET /store/woocommerce/oauth/url?storeUrl=...
 */
exports.wooOAuthUrl = async (req, res, next) => {
  try {
    const storeUrl = req.query.storeUrl;
    if (!storeUrl) return response.badRequest(res, 'storeUrl is required');
    const { url } = buildWooAuthUrl({
      storeUrl,
      companyId: req.company._id,
      subdomain: req.company.subdomain,
      userId: req.user._id,
      returnOrigin: req.query.returnOrigin || req.headers.origin,
      returnPath: typeof req.query.returnPath === 'string' ? req.query.returnPath : null,
    });
    return response.success(res, { url });
  } catch (err) {
    if (err.message && !err.statusCode) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};

/**
 * POST /store/woocommerce/oauth/callback
 * WooCommerce posts the generated REST keys here (user_id carries our state).
 */
exports.wooOAuthCallback = async (req, res, next) => {
  try {
    const { user_id: userId, consumer_key: consumerKey, consumer_secret: consumerSecret } =
      req.body || {};

    if (!userId || !consumerKey || !consumerSecret) {
      return res.status(400).json({ success: false, message: 'Missing WooCommerce credentials' });
    }

    let payload;
    try {
      payload = verifyOAuthState(String(userId));
    } catch {
      return res.status(400).json({ success: false, message: 'OAuth session expired' });
    }
    if (payload.purpose !== 'woo_oauth') {
      return res.status(400).json({ success: false, message: 'OAuth state mismatch' });
    }

    const company = await Company.findById(payload.companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    const storeUrl = payload.storeUrl;
    let storeName = storeUrl.replace(/^https?:\/\//, '');
    try {
      const verified = await testWooCommerceConnection({ storeUrl, consumerKey, consumerSecret });
      storeName = verified.storeName;
    } catch {
      /* keep fallback name — keys still valid enough to store */
    }

    const webhookSecret = generateWebhookSecret();
    const webhooksRegistered = await registerWooWebhooks({
      storeUrl,
      consumerKey,
      consumerSecret,
      companyId: company._id,
      secret: webhookSecret,
    });

    const integration = {
      provider: 'woocommerce',
      status: 'connected',
      connectedAt: new Date(),
      lastSyncAt: new Date(),
      lastError: null,
      encrypted: false,
      webhooksRegistered,
      woocommerce: { storeUrl, consumerKey, consumerSecret, webhookSecret, storeName },
      syncSettings: company.storeIntegration?.syncSettings || {
        syncOrders: true,
        syncCustomers: true,
        syncProducts: false,
      },
    };
    encryptStoreIntegration(integration);
    company.storeIntegration = integration;
    await company.save();

    logStoreConnected({ company, provider: 'woocommerce', req });
    runBackgroundSync(company._id);

    // Woo only needs a 200 here; the browser is redirected via return_url.
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[woo oauth callback]', err);
    return res.status(500).json({ success: false, message: 'Could not store WooCommerce keys' });
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
    const nextSyncSettings = syncSettings
      ? {
          syncOrders: syncSettings.syncOrders !== false,
          syncCustomers: syncSettings.syncCustomers !== false,
          syncProducts: Boolean(syncSettings.syncProducts),
        }
      : integration.syncSettings;

    if (syncSettings) {
      // Only patch syncSettings — never replace storeIntegration (wipes select:false secrets).
      await patchStoreIntegrationFields(company._id, { syncSettings: nextSyncSettings });
      if (company.storeIntegration) {
        company.storeIntegration.syncSettings = nextSyncSettings;
      }
    }

    let productsSynced = null;
    if (nextSyncSettings?.syncProducts) {
      try {
        const withSecrets = await loadCompanyWithStoreSecrets(company._id);
        const productResult = await syncStoreProducts(withSecrets);
        productsSynced = productResult.synced;
        await patchStoreIntegrationFields(company._id, {
          lastSyncAt: new Date(),
          lastError: null,
        });
        if (company.storeIntegration) {
          company.storeIntegration.lastError = null;
          company.storeIntegration.lastSyncAt = new Date();
        }
        try {
          const { bumpAssistantConfigVersion } = require('../services/assistant-engine/assistant-config-version.service');
          const { clearRuntimeConfigCache } = require('../services/assistant-engine/assistant-runtime-config.service');
          await bumpAssistantConfigVersion(company._id, 'product_sync');
          clearRuntimeConfigCache(String(company._id));
        } catch (bumpErr) {
          console.warn('[store] assistant config version bump failed', bumpErr.message);
        }
      } catch (syncErr) {
        await patchStoreIntegrationFields(company._id, { lastError: syncErr.message });
        if (company.storeIntegration) {
          company.storeIntegration.lastError = syncErr.message;
        }
      }
    }

    try {
      const { bumpAssistantConfigVersion } = require('../services/assistant-engine/assistant-config-version.service');
      const { clearRuntimeConfigCache } = require('../services/assistant-engine/assistant-runtime-config.service');
      await bumpAssistantConfigVersion(company._id, 'store_settings');
      clearRuntimeConfigCache(String(company._id));
    } catch (err) {
      console.warn('[store] assistant config version bump failed', err.message);
    }

    const fresh = await Company.findById(company._id).select('storeIntegration');
    return response.success(
      res,
      {
        store: sanitizeStoreIntegration(fresh?.storeIntegration || company.storeIntegration),
        productsSynced,
      },
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
    const company = await loadCompanyWithStoreSecrets(req.company._id);
    const integration = getIntegration(company);
    if (!integration.provider || integration.status !== 'connected') {
      return response.badRequest(res, 'No connected store to test');
    }

    const secrets = getStoreSecrets(integration);
    if (integration.provider === 'shopify') {
      const verified = await testShopifyConnection({
        shopDomain: integration.shopify.shopDomain,
        accessToken: secrets.shopify.accessToken,
      });
      integration.shopify.shopName = verified.shopName;
    } else if (integration.provider === 'woocommerce') {
      const verified = await testWooCommerceConnection({
        storeUrl: integration.woocommerce.storeUrl,
        consumerKey: secrets.woocommerce.consumerKey,
        consumerSecret: secrets.woocommerce.consumerSecret,
      });
      integration.woocommerce.storeName = verified.storeName;
    } else {
      const verified = await testCustomConnection({
        storeUrl: integration.custom.storeUrl,
        apiKey: secrets.custom.apiKey,
      });
      const capabilities = await fetchCustomCapabilities({
        storeUrl: verified.storeUrl,
        apiKey: secrets.custom.apiKey,
      });
      integration.custom.storeName = verified.storeName;
      integration.custom.supportedActions = capabilities.actions;
      integration.custom.features = capabilities.features;
    }

    integration.status = 'connected';
    integration.lastError = null;
    company.storeIntegration = integration;
    await company.save();

    return response.success(
      res,
      { store: sanitizeStoreIntegration(company.storeIntegration) },
      'Connection verified',
    );
  } catch (err) {
    try {
      await patchStoreIntegrationFields(req.company._id, {
        status: 'error',
        lastError: err.message,
      });
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
    const company = await loadCompanyWithStoreSecrets(req.company._id);
    const integration = getIntegration(company);
    if (integration.status !== 'connected') {
      return response.badRequest(res, 'Connect a store before syncing');
    }

    const result = await syncStoreOrders(company);
    let productsSynced = null;
    if (integration.syncSettings?.syncProducts) {
      const productResult = await syncStoreProducts(company);
      productsSynced = productResult.synced;
      try {
        const { bumpAssistantConfigVersion } = require('../services/assistant-engine/assistant-config-version.service');
        const { clearRuntimeConfigCache } = require('../services/assistant-engine/assistant-runtime-config.service');
        await bumpAssistantConfigVersion(company._id, 'product_sync');
        clearRuntimeConfigCache(String(company._id));
      } catch (bumpErr) {
        console.warn('[store] assistant config version bump failed', bumpErr.message);
      }
    }

    integration.lastSyncAt = new Date();
    integration.lastError = null;
    company.storeIntegration = integration;
    await company.save();

    return response.success(
      res,
      {
        store: sanitizeStoreIntegration(company.storeIntegration),
        synced: result.synced,
        productsSynced,
      },
      productsSynced != null
        ? `Synced ${result.synced} orders and ${productsSynced} products`
        : `Synced ${result.synced} orders`,
    );
  } catch (err) {
    try {
      await patchStoreIntegrationFields(req.company._id, { lastError: err.message });
    } catch {
      /* ignore */
    }
    if (err.message && !err.statusCode) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};

/**
 * GET /store/orders?email=&phone=
 * Returns recent store orders matched to a customer (used by the inbox).
 */
exports.listOrders = async (req, res, next) => {
  try {
    const integration = getIntegration(req.company);
    if (integration.status !== 'connected') {
      return response.success(res, { connected: false, orders: [] });
    }
    const orders = await findOrdersForCustomer(req.company._id, {
      email: req.query.email,
      phone: req.query.phone,
      limit: Math.min(parseInt(req.query.limit, 10) || 10, 25),
    });
    return response.success(res, { connected: true, provider: integration.provider, orders });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /store/orders/:orderId/cancel
 */
exports.cancelOrder = async (req, res, next) => {
  try {
    const integration = getIntegration(req.company);
    if (integration.status !== 'connected') {
      return response.badRequest(res, 'No store connected');
    }
    const company = await loadCompanyWithStoreSecrets(req.company._id);
    const order = await cancelStoreOrder(company, req.params.orderId, {
      reason: req.body?.reason,
      restock: req.body?.restock,
      notifyCustomer: req.body?.notifyCustomer,
    });
    return response.success(res, { order }, 'Order cancelled');
  } catch (err) {
    if (err.message && !err.statusCode) return response.badRequest(res, err.message);
    next(err);
  }
};

/**
 * POST /store/orders/:orderId/fulfill
 */
exports.fulfillOrder = async (req, res, next) => {
  try {
    const integration = getIntegration(req.company);
    if (integration.status !== 'connected') {
      return response.badRequest(res, 'No store connected');
    }
    const company = await loadCompanyWithStoreSecrets(req.company._id);
    const order = await fulfillStoreOrder(company, req.params.orderId, {
      trackingNumber: req.body?.trackingNumber,
      trackingCompany: req.body?.trackingCompany,
      trackingUrl: req.body?.trackingUrl,
      notifyCustomer: req.body?.notifyCustomer,
    });
    return response.success(res, { order }, 'Order fulfilled');
  } catch (err) {
    if (err.message && !err.statusCode) return response.badRequest(res, err.message);
    next(err);
  }
};

/**
 * GET /store/orders/:orderId
 */
exports.getOrder = async (req, res, next) => {
  try {
    const integration = getIntegration(req.company);
    if (integration.status !== 'connected') {
      return response.badRequest(res, 'No store connected');
    }
    const company = await loadCompanyWithStoreSecrets(req.company._id);
    const detail = await getStoreOrderDetail(company, req.params.orderId);
    return response.success(res, detail);
  } catch (err) {
    if (err.message && !err.statusCode) return response.badRequest(res, err.message);
    next(err);
  }
};

/**
 * POST /store/orders/:orderId/actions
 */
exports.runOrderAction = async (req, res, next) => {
  try {
    const integration = getIntegration(req.company);
    if (integration.status !== 'connected') {
      return response.badRequest(res, 'No store connected');
    }
    const action = req.body?.action;
    if (!action) return response.badRequest(res, 'action is required');

    const company = await loadCompanyWithStoreSecrets(req.company._id);
    const result = await runStoreOrderAction(company, req.params.orderId, action, req.body || {});

    if (result?.duplicateUrl) {
      return response.success(res, { duplicateUrl: result.duplicateUrl }, 'Draft order created');
    }

    if (result?.archived) {
      return response.success(res, { archived: true }, 'Order archived');
    }

    return response.success(res, { order: result }, 'Order updated');
  } catch (err) {
    if (err.message && !err.statusCode) return response.badRequest(res, err.message);
    next(err);
  }
};

/**
 * PATCH /store/orders/:orderId
 */
exports.updateOrder = async (req, res, next) => {
  try {
    const integration = getIntegration(req.company);
    if (integration.status !== 'connected') {
      return response.badRequest(res, 'No store connected');
    }
    const company = await loadCompanyWithStoreSecrets(req.company._id);
    const order = await updateStoreOrder(company, req.params.orderId, {
      note: req.body?.note,
      tags: req.body?.tags,
      email: req.body?.email,
      updateCustomerProfile: req.body?.updateCustomerProfile,
      shippingAddress: req.body?.shippingAddress,
      billingAddress: req.body?.billingAddress,
    });
    return response.success(res, { order }, 'Order updated');
  } catch (err) {
    if (err.message && !err.statusCode) return response.badRequest(res, err.message);
    next(err);
  }
};

/**
 * DELETE /store
 */
exports.disconnect = async (req, res, next) => {
  try {
    const company = await Company.findById(req.company._id).select(
      '+storeIntegration.shopify.accessToken',
    );
    const integration = company.storeIntegration;

    try {
      const { uninstallShopifyWidget } = require('../services/live-chat-shopify.service');
      await uninstallShopifyWidget(company);
      if (company.liveChat) {
        company.liveChat.widgetInstalled = false;
        company.liveChat.installMethod = null;
        company.liveChat.shopifyScriptTagId = undefined;
        company.markModified('liveChat');
      }
    } catch (err) {
      console.warn('[store disconnect widget]', err.message);
    }

    if (integration?.provider === 'shopify' && integration?.status === 'connected') {
      const secrets = getStoreSecrets(integration);
      const shopDomain = integration.shopify?.shopDomain;
      const accessToken = secrets.shopify?.accessToken;
      if (shopDomain && accessToken) {
        try {
          await revokeShopifyAppAccess(shopDomain, accessToken);
        } catch (err) {
          console.warn('[store disconnect shopify revoke]', err.message);
        }
      }
    }

    company.storeIntegration = {
      status: 'disconnected',
      syncSettings: { syncOrders: true, syncCustomers: true, syncProducts: false },
    };
    await company.save();

    // Drop synced orders for this company (best effort).
    StoreOrder.deleteMany({ company: company._id }).catch((err) =>
      console.error('[store disconnect cleanup]', err.message),
    );

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
