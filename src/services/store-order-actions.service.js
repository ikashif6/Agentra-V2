const StoreOrder = require('../models/StoreOrder');
const {
  SHOPIFY_API_VERSION,
  getStoreSecrets,
  normalizeShopifyOrder,
  normalizeWooOrder,
} = require('./store.service');
const { upsertOrder } = require('./store-sync.service');

async function readJsonResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function loadStoreOrder(companyId, orderId) {
  const order = await StoreOrder.findOne({ _id: orderId, company: companyId });
  if (!order) throw new Error('Order not found');
  return order;
}

async function refreshShopifyOrder(company, shopDomain, accessToken, externalId) {
  const res = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders/${externalId}.json`,
    { headers: { 'X-Shopify-Access-Token': accessToken, Accept: 'application/json' } },
  );
  const body = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(body?.errors || `Could not refresh order (${res.status})`);
  }
  const normalized = normalizeShopifyOrder(body.order, shopDomain);
  return upsertOrder(company._id, normalized, body.order);
}

async function refreshWooOrder(company, storeUrl, consumerKey, consumerSecret, externalId) {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const res = await fetch(`${storeUrl.replace(/\/+$/, '')}/wp-json/wc/v3/orders/${externalId}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  });
  const body = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(body?.message || `Could not refresh order (${res.status})`);
  }
  const normalized = normalizeWooOrder(body, storeUrl);
  return upsertOrder(company._id, normalized, body);
}

async function shopifyCancelOrder(shopDomain, accessToken, externalId, options = {}) {
  const res = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders/${externalId}/cancel.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        reason: options.reason || 'customer',
        email: options.notifyCustomer !== false,
        restock: options.restock !== false,
      }),
    },
  );
  const body = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(
      typeof body?.errors === 'string'
        ? body.errors
        : body?.errors?.base?.[0] || body?.error || `Shopify cancel failed (${res.status})`,
    );
  }
  return body?.order;
}

async function shopifyFulfillOrder(shopDomain, accessToken, externalId, options = {}) {
  const orderRes = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders/${externalId}.json`,
    { headers: { 'X-Shopify-Access-Token': accessToken, Accept: 'application/json' } },
  );
  const orderBody = await readJsonResponse(orderRes);
  if (!orderRes.ok) {
    throw new Error(orderBody?.errors || `Could not load order (${orderRes.status})`);
  }

  const lineItems = (orderBody.order?.line_items || []).filter(
    (li) => li.fulfillable_quantity > 0,
  );
  if (!lineItems.length) {
    throw new Error('This order has no items left to fulfill');
  }

  const locRes = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/locations.json`,
    { headers: { 'X-Shopify-Access-Token': accessToken, Accept: 'application/json' } },
  );
  const locBody = await readJsonResponse(locRes);
  const locationId = locBody?.locations?.[0]?.id;
  if (!locationId) throw new Error('No Shopify location found for fulfillment');

  const fulfillment = {
    location_id: locationId,
    notify_customer: options.notifyCustomer !== false,
    line_items: lineItems.map((li) => ({ id: li.id, quantity: li.fulfillable_quantity })),
  };
  if (options.trackingNumber) {
    fulfillment.tracking_number = options.trackingNumber;
    if (options.trackingCompany) fulfillment.tracking_company = options.trackingCompany;
    if (options.trackingUrl) fulfillment.tracking_urls = [options.trackingUrl];
  }

  const res = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders/${externalId}/fulfillments.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ fulfillment }),
    },
  );
  const body = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(
      typeof body?.errors === 'string'
        ? body.errors
        : body?.errors?.base?.[0] || `Shopify fulfill failed (${res.status})`,
    );
  }
  return body?.fulfillment;
}

async function wooCancelOrder(storeUrl, consumerKey, consumerSecret, externalId) {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const res = await fetch(`${storeUrl.replace(/\/+$/, '')}/wp-json/wc/v3/orders/${externalId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  const body = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(body?.message || `WooCommerce cancel failed (${res.status})`);
  }
  return body;
}

async function wooFulfillOrder(storeUrl, consumerKey, consumerSecret, externalId, options = {}) {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const base = storeUrl.replace(/\/+$/, '');

  const payload = { status: 'completed' };
  const res = await fetch(`${base}/wp-json/wc/v3/orders/${externalId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(body?.message || `WooCommerce fulfill failed (${res.status})`);
  }

  if (options.trackingNumber) {
    const note = [
      'Marked fulfilled from Agentra.',
      options.trackingCompany ? `Carrier: ${options.trackingCompany}` : null,
      `Tracking: ${options.trackingNumber}`,
      options.trackingUrl ? `URL: ${options.trackingUrl}` : null,
    ]
      .filter(Boolean)
      .join(' ');

    await fetch(`${base}/wp-json/wc/v3/orders/${externalId}/notes`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ note, customer_note: options.notifyCustomer !== false }),
    }).catch(() => {});
  }

  return body;
}

function isCancelled(order) {
  const fin = (order.financialStatus || '').toLowerCase();
  const ful = (order.fulfillmentStatus || '').toLowerCase();
  return fin === 'cancelled' || fin === 'refunded' || ful === 'cancelled';
}

function isFulfilled(order) {
  const ful = (order.fulfillmentStatus || '').toLowerCase();
  return ful === 'fulfilled' || ful === 'shipped' || ful === 'completed';
}

async function cancelStoreOrder(company, orderId, options = {}) {
  const storeOrder = await loadStoreOrder(company._id, orderId);
  if (isCancelled(storeOrder)) throw new Error('This order is already cancelled');

  const integration = company.storeIntegration;
  const secrets = getStoreSecrets(integration);
  const { provider, externalId } = storeOrder;

  if (provider === 'shopify') {
    const { shopDomain, accessToken } = secrets.shopify;
    if (!shopDomain || !accessToken) throw new Error('Shopify credentials unavailable');
    await shopifyCancelOrder(shopDomain, accessToken, externalId, options);
    return refreshShopifyOrder(company, shopDomain, accessToken, externalId);
  }

  if (provider === 'woocommerce') {
    const { storeUrl, consumerKey, consumerSecret } = secrets.woocommerce;
    if (!storeUrl || !consumerKey || !consumerSecret) {
      throw new Error('WooCommerce credentials unavailable');
    }
    await wooCancelOrder(storeUrl, consumerKey, consumerSecret, externalId);
    return refreshWooOrder(company, storeUrl, consumerKey, consumerSecret, externalId);
  }

  throw new Error('Order actions are not supported for custom stores yet');
}

async function fulfillStoreOrder(company, orderId, options = {}) {
  const storeOrder = await loadStoreOrder(company._id, orderId);
  if (isCancelled(storeOrder)) throw new Error('Cannot fulfill a cancelled order');
  if (isFulfilled(storeOrder)) throw new Error('This order is already fulfilled');

  const integration = company.storeIntegration;
  const secrets = getStoreSecrets(integration);
  const { provider, externalId } = storeOrder;

  if (provider === 'shopify') {
    const { shopDomain, accessToken } = secrets.shopify;
    if (!shopDomain || !accessToken) throw new Error('Shopify credentials unavailable');
    await shopifyFulfillOrder(shopDomain, accessToken, externalId, options);
    return refreshShopifyOrder(company, shopDomain, accessToken, externalId);
  }

  if (provider === 'woocommerce') {
    const { storeUrl, consumerKey, consumerSecret } = secrets.woocommerce;
    if (!storeUrl || !consumerKey || !consumerSecret) {
      throw new Error('WooCommerce credentials unavailable');
    }
    await wooFulfillOrder(storeUrl, consumerKey, consumerSecret, externalId, options);
    return refreshWooOrder(company, storeUrl, consumerKey, consumerSecret, externalId);
  }

  throw new Error('Order actions are not supported for custom stores yet');
}

module.exports = {
  cancelStoreOrder,
  fulfillStoreOrder,
  isCancelled,
  isFulfilled,
};
