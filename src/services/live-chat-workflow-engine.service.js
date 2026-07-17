/**
 * Deterministic workflow engine for live chat ecommerce flows.
 */

const RETURN_STATES = [
  'collect_identity',
  'verify_order',
  'choose_order',
  'choose_item',
  'check_eligibility',
  'collect_reason',
  'choose_resolution',
  'choose_refund_method',
  'choose_return_method',
  'review',
  'awaiting_confirmation',
  'creating_return',
  'completed',
  'failed',
  'handoff',
];

const EXCHANGE_STATES = [
  'collect_identity',
  'verify_order',
  'choose_item',
  'check_exchange_eligibility',
  'choose_replacement_variant',
  'check_inventory',
  'review',
  'awaiting_confirmation',
  'creating_exchange',
  'completed',
  'failed',
  'handoff',
];

const PRODUCT_STATES = [
  'understand_request',
  'collect_missing_preferences',
  'search_catalog',
  'rank_results',
  'present_results',
  'refine_results',
  'compare_products',
  'add_to_cart',
  'completed',
];

const CONTACT_STATES = [
  'offer_contact_request',
  'collect_contact_method',
  'collect_email',
  'collect_phone',
  'collect_preferred_time',
  'review_contact_request',
  'awaiting_confirmation',
  'submitted',
  'failed',
];

const WORKFLOW_DEFS = {
  return_request: {
    states: RETURN_STATES,
    initial: 'collect_identity',
    requiredByStep: {
      collect_identity: ['orderNumber', 'email'],
      verify_order: ['orderNumber', 'email'],
      choose_item: ['selectedLineItemId'],
      collect_reason: ['returnReason'],
      choose_refund_method: ['refundMethod'],
      choose_return_method: ['returnMethod'],
    },
    maxRetries: { verify_order: 3, collect_identity: 5 },
  },
  exchange_item: {
    states: EXCHANGE_STATES,
    initial: 'collect_identity',
    requiredByStep: {
      collect_identity: ['orderNumber', 'email'],
      choose_item: ['selectedLineItemId'],
      choose_replacement_variant: ['size', 'color'],
    },
    maxRetries: { verify_order: 3 },
  },
  product_search: {
    states: PRODUCT_STATES,
    initial: 'understand_request',
    requiredByStep: {},
    maxRetries: {},
  },
  contact_request: {
    states: CONTACT_STATES,
    initial: 'offer_contact_request',
    requiredByStep: {
      collect_email: ['email'],
      collect_phone: ['phone'],
    },
    maxRetries: {},
  },
  track_order: {
    states: ['collect_identity', 'verify_order', 'retrieve_fulfillment', 'present_tracking', 'completed', 'handoff'],
    initial: 'collect_identity',
    requiredByStep: {
      collect_identity: ['orderNumber', 'email'],
    },
    maxRetries: { verify_order: 3 },
  },
  refund: {
    states: ['collect_identity', 'verify_order', 'assess_refund', 'present_options', 'handoff', 'completed'],
    initial: 'collect_identity',
    requiredByStep: {
      collect_identity: ['orderNumber', 'email'],
    },
    maxRetries: { verify_order: 3 },
  },
  refund_investigation: {
    states: ['collect_identity', 'verify_order', 'explain_refund_timeline', 'offer_handoff', 'completed'],
    initial: 'explain_refund_timeline',
    requiredByStep: {},
    maxRetries: {},
  },
  handoff: {
    states: ['checking_availability', 'waiting_for_agent', 'unavailable', 'outside_business_hours', 'completed'],
    initial: 'checking_availability',
    requiredByStep: {},
    maxRetries: {},
  },
};

function getWorkflowDef(name) {
  return WORKFLOW_DEFS[name] || null;
}

function getMissingForStep(workflowName, step, collected) {
  const def = getWorkflowDef(workflowName);
  const required = def?.requiredByStep?.[step] || [];
  return required.filter((f) => !collected?.[f]);
}

function canTransition(workflowName, from, to) {
  const def = getWorkflowDef(workflowName);
  if (!def) return false;
  if (!def.states.includes(to)) return false;
  if (!from) return to === def.initial;
  // Allow forward movement and handoff/failed/completed from most states
  if (['handoff', 'failed', 'completed'].includes(to)) return true;
  const fromIdx = def.states.indexOf(from);
  const toIdx = def.states.indexOf(to);
  if (fromIdx < 0 || toIdx < 0) return false;
  return toIdx >= fromIdx - 1; // allow small backtracks for corrections
}

function setWorkflowStep(session, workflowName, step, patch = {}) {
  if (!session.workflowState || typeof session.workflowState !== 'object') {
    session.workflowState = {};
  }
  const wf = session.workflowState;
  if (workflowName) wf.activeWorkflow = workflowName;
  if (step) {
    if (wf.workflowStep && !canTransition(wf.activeWorkflow || workflowName, wf.workflowStep, step)) {
      // force allowed terminal transitions only
      if (!['handoff', 'failed', 'completed', 'collect_identity'].includes(step)) {
        return { ok: false, reason: 'invalid_transition', from: wf.workflowStep, to: step };
      }
    }
    wf.workflowStep = step;
  }
  Object.assign(wf, patch);
  wf.version = (wf.version || 0) + 1;
  wf.updatedAt = new Date().toISOString();
  session.workflowState = wf;
  session.markModified?.('workflowState');
  return { ok: true, workflowState: wf };
}

function isReturnEligible(order, lineItem) {
  const ful = String(order.fulfillmentStatus || '').toLowerCase();
  const fin = String(order.financialStatus || '').toLowerCase();
  if (/cancel|void/.test(fin)) {
    return { eligible: false, reason: 'This order was cancelled.' };
  }
  if (/refund/.test(fin)) {
    return { eligible: false, reason: 'This order already has a refund on file.' };
  }
  // Heuristic window: 30 days from placedAt when present
  if (order.placedAt) {
    const ageDays = (Date.now() - new Date(order.placedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 30 && !/unfulfilled|null/.test(ful)) {
      return { eligible: false, reason: 'This order is outside the standard return window.' };
    }
  }
  if (lineItem && lineItem.returnable === false) {
    return { eligible: false, reason: 'That item is marked final sale.' };
  }
  return { eligible: true, reason: null };
}

function mapIntentToWorkflowName(intent) {
  switch (intent) {
    case 'start_return':
    case 'damaged_item':
    case 'wrong_item':
    case 'missing_item':
      return 'return_request';
    case 'exchange_item':
      return 'exchange_item';
    case 'product_recommendation':
    case 'product_search':
    case 'product_comparison':
    case 'product_availability':
    case 'size_help':
      return 'product_search';
    case 'track_order':
    case 'order_status':
      return 'track_order';
    case 'refund_status':
    case 'refund_request':
      return 'refund';
    case 'refund_not_received':
      return 'refund_investigation';
    case 'speak_to_human':
      return 'handoff';
    case 'start_contact_request':
      return 'contact_request';
    case 'change_delivery_address':
      return 'track_order'; // identity then address form
    default:
      return null;
  }
}

module.exports = {
  WORKFLOW_DEFS,
  RETURN_STATES,
  EXCHANGE_STATES,
  PRODUCT_STATES,
  CONTACT_STATES,
  getWorkflowDef,
  getMissingForStep,
  canTransition,
  setWorkflowStep,
  isReturnEligible,
  mapIntentToWorkflowName,
};
