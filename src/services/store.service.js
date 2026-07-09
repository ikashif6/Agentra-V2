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
      shopDomain: integration?.shopify?.shopDomain,
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

function normalizeAddress(addr) {
  if (!addr?.address1 && !addr?.city) return undefined;
  return {
    name: addr.name || undefined,
    address1: addr.address1 || undefined,
    address2: addr.address2 || undefined,
    city: addr.city || undefined,
    province: addr.province || addr.state || undefined,
    zip: addr.zip || addr.postcode || undefined,
    country: addr.country || undefined,
    phone: addr.phone || undefined,
  };
}

function mapShopifyChannel(sourceName) {
  if (!sourceName) return undefined;
  if (sourceName === 'web' || sourceName === 'online_store') return 'Online Store';
  return String(sourceName).replace(/_/g, ' ');
}

function lineItemCount(lineItems) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return 0;
  return lineItems.reduce((sum, li) => sum + (toNumber(li.quantity) ?? 1), 0);
}

function moneyFromSet(priceSet) {
  return toNumber(priceSet?.shop_money?.amount ?? priceSet?.presentment_money?.amount);
}

function sumLinePrices(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return undefined;
  let sum = 0;
  let hasValue = false;
  for (const line of lines) {
    const price =
      moneyFromSet(line.price_set) ??
      moneyFromSet(line.discounted_price_set) ??
      toNumber(line.discounted_price) ??
      toNumber(line.price);
    if (price != null) {
      sum += price;
      hasValue = true;
    }
  }
  return hasValue ? sum : undefined;
}

function lineItemWeightGrams(lineItems) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return undefined;
  const grams = lineItems.reduce(
    (sum, li) => sum + (toNumber(li.grams) || 0) * (toNumber(li.quantity) ?? 1),
    0,
  );
  return grams > 0 ? grams : undefined;
}

function mapTaxLines(taxLines) {
  if (!Array.isArray(taxLines) || taxLines.length === 0) return undefined;
  const mapped = taxLines
    .map((line) => ({
      title: line.title || undefined,
      rate: toNumber(line.rate),
      price: moneyFromSet(line.price_set) ?? toNumber(line.price),
    }))
    .filter((line) => line.title || line.price != null);
  return mapped.length ? mapped : undefined;
}

function aggregateTaxFromLineItems(lineItems) {
  const byKey = new Map();
  for (const li of lineItems || []) {
    for (const taxLine of li.tax_lines || []) {
      const title = taxLine.title || 'Tax';
      const rate = toNumber(taxLine.rate);
      const key = `${title}::${rate ?? ''}`;
      const price = moneyFromSet(taxLine.price_set) ?? toNumber(taxLine.price) ?? 0;
      const existing = byKey.get(key) || { title, rate, price: 0 };
      existing.price += price;
      byKey.set(key, existing);
    }
  }
  const lines = [...byKey.values()].filter((line) => line.title || line.price > 0);
  return lines.length ? lines : undefined;
}

function resolveTaxLines(o, lineItems) {
  return mapTaxLines(o.tax_lines) ?? aggregateTaxFromLineItems(lineItems);
}

function mapShippingLines(shippingLines) {
  if (!Array.isArray(shippingLines) || shippingLines.length === 0) return undefined;
  const mapped = shippingLines
    .map((line) => ({
      title: line.title || undefined,
      price:
        moneyFromSet(line.discounted_price_set) ??
        toNumber(line.discounted_price) ??
        moneyFromSet(line.price_set) ??
        toNumber(line.price),
    }))
    .filter((line) => line.title || line.price != null);
  return mapped.length ? mapped : undefined;
}

function finalizeShopifyPayment(raw, data) {
  const subtotal =
    data.subtotalPrice ??
    toNumber(raw.current_subtotal_price) ??
    toNumber(raw.total_line_items_price);
  const total = data.totalPrice ?? toNumber(raw.current_total_price);
  const discounts = toNumber(raw.total_discounts) ?? 0;

  data.subtotalPrice = subtotal;
  data.totalPrice = total;

  if (!data.taxLines?.length) {
    data.taxLines = aggregateTaxFromLineItems(raw.line_items);
  }

  if (data.totalTax == null && data.taxLines?.length) {
    data.totalTax = data.taxLines.reduce((sum, line) => sum + (line.price ?? 0), 0);
  }

  if (data.totalShipping == null && data.shippingLines?.length) {
    data.totalShipping = data.shippingLines.reduce((sum, line) => sum + (line.price ?? 0), 0);
  }

  if (subtotal != null && total != null) {
    const remainder = Math.round((total - subtotal + discounts) * 100) / 100;
    if (remainder > 0.001) {
      if (data.totalTax == null && data.totalShipping != null) {
        data.totalTax = Math.round((remainder - data.totalShipping) * 100) / 100;
      } else if (data.totalShipping == null && data.totalTax != null) {
        data.totalShipping = Math.round((remainder - data.totalTax) * 100) / 100;
      }
    }
  }

  if (data.totalShipping != null && !data.shippingLines?.length) {
    data.shippingLines = [
      {
        title: data.shippingMethod || raw.shipping_lines?.[0]?.title || 'Shipping',
        price: data.totalShipping,
      },
    ];
  }

  if (data.totalTax != null && !data.taxLines?.length) {
    data.taxLines = [{ title: 'Taxes', price: data.totalTax }];
  }

  if (!data.shippingMethod && data.shippingLines?.[0]?.title) {
    data.shippingMethod = data.shippingLines[0].title;
  }

  return data;
}

function normalizeShopifyOrder(o, shopDomain) {
  const customer = o.customer || {};
  const shipping = o.shipping_address || {};
  const billing = o.billing_address || {};
  const lineItems = Array.isArray(o.line_items) ? o.line_items : [];
  const shippingLines = mapShippingLines(o.shipping_lines);
  const taxLines = resolveTaxLines(o, lineItems);

  return finalizeShopifyPayment(o, {
    provider: 'shopify',
    externalId: String(o.id),
    orderNumber: o.name || (o.order_number ? `#${o.order_number}` : undefined),
    name: o.name,
    currency: o.currency,
    totalPrice: toNumber(o.total_price) ?? toNumber(o.current_total_price),
    subtotalPrice:
      toNumber(o.subtotal_price) ??
      toNumber(o.current_subtotal_price) ??
      toNumber(o.total_line_items_price),
    totalShipping:
      moneyFromSet(o.total_shipping_price_set) ??
      moneyFromSet(o.current_shipping_price_set) ??
      toNumber(o.total_shipping_price) ??
      sumLinePrices(o.shipping_lines),
    totalTax:
      moneyFromSet(o.total_tax_set) ??
      toNumber(o.total_tax) ??
      moneyFromSet(o.current_total_tax_set) ??
      toNumber(o.current_total_tax) ??
      sumLinePrices(o.tax_lines) ??
      (taxLines ? taxLines.reduce((sum, line) => sum + (line.price ?? 0), 0) : undefined),
    financialStatus: o.financial_status,
    fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
    channel: mapShopifyChannel(o.source_name),
    tags: o.tags
      ? String(o.tags)
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [],
    note: o.note || undefined,
    itemCount: lineItemCount(lineItems),
    onHold: Boolean(o.fulfillment_status === 'on_hold' || o.cancel_reason === 'other'),
    shippingMethod: o.shipping_lines?.[0]?.title || undefined,
    shippingLines,
    taxLines,
    totalWeightGrams: lineItemWeightGrams(lineItems) ?? toNumber(o.total_weight) ?? undefined,
    fulfillmentService: lineItems[0]?.fulfillment_service || undefined,
    closedAt: o.closed_at ? new Date(o.closed_at) : undefined,
    customer: {
      externalId: customer.id ? String(customer.id) : undefined,
      name: fullName(customer.first_name, customer.last_name) || shipping.name,
      email: o.email || customer.email || undefined,
      phone: o.phone || customer.phone || shipping.phone || undefined,
    },
    shippingAddress: normalizeAddress(shipping),
    billingAddress: normalizeAddress(billing),
    lineItems: lineItems.map((li) => ({
      externalId: li.id ? String(li.id) : undefined,
      title: li.title,
      variantTitle: li.variant_title || undefined,
      sku: li.sku || undefined,
      quantity: toNumber(li.quantity) ?? 1,
      fulfillableQuantity: toNumber(li.fulfillable_quantity),
      price: toNumber(li.price),
      imageUrl: li.image?.src || li.image_url || undefined,
      grams: toNumber(li.grams),
    })),
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
  });
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
  const shipping = o.shipping || {};
  const lineItems = Array.isArray(o.line_items) ? o.line_items : [];
  return {
    provider: 'woocommerce',
    externalId: String(o.id),
    orderNumber: `#${o.number || o.id}`,
    name: `#${o.number || o.id}`,
    currency: o.currency,
    totalPrice: toNumber(o.total),
    subtotalPrice: toNumber(o.subtotal),
    totalShipping: toNumber(o.shipping_total),
    totalTax: toNumber(o.total_tax),
    financialStatus: mapWooFinancialStatus(o.status),
    fulfillmentStatus: o.status === 'completed' ? 'fulfilled' : 'unfulfilled',
    channel: 'WooCommerce',
    tags: Array.isArray(o.tags) ? o.tags.map((tag) => String(tag)) : [],
    note: o.customer_note || undefined,
    itemCount: lineItemCount(lineItems),
    customer: {
      externalId: o.customer_id ? String(o.customer_id) : undefined,
      name: fullName(billing.first_name, billing.last_name),
      email: billing.email || undefined,
      phone: billing.phone || undefined,
    },
    shippingAddress: normalizeAddress({
      name: fullName(shipping.first_name, shipping.last_name),
      address1: shipping.address_1,
      address2: shipping.address_2,
      city: shipping.city,
      state: shipping.state,
      postcode: shipping.postcode,
      country: shipping.country,
      phone: shipping.phone,
    }),
    billingAddress: normalizeAddress({
      name: fullName(billing.first_name, billing.last_name),
      address1: billing.address_1,
      address2: billing.address_2,
      city: billing.city,
      state: billing.state,
      postcode: billing.postcode,
      country: billing.country,
      phone: billing.phone,
    }),
    lineItems: lineItems.map((li) => ({
          title: li.name,
          sku: li.sku || undefined,
          quantity: toNumber(li.quantity) ?? 1,
          price: toNumber(li.price),
          imageUrl: li.image?.src || undefined,
        })),
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
