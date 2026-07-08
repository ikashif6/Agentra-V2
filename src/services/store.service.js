const crypto = require('crypto');
const { encryptSecret, decryptSecret } = require('../utils/crypto');

const SHOPIFY_API_VERSION = '2024-10';

function normalizeShopDomain(input) {
  let domain = String(input || '').trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!domain.includes('.')) {
    domain = `${domain}.myshopify.com`;
  }
  if (!domain.endsWith('.myshopify.com')) {
    throw new Error('Enter a valid Shopify store domain (e.g. your-store.myshopify.com)');
  }
  return domain;
}

function normalizeStoreUrl(input) {
  let url = String(input || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  const parsed = new URL(url);
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString().replace(/\/+$/, '');
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

async function testShopifyConnection({ shopDomain, accessToken }) {
  const domain = normalizeShopDomain(shopDomain);
  const token = String(accessToken || '').trim();
  if (!token) throw new Error('Shopify access token is required');

  const res = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
    headers: {
      'X-Shopify-Access-Token': token,
      Accept: 'application/json',
    },
  });

  const body = await readJsonResponse(res);
  if (!res.ok) {
    const message = body?.errors || body?.error || `Shopify returned ${res.status}`;
    throw new Error(typeof message === 'string' ? message : 'Could not verify Shopify credentials');
  }

  return {
    shopDomain: domain,
    shopName: body?.shop?.name || domain,
  };
}

async function testWooCommerceConnection({ storeUrl, consumerKey, consumerSecret }) {
  const url = normalizeStoreUrl(storeUrl);
  const key = String(consumerKey || '').trim();
  const secret = String(consumerSecret || '').trim();
  if (!key || !secret) throw new Error('WooCommerce consumer key and secret are required');

  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await fetch(`${url}/wp-json/wc/v3/system_status`, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
  });

  const body = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(
      body?.message || `WooCommerce returned ${res.status}. Check your URL and REST API keys.`,
    );
  }

  const storeName =
    body?.settings?.general?.store_name ||
    body?.environment?.site_url ||
    url.replace(/^https?:\/\//, '');

  return {
    storeUrl: url,
    storeName: String(storeName),
  };
}

async function testCustomConnection({ storeUrl, apiKey }) {
  const url = normalizeStoreUrl(storeUrl);
  const headers = { Accept: 'application/json' };
  const key = String(apiKey || '').trim();
  if (key) headers.Authorization = `Bearer ${key}`;

  const res = await fetch(url, {
    method: 'GET',
    headers,
    redirect: 'follow',
  });

  if (!res.ok && res.status !== 401 && res.status !== 403) {
    throw new Error(`Store URL returned ${res.status}. Check the URL is reachable.`);
  }

  let storeName = url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const body = await readJsonResponse(res);
  if (body && typeof body === 'object') {
    storeName =
      body.name || body.storeName || body.title || body.shop?.name || storeName;
  }

  return {
    storeUrl: url,
    storeName: String(storeName),
  };
}

function generateWebhookSecret() {
  return crypto.randomBytes(24).toString('hex');
}

// ─── Credential encryption at rest ────────────────────────────────────────────
// Secret fields are AES-encrypted (utils/crypto) once integration.encrypted=true.
// Reads go through getStoreSecrets() which transparently handles both encrypted
// and any legacy plaintext values.

function encryptStoreIntegration(integration) {
  if (!integration) return integration;
  if (integration.shopify?.accessToken) {
    integration.shopify.accessToken = encryptSecret(integration.shopify.accessToken);
  }
  if (integration.woocommerce) {
    if (integration.woocommerce.consumerKey) {
      integration.woocommerce.consumerKey = encryptSecret(integration.woocommerce.consumerKey);
    }
    if (integration.woocommerce.consumerSecret) {
      integration.woocommerce.consumerSecret = encryptSecret(integration.woocommerce.consumerSecret);
    }
    if (integration.woocommerce.webhookSecret) {
      integration.woocommerce.webhookSecret = encryptSecret(integration.woocommerce.webhookSecret);
    }
  }
  if (integration.custom) {
    if (integration.custom.apiKey) {
      integration.custom.apiKey = encryptSecret(integration.custom.apiKey);
    }
    if (integration.custom.webhookSecret) {
      integration.custom.webhookSecret = encryptSecret(integration.custom.webhookSecret);
    }
  }
  integration.encrypted = true;
  return integration;
}

function readSecret(value, encrypted) {
  if (!value) return value;
  if (!encrypted) return value;
  try {
    return decryptSecret(value) ?? value;
  } catch {
    return value;
  }
}

// Returns decrypted credentials for the connected provider.
function getStoreSecrets(integration) {
  const enc = Boolean(integration?.encrypted);
  return {
    shopify: {
      accessToken: readSecret(integration?.shopify?.accessToken, enc),
    },
    woocommerce: {
      consumerKey: readSecret(integration?.woocommerce?.consumerKey, enc),
      consumerSecret: readSecret(integration?.woocommerce?.consumerSecret, enc),
      webhookSecret: readSecret(integration?.woocommerce?.webhookSecret, enc),
    },
    custom: {
      apiKey: readSecret(integration?.custom?.apiKey, enc),
      webhookSecret: readSecret(integration?.custom?.webhookSecret, enc),
    },
  };
}

// ─── Order normalizers (provider payload → StoreOrder shape) ───────────────────

function toNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function fullName(first, last) {
  return [first, last].filter(Boolean).join(' ').trim() || undefined;
}

function normalizeShopifyOrder(o, shopDomain) {
  const customer = o.customer || {};
  const shipping = o.shipping_address || {};
  return {
    provider: 'shopify',
    externalId: String(o.id),
    orderNumber: o.name || (o.order_number ? `#${o.order_number}` : undefined),
    name: o.name,
    currency: o.currency,
    totalPrice: toNumber(o.total_price),
    subtotalPrice: toNumber(o.subtotal_price),
    financialStatus: o.financial_status,
    fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
    customer: {
      externalId: customer.id ? String(customer.id) : undefined,
      name: fullName(customer.first_name, customer.last_name) || shipping.name,
      email: o.email || customer.email || undefined,
      phone: o.phone || customer.phone || shipping.phone || undefined,
    },
    lineItems: Array.isArray(o.line_items)
      ? o.line_items.map((li) => ({
          title: li.title,
          variantTitle: li.variant_title || undefined,
          sku: li.sku || undefined,
          quantity: toNumber(li.quantity) ?? 1,
          price: toNumber(li.price),
        }))
      : [],
    fulfillments: Array.isArray(o.fulfillments)
      ? o.fulfillments.map((f) => ({
          status: f.shipment_status || f.status,
          trackingCompany: f.tracking_company || undefined,
          trackingNumber: f.tracking_number || undefined,
          trackingUrl:
            f.tracking_url || (Array.isArray(f.tracking_urls) ? f.tracking_urls[0] : undefined),
          shippedAt: f.created_at ? new Date(f.created_at) : undefined,
        }))
      : [],
    statusUrl: o.order_status_url || undefined,
    adminUrl: shopDomain ? `https://${shopDomain}/admin/orders/${o.id}` : undefined,
    placedAt: o.created_at ? new Date(o.created_at) : undefined,
    updatedAtStore: o.updated_at ? new Date(o.updated_at) : undefined,
  };
}

function mapWooFinancialStatus(status) {
  switch (status) {
    case 'completed':
    case 'processing':
      return 'paid';
    case 'refunded':
      return 'refunded';
    case 'cancelled':
    case 'failed':
      return status;
    default:
      return 'pending';
  }
}

function normalizeWooOrder(o, storeUrl) {
  const billing = o.billing || {};
  return {
    provider: 'woocommerce',
    externalId: String(o.id),
    orderNumber: `#${o.number || o.id}`,
    name: `#${o.number || o.id}`,
    currency: o.currency,
    totalPrice: toNumber(o.total),
    financialStatus: mapWooFinancialStatus(o.status),
    fulfillmentStatus: o.status === 'completed' ? 'fulfilled' : 'unfulfilled',
    customer: {
      externalId: o.customer_id ? String(o.customer_id) : undefined,
      name: fullName(billing.first_name, billing.last_name),
      email: billing.email || undefined,
      phone: billing.phone || undefined,
    },
    lineItems: Array.isArray(o.line_items)
      ? o.line_items.map((li) => ({
          title: li.name,
          sku: li.sku || undefined,
          quantity: toNumber(li.quantity) ?? 1,
          price: toNumber(li.price),
          imageUrl: li.image?.src || undefined,
        }))
      : [],
    fulfillments: [],
    adminUrl: storeUrl ? `${storeUrl}/wp-admin/post.php?post=${o.id}&action=edit` : undefined,
    placedAt: o.date_created ? new Date(o.date_created) : undefined,
    updatedAtStore: o.date_modified ? new Date(o.date_modified) : undefined,
  };
}

// Custom stores implement the documented Agentra order contract.
function normalizeCustomOrder(o) {
  const customer = o.customer || {};
  return {
    provider: 'custom',
    externalId: String(o.id ?? o.externalId ?? o.number ?? ''),
    orderNumber: o.orderNumber || (o.number ? `#${o.number}` : undefined),
    name: o.name || o.orderNumber || (o.number ? `#${o.number}` : undefined),
    currency: o.currency,
    totalPrice: toNumber(o.total ?? o.totalPrice),
    financialStatus: o.financialStatus || o.paymentStatus || undefined,
    fulfillmentStatus: o.fulfillmentStatus || o.shippingStatus || undefined,
    customer: {
      externalId: customer.id ? String(customer.id) : undefined,
      name: customer.name || fullName(customer.firstName, customer.lastName),
      email: customer.email || o.email || undefined,
      phone: customer.phone || o.phone || undefined,
    },
    lineItems: Array.isArray(o.lineItems || o.items)
      ? (o.lineItems || o.items).map((li) => ({
          title: li.title || li.name,
          sku: li.sku || undefined,
          quantity: toNumber(li.quantity) ?? 1,
          price: toNumber(li.price),
          imageUrl: li.imageUrl || li.image || undefined,
        }))
      : [],
    fulfillments: Array.isArray(o.fulfillments)
      ? o.fulfillments.map((f) => ({
          status: f.status,
          trackingCompany: f.trackingCompany || f.carrier || undefined,
          trackingNumber: f.trackingNumber || undefined,
          trackingUrl: f.trackingUrl || undefined,
          shippedAt: f.shippedAt ? new Date(f.shippedAt) : undefined,
        }))
      : [],
    statusUrl: o.statusUrl || undefined,
    adminUrl: o.adminUrl || undefined,
    placedAt: o.placedAt || o.createdAt ? new Date(o.placedAt || o.createdAt) : undefined,
    updatedAtStore: o.updatedAt ? new Date(o.updatedAt) : undefined,
  };
}

function sanitizeStoreIntegration(integration) {
  if (!integration) {
    return {
      provider: null,
      status: 'disconnected',
      connectedAt: null,
      lastSyncAt: null,
      lastError: null,
      syncSettings: {
        syncOrders: true,
        syncCustomers: true,
        syncProducts: false,
      },
    };
  }

  const plain = integration.toObject?.() ?? integration;

  return {
    provider: plain.provider || null,
    status: plain.status || 'disconnected',
    connectedAt: plain.connectedAt || null,
    lastSyncAt: plain.lastSyncAt || null,
    lastError: plain.lastError || null,
    webhooksRegistered: Boolean(plain.webhooksRegistered),
    shopify: plain.shopify
      ? {
          shopDomain: plain.shopify.shopDomain,
          shopName: plain.shopify.shopName,
          scope: plain.shopify.scope,
          hasAccessToken: Boolean(plain.shopify.accessToken),
        }
      : undefined,
    woocommerce: plain.woocommerce
      ? {
          storeUrl: plain.woocommerce.storeUrl,
          storeName: plain.woocommerce.storeName,
          hasCredentials: Boolean(plain.woocommerce.consumerKey),
        }
      : undefined,
    custom: plain.custom
      ? {
          storeUrl: plain.custom.storeUrl,
          storeName: plain.custom.storeName,
          hasApiKey: Boolean(plain.custom.apiKey),
          webhookSecret: plain.custom.webhookSecret || undefined,
        }
      : undefined,
    syncSettings: plain.syncSettings || {
      syncOrders: true,
      syncCustomers: true,
      syncProducts: false,
    },
  };
}

module.exports = {
  SHOPIFY_API_VERSION,
  normalizeShopDomain,
  normalizeStoreUrl,
  testShopifyConnection,
  testWooCommerceConnection,
  testCustomConnection,
  generateWebhookSecret,
  sanitizeStoreIntegration,
  encryptStoreIntegration,
  getStoreSecrets,
  normalizeShopifyOrder,
  normalizeWooOrder,
  normalizeCustomOrder,
};
