const crypto = require('crypto');
const { encryptSecret, decryptSecret } = require('../utils/crypto');

const SHOPIFY_API_VERSION = '2024-10';

function stripHostInput(input) {
  let domain = String(input || '').trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.split('/')[0].split('?')[0].split('#')[0];
  domain = domain.replace(/^www\./, '');
  return domain;
}

function normalizeShopDomain(input) {
  let domain = stripHostInput(input);
  if (!domain.includes('.')) {
    domain = `${domain}.myshopify.com`;
  }
  if (!domain.endsWith('.myshopify.com')) {
    throw new Error('Enter a valid Shopify store domain (e.g. your-store.myshopify.com)');
  }
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(domain)) {
    throw new Error('Enter a valid Shopify store domain (e.g. your-store.myshopify.com)');
  }
  return domain;
}

function extractMyshopifyDomain(text) {
  if (!text) return null;
  const patterns = [
    /([a-z0-9][a-z0-9-]*\.myshopify\.com)/i,
    /"permanent_domain"\s*:\s*"([a-z0-9][a-z0-9-]*\.myshopify\.com)"/i,
    /"myshopifyDomain"\s*:\s*"([a-z0-9][a-z0-9-]*\.myshopify\.com)"/i,
    /Shopify\.shop\s*=\s*"([^"]+)"/i,
  ];
  for (const pattern of patterns) {
    const match = String(text).match(pattern);
    if (!match?.[1]) continue;
    try {
      const raw = match[1].includes('.') ? match[1] : `${match[1]}.myshopify.com`;
      return normalizeShopDomain(raw);
    } catch {
      /* try next pattern */
    }
  }
  return null;
}

async function fetchTextWithTimeout(url, { timeoutMs = 8000, redirect = 'follow' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect,
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/json,*/*',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const text = await res.text().catch(() => '');
    return { res, text };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Accept either `store.myshopify.com` or a custom storefront domain and resolve
 * to the permanent Shopify shop domain required for OAuth.
 */
async function resolveShopifyShopDomain(input) {
  const host = stripHostInput(input);
  if (!host) {
    throw new Error('Enter your Shopify domain or storefront URL');
  }

  try {
    return normalizeShopDomain(host);
  } catch {
    /* custom domain — try resolve below */
  }

  const candidates = [
    `https://${host}/`,
    `https://www.${host}/`,
    `https://${host}/admin`,
    `https://www.${host}/admin`,
    `http://${host}/`,
  ];

  for (const url of candidates) {
    try {
      const { res, text } = await fetchTextWithTimeout(url);
      const fromLocation = extractMyshopifyDomain(res.url || '');
      if (fromLocation) return fromLocation;
      const fromBody = extractMyshopifyDomain(text);
      if (fromBody) return fromBody;
    } catch {
      /* try next candidate */
    }
  }

  throw new Error(
    'Could not resolve that storefront to a Shopify shop. Enter your *.myshopify.com domain (Settings → Domains in Shopify admin).',
  );
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

  const ordersUrl = `${url}/agentra/orders?limit=1`;
  const ordersRes = await fetch(ordersUrl, { headers });
  if (!ordersRes.ok) {
    throw new Error(
      `Custom store must expose GET ${ordersUrl.replace(url, '')} (returned ${ordersRes.status}).`,
    );
  }
  const ordersBody = await readJsonResponse(ordersRes);
  const list = Array.isArray(ordersBody) ? ordersBody : ordersBody?.orders;
  if (!Array.isArray(list)) {
    throw new Error('Custom store /agentra/orders must return { orders: [...] } or an array.');
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
  if (integration.shopify?.refreshToken) {
    integration.shopify.refreshToken = encryptSecret(integration.shopify.refreshToken);
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
      refreshToken: readSecret(integration?.shopify?.refreshToken, enc),
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
    cancelledAt: o.cancelled_at ? new Date(o.cancelled_at) : undefined,
    cancelReason: o.cancel_reason || undefined,
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

function mapWooFinancialStatus(o) {
  const status = (typeof o === 'string' ? o : o?.status || '').toLowerCase();
  const refunds = Array.isArray(o?.refunds) ? o.refunds : [];
  if (refunds.length) {
    const refunded = refunds.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const total = parseFloat(o?.total) || 0;
    if (total > 0 && refunded >= total - 0.01) return 'refunded';
    if (refunded > 0) return 'partially_refunded';
  }
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

function mapWooFulfillmentStatus(o) {
  const status = (o?.status || '').toLowerCase();
  if (status === 'completed') return 'fulfilled';
  if (status === 'cancelled') return 'cancelled';
  return 'unfulfilled';
}

function wooMetaMap(metaData) {
  const map = {};
  for (const entry of metaData || []) {
    if (entry?.key) map[entry.key] = entry.value;
  }
  return map;
}

function wooFulfillmentsFromOrder(o) {
  const meta = wooMetaMap(o.meta_data);
  const trackingNumber =
    meta._wc_shipment_tracking_number ||
    meta._tracking_number ||
    meta.tracking_number ||
    meta.TrackingNumber;
  const trackingCompany =
    meta._wc_shipment_tracking_provider ||
    meta._tracking_provider ||
    meta.tracking_provider ||
    meta.carrier;
  const trackingUrl = meta._tracking_url || meta.tracking_url;

  if (!trackingNumber && o.status !== 'completed') return [];

  return [
    {
      status: o.status === 'completed' ? 'completed' : o.status,
      trackingCompany: trackingCompany ? String(trackingCompany) : undefined,
      trackingNumber: trackingNumber ? String(trackingNumber) : undefined,
      trackingUrl: trackingUrl ? String(trackingUrl) : undefined,
      shippedAt: o.date_completed ? new Date(o.date_completed) : undefined,
    },
  ];
}

function normalizeWooOrder(o, storeUrl) {
  const billing = o.billing || {};
  const shipping = o.shipping || {};
  const lineItems = Array.isArray(o.line_items) ? o.line_items : [];
  const shippingLines = (o.shipping_lines || []).map((line) => ({
    title: line.method_title || line.method_id || 'Shipping',
    price: toNumber(line.total) ?? toNumber(line.total_tax) ?? 0,
  }));
  const taxLines = (o.tax_lines || []).map((line) => ({
    title: line.label || 'Tax',
    rate: line.rate_percent != null ? toNumber(line.rate_percent) / 100 : undefined,
    price: toNumber(line.tax_total) ?? toNumber(line.total),
  }));
  const baseUrl = storeUrl ? storeUrl.replace(/\/+$/, '') : '';

  return {
    provider: 'woocommerce',
    externalId: String(o.id),
    orderNumber: `#${o.number || o.id}`,
    name: `#${o.number || o.id}`,
    currency: o.currency,
    totalPrice: toNumber(o.total),
    subtotalPrice: toNumber(o.total) != null && toNumber(o.total_tax) != null && toNumber(o.shipping_total) != null
      ? Math.round((toNumber(o.total) - toNumber(o.total_tax) - toNumber(o.shipping_total)) * 100) / 100
      : toNumber(o.subtotal),
    totalShipping: toNumber(o.shipping_total) ?? sumLinePrices(o.shipping_lines),
    totalTax: toNumber(o.total_tax) ?? sumLinePrices(o.tax_lines),
    financialStatus: mapWooFinancialStatus(o),
    fulfillmentStatus: mapWooFulfillmentStatus(o),
    channel: 'WooCommerce',
    tags: Array.isArray(o.tags)
      ? o.tags.map((tag) => (typeof tag === 'string' ? tag : tag?.name || String(tag)))
      : [],
    note: o.customer_note || undefined,
    itemCount: lineItemCount(lineItems),
    onHold: (o.status || '').toLowerCase() === 'on-hold',
    shippingMethod: o.shipping_lines?.[0]?.method_title || undefined,
    shippingLines,
    taxLines,
    customer: {
      externalId: o.customer_id ? String(o.customer_id) : undefined,
      name: fullName(billing.first_name, billing.last_name),
      email: billing.email || o.billing?.email || undefined,
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
      externalId: li.id ? String(li.id) : undefined,
      title: li.name,
      variantTitle: li.variation_id ? String(li.variation_id) : undefined,
      sku: li.sku || undefined,
      quantity: toNumber(li.quantity) ?? 1,
      price: toNumber(li.price),
      imageUrl: li.image?.src || undefined,
    })),
    fulfillments: wooFulfillmentsFromOrder(o),
    statusUrl:
      o.view_order_url ||
      (baseUrl && o.order_key
        ? `${baseUrl}/checkout/order-received/${o.id}/?key=${o.order_key}`
        : baseUrl
          ? `${baseUrl}/my-account/view-order/${o.id}/`
          : undefined),
    adminUrl: baseUrl ? `${baseUrl}/wp-admin/post.php?post=${o.id}&action=edit` : undefined,
    placedAt: o.date_created ? new Date(o.date_created) : undefined,
    updatedAtStore: o.date_modified ? new Date(o.date_modified) : undefined,
  };
}

// Custom stores implement the documented Agentra order contract.
function normalizeCustomOrder(o) {
  const customer = o.customer || {};
  const shipping = o.shippingAddress || o.shipping || {};
  const billing = o.billingAddress || o.billing || {};
  const lineItems = Array.isArray(o.lineItems || o.items) ? o.lineItems || o.items : [];
  const shippingLines = Array.isArray(o.shippingLines)
    ? o.shippingLines.map((line) => ({
        title: line.title || line.name || 'Shipping',
        price: toNumber(line.price),
      }))
    : o.shippingMethod || o.totalShipping != null
      ? [{ title: o.shippingMethod || 'Shipping', price: toNumber(o.totalShipping) }]
      : [];
  const taxLines = Array.isArray(o.taxLines)
    ? o.taxLines.map((line) => ({
        title: line.title || line.name || 'Tax',
        rate: toNumber(line.rate),
        price: toNumber(line.price),
      }))
    : o.totalTax != null
      ? [{ title: 'Taxes', price: toNumber(o.totalTax) }]
      : [];

  return {
    provider: 'custom',
    externalId: String(o.id ?? o.externalId ?? o.number ?? ''),
    orderNumber: o.orderNumber || (o.number ? `#${o.number}` : undefined),
    name: o.name || o.orderNumber || (o.number ? `#${o.number}` : undefined),
    currency: o.currency,
    totalPrice: toNumber(o.total ?? o.totalPrice),
    subtotalPrice: toNumber(o.subtotal ?? o.subtotalPrice),
    totalShipping: toNumber(o.totalShipping ?? o.shippingTotal),
    totalTax: toNumber(o.totalTax ?? o.taxTotal),
    financialStatus: o.financialStatus || o.paymentStatus || undefined,
    fulfillmentStatus: o.fulfillmentStatus || o.shippingStatus || undefined,
    channel: o.channel || 'Custom store',
    tags: Array.isArray(o.tags) ? o.tags.map((tag) => String(tag)) : [],
    note: o.note || o.customerNote || undefined,
    itemCount: o.itemCount ?? lineItemCount(lineItems),
    onHold: Boolean(o.onHold),
    shippingMethod: o.shippingMethod || shippingLines[0]?.title,
    shippingLines,
    taxLines,
    customer: {
      externalId: customer.id || customer.externalId ? String(customer.id || customer.externalId) : undefined,
      name: customer.name || fullName(customer.firstName, customer.lastName),
      email: customer.email || o.email || undefined,
      phone: customer.phone || o.phone || undefined,
    },
    shippingAddress: normalizeAddress({
      name: shipping.name || fullName(shipping.firstName, shipping.first_name),
      address1: shipping.address1 || shipping.address_1 || shipping.line1,
      address2: shipping.address2 || shipping.address_2 || shipping.line2,
      city: shipping.city,
      state: shipping.state || shipping.province,
      postcode: shipping.zip || shipping.postcode || shipping.postalCode,
      country: shipping.country,
      phone: shipping.phone,
    }),
    billingAddress: normalizeAddress({
      name: billing.name || fullName(billing.firstName, billing.first_name),
      address1: billing.address1 || billing.address_1 || billing.line1,
      address2: billing.address2 || billing.address_2 || billing.line2,
      city: billing.city,
      state: billing.state || billing.province,
      postcode: billing.zip || billing.postcode || billing.postalCode,
      country: billing.country,
      phone: billing.phone,
    }),
    lineItems: lineItems.map((li) => ({
      externalId: li.id || li.externalId ? String(li.id || li.externalId) : undefined,
      title: li.title || li.name,
      variantTitle: li.variantTitle || li.variant || undefined,
      sku: li.sku || undefined,
      quantity: toNumber(li.quantity) ?? 1,
      price: toNumber(li.price),
      imageUrl: li.imageUrl || li.image || undefined,
    })),
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
        syncProducts: true,
      },
    };
  }

  const plain = integration.toObject?.() ?? integration;
  const syncSettings = plain.syncSettings || {};

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
          supportedActions: plain.custom.supportedActions || undefined,
          features: plain.custom.features || undefined,
        }
      : undefined,
    syncSettings: {
      syncOrders: syncSettings.syncOrders !== false,
      syncCustomers: syncSettings.syncCustomers !== false,
      syncProducts: syncSettings.syncProducts !== false,
    },
  };
}

module.exports = {
  SHOPIFY_API_VERSION,
  normalizeShopDomain,
  resolveShopifyShopDomain,
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
