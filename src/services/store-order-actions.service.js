const StoreOrder = require('../models/StoreOrder');
const {
  SHOPIFY_API_VERSION,
  getStoreSecrets,
  normalizeShopifyOrder,
  normalizeWooOrder,
} = require('./store.service');
const { upsertOrder } = require('./store-sync.service');
const { fetchShopifyConversion, shopifyGraphql } = require('./shopify-conversion.service');

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

async function refreshShopifyOrder(company, shopDomain, accessToken, externalId, rawOrder) {
  let order = rawOrder;
  if (!order) {
    const res = await fetch(
      `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders/${externalId}.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken, Accept: 'application/json' } },
    );
    const body = await readJsonResponse(res);
    if (!res.ok) {
      throw new Error(body?.errors || `Could not refresh order (${res.status})`);
    }
    order = body.order;
  }
  const normalized = normalizeShopifyOrder(order, shopDomain);
  return upsertOrder(company._id, normalized, order);
}

function mergePaymentFields(order, normalized) {
  return {
    ...order,
    subtotalPrice: normalized.subtotalPrice,
    totalPrice: normalized.totalPrice,
    totalShipping: normalized.totalShipping,
    totalTax: normalized.totalTax,
    shippingLines: normalized.shippingLines,
    taxLines: normalized.taxLines,
    shippingMethod: normalized.shippingMethod,
    totalWeightGrams: normalized.totalWeightGrams,
  };
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

async function shopifyFetch(shopDomain, accessToken, path, options = {}) {
  const res = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}${path}`, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await readJsonResponse(res);
  if (!res.ok) {
    const message =
      typeof body?.errors === 'string'
        ? body.errors
        : body?.errors?.base?.[0] ||
          body?.error ||
          body?.message ||
          `Shopify request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

async function shopifyFulfillmentOrders(shopDomain, accessToken, externalId) {
  const body = await shopifyFetch(
    shopDomain,
    accessToken,
    `/orders/${externalId}/fulfillment_orders.json`,
  );
  return body?.fulfillment_orders || [];
}

async function shopifyHoldFulfillment(shopDomain, accessToken, externalId, options = {}) {
  const fulfillmentOrders = await shopifyFulfillmentOrders(shopDomain, accessToken, externalId);
  const open = fulfillmentOrders.filter((fo) =>
    ['open', 'in_progress', 'scheduled'].includes(fo.status),
  );
  if (!open.length) throw new Error('No open fulfillment orders to place on hold');

  for (const fo of open) {
    await shopifyFetch(shopDomain, accessToken, `/fulfillment_orders/${fo.id}/hold.json`, {
      method: 'POST',
      body: JSON.stringify({
        fulfillment_hold: {
          reason: options.reason || 'other',
          reason_notes: options.reasonNotes || 'Placed on hold from Agentra',
          notify_merchant: false,
        },
      }),
    });
  }
}

async function shopifyRequestFulfillment(shopDomain, accessToken, externalId, options = {}) {
  const fulfillmentOrders = await shopifyFulfillmentOrders(shopDomain, accessToken, externalId);
  const open = fulfillmentOrders.filter((fo) => fo.status === 'open' || fo.status === 'in_progress');
  if (!open.length) throw new Error('No fulfillment orders available to request');

  for (const fo of open) {
    await shopifyFetch(
      shopDomain,
      accessToken,
      `/fulfillment_orders/${fo.id}/fulfillment_request.json`,
      {
        method: 'POST',
        body: JSON.stringify({
          fulfillment_request: {
            message: options.message || 'Fulfillment requested from Agentra',
          },
        }),
      },
    );
  }
}

async function shopifySendInvoice(shopDomain, accessToken, externalId, options = {}) {
  await shopifyFetch(shopDomain, accessToken, `/orders/${externalId}/send_invoice.json`, {
    method: 'POST',
    body: JSON.stringify({
      invoice: {
        to: options.email || undefined,
        subject: options.subject || undefined,
        custom_message: options.message || 'Here is your invoice.',
      },
    }),
  });
}

async function shopifyResendOrderEmail(shopDomain, accessToken, externalId, options = {}) {
  const email = options.email;
  if (!email) {
    throw new Error('This order does not have a customer email address');
  }

  const orderLabel = options.orderName || `#${externalId}`;
  const gid = `gid://shopify/Order/${externalId}`;
  const data = await shopifyGraphql(
    shopDomain,
    accessToken,
    `
      mutation OrderInvoiceSend($orderId: ID!, $email: EmailInput) {
        orderInvoiceSend(id: $orderId, email: $email) {
          order { id }
          userErrors { field message }
        }
      }
    `,
    {
      orderId: gid,
      email: {
        to: email,
        subject: options.subject || `Order ${orderLabel}`,
        customMessage:
          options.message ||
          `Here is your order confirmation for ${orderLabel}. If you have any questions, just reply to this email.`,
      },
    },
  );

  const errors = data?.orderInvoiceSend?.userErrors || [];
  if (errors.length) {
    throw new Error(errors[0].message || 'Could not resend order email');
  }
}

async function shopifyMarkAsPaid(shopDomain, accessToken, externalId, orderTotal, currency) {
  await shopifyFetch(shopDomain, accessToken, `/orders/${externalId}/transactions.json`, {
    method: 'POST',
    body: JSON.stringify({
      transaction: {
        kind: 'sale',
        status: 'success',
        amount: String(orderTotal),
        currency: currency || 'USD',
        gateway: 'manual',
        source: 'external',
      },
    }),
  });
}

async function shopifyRefundOrder(shopDomain, accessToken, externalId, orderTotal, currency) {
  const txBody = await shopifyFetch(shopDomain, accessToken, `/orders/${externalId}/transactions.json`);
  const transactions = txBody?.transactions || [];
  const parent =
    transactions.find(
      (tx) =>
        tx?.status === 'success' &&
        (tx?.kind === 'sale' || tx?.kind === 'capture' || tx?.kind === 'authorization'),
    ) ||
    transactions.find((tx) => tx?.status === 'success');

  if (!parent?.id) {
    throw new Error('Could not find a successful payment transaction to refund');
  }

  const amount = Number(orderTotal || parent.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Refund amount is invalid');
  }

  await shopifyFetch(shopDomain, accessToken, `/orders/${externalId}/transactions.json`, {
    method: 'POST',
    body: JSON.stringify({
      transaction: {
        kind: 'refund',
        parent_id: parent.id,
        amount: String(amount),
        currency: currency || parent.currency || 'USD',
        gateway: parent.gateway || 'manual',
      },
    }),
  });
}

async function shopifyArchiveOrder(shopDomain, accessToken, externalId) {
  await shopifyFetch(shopDomain, accessToken, `/orders/${externalId}/close.json`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

async function shopifyDuplicateOrder(shopDomain, accessToken, rawOrder) {
  const body = await shopifyFetch(shopDomain, accessToken, '/draft_orders.json', {
    method: 'POST',
    body: JSON.stringify({
      draft_order: {
        line_items: (rawOrder.line_items || []).map((li) => ({
          variant_id: li.variant_id,
          quantity: li.quantity,
        })),
        customer: rawOrder.customer?.id ? { id: rawOrder.customer.id } : undefined,
        email: rawOrder.email || rawOrder.customer?.email,
        shipping_address: rawOrder.shipping_address,
        billing_address: rawOrder.billing_address,
        note: `Duplicated from ${rawOrder.name || rawOrder.id}`,
        tags: rawOrder.tags,
      },
    }),
  });
  const draft = body?.draft_order;
  return draft?.invoice_url || `https://${shopDomain}/admin/draft_orders/${draft?.id}`;
}

async function shopifyUpdateOrder(shopDomain, accessToken, externalId, updates = {}) {
  const payload = { order: { id: Number(externalId) } };
  if (updates.note !== undefined) payload.order.note = updates.note;
  if (updates.tags !== undefined) {
    payload.order.tags = Array.isArray(updates.tags) ? updates.tags.join(', ') : updates.tags;
  }
  if (updates.shippingAddress) {
    const a = updates.shippingAddress;
    payload.order.shipping_address = {
      first_name: a.firstName || a.name?.split(' ')[0],
      last_name: a.lastName || a.name?.split(' ').slice(1).join(' '),
      name: a.name,
      address1: a.address1,
      address2: a.address2,
      city: a.city,
      province: a.province,
      zip: a.zip,
      country: a.country,
      phone: a.phone,
    };
  }
  if (updates.email !== undefined) {
    payload.order.email = updates.email;
  }
  if (updates.billingAddress) {
    const a = updates.billingAddress;
    payload.order.billing_address = {
      first_name: a.firstName || a.name?.split(' ')[0],
      last_name: a.lastName || a.name?.split(' ').slice(1).join(' '),
      name: a.name,
      address1: a.address1,
      address2: a.address2,
      city: a.city,
      province: a.province,
      zip: a.zip,
      country: a.country,
      phone: a.phone,
    };
  }

  await shopifyFetch(shopDomain, accessToken, `/orders/${externalId}.json`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

async function shopifyRemoveCustomerFromOrder(shopDomain, accessToken, externalId) {
  const data = await shopifyGraphql(
    shopDomain,
    accessToken,
    `
      mutation OrderCustomerRemove($orderId: ID!) {
        orderCustomerRemove(orderId: $orderId) {
          order { id }
          userErrors { message }
        }
      }
    `,
    { orderId: `gid://shopify/Order/${externalId}` },
  );
  const errors = data?.orderCustomerRemove?.userErrors || [];
  if (errors.length) {
    throw new Error(errors[0].message || 'Could not remove customer from order');
  }
}

async function shopifyUpdateCustomerProfileEmail(
  shopDomain,
  accessToken,
  customerExternalId,
  email,
) {
  const data = await shopifyGraphql(
    shopDomain,
    accessToken,
    `
      mutation CustomerUpdate($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer { id email }
          userErrors { message }
        }
      }
    `,
    {
      input: {
        id: `gid://shopify/Customer/${customerExternalId}`,
        email,
      },
    },
  );
  const errors = data?.customerUpdate?.userErrors || [];
  if (errors.length) {
    throw new Error(errors[0].message || 'Could not update customer profile');
  }
}

async function shopifyOrderTimeline(shopDomain, accessToken, externalId, rawOrder) {
  const events = [];
  if (rawOrder?.created_at) {
    events.push({
      id: `created-${externalId}`,
      at: rawOrder.created_at,
      type: 'created',
      message: `Order placed from ${mapShopifyChannel(rawOrder.source_name) || 'store'}`,
    });
  }
  if (rawOrder?.note) {
    events.push({
      id: `note-${externalId}`,
      at: rawOrder.updated_at || rawOrder.created_at,
      type: 'note',
      message: rawOrder.note,
    });
  }

  try {
    const txBody = await shopifyFetch(
      shopDomain,
      accessToken,
      `/orders/${externalId}/transactions.json`,
    );
    for (const tx of txBody?.transactions || []) {
      events.push({
        id: `tx-${tx.id}`,
        at: tx.created_at,
        type: 'payment',
        message: `${tx.kind} ${tx.status} — ${tx.amount} ${tx.currency}`,
      });
    }
  } catch {
    // ignore missing transaction scope
  }

  for (const f of rawOrder?.fulfillments || []) {
    events.push({
      id: `fulfillment-${f.id}`,
      at: f.created_at,
      type: 'fulfillment',
      message: `Fulfillment ${f.status || 'created'}${f.tracking_number ? ` · ${f.tracking_number}` : ''}`,
    });
  }

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function mapShopifyChannel(sourceName) {
  if (!sourceName) return undefined;
  if (sourceName === 'web' || sourceName === 'online_store') return 'Online Store';
  return String(sourceName).replace(/_/g, ' ');
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

async function getStoreOrderDetail(company, orderId) {
  const storeOrder = await loadStoreOrder(company._id, orderId);
  const integration = company.storeIntegration;
  const secrets = getStoreSecrets(integration);
  const { provider, externalId } = storeOrder;

  if (provider === 'shopify') {
    const { shopDomain, accessToken } = secrets.shopify;
    if (!shopDomain || !accessToken) throw new Error('Shopify credentials unavailable');
    const res = await fetch(
      `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders/${externalId}.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken, Accept: 'application/json' } },
    );
    const body = await readJsonResponse(res);
    if (!res.ok) throw new Error(body?.errors || `Could not load order (${res.status})`);
    const normalized = normalizeShopifyOrder(body.order, shopDomain);
    const orderDoc = await refreshShopifyOrder(
      company,
      shopDomain,
      accessToken,
      externalId,
      body.order,
    );
    const timeline = await shopifyOrderTimeline(shopDomain, accessToken, externalId, body.order);
    const conversion = await fetchShopifyConversion(
      shopDomain,
      accessToken,
      externalId,
      body.order,
    );
    const plain = orderDoc?.toObject ? orderDoc.toObject() : orderDoc;
    return { order: mergePaymentFields(plain, normalized), timeline, conversion };
  }

  if (provider === 'woocommerce') {
    const order = storeOrder.toObject();
    return {
      order,
      timeline: order.placedAt
        ? [{ id: 'created', at: order.placedAt, type: 'created', message: 'Order placed' }]
        : [],
    };
  }

  return {
    order: storeOrder.toObject(),
    timeline: [],
  };
}

async function runStoreOrderAction(company, orderId, action, payload = {}) {
  const storeOrder = await loadStoreOrder(company._id, orderId);
  const integration = company.storeIntegration;
  const secrets = getStoreSecrets(integration);
  const { provider, externalId } = storeOrder;

  if (provider !== 'shopify') {
    if (action === 'cancel') return cancelStoreOrder(company, orderId, payload);
    if (action === 'fulfill') return fulfillStoreOrder(company, orderId, payload);
    throw new Error('This action is only supported for Shopify stores right now');
  }

  const { shopDomain, accessToken } = secrets.shopify;
  if (!shopDomain || !accessToken) throw new Error('Shopify credentials unavailable');

  switch (action) {
    case 'cancel':
      await shopifyCancelOrder(shopDomain, accessToken, externalId, payload);
      return refreshShopifyOrder(company, shopDomain, accessToken, externalId);
    case 'fulfill':
      await shopifyFulfillOrder(shopDomain, accessToken, externalId, payload);
      return refreshShopifyOrder(company, shopDomain, accessToken, externalId);
    case 'hold':
      await shopifyHoldFulfillment(shopDomain, accessToken, externalId, payload);
      return refreshShopifyOrder(company, shopDomain, accessToken, externalId);
    case 'request_fulfillment':
      await shopifyRequestFulfillment(shopDomain, accessToken, externalId, payload);
      return refreshShopifyOrder(company, shopDomain, accessToken, externalId);
    case 'send_invoice':
      await shopifySendInvoice(shopDomain, accessToken, externalId, payload);
      return refreshShopifyOrder(company, shopDomain, accessToken, externalId);
    case 'resend_order_email':
      await shopifyResendOrderEmail(shopDomain, accessToken, externalId, {
        email: payload.email || storeOrder.customer?.email,
        subject: payload.subject,
        message: payload.message,
        orderName: storeOrder.orderNumber || storeOrder.name,
      });
      return refreshShopifyOrder(company, shopDomain, accessToken, externalId);
    case 'mark_paid':
      await shopifyMarkAsPaid(
        shopDomain,
        accessToken,
        externalId,
        storeOrder.totalPrice,
        storeOrder.currency,
      );
      return refreshShopifyOrder(company, shopDomain, accessToken, externalId);
    case 'refund':
      await shopifyRefundOrder(
        shopDomain,
        accessToken,
        externalId,
        storeOrder.totalPrice,
        storeOrder.currency,
      );
      return refreshShopifyOrder(company, shopDomain, accessToken, externalId);
    case 'archive':
      await shopifyArchiveOrder(shopDomain, accessToken, externalId);
      return refreshShopifyOrder(company, shopDomain, accessToken, externalId);
    case 'remove_customer':
      await shopifyRemoveCustomerFromOrder(shopDomain, accessToken, externalId);
      return refreshShopifyOrder(company, shopDomain, accessToken, externalId);
    case 'duplicate': {
      const rawRes = await fetch(
        `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders/${externalId}.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken, Accept: 'application/json' } },
      );
      const rawBody = await readJsonResponse(rawRes);
      const url = await shopifyDuplicateOrder(shopDomain, accessToken, rawBody.order);
      return { duplicateUrl: url };
    }
    default:
      throw new Error(`Unknown order action: ${action}`);
  }
}

async function updateStoreOrder(company, orderId, updates = {}) {
  const storeOrder = await loadStoreOrder(company._id, orderId);
  if (isFulfilled(storeOrder) && updates.shippingAddress) {
    throw new Error('Shipping address cannot be changed after the order has shipped');
  }

  const integration = company.storeIntegration;
  const secrets = getStoreSecrets(integration);
  const { provider, externalId } = storeOrder;

  if (provider === 'shopify') {
    const { shopDomain, accessToken } = secrets.shopify;
    if (!shopDomain || !accessToken) throw new Error('Shopify credentials unavailable');
    if (
      updates.updateCustomerProfile &&
      updates.email &&
      storeOrder.customer?.externalId
    ) {
      try {
        await shopifyUpdateCustomerProfileEmail(
          shopDomain,
          accessToken,
          storeOrder.customer.externalId,
          updates.email,
        );
      } catch (err) {
        console.warn('[shopify customer profile]', err.message);
      }
    }
    await shopifyUpdateOrder(shopDomain, accessToken, externalId, updates);
    return refreshShopifyOrder(company, shopDomain, accessToken, externalId);
  }

  throw new Error('Order editing is only supported for Shopify stores right now');
}

module.exports = {
  cancelStoreOrder,
  fulfillStoreOrder,
  getStoreOrderDetail,
  runStoreOrderAction,
  updateStoreOrder,
  isCancelled,
  isFulfilled,
};
