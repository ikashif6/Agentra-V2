const crypto = require('crypto');
const { signOAuthState } = require('../utils/token');
const {
  SHOPIFY_API_VERSION,
  normalizeShopDomain,
  normalizeStoreUrl,
  getStoreSecrets,
  encryptStoreIntegration,
} = require('./store.service');
const { encryptSecret } = require('../utils/crypto');

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

/** Shopify script tags require a publicly reachable HTTPS src (not localhost/http). */
function isHttpsPublicApiUrl(url = getApiBaseUrl()) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    return true;
  } catch {
    return false;
  }
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

function normalizeReturnPath(path) {
  if (!path || typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  const withoutHash = trimmed.split('#')[0];
  if (withoutHash.length > 512) return null;
  try {
    const url = new URL(withoutHash, 'http://local.invalid');
    if (url.pathname !== '/settings' && url.pathname !== '/setup') return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function buildStoreSettingsRedirect(subdomain, params = {}, returnOrigin = null, returnPath = null) {
  const origin = normalizeReturnOrigin(returnOrigin) || getFrontendOrigin(subdomain);
  const path = normalizeReturnPath(returnPath) || '/settings';
  const url = new URL(path, origin);
  if (url.pathname === '/settings' && !url.searchParams.get('item')) {
    url.searchParams.set('item', 'store');
  }
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
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

function shopifyAdminStoreHandle(shopDomain) {
  return normalizeShopDomain(shopDomain).replace(/\.myshopify\.com$/i, '');
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

  // Use Unified Admin host — legacy {shop}.myshopify.com/admin/oauth/install_custom_app
  // often lands on /app/grant with "installation link is invalid".
  const url = new URL('https://admin.shopify.com/oauth/install_custom_app');
  url.searchParams.set('client_id', parsed.clientId);
  url.searchParams.set('signature', parsed.signature);
  url.searchParams.set('no_redirect', 'true');
  return url.toString();
}

function buildShopifyAuthorizeUrl({
  shopDomain,
  companyId,
  subdomain,
  userId,
  returnOrigin,
  returnPath,
}) {
  if (!isShopifyOAuthConfigured()) {
    throw new Error(
      'Shopify is not configured on the server. Add SHOPIFY_API_KEY and SHOPIFY_API_SECRET.',
    );
  }
  const domain = normalizeShopDomain(shopDomain);
  const handle = shopifyAdminStoreHandle(domain);
  const state = signOAuthState({
    purpose: 'shopify_oauth',
    companyId: companyId.toString(),
    subdomain,
    userId: userId.toString(),
    shopDomain: domain,
    returnOrigin: normalizeReturnOrigin(returnOrigin) || undefined,
    returnPath: normalizeReturnPath(returnPath) || undefined,
  });

  // Unified Admin authorize URL — required for custom-distribution apps.
  // Legacy https://{shop}.myshopify.com/admin/oauth/authorize triggers the
  // broken /app/grant "installation link is invalid" page.
  const url = new URL(`https://admin.shopify.com/store/${handle}/oauth/authorize`);
  url.searchParams.set('client_id', process.env.SHOPIFY_API_KEY);
  url.searchParams.set('scope', SHOPIFY_SCOPES);
  url.searchParams.set('redirect_uri', getShopifyRedirectUri());
  url.searchParams.set('state', state);
  return url.toString();
}

function buildShopifyInstallUrl({
  shopDomain,
  companyId,
  subdomain,
  userId,
  returnOrigin,
  returnPath,
}) {
  if (!isShopifyOAuthConfigured()) {
    throw new Error(
      'Shopify is not configured on the server. Add SHOPIFY_API_KEY and SHOPIFY_API_SECRET.',
    );
  }
  // Public Partner apps use standard OAuth for any shop (no per-store custom install links).
  return buildShopifyAuthorizeUrl({
    shopDomain: normalizeShopDomain(shopDomain),
    companyId,
    subdomain,
    userId,
    returnOrigin,
    returnPath,
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
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
      // Required for newly created public apps (expiring offline tokens).
      expiring: '1',
    }).toString(),
  });
  const body = await readJsonResponse(res);
  if (!res.ok || !body?.access_token) {
    throw new Error(body?.error_description || body?.error || 'Could not exchange Shopify code');
  }
  return parseShopifyTokenResponse(body);
}

function parseShopifyTokenResponse(body) {
  const now = Date.now();
  const expiresIn = Number(body.expires_in);
  const refreshExpiresIn = Number(body.refresh_token_expires_in);
  return {
    accessToken: body.access_token,
    scope: body.scope,
    refreshToken: body.refresh_token || null,
    accessTokenExpiresAt: Number.isFinite(expiresIn)
      ? new Date(now + expiresIn * 1000)
      : null,
    refreshTokenExpiresAt: Number.isFinite(refreshExpiresIn)
      ? new Date(now + refreshExpiresIn * 1000)
      : null,
  };
}

function shopifyTokenRequestError(body, fallback) {
  return body?.error_description || body?.error || body?.errors || fallback;
}

/** Migrate a non-expiring offline token → expiring offline token (irreversible). */
async function migrateNonExpiringToExpiringOfflineToken(shopDomain, accessToken) {
  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: accessToken,
      subject_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
      requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
      expiring: '1',
    }).toString(),
  });
  const body = await readJsonResponse(res);
  if (!res.ok || !body?.access_token) {
    throw new Error(
      shopifyTokenRequestError(
        body,
        'Could not migrate Shopify token to expiring offline access. Disconnect and reconnect your store.',
      ),
    );
  }
  return parseShopifyTokenResponse(body);
}

async function refreshExpiringOfflineToken(shopDomain, refreshToken) {
  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });
  const body = await readJsonResponse(res);
  if (!res.ok || !body?.access_token) {
    throw new Error(
      shopifyTokenRequestError(
        body,
        'Could not refresh Shopify access token. Disconnect and reconnect your store.',
      ),
    );
  }
  return parseShopifyTokenResponse(body);
}

function applyShopifyTokenFields(company, tokens) {
  if (!company?.storeIntegration?.shopify) {
    throw new Error('Shopify integration missing');
  }
  const shopify = company.storeIntegration.shopify;
  const alreadyEncrypted = Boolean(company.storeIntegration.encrypted);

  shopify.accessToken = alreadyEncrypted
    ? encryptSecret(tokens.accessToken)
    : tokens.accessToken;
  if (tokens.refreshToken) {
    shopify.refreshToken = alreadyEncrypted
      ? encryptSecret(tokens.refreshToken)
      : tokens.refreshToken;
  }
  if (tokens.accessTokenExpiresAt) {
    shopify.accessTokenExpiresAt = tokens.accessTokenExpiresAt;
  }
  if (tokens.refreshTokenExpiresAt) {
    shopify.refreshTokenExpiresAt = tokens.refreshTokenExpiresAt;
  }
  if (tokens.scope) shopify.scope = tokens.scope;

  if (!alreadyEncrypted) {
    encryptStoreIntegration(company.storeIntegration);
  }
  company.markModified('storeIntegration');
}

/**
 * Ensure company has a usable Shopify Admin API access token.
 * Migrates legacy non-expiring tokens and refreshes expiring ones as needed.
 */
async function ensureShopifyAccessToken(company, { persist = true } = {}) {
  const integration = company?.storeIntegration;
  if (integration?.provider !== 'shopify' || integration?.status !== 'connected') {
    throw new Error('Connect a Shopify store first');
  }

  const shopDomain = integration.shopify?.shopDomain;
  const secrets = getStoreSecrets(integration);
  let accessToken = secrets.shopify?.accessToken;
  const refreshToken = secrets.shopify?.refreshToken;
  if (!shopDomain || !accessToken) {
    throw new Error('Shopify credentials unavailable');
  }

  const expiresAt = integration.shopify?.accessTokenExpiresAt
    ? new Date(integration.shopify.accessTokenExpiresAt).getTime()
    : null;
  const refreshSkewMs = 60 * 1000;

  // Legacy permanent token — migrate once to expiring offline tokens.
  if (!refreshToken) {
    const migrated = await migrateNonExpiringToExpiringOfflineToken(shopDomain, accessToken);
    applyShopifyTokenFields(company, migrated);
    if (persist) await company.save();
    return { shopDomain, accessToken: migrated.accessToken, migrated: true };
  }

  if (!expiresAt || expiresAt - refreshSkewMs <= Date.now()) {
    try {
      const refreshed = await refreshExpiringOfflineToken(shopDomain, refreshToken);
      applyShopifyTokenFields(company, refreshed);
      if (persist) await company.save();
      return { shopDomain, accessToken: refreshed.accessToken, refreshed: true };
    } catch (err) {
      // Refresh token may itself be stale — force reconnect messaging.
      const message = String(err.message || '');
      if (/invalid_request|refresh_token|expired/i.test(message)) {
        throw new Error(
          'Shopify session expired. Disconnect and reconnect your store in Settings › Store, then try again.',
        );
      }
      throw err;
    }
  }

  return { shopDomain, accessToken, migrated: false, refreshed: false };
}

function isNonExpiringTokenRejectedError(err) {
  return /non-expiring access tokens are no longer accepted/i.test(String(err?.message || err || ''));
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

function buildWooAuthUrl({ storeUrl, companyId, subdomain, userId, returnOrigin, returnPath }) {
  const url = normalizeStoreUrl(storeUrl);
  const state = signOAuthState({
    purpose: 'woo_oauth',
    companyId: companyId.toString(),
    subdomain,
    userId: userId.toString(),
    storeUrl: url,
    returnOrigin: normalizeReturnOrigin(returnOrigin) || undefined,
    returnPath: normalizeReturnPath(returnPath) || undefined,
  });

  const authUrl = new URL(`${url}/wc-auth/v1/authorize`);
  authUrl.searchParams.set('app_name', 'Agentra Support');
  // read_write so agents can also refund / edit / fulfill from the inbox.
  authUrl.searchParams.set('scope', 'read_write');
  authUrl.searchParams.set('user_id', state);
  authUrl.searchParams.set(
    'return_url',
    buildStoreSettingsRedirect(subdomain, { store: 'pending' }, returnOrigin, returnPath),
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
  getApiBaseUrl,
  isHttpsPublicApiUrl,
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
  ensureShopifyAccessToken,
  migrateNonExpiringToExpiringOfflineToken,
  isNonExpiringTokenRejectedError,
  fetchShopifyShopName,
  registerShopifyWebhooks,
  buildWooAuthUrl,
  registerWooWebhooks,
  verifyShopifyWebhook,
  verifyHmacSignature,
  buildStoreSettingsRedirect,
  customWebhookAddress,
};
