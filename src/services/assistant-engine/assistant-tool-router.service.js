/**
 * Capability-aware tool routing decisions (no side effects).
 */

const {
  capabilityForRoute,
  enforceCapability,
} = require('./assistant-capability.service');

function routeTools({
  route,
  runtimeConfig,
  turnContext,
  understanding,
} = {}) {
  const capability = capabilityForRoute(route?.route || route);
  const identityVerified = Boolean(
    turnContext?.verified?.orderNumber && turnContext?.verified?.email,
  );

  const permission = enforceCapability({
    capabilities: runtimeConfig?.capabilities,
    capability,
    context: {
      requireIdentity: ['lookupOrders', 'autoRefund'].includes(capability),
      identityVerified,
      tenantId: runtimeConfig?.workspaceId,
    },
  });

  const tools = [];
  if (!permission.allowed) {
    return {
      tools,
      permission,
      skipToolExecution: true,
      reason: permission.reason,
    };
  }

  switch (String(route?.route || route)) {
    case 'track_order':
    case 'financial_status':
    case 'refund_not_received':
    case 'return_or_refund':
      if (runtimeConfig?.integrations?.orderLookupAvailable !== false) {
        tools.push('order_lookup');
      }
      break;
    case 'product':
      if (runtimeConfig?.integrations?.catalogueAvailable !== false) {
        tools.push('product_search');
      }
      break;
    case 'policy':
      if (runtimeConfig?.knowledgeEnabled !== false) {
        tools.push('knowledge_retrieve');
      }
      break;
    case 'handoff':
      tools.push('availability_check');
      break;
    default:
      break;
  }

  // Knowledge may also be useful for return/refund policy questions
  if (
    understanding?.primaryIntent === 'return_policy' ||
    understanding?.primaryIntent === 'store_policy_question'
  ) {
    if (!tools.includes('knowledge_retrieve') && runtimeConfig?.knowledgeEnabled !== false) {
      tools.push('knowledge_retrieve');
    }
  }

  return {
    tools,
    permission,
    skipToolExecution: false,
    reason: 'ok',
  };
}

module.exports = {
  routeTools,
};
