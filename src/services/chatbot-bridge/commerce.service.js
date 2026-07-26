/**
 * Commerce data for the standalone chatbot — uses Agentra connected-store snapshots
 * and existing store action services. No chatbot engine changes required.
 */

const mongoose = require('mongoose');
const StoreProduct = require('../../models/StoreProduct');
const StoreOrder = require('../../models/StoreOrder');
const { findCompanyByWorkspaceId } = require('./workspace-config.service');
const { resolveChannelAiConfig } = require('../ai-agent-config.service');
const { defaultPermissions, assertPermission } = require('../live-chat-permissions.service');
const {
  cancelStoreOrder,
  runStoreOrderAction,
  updateStoreOrder,
} = require('../store-order-actions.service');

function idFilter(productOrOrderId) {
  const id = String(productOrOrderId || '').trim();
  const or = [{ externalId: id }];
  if (mongoose.Types.ObjectId.isValid(id)) {
    or.push({ _id: id });
  }
  return { $or: or };
}

function mapProduct(doc) {
  return {
    id: String(doc.externalId || doc._id),
    title: doc.title,
    description: doc.description || undefined,
    imageUrl: doc.imageUrl || undefined,
    price: Number(doc.price || 0),
    currency: doc.currency || 'USD',
    url: doc.productUrl || undefined,
    available: String(doc.status || 'active').toLowerCase() === 'active',
    productType: doc.productType || undefined,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
  };
}

function mapOrder(doc) {
  const fulfillment = Array.isArray(doc.fulfillments) && doc.fulfillments[0]
    ? doc.fulfillments[0]
    : null;
  const unfulfilled = !doc.fulfillmentStatus || /unfulfilled|null/i.test(String(doc.fulfillmentStatus));
  return {
    id: String(doc.externalId || doc._id),
    orderNumber: String(doc.orderNumber || doc.name || doc.externalId || ''),
    email: doc.customer?.email || '',
    phone: doc.customer?.phone || undefined,
    total: Number(doc.totalPrice || 0),
    currency: doc.currency || 'USD',
    financialStatus: String(doc.financialStatus || 'unknown'),
    fulfillmentStatus: String(doc.fulfillmentStatus || 'unfulfilled'),
    shipmentStatus: fulfillment?.status || (unfulfilled ? 'unshipped' : 'shipped'),
    refundStatus: /refund/i.test(String(doc.financialStatus || '')) ? 'refunded' : 'none',
    cancellationStatus: doc.closedAt ? 'cancelled' : 'open',
    createdAt: (doc.createdAt || doc.orderedAt || new Date()).toISOString?.()
      || new Date(doc.createdAt || Date.now()).toISOString(),
    items: (doc.lineItems || []).map((item) => ({
      title: item.title || 'Item',
      quantity: Number(item.quantity || 1),
      sku: item.sku || undefined,
      price: item.price != null ? Number(item.price) : undefined,
    })),
    shippingAddress: doc.shippingAddress
      ? {
          line1: doc.shippingAddress.address1 || '',
          line2: doc.shippingAddress.address2 || undefined,
          city: doc.shippingAddress.city || '',
          state: doc.shippingAddress.province || undefined,
          zip: doc.shippingAddress.zip || '',
          country: doc.shippingAddress.country || '',
        }
      : undefined,
    tracking: fulfillment
      ? {
          number: fulfillment.trackingNumber || undefined,
          carrier: fulfillment.trackingCompany || undefined,
          url: fulfillment.trackingUrl || undefined,
        }
      : undefined,
    returnEligible: !unfulfilled,
    cancelEligible: unfulfilled,
    addressChangeEligible: unfulfilled,
    deliveredAt: null,
    fulfilledAt: fulfillment?.shippedAt
      ? new Date(fulfillment.shippedAt).toISOString()
      : null,
    _agentraOrderId: String(doc._id),
  };
}

async function companyContext(workspaceId) {
  const company = await findCompanyByWorkspaceId(workspaceId);
  if (!company) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }
  const channelAi = resolveChannelAiConfig(company, 'liveChat');
  const permissions = defaultPermissions(channelAi);
  return { company, permissions };
}

async function searchProducts(workspaceId, query = {}) {
  const { company } = await companyContext(workspaceId);
  const limit = Math.min(Number(query.limit || 8) || 8, 24);
  const filter = {
    company: company._id,
    status: { $in: ['active', 'ACTIVE', null, undefined] },
  };
  const q = String(query.query || '').trim();
  let rows;
  if (q) {
    rows = await StoreProduct.find(
      { ...filter, $text: { $search: q } },
      { score: { $meta: 'textScore' } },
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .lean();
    if (!rows.length) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      rows = await StoreProduct.find({
        ...filter,
        $or: [{ title: rx }, { productType: rx }, { tags: rx }],
      })
        .limit(limit)
        .lean();
    }
  } else {
    rows = await StoreProduct.find(filter).sort({ updatedAt: -1 }).limit(limit).lean();
  }
  let products = rows.map(mapProduct);
  if (query.budgetMax != null) {
    const max = Number(query.budgetMax);
    products = products.filter((p) => p.price <= max);
  }
  if (query.availableOnly) {
    products = products.filter((p) => p.available);
  }
  return products;
}

async function getProduct(workspaceId, productId) {
  const { company } = await companyContext(workspaceId);
  const doc = await StoreProduct.findOne({
    company: company._id,
    ...idFilter(productId),
  }).lean();
  return doc ? mapProduct(doc) : null;
}

async function findOrder(workspaceId, input = {}) {
  const { company, permissions } = await companyContext(workspaceId);
  assertPermission(permissions, 'viewOrders');
  const orderNumber = String(input.orderNumber || '').replace(/^#/, '').trim();
  const email = String(input.email || '').toLowerCase().trim();
  if (!orderNumber || !email) return null;

  const doc = await StoreOrder.findOne({
    company: company._id,
    'customer.email': email,
    $or: [
      { orderNumber: new RegExp(`^#?${orderNumber}$`, 'i') },
      { name: new RegExp(`^#?${orderNumber}$`, 'i') },
      { externalId: orderNumber },
    ],
  }).lean();

  return doc ? mapOrder(doc) : null;
}

async function getOrder(workspaceId, orderId) {
  const { company, permissions } = await companyContext(workspaceId);
  assertPermission(permissions, 'viewOrders');
  const doc = await StoreOrder.findOne({
    company: company._id,
    ...idFilter(orderId),
  }).lean();
  return doc ? mapOrder(doc) : null;
}

async function getTrackingDetails(workspaceId, orderId) {
  const order = await getOrder(workspaceId, orderId);
  if (!order) return null;
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    tracking: order.tracking || null,
    fulfillmentStatus: order.fulfillmentStatus,
    shipmentStatus: order.shipmentStatus,
  };
}

async function requestCancellation(workspaceId, orderId, reason) {
  const { company, permissions } = await companyContext(workspaceId);
  assertPermission(permissions, 'cancelOrders');
  const doc = await StoreOrder.findOne({
    company: company._id,
    ...idFilter(orderId),
  });
  if (!doc) return { ok: false, message: 'Order not found' };
  try {
    const updated = await cancelStoreOrder(company, doc._id, { reason });
    return {
      ok: true,
      message: 'Cancellation requested',
      order: mapOrder(updated.toObject ? updated.toObject() : updated),
    };
  } catch (err) {
    return { ok: false, message: err.message || 'Cancellation failed' };
  }
}

async function requestAddressChange(workspaceId, orderId, address) {
  const { company, permissions } = await companyContext(workspaceId);
  assertPermission(permissions, 'changeDeliveryAddress');
  const doc = await StoreOrder.findOne({
    company: company._id,
    ...idFilter(orderId),
  });
  if (!doc) return { ok: false, message: 'Order not found' };
  try {
    const updated = await updateStoreOrder(company, doc._id, {
      shippingAddress: {
        address1: address.line1,
        address2: address.line2,
        city: address.city,
        province: address.state,
        zip: address.zip,
        country: address.country,
      },
    });
    return {
      ok: true,
      message: 'Address update requested',
      order: mapOrder(updated.toObject ? updated.toObject() : updated),
    };
  } catch (err) {
    return { ok: false, message: err.message || 'Address change failed' };
  }
}

async function initiateRefund(workspaceId, input = {}) {
  const { company, permissions } = await companyContext(workspaceId);
  assertPermission(permissions, 'issueRefunds');
  const amount = Number(input.amount || 0);
  if (amount > Number(permissions.maxRefundAmount || 0)) {
    return {
      ok: false,
      message: 'Refund amount exceeds the AI limit. A human agent is required.',
    };
  }
  const doc = await StoreOrder.findOne({
    company: company._id,
    ...idFilter(input.orderId),
  });
  if (!doc) return { ok: false, message: 'Order not found' };
  try {
    const result = await runStoreOrderAction(company, doc._id, 'refund', {
      amount,
      reason: input.reason,
    });
    return {
      ok: true,
      message: 'Refund submitted',
      refundId: result?.refundId || result?.id || result?.externalId,
      amount,
    };
  } catch (err) {
    return { ok: false, message: err.message || 'Refund failed' };
  }
}

async function getRefundDetails(workspaceId, orderId) {
  const order = await getOrder(workspaceId, orderId);
  if (!order) return null;
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    financialStatus: order.financialStatus,
    refundStatus: order.refundStatus,
    total: order.total,
    currency: order.currency,
  };
}

module.exports = {
  searchProducts,
  getProduct,
  findOrder,
  getOrder,
  getTrackingDetails,
  requestCancellation,
  requestAddressChange,
  initiateRefund,
  getRefundDetails,
  mapProduct,
  mapOrder,
};
