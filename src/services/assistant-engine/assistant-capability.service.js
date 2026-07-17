/**
 * Capability mapping and enforcement.
 * Semantic intent stays unchanged; disabled capabilities return unavailable decisions.
 */

const { moneyObject } = require('../live-chat-money.service');

const ACTION_TO_CAPABILITY = {
  lookupOrder: 'lookupOrders',
  refundOrder: 'autoRefund',
  cancelOrder: 'cancelOrder',
  editOrder: 'editOrderContactAddress',
  productRecommendations: 'productRecommendations',
  requestHuman: 'humanHandoff',
};

function mapAllowedActionsToCapabilities(allowedActions = {}, { currency = 'USD' } = {}) {
  const actions = allowedActions || {};
  const maxRefund = Number(actions.maxRefundAmount ?? 100);
  return {
    lookupOrders: actions.lookupOrder !== false,
    autoRefund: Boolean(actions.refundOrder),
    maxRefundAmount: Number.isFinite(maxRefund) ? maxRefund : 100,
    maxRefundMoney: moneyObject(Number.isFinite(maxRefund) ? maxRefund : 100, currency),
    cancelOrder: Boolean(actions.cancelOrder),
    editOrderContactAddress: Boolean(actions.editOrder),
    productRecommendations: actions.productRecommendations !== false,
    humanHandoff: actions.requestHuman !== false,
  };
}

function capabilityForIntent(intent) {
  switch (String(intent || '')) {
    case 'track_order':
    case 'shipping_status':
    case 'delivery_estimate':
    case 'order_status':
    case 'financial_status':
    case 'refund_status':
    case 'refund_not_received':
      return 'lookupOrders';
    case 'request_refund':
    case 'start_return':
      return 'autoRefund';
    case 'cancel_order':
      return 'cancelOrder';
    case 'change_delivery_address':
      return 'editOrderContactAddress';
    case 'product_search':
    case 'product_recommendation':
    case 'product_comparison':
    case 'product_availability':
    case 'size_help':
      return 'productRecommendations';
    case 'contact_support':
      return 'humanHandoff';
    default:
      return null;
  }
}

function capabilityForRoute(route) {
  switch (String(route || '')) {
    case 'track_order':
    case 'financial_status':
    case 'refund_not_received':
      return 'lookupOrders';
    case 'return_or_refund':
      return 'autoRefund';
    case 'product':
      return 'productRecommendations';
    case 'handoff':
      return 'humanHandoff';
    default:
      return null;
  }
}

/**
 * Enforce a capability before tool invocation.
 * Returns a decision object — never throws for disabled actions.
 */
function enforceCapability({
  capabilities,
  capability,
  context = {},
} = {}) {
  const caps = capabilities || {};
  const key = capability;
  if (!key) {
    return { allowed: true, capability: null, reason: 'no_capability_required' };
  }

  if (caps[key] !== true && key !== 'maxRefundAmount' && key !== 'maxRefundMoney') {
    return {
      allowed: false,
      capability: key,
      reason: 'channel_permission_disabled',
      decision: 'unavailable_manual_review',
      safeMessage:
        key === 'humanHandoff'
          ? 'I can keep helping here. Live agent handoff is not enabled for this channel right now.'
          : key === 'productRecommendations'
            ? 'I can help with orders and policies, but product recommendations are not enabled on this channel. What else can I help with?'
            : key === 'autoRefund'
              ? 'I can gather the details, but refunds need a support specialist to review. I can connect you if handoff is available, or take a note.'
              : 'That action is not available on this channel right now. I can help another way or connect you with support if available.',
    };
  }

  if (key === 'autoRefund' || key === 'lookupOrders') {
    if (context.requireIdentity && !context.identityVerified) {
      return {
        allowed: false,
        capability: key,
        reason: 'identity_not_verified',
        decision: 'need_identity',
        safeMessage: 'Please share the order number and the email used at checkout so I can look that up securely.',
      };
    }
  }

  if (key === 'autoRefund' && context.amount != null) {
    const max = Number(caps.maxRefundAmount ?? 0);
    const amount = Number(context.amount);
    if (Number.isFinite(amount) && Number.isFinite(max) && amount > max) {
      return {
        allowed: false,
        capability: key,
        reason: 'amount_over_limit',
        decision: 'manual_review',
        // Never expose the threshold to customers
        safeMessage:
          'This refund needs a specialist review. I can connect you with support or take your details.',
      };
    }
  }

  if (key === 'autoRefund' && context.requireConfirmation && !context.confirmed) {
    return {
      allowed: false,
      capability: key,
      reason: 'confirmation_required',
      decision: 'need_confirmation',
      safeMessage: 'Please confirm you want me to proceed with the refund request.',
    };
  }

  if (context.tenantId && context.resourceTenantId && String(context.tenantId) !== String(context.resourceTenantId)) {
    return {
      allowed: false,
      capability: key,
      reason: 'tenant_isolation',
      decision: 'denied',
      safeMessage: 'I could not complete that request securely. Please try again or ask for a human agent.',
    };
  }

  return { allowed: true, capability: key, reason: 'permitted', decision: 'allow' };
}

function canUseCapability(capabilities, capability) {
  return enforceCapability({ capabilities, capability }).allowed;
}

module.exports = {
  ACTION_TO_CAPABILITY,
  mapAllowedActionsToCapabilities,
  capabilityForIntent,
  capabilityForRoute,
  enforceCapability,
  canUseCapability,
};
