const StoreOrder = require('../models/StoreOrder');
const {
  SHOPIFY_API_VERSION,
  getStoreSecrets,
  normalizeShopifyOrder,
  normalizeWooOrder,
  normalizeCustomOrder,
} = require('./store.service');

async function readJsonResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ─── Provider fetchers ────────────────────────────────────────────────────────

async function fetchShopifyOrders({ shopDomain, accessToken, limit = 100 }) {
  const url = new URL(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders.json`);
  url.searchParams.set('status', 'any');
  url.searchParams.set('limit', String(Math.min(limit, 250)));
  const res = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': accessToken, Accept: 'application/json' },
  });
  const body = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(body?.errors || `Shopify orders fetch failed (${res.status})`);
  }
  return (body?.orders || []).map((o) => normalizeShopifyOrder(o, shopDomain));
}

async function fetchWooOrders({ storeUrl, consumerKey, consumerSecret, limit = 100 }) {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const url = new URL(`${storeUrl}/wp-json/wc/v3/orders`);
  url.searchParams.set('per_page', String(Math.min(limit, 100)));
  url.searchParams.set('orderby', 'date');
  url.searchParams.set('order', 'desc');
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  });
  const body = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(body?.message || `WooCommerce orders fetch failed (${res.status})`);
  }
  return (Array.isArray(body) ? body : []).map((o) => normalizeWooOrder(o, storeUrl));
}

// Custom stores expose GET {base}/agentra/orders (optionally ?email=) returning
// { orders: [...] } in the documented Agentra order shape.
async function fetchCustomOrders({ storeUrl, apiKey, email, limit = 100 }) {
  const url = new URL(`${storeUrl.replace(/\/+$/, '')}/agentra/orders`);
  if (email) url.searchParams.set('email', email);
  url.searchParams.set('limit', String(limit));
  const headers = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(url, { headers });
  const body = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(`Custom store orders fetch failed (${res.status})`);
  }
  const list = Array.isArray(body) ? body : body?.orders || [];
  return list.map((o) => normalizeCustomOrder(o));
}

function customStoreHeaders(apiKey) {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

async function fetchCustomOrder({ storeUrl, apiKey, externalId }) {
  const base = storeUrl.replace(/\/+$/, '');
  const res = await fetch(`${base}/agentra/orders/${externalId}`, {
    headers: customStoreHeaders(apiKey),
  });
  const body = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `Custom store order fetch failed (${res.status})`);
  }
  const raw = body?.order ?? body;
  return { normalized: normalizeCustomOrder(raw), raw };
}

async function customStoreOrderAction({ storeUrl, apiKey, externalId, action, payload = {} }) {
  const base = storeUrl.replace(/\/+$/, '');
  const res = await fetch(`${base}/agentra/orders/${externalId}/actions`, {
    method: 'POST',
    headers: customStoreHeaders(apiKey),
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `Custom store action failed (${res.status})`);
  }
  return body;
}

async function updateCustomOrderRemote({ storeUrl, apiKey, externalId, updates }) {
  const base = storeUrl.replace(/\/+$/, '');
  const res = await fetch(`${base}/agentra/orders/${externalId}`, {
    method: 'PATCH',
    headers: customStoreHeaders(apiKey),
    body: JSON.stringify(updates),
  });
  const body = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `Custom store order update failed (${res.status})`);
  }
  const raw = body?.order ?? body;
  return { normalized: normalizeCustomOrder(raw), raw };
}

// ─── Upsert ──────────────────────────────────────────────────────────────────

async function upsertOrder(companyId, normalized, raw) {
  if (!normalized?.externalId) return null;
  const doc = { company: companyId, ...normalized };
  if (raw !== undefined) doc.raw = raw;
  return StoreOrder.findOneAndUpdate(
    { company: companyId, provider: normalized.provider, externalId: normalized.externalId },
    { $set: doc },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function upsertMany(companyId, orders) {
  let count = 0;
  for (const order of orders) {
    try {
      await upsertOrder(companyId, order);
      count += 1;
    } catch (err) {
      // Duplicate-key races are safe to ignore; log anything else.
      if (err?.code !== 11000) {
        console.error('[store upsert]', order?.externalId, err.message);
      }
    }
  }
  return count;
}

// ─── Full sync ────────────────────────────────────────────────────────────────

/**
 * Sync recent orders for a company. `company` MUST be loaded with the encrypted
 * secret fields selected (see loadCompanyWithStoreSecrets in the controller).
 */
async function syncStoreOrders(company, { limit = 100 } = {}) {
  const integration = company.storeIntegration || {};
  if (integration.status !== 'connected' || !integration.provider) {
    throw new Error('No connected store to sync');
  }
  if (integration.syncSettings && integration.syncSettings.syncOrders === false) {
    return { synced: 0, skipped: true };
  }

  const secrets = getStoreSecrets(integration);
  let orders = [];

  if (integration.provider === 'shopify') {
    orders = await fetchShopifyOrders({
      shopDomain: integration.shopify.shopDomain,
      accessToken: secrets.shopify.accessToken,
      limit,
    });
  } else if (integration.provider === 'woocommerce') {
    orders = await fetchWooOrders({
      storeUrl: integration.woocommerce.storeUrl,
      consumerKey: secrets.woocommerce.consumerKey,
      consumerSecret: secrets.woocommerce.consumerSecret,
      limit,
    });
  } else {
    orders = await fetchCustomOrders({
      storeUrl: integration.custom.storeUrl,
      apiKey: secrets.custom.apiKey,
      limit,
    });
  }

  const synced = await upsertMany(company._id, orders);
  return { synced };
}

// ─── Customer order lookup (for the inbox) ────────────────────────────────────

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findOrdersForCustomer(companyId, { email, phone, limit = 10 } = {}) {
  const or = [];
  if (email) {
    or.push({ 'customer.email': String(email).toLowerCase().trim() });
  }
  if (phone) {
    // Match loosely on the trailing digits to tolerate formatting differences.
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length >= 7) {
      or.push({ 'customer.phone': new RegExp(`${escapeRegex(digits.slice(-9))}$`) });
    }
  }
  if (or.length === 0) return [];

  return StoreOrder.find({ company: companyId, $or: or })
    .sort({ placedAt: -1, createdAt: -1 })
    .limit(limit)
    .lean();
}

module.exports = {
  fetchShopifyOrders,
  fetchWooOrders,
  fetchCustomOrders,
  fetchCustomOrder,
  customStoreOrderAction,
  updateCustomOrderRemote,
  upsertOrder,
  upsertMany,
  syncStoreOrders,
  findOrdersForCustomer,
};
