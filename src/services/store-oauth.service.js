const crypto = require('crypto');
const { signOAuthState } = require('../utils/token');
const {
  SHOPIFY_API_VERSION,
  normalizeShopDomain,
  normalizeStoreUrl,
} = require('./store.service');

const SHOPIFY_SCRIPT_TAG_SCOPE = 'write_script_tags';

// Default scopes for custom-distribution Shopify app (includes live chat script tag install).
const SHOPIFY_BASE_SCOPES =
  'read_orders,write_orders,read_customers,write_customers,read_products,read_fulfillments,write_fulfillments,write_script_tags';

const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || SHOPIFY_BASE_SCOPES;

function parseScopeList(scopes) {
  return String(scopes || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function shopifyScopesIncludeScriptTags(scopes) {
  return parseScopeList(scopes).includes(SHOPIFY_SCRIPT_TAG_SCOPE);
}

function configuredShopifyScriptTagsScope() {
  return shopifyScopesIncludeScriptTags(SHOPIFY_SCOPES);
}

// ─── Config ────────────────────────────────────────────────────────────────

function isShopifyOAuthConfigured() {
  return Boolean(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET);
}

function getApiBaseUrl() {
  return (process.env.APP_API_URL || `http://localhost:${process.env.PORT || 5000}`).replace(
    /\/+$/,
    '',
  );
}

function getShopifyRedirectUri() {
  return `${getApiBaseUrl()}/api/v1/store/shopify/oauth/callback`;
}

function getWooCallbackUrl() {
  return `${getApiBaseUrl()}/api/v1/store/woocommerce/oauth/callback`;
}

function shopifyWebhookAddress(companyId) {
  return `${getApiBaseUrl()}/api/v1/webhooks/store/shopify/${companyId}`;
}

function wooWebhookAddress(companyId) {
  return `${getApiBaseUrl()}/api/v1/webhooks/store/woocommerce/${companyId}`;
}

function customWebhookAddress(companyId) {
  return `${getApiBaseUrl()}/api/v1/webhooks/store/custom/${companyId}`;
}

// ─── Frontend redirect (back to Settings → Store) ─────────────────────────────

function getFrontendOrigin(subdomain) {
  const port = process.env.APP_FRONTEND_DEV_PORT || 3000;
  const baseDomain = process.env.APP_BASE_DOMAIN || 'agentraa.com';
  if (process.env.NODE_ENV === 'production') {
    return `https://${subdomain}.${baseDomain}`;
  }
  return `http://${subdomain}.localhost:${port}`;
}

function normalizeReturnOrigin(origin) {
  if (!origin || typeof origin !== 'string') return null;
  try {
    const url = new URL(origin);
    const baseDomain = process.env.APP_BASE_DOMAIN || 'agentraa.com';
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost')) return url.origin;
    if (host === baseDomain || host.endsWith(`.${baseDomain}`)) return url.origin;
  } catch {
    return null;
  }
  return null;
}

function buildStoreSettingsRedirect(subdomain, params = {}, returnOrigin = null) {
  const query = new URLSearchParams({ item: 'store', ...params });
  const origin = normalizeReturnOrigin(returnOrigin) || getFrontendOrigin(subdomain);
  return `${origin}/settings?${query.toString()}`;
}

async function readJsonResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ─── Shopify OAuth ────────────────────────────────────────────────────────────

function parseCustomInstallLink(link) {
  if (!link || typeof link !== 'string') {
    throw new Error('SHOPIFY_CUSTOM_INSTALL_LINK is not configured');
  }
  let url;
  try {
    url = new URL(link.trim());
  } catch {
    throw new Error('SHOPIFY_CUSTOM_INSTALL_LINK is not a valid URL');
  }

  const clientId = url.searchParams.get('client_id');
  let signature = url.searchParams.get('signature');
  if (!clientId || !signature) {
    throw new Error('Install link is missing client_id or signature');
  }

  try {
    signature = decodeURIComponent(signature);
  } catch {
    // keep raw value
  }

  const [base64Payload] = signature.split('--');
  if (!base64Payload) {
    throw new Error('Install link signature is malformed');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf8'));
  } catch {
    throw new Error('Install link signature could not be decoded');
  }

  if (!payload?.permanent_domain) {
    throw new Error('Install link is missing the store domain');
  }
  if (payload.expires_at && payload.expires_at * 1000 < Date.now()) {
    throw new Error('Install link has expired — generate a new one in your Shopify Partner app');
  }

  return {
    clientId,
    signature,
    storeDomain: normalizeShopDomain(payload.permanent_domain),
  };
}

function usesCustomInstallFlow() {
  return Boolean(process.env.SHOPIFY_CUSTOM_INSTALL_LINK?.trim());
}

function buildShopifyCustomInstallUrl(shopDomain) {
  if (!usesCustomInstallFlow()) return null;
  const parsed = parseCustomInstallLink(process.env.SHOPIFY_CUSTOM_INSTALL_LINK);
  const domain = normalizeShopDomain(shopDomain);
  if (parsed.storeDomain !== domain) {
    throw new Error(
      `This Shopify install link is for ${parsed.storeDomain}. Generate a new link for ${domain} in your Partner app.`,
    );
  }
  if (parsed.clientId !== process.env.SHOPIFY_API_KEY) {
    throw new Error('Install link client_id does not match SHOPIFY_API_KEY');
  }

  const url = new URL(`https://${domain}/admin/oauth/install_custom_app`);
  url.searchParams.set('client_id', parsed.clientId);
  url.searchParams.set('signature', parsed.signature);
  return url.toString();
}

function buildShopifyAuthorizeUrl({ shopDomain, companyId, subdomain, userId, returnOrigin }) {
  if (!isShopifyOAuthConfigured()) {
    throw new Error(
      'Shopify is not configured on the server. Add SHOPIFY_API_KEY and SHOPIFY_API_SECRET.',
    );
  }
  const domain = normalizeShopDomain(shopDomain);
  const state = signOAuthState({
    purpose: 'shopify_oauth',
    companyId: companyId.toString(),
    subdomain,
    userId: userId.toString(),
    shopDomain: domain,
    returnOrigin: normalizeReturnOrigin(returnOrigin) || undefined,
  });

  const url = new URL(`https://${domain}/admin/oauth/authorize`);
  url.searchParams.set('client_id', process.env.SHOPIFY_API_KEY);
  url.searchParams.set('scope', SHOPIFY_SCOPES);
  url.searchParams.set('redirect_uri', getShopifyRedirectUri());
  url.searchParams.set('state', state);
  return url.toString();
}

function buildShopifyInstallUrl({ shopDomain, companyId, subdomain, userId, returnOrigin }) {
  if (!isShopifyOAuthConfigured()) {
    throw new Error(
      'Shopify is not configured on the server. Add SHOPIFY_API_KEY and SHOPIFY_API_SECRET.',
    );
  }
  const domain = normalizeShopDomain(shopDomain);
  const customInstallUrl = buildShopifyCustomInstallUrl(domain);
  if (customInstallUrl) {
    return customInstallUrl;
  }

  return buildShopifyAuthorizeUrl({
    shopDomain: domain,
    companyId,
    subdomain,
    userId,
    returnOrigin,
  });
}

async function revokeShopifyAppAccess(shopDomain, accessToken) {
  if (!shopDomain || !accessToken) return { revoked: false };
  const res = await fetch(`https://${shopDomain}/admin/api_permissions/current.json`, {
    method: 'DELETE',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      Accept: 'application/json',
    },
  });
  return { revoked: res.ok || res.status === 404 };
}

// Shopify signs the callback query with the app secret (HMAC over the sorted
// query string excluding hmac/signature).
function verifyShopifyOAuthHmac(query) {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) return false;
  const { hmac, signature, ...rest } = query;
  if (!hmac) return false;

  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${Array.isArray(rest[key]) ? rest[key].join(',') : rest[key]}`)
    .join('&');

  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, 'utf8'), Buffer.from(String(hmac), 'utf8'));
  } catch {
    return false;
  }
}

function isValidShopDomain(shop) {
  return typeof shop === 'string' && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}

async function exchangeShopifyCode(shopDomain, code) {
  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  });
  const body = await readJsonResponse(res);
  if (!res.ok || !body?.access_token) {
    throw new Error(body?.error_description || body?.error || 'Could not exchange Shopify code');
  }
  return { accessToken: body.access_token, scope: body.scope };
}

async function fetchShopifyShopName({ shopDomain, accessToken }) {
  try {
    const res = await fetch(
      `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken, Accept: 'application/json' } },
    );
    const body = await readJsonResponse(res);
    return body?.shop?.name || shopDomain;
  } catch {
    return shopDomain;
  }
}

async function registerShopifyWebhooks({ shopDomain, accessToken, companyId }) {
  const address = shopifyWebhookAddress(companyId);
  const topics = ['orders/create', 'orders/updated', 'orders/fulfilled'];
  let registered = 0;

  // Clean up any stale webhooks pointing at our address, then (re)create.
  for (const topic of topics) {
    try {
      const res = await fetch(
        `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ webhook: { topic, address, format: 'json' } }),
        },
      );
      // 422 = already exists; treat as success.
      if (res.ok || res.status === 422) registered += 1;
    } catch (err) {
      console.error('[shopify webhook register]', topic, err.message);
    }
  }
  return registered > 0;
}

// ─── WooCommerce auth handshake (wc-auth/v1) ──────────────────────────────────

function buildWooAuthUrl({ storeUrl, companyId, subdomain, userId, returnOrigin }) {
  const url = normalizeStoreUrl(storeUrl);
  const state = signOAuthState({
    purpose: 'woo_oauth',
    companyId: companyId.toString(),
    subdomain,
    userId: userId.toString(),
    storeUrl: url,
    returnOrigin: normalizeReturnOrigin(returnOrigin) || undefined,
  });

  const authUrl = new URL(`${url}/wc-auth/v1/authorize`);
  authUrl.searchParams.set('app_name', 'Agentra Support');
  // read_write so agents can also refund / edit / fulfill from the inbox.
  authUrl.searchParams.set('scope', 'read_write');
  authUrl.searchParams.set('user_id', state);
  authUrl.searchParams.set(
    'return_url',
    buildStoreSettingsRedirect(subdomain, { store: 'pending' }, returnOrigin),
  );
  authUrl.searchParams.set('callback_url', getWooCallbackUrl());
  return { url: authUrl.toString(), storeUrl: url };
}

async function registerWooWebhooks({ storeUrl, consumerKey, consumerSecret, companyId, secret }) {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const address = wooWebhookAddress(companyId);
  const topics = ['order.created', 'order.updated'];
  let registered = 0;

  for (const topic of topics) {
    try {
      const res = await fetch(`${storeUrl}/wp-json/wc/v3/webhooks`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: `Agentra ${topic}`,
          topic,
          delivery_url: address,
          secret,
          status: 'active',
        }),
      });
      if (res.ok) registered += 1;
    } catch (err) {
      console.error('[woo webhook register]', topic, err.message);
    }
  }
  return registered > 0;
}

// ─── Webhook signature verification (inbound) ─────────────────────────────────

function verifyShopifyWebhook(rawBody, hmacHeader) {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret || !hmacHeader || !rawBody) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(String(hmacHeader)));
  } catch {
    return false;
  }
}

function verifyHmacSignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader || !rawBody) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(String(signatureHeader)));
  } catch {
    return false;
  }
}

module.exports = {
  SHOPIFY_SCOPES,
  SHOPIFY_BASE_SCOPES,
  SHOPIFY_SCRIPT_TAG_SCOPE,
  shopifyScopesIncludeScriptTags,
  configuredShopifyScriptTagsScope,
  isShopifyOAuthConfigured,
  getShopifyRedirectUri,
  getWooCallbackUrl,
  revokeShopifyAppAccess,
  usesCustomInstallFlow,
  parseCustomInstallLink,
  buildShopifyCustomInstallUrl,
  buildShopifyAuthorizeUrl,
  buildShopifyInstallUrl,
  verifyShopifyOAuthHmac,
  isValidShopDomain,
  exchangeShopifyCode,
  fetchShopifyShopName,
  registerShopifyWebhooks,
  buildWooAuthUrl,
  registerWooWebhooks,
  verifyShopifyWebhook,
  verifyHmacSignature,
  buildStoreSettingsRedirect,
  customWebhookAddress,
};
