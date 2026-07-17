const StoreProduct = require('../models/StoreProduct');
const StoreOrder = require('../models/StoreOrder');
const { SHOPIFY_API_VERSION, getStoreSecrets } = require('./store.service');
const { runStoreOrderAction } = require('./store-order-actions.service');
const { isOrderVerified } = require('./live-chat-session.service');

function extractOrderNumber(text) {
  const raw = String(text || '');
  const hadEmail = /[^\s@]+@[^\s@]+\.[^\s@]+/i.test(raw);
  // Never treat digits inside an email as an order number (e.g. name.61764@school.edu)
  const withoutEmails = raw.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/gi, ' ');

  const explicit = withoutEmails.match(
    /(?:order\s*(?:number|no\.?|#)?\s*|#)\s*([A-Z]{0,4}-?\d{3,})\b/i,
  );
  if (explicit) return explicit[1].replace(/^#/, '');

  // Prefixed alphanumeric: AG-1001, #AG-1001
  const prefixed = withoutEmails.match(/\b([A-Z]{1,4}-\d{3,})\b/i);
  if (prefixed) return prefixed[1];

  // Short replies that are basically the number: "1001", "its 1001", "it's #1001", "1001,"
  const mostlyNumber = withoutEmails
    .trim()
    .match(/^(?:(?:it'?s|this|that|order|number|no\.?|my order is)\s+)?#?([A-Z]{0,4}-?\d{3,})\s*[.,;/|]?\s*$/i);
  if (mostlyNumber) return mostlyNumber[1].replace(/^#/, '');

  // Combined replies: "1001, email@x.com" / "email@x.com 1001" / "1001 / email@x.com"
  if (hadEmail) {
    const loose = withoutEmails.match(/\b(\d{3,8})\b/) || withoutEmails.match(/\b([A-Z]{1,4}-\d{3,})\b/i);
    if (loose) return loose[1];
  }

  // Short mixed text with separators: "1001 and please" when only one number-like token
  const tokens = withoutEmails
    .replace(/[,;/|]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length > 0 && tokens.length <= 6) {
    const digitToken = tokens.find((t) => /^#?[A-Z]{0,4}-?\d{3,8}$/i.test(t));
    if (digitToken) return digitToken.replace(/^#/, '');
  }

  return null;
}

function extractEmail(text) {
  const match = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase().trim() : null;
}

/** Interactive form payload for order number / email collection in the widget. */
function buildOrderLookupForm(hasOrderNumber, hasEmail) {
  const fields = [];
  if (!hasOrderNumber) {
    fields.push({
      name: 'orderNumber',
      type: 'text',
      label: 'Order number',
      placeholder: '#1042',
      required: true,
      inputMode: 'numeric',
      autocomplete: 'off',
    });
  }
  if (!hasEmail) {
    fields.push({
      name: 'email',
      type: 'email',
      label: 'Email used on the order',
      placeholder: 'you@example.com',
      required: true,
      autocomplete: 'email',
    });
  }
  return {
    formId: 'order_lookup',
    title: !hasOrderNumber && !hasEmail ? 'Find your order' : 'One more detail',
    fields,
    submitLabel: 'Look up order',
  };
}

/** Interactive form for collecting a new shipping address. */
function buildShippingAddressForm() {
  return {
    formId: 'shipping_address',
    title: 'New shipping address',
    fields: [
      { name: 'name', type: 'text', label: 'Full name', placeholder: 'Full name', required: true, autocomplete: 'name' },
      { name: 'address1', type: 'text', label: 'Address', placeholder: 'Street address', required: true, autocomplete: 'address-line1' },
      { name: 'address2', type: 'text', label: 'Apt / suite (optional)', placeholder: 'Apartment, suite, etc.', required: false, autocomplete: 'address-line2' },
      { name: 'city', type: 'text', label: 'City', placeholder: 'City', required: true, autocomplete: 'address-level2' },
      { name: 'province', type: 'text', label: 'State / province', placeholder: 'State or province', required: false, autocomplete: 'address-level1' },
      { name: 'zip', type: 'text', label: 'ZIP / postal code', placeholder: 'Postal code', required: true, autocomplete: 'postal-code' },
      { name: 'country', type: 'text', label: 'Country', placeholder: 'Country', required: true, autocomplete: 'country-name' },
      { name: 'phone', type: 'tel', label: 'Phone (optional)', placeholder: 'Phone number', required: false, autocomplete: 'tel' },
    ],
    submitLabel: 'Update address',
  };
}

/**
 * Serialize form values into a plain customer message the extractors / AI can read.
 */
function formatFormSubmission(formId, values) {
  const v = values || {};
  if (formId === 'order_lookup') {
    const parts = [];
    if (v.orderNumber) parts.push(`Order #${String(v.orderNumber).replace(/^#/, '').trim()}`);
    if (v.email) parts.push(String(v.email).trim());
    return parts.join(', ');
  }
  if (formId === 'shipping_address') {
    const lines = ['New shipping address:'];
    if (v.name) lines.push(`Name: ${v.name}`);
    if (v.address1) lines.push(`Address: ${v.address1}`);
    if (v.address2) lines.push(`Address 2: ${v.address2}`);
    if (v.city) lines.push(`City: ${v.city}`);
    if (v.province) lines.push(`State: ${v.province}`);
    if (v.zip) lines.push(`ZIP: ${v.zip}`);
    if (v.country) lines.push(`Country: ${v.country}`);
    if (v.phone) lines.push(`Phone: ${v.phone}`);
    return lines.join('\n');
  }
  return Object.entries(v)
    .filter(([, val]) => val != null && String(val).trim())
    .map(([k, val]) => `${k}: ${val}`)
    .join('\n');
}

function parseShippingAddressFromText(text) {
  const raw = String(text || '');
  if (!/new shipping address/i.test(raw) && !/^name:\s*/im.test(raw)) return null;
  const pick = (label) => {
    const m = raw.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
    return m ? m[1].trim() : '';
  };
  const address1 = pick('Address') || pick('Address 1');
  const city = pick('City');
  const zip = pick('ZIP') || pick('Postal') || pick('Postcode');
  const country = pick('Country');
  if (!address1 || !city || !zip || !country) return null;
  return {
    name: pick('Name'),
    address1,
    address2: pick('Address 2') || pick('Apt'),
    city,
    province: pick('State') || pick('Province'),
    zip,
    country,
    phone: pick('Phone'),
  };
}


async function searchProducts(companyId, query, limit = 4) {
  const q = String(query || '').trim();
  if (!q) {
    return StoreProduct.find({ company: companyId, status: 'active' })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
  }
  return StoreProduct.find(
    {
      company: companyId,
      status: 'active',
      $or: [
        { title: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { tags: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ],
    },
    null,
    { limit },
  ).lean();
}

async function lookupOrderForEmail(companyId, email, orderNumber) {
  const normalizedNumber = orderNumber ? String(orderNumber).replace(/^#/, '').trim() : null;
  const baseQuery = {
    company: companyId,
    'customer.email': String(email).toLowerCase().trim(),
  };
  if (normalizedNumber) {
    const order = await StoreOrder.findOne({
      ...baseQuery,
      $or: [
        { externalId: normalizedNumber },
        { orderNumber: new RegExp(`${normalizedNumber}$`, 'i') },
        { name: new RegExp(`#?${normalizedNumber}$`, 'i') },
      ],
    }).lean();
    return order ? [order] : [];
  }
  return StoreOrder.find(baseQuery).sort({ placedAt: -1 }).limit(5).lean();
}

async function executeRefundIfAllowed(company, session, storeOrder, options = {}) {
  const config = options.allowedActions || company.liveChat?.ai?.allowedActions || {};
  if (!config.refundOrder) {
    return { ok: false, message: 'Refunds must be handled by a human agent for this store.' };
  }
  if (!isOrderVerified(session, storeOrder.externalId)) {
    return { ok: false, message: 'Please verify your order number and email first.' };
  }
  const maxAmount = Number(config.maxRefundAmount ?? 100);
  const total = Number(storeOrder.totalPrice ?? 0);
  if (total > maxAmount) {
    return {
      ok: false,
      // Never expose the internal dollar threshold to customers
      message:
        'This refund needs a quick review from our support team. Would you like me to connect you?',
      escalate: true,
      handoffReason: 'refund_amount_exceeds_ai_limit',
      internalLimit: maxAmount,
    };
  }
  const fin = (storeOrder.financialStatus || '').toLowerCase();
  if (fin === 'refunded' || fin === 'cancelled') {
    return { ok: false, message: 'This order is not eligible for a refund.' };
  }

  await runStoreOrderAction(company, storeOrder._id, 'refund', {});
  return { ok: true, message: `Refund processed for order ${storeOrder.orderNumber || storeOrder.name}.` };
}

function formatProductCards(products) {
  return (products || []).map((p) => ({
    id: p.externalId,
    title: p.title,
    imageUrl: p.imageUrl,
    price: p.price,
    currency: p.currency,
    url: p.productUrl,
  }));
}

const { moneyObject, normalizeMoneyAmount } = require('./live-chat-money.service');

function formatOrderCard(order) {
  const currency = order.currency || 'USD';
  const normalizedTotal = normalizeMoneyAmount(order.totalPrice, currency);
  return {
    externalId: order.externalId,
    orderNumber: order.orderNumber || order.name,
    financialStatus: order.financialStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    totalPrice: normalizedTotal != null ? normalizedTotal : order.totalPrice,
    totalDisplay: moneyObject(order.totalPrice, currency).display,
    currency,
    placedAt: order.placedAt,
    lineItems: (order.lineItems || []).slice(0, 4).map((li) => ({
      title: li.title,
      quantity: li.quantity,
      imageUrl: li.imageUrl,
    })),
    tracking: order.fulfillments?.[0]
      ? {
          company: order.fulfillments[0].trackingCompany,
          number: order.fulfillments[0].trackingNumber,
          url: order.fulfillments[0].trackingUrl,
        }
      : null,
    adminUrl: order.adminUrl,
    statusUrl: order.statusUrl,
  };
}

module.exports = {
  extractOrderNumber,
  extractEmail,
  buildOrderLookupForm,
  buildShippingAddressForm,
  formatFormSubmission,
  parseShippingAddressFromText,
  searchProducts,
  lookupOrderForEmail,
  executeRefundIfAllowed,
  formatProductCards,
  formatOrderCard,
};
