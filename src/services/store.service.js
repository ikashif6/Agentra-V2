const crypto = require('crypto');

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
    shopify: plain.shopify
      ? {
          shopDomain: plain.shopify.shopDomain,
          shopName: plain.shopify.shopName,
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
  normalizeShopDomain,
  normalizeStoreUrl,
  testShopifyConnection,
  testWooCommerceConnection,
  testCustomConnection,
  generateWebhookSecret,
  sanitizeStoreIntegration,
};
