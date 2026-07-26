/**
 * Chatbot bridge HTTP API — config, knowledge, commerce, availability.
 * Consumed by Chatbot AI Agent prepared providers (not by customers).
 */

const response = require('../utils/apiResponse');
const {
  findCompanyByWorkspaceId,
  buildWorkspaceConfig,
} = require('../services/chatbot-bridge/workspace-config.service');
const {
  listKnowledgeDocs,
  searchKnowledgeDocs,
} = require('../services/chatbot-bridge/knowledge.service');
const commerce = require('../services/chatbot-bridge/commerce.service');
const {
  hasOnlineLiveChatAgents,
  isWithinBusinessHours,
} = require('../services/live-chat-hours.service');
const { mergeLiveChatConfig } = require('../services/live-chat-config.service');

async function getWorkspaceConfig(req, res) {
  try {
    const company = await findCompanyByWorkspaceId(req.params.workspaceId);
    if (!company) return response.notFound(res, 'Workspace not found');
    const config = await buildWorkspaceConfig(company, {
      channel: req.query.channel || 'web',
    });
    return response.success(res, { config });
  } catch (err) {
    return response.error(res, err.message || 'Config error');
  }
}

async function getKnowledge(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Number(req.query.limit || 5);
    const docs = q
      ? await searchKnowledgeDocs(req.params.workspaceId, q, limit)
      : await listKnowledgeDocs(req.params.workspaceId);
    return response.success(res, { documents: docs });
  } catch (err) {
    return response.error(res, err.message || 'Knowledge error');
  }
}

async function getAvailability(req, res) {
  try {
    const company = await findCompanyByWorkspaceId(req.params.workspaceId);
    if (!company) return response.notFound(res, 'Workspace not found');
    const liveChat = mergeLiveChatConfig(company);
    const agentsOnline = await hasOnlineLiveChatAgents(company);
    const withinHours = isWithinBusinessHours(company);
    const handoffOnlyInHours = liveChat.behavior?.handoffOnlyInBusinessHours !== false;
    return response.success(res, {
      agentsAvailable: agentsOnline && (!handoffOnlyInHours || withinHours),
      agentsOnline,
      withinBusinessHours: withinHours,
    });
  } catch (err) {
    return response.error(res, err.message || 'Availability error');
  }
}

async function searchProducts(req, res) {
  try {
    const products = await commerce.searchProducts(req.params.workspaceId, {
      ...(req.query || {}),
      ...(req.body || {}),
    });
    return response.success(res, { products });
  } catch (err) {
    return response.error(res, err.message || 'Product search failed', err.status || 500);
  }
}

async function getProduct(req, res) {
  try {
    const product = await commerce.getProduct(req.params.workspaceId, req.params.productId);
    if (!product) return response.notFound(res, 'Product not found');
    return response.success(res, { product });
  } catch (err) {
    return response.error(res, err.message || 'Product lookup failed', err.status || 500);
  }
}

async function findOrder(req, res) {
  try {
    const order = await commerce.findOrder(req.params.workspaceId, req.body || {});
    return response.success(res, { order });
  } catch (err) {
    return response.error(res, err.message || 'Order lookup failed', err.status || 500);
  }
}

async function getOrder(req, res) {
  try {
    const order = await commerce.getOrder(req.params.workspaceId, req.params.orderId);
    if (!order) return response.notFound(res, 'Order not found');
    return response.success(res, { order });
  } catch (err) {
    return response.error(res, err.message || 'Order lookup failed', err.status || 500);
  }
}

async function getTracking(req, res) {
  try {
    const tracking = await commerce.getTrackingDetails(
      req.params.workspaceId,
      req.params.orderId,
    );
    if (!tracking) return response.notFound(res, 'Order not found');
    return response.success(res, { tracking });
  } catch (err) {
    return response.error(res, err.message || 'Tracking lookup failed', err.status || 500);
  }
}

async function cancelOrder(req, res) {
  try {
    const result = await commerce.requestCancellation(
      req.params.workspaceId,
      req.params.orderId,
      req.body?.reason,
    );
    return response.success(res, result);
  } catch (err) {
    return response.error(res, err.message || 'Cancel failed', err.status || 500);
  }
}

async function changeAddress(req, res) {
  try {
    const result = await commerce.requestAddressChange(
      req.params.workspaceId,
      req.params.orderId,
      req.body?.address || req.body || {},
    );
    return response.success(res, result);
  } catch (err) {
    return response.error(res, err.message || 'Address change failed', err.status || 500);
  }
}

async function refundOrder(req, res) {
  try {
    const result = await commerce.initiateRefund(req.params.workspaceId, {
      orderId: req.params.orderId,
      ...(req.body || {}),
    });
    return response.success(res, result);
  } catch (err) {
    return response.error(res, err.message || 'Refund failed', err.status || 500);
  }
}

async function refundDetails(req, res) {
  try {
    const details = await commerce.getRefundDetails(
      req.params.workspaceId,
      req.params.orderId,
    );
    if (!details) return response.notFound(res, 'Order not found');
    return response.success(res, { details });
  } catch (err) {
    return response.error(res, err.message || 'Refund details failed', err.status || 500);
  }
}

module.exports = {
  getWorkspaceConfig,
  getKnowledge,
  getAvailability,
  searchProducts,
  getProduct,
  findOrder,
  getOrder,
  getTracking,
  cancelOrder,
  changeAddress,
  refundOrder,
  refundDetails,
};
