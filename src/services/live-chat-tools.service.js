const StoreProduct = require('../models/StoreProduct');
const StoreOrder = require('../models/StoreOrder');
const { SHOPIFY_API_VERSION, getStoreSecrets } = require('./store.service');
const { runStoreOrderAction } = require('./store-order-actions.service');
const { isOrderVerified } = require('./live-chat-session.service');

function extractOrderNumber(text) {
  const match = String(text).match(/#?\b(\d{3,})\b/);
  return match ? match[1] : null;
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

async function executeRefundIfAllowed(company, session, storeOrder) {
  const config = company.liveChat?.ai?.allowedActions || {};
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
      message: `Orders over $${maxAmount} require a human agent for refunds. I can connect you now.`,
      escalate: true,
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

function formatOrderCard(order) {
  return {
    externalId: order.externalId,
    orderNumber: order.orderNumber || order.name,
    financialStatus: order.financialStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    totalPrice: order.totalPrice,
    currency: order.currency,
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
  searchProducts,
  lookupOrderForEmail,
  executeRefundIfAllowed,
  formatProductCards,
  formatOrderCard,
};
