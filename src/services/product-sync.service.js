const StoreProduct = require('../models/StoreProduct');
const Company = require('../models/Company');
const { SHOPIFY_API_VERSION, getStoreSecrets } = require('./store.service');

async function readJsonResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeShopifyProduct(p, shopDomain) {
  const image = p.image?.src || p.images?.[0]?.src;
  const variant = p.variants?.[0];
  return {
    provider: 'shopify',
    externalId: String(p.id),
    title: p.title,
    description: p.body_html ? String(p.body_html).replace(/<[^>]+>/g, ' ').slice(0, 2000) : '',
    handle: p.handle,
    imageUrl: image,
    price: variant?.price ? Number(variant.price) : undefined,
    compareAtPrice: variant?.compare_at_price ? Number(variant.compare_at_price) : undefined,
    currency: variant?.currency || undefined,
    productUrl: p.handle ? `https://${shopDomain}/products/${p.handle}` : undefined,
    vendor: p.vendor,
    productType: p.product_type,
    tags: String(p.tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    status: p.status === 'active' ? 'active' : 'draft',
    syncedAt: new Date(),
  };
}

function normalizeWooProduct(p, storeUrl) {
  const base = storeUrl.replace(/\/+$/, '');
  return {
    provider: 'woocommerce',
    externalId: String(p.id),
    title: p.name,
    description: p.short_description || p.description || '',
    handle: p.slug,
    imageUrl: p.images?.[0]?.src,
    price: p.price ? Number(p.price) : undefined,
    compareAtPrice: p.regular_price ? Number(p.regular_price) : undefined,
    currency: undefined,
    productUrl: p.permalink || (p.slug ? `${base}/product/${p.slug}/` : undefined),
    vendor: undefined,
    productType: p.categories?.[0]?.name,
    tags: (p.tags || []).map((t) => (typeof t === 'string' ? t : t.name)).filter(Boolean),
    status: p.status === 'publish' ? 'active' : 'draft',
    syncedAt: new Date(),
  };
}

async function fetchShopifyProducts(shopDomain, accessToken, limit = 100) {
  const url = new URL(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/products.json`);
  url.searchParams.set('limit', String(Math.min(limit, 250)));
  url.searchParams.set('status', 'active');
  const res = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': accessToken, Accept: 'application/json' },
  });
  const body = await readJsonResponse(res);
  if (!res.ok) throw new Error(body?.errors || `Shopify products fetch failed (${res.status})`);
  return (body?.products || []).map((p) => normalizeShopifyProduct(p, shopDomain));
}

async function fetchWooProducts(storeUrl, consumerKey, consumerSecret, limit = 100) {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const url = new URL(`${storeUrl.replace(/\/+$/, '')}/wp-json/wc/v3/products`);
  url.searchParams.set('per_page', String(Math.min(limit, 100)));
  url.searchParams.set('status', 'publish');
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  });
  const body = await readJsonResponse(res);
  if (!res.ok) throw new Error(body?.message || `WooCommerce products fetch failed (${res.status})`);
  return (Array.isArray(body) ? body : []).map((p) => normalizeWooProduct(p, storeUrl));
}

async function upsertProduct(companyId, normalized) {
  return StoreProduct.findOneAndUpdate(
    { company: companyId, provider: normalized.provider, externalId: normalized.externalId },
    { $set: { company: companyId, ...normalized } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function syncStoreProducts(company, { limit = 100 } = {}) {
  const integration = company.storeIntegration || {};
  if (integration.status !== 'connected' || !integration.provider) {
    throw new Error('No connected store to sync products');
  }

  const secrets = getStoreSecrets(integration);
  let products = [];

  if (integration.provider === 'shopify') {
    const accessToken = secrets.shopify.accessToken;
    if (!accessToken) {
      throw new Error('Shopify access token is missing. Disconnect and reconnect the store.');
    }
    products = await fetchShopifyProducts(
      integration.shopify.shopDomain,
      accessToken,
      limit,
    );
  } else if (integration.provider === 'woocommerce') {
    products = await fetchWooProducts(
      integration.woocommerce.storeUrl,
      secrets.woocommerce.consumerKey,
      secrets.woocommerce.consumerSecret,
      limit,
    );
  } else {
    const base = integration.custom.storeUrl.replace(/\/+$/, '');
    const headers = { Accept: 'application/json' };
    if (secrets.custom.apiKey) headers.Authorization = `Bearer ${secrets.custom.apiKey}`;
    const res = await fetch(`${base}/agentra/products?limit=${limit}`, { headers });
    const body = await readJsonResponse(res);
    if (!res.ok) throw new Error(`Custom store products fetch failed (${res.status})`);
    const list = Array.isArray(body) ? body : body?.products || [];
    products = list.map((p) => ({
      provider: 'custom',
      externalId: String(p.id ?? p.externalId),
      title: p.title,
      description: p.description || '',
      handle: p.handle,
      imageUrl: p.imageUrl || p.image,
      price: p.price != null ? Number(p.price) : undefined,
      currency: p.currency,
      productUrl: p.url || p.productUrl,
      tags: p.tags || [],
      status: 'active',
      syncedAt: new Date(),
    }));
  }

  let synced = 0;
  for (const product of products) {
    await upsertProduct(company._id, product);
    synced += 1;
  }
  return { synced };
}

async function syncProductsForCompanyId(companyId) {
  const STORE_SECRET_SELECT =
    '+storeIntegration.shopify.accessToken ' +
    '+storeIntegration.woocommerce.consumerKey ' +
    '+storeIntegration.woocommerce.consumerSecret ' +
    '+storeIntegration.custom.apiKey';
  const company = await Company.findById(companyId).select(STORE_SECRET_SELECT);
  if (!company) return { synced: 0 };
  return syncStoreProducts(company);
}

module.exports = {
  syncStoreProducts,
  syncProductsForCompanyId,
};
