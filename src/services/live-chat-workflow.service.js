/**
 * Persistent workflow + handoff state for live chat.
 * Deterministic transitions — the LLM is not the authority.
 */

const HANDOFF_STATUSES = {
  NOT_REQUESTED: 'not_requested',
  OFFERED: 'offered',
  CHECKING_AVAILABILITY: 'checking_availability',
  QUEUED: 'queued',
  WAITING_FOR_AGENT: 'waiting_for_agent',
  AGENT_JOINED: 'agent_joined',
  UNAVAILABLE: 'unavailable',
  OUTSIDE_BUSINESS_HOURS: 'outside_business_hours',
  CANCELLED_BY_CUSTOMER: 'cancelled_by_customer',
  CANCELLED_BY_SYSTEM: 'cancelled_by_system',
  TIMED_OUT: 'timed_out',
  FAILED: 'failed',
  COMPLETED: 'completed',
};

const ACTIVE_RESPONDERS = {
  AI: 'ai',
  QUEUED: 'queued_for_human',
  HUMAN: 'human',
  OFFLINE: 'offline_request',
};

const VALID_HANDOFF_TRANSITIONS = {
  [HANDOFF_STATUSES.NOT_REQUESTED]: [
    HANDOFF_STATUSES.OFFERED,
    HANDOFF_STATUSES.CHECKING_AVAILABILITY,
    HANDOFF_STATUSES.QUEUED,
    HANDOFF_STATUSES.WAITING_FOR_AGENT,
    HANDOFF_STATUSES.UNAVAILABLE,
    HANDOFF_STATUSES.OUTSIDE_BUSINESS_HOURS,
  ],
  [HANDOFF_STATUSES.OFFERED]: [
    HANDOFF_STATUSES.CHECKING_AVAILABILITY,
    HANDOFF_STATUSES.QUEUED,
    HANDOFF_STATUSES.WAITING_FOR_AGENT,
    HANDOFF_STATUSES.UNAVAILABLE,
    HANDOFF_STATUSES.OUTSIDE_BUSINESS_HOURS,
    HANDOFF_STATUSES.CANCELLED_BY_CUSTOMER,
  ],
  [HANDOFF_STATUSES.CHECKING_AVAILABILITY]: [
    HANDOFF_STATUSES.QUEUED,
    HANDOFF_STATUSES.WAITING_FOR_AGENT,
    HANDOFF_STATUSES.UNAVAILABLE,
    HANDOFF_STATUSES.OUTSIDE_BUSINESS_HOURS,
    HANDOFF_STATUSES.FAILED,
    HANDOFF_STATUSES.CANCELLED_BY_CUSTOMER,
  ],
  [HANDOFF_STATUSES.QUEUED]: [
    HANDOFF_STATUSES.WAITING_FOR_AGENT,
    HANDOFF_STATUSES.AGENT_JOINED,
    HANDOFF_STATUSES.TIMED_OUT,
    HANDOFF_STATUSES.CANCELLED_BY_CUSTOMER,
    HANDOFF_STATUSES.UNAVAILABLE,
  ],
  [HANDOFF_STATUSES.WAITING_FOR_AGENT]: [
    HANDOFF_STATUSES.AGENT_JOINED,
    HANDOFF_STATUSES.TIMED_OUT,
    HANDOFF_STATUSES.CANCELLED_BY_CUSTOMER,
    HANDOFF_STATUSES.CANCELLED_BY_SYSTEM,
  ],
  [HANDOFF_STATUSES.AGENT_JOINED]: [HANDOFF_STATUSES.COMPLETED],
  [HANDOFF_STATUSES.CANCELLED_BY_CUSTOMER]: [],
  [HANDOFF_STATUSES.COMPLETED]: [],
};

const SAFE_HANDOFF_REASONS = {
  refund_requires_review:
    'This refund needs a quick review from our support team. Would you like me to connect you?',
  refund_amount_exceeds_ai_limit:
    'This refund needs a quick review from our support team. Would you like me to connect you?',
  action_not_permitted:
    "I'll need a support specialist for that. Would you like me to connect you?",
  customer_requested: 'I can connect you with a support specialist. Shall I?',
  verification_failed:
    "I wasn't able to verify those details. Would you like me to connect you with support?",
  tool_failure: "I'm having trouble completing that. Would you like me to connect you with support?",
  default: 'I can connect you with a support specialist. Would you like me to?',
};

function defaultWorkflowState() {
  return {
    activeIntent: null,
    activeWorkflow: null,
    workflowStep: null,
    collectedFields: {
      orderNumber: null,
      email: null,
      phone: null,
      returnReason: null,
      selectedLineItemId: null,
      refundMethod: null,
      returnMethod: null,
      productQuery: null,
      size: null,
      color: null,
    },
    verifiedFields: {
      customer: false,
      order: false,
      emailOwnership: false,
    },
    missingFields: [],
    attemptCounts: {
      clarification: 0,
      toolFailure: 0,
      orderVerify: 0,
    },
    lastSuccessfulAction: null,
    recentlyRequestedFields: [],
    version: 0,
    updatedAt: new Date().toISOString(),
  };
}

function defaultHandoffState() {
  return {
    status: HANDOFF_STATUSES.NOT_REQUESTED,
    reason: null,
    customerFacingReason: null,
    requestedAt: null,
    cancelledAt: null,
    joinedAt: null,
    assignedAgentId: null,
    version: 0,
    activeResponder: ACTIVE_RESPONDERS.AI,
    lastStatusChangeAt: null,
  };
}

function ensureWorkflowState(session) {
  if (!session.workflowState || typeof session.workflowState !== 'object') {
    session.workflowState = defaultWorkflowState();
  }
  if (!session.workflowState.collectedFields) {
    session.workflowState.collectedFields = defaultWorkflowState().collectedFields;
  }
  return session.workflowState;
}

function ensureHandoffState(session) {
  if (!session.handoffState || typeof session.handoffState !== 'object') {
    session.handoffState = defaultHandoffState();
  }
  return session.handoffState;
}

/** Merge extracted entities into collectedFields without wiping prior valid values. */
function mergeCollectedFields(existing, incoming, { isCorrection = false } = {}) {
  const base = { ...(existing || {}) };
  const next = { ...base };
  Object.entries(incoming || {}).forEach(([key, value]) => {
    if (value == null || value === '') return;
    if (isCorrection || !base[key]) {
      next[key] = value;
      return;
    }
    // Overwrite when customer clearly supplies a new value for the same field
    if (String(value).toLowerCase() !== String(base[key]).toLowerCase()) {
      next[key] = value;
    }
  });
  return next;
}

function getMissingFields(workflow, step, collected) {
  const fields = collected || {};
  if (
    workflow === 'track_order' ||
    workflow === 'return_request' ||
    workflow === 'refund' ||
    workflow === 'cancel_order' ||
    workflow === 'change_delivery_address' ||
    step === 'collect_identity'
  ) {
    const missing = [];
    if (!fields.orderNumber) missing.push('orderNumber');
    if (!fields.email) missing.push('email');
    return missing;
  }
  return [];
}

function maskEmail(email) {
  const e = String(email || '');
  const at = e.indexOf('@');
  if (at < 1) return '***';
  return `${e[0]}***${e.slice(at)}`;
}

function maskOrderNumber(num) {
  const s = String(num || '');
  if (s.length <= 3) return '***';
  return `${'*'.repeat(Math.max(3, s.length - 3))}${s.slice(-3)}`;
}

function getSafeHandoffMessage(reason) {
  return SAFE_HANDOFF_REASONS[reason] || SAFE_HANDOFF_REASONS.default;
}

function canTransitionHandoff(from, to) {
  if (!from || from === to) return true;
  const allowed = VALID_HANDOFF_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

function setHandoffStatus(session, nextStatus, patch = {}) {
  const state = ensureHandoffState(session);
  const from = state.status || HANDOFF_STATUSES.NOT_REQUESTED;
  if (!canTransitionHandoff(from, nextStatus)) {
    return { ok: false, reason: 'invalid_transition', from, to: nextStatus };
  }
  state.status = nextStatus;
  state.version = (state.version || 0) + 1;
  state.lastStatusChangeAt = new Date().toISOString();
  Object.assign(state, patch);
  session.handoffState = state;
  session.markModified?.('handoffState');
  return { ok: true, state };
}

function isHandoffPending(session) {
  const status = ensureHandoffState(session).status;
  return [
    HANDOFF_STATUSES.OFFERED,
    HANDOFF_STATUSES.CHECKING_AVAILABILITY,
    HANDOFF_STATUSES.QUEUED,
    HANDOFF_STATUSES.WAITING_FOR_AGENT,
  ].includes(status);
}

function wantsCancelHandoff(text) {
  const t = String(text || '').toLowerCase();
  return (
    /\b(no[,.]?\s+)?(please\s+)?keep helping\b/.test(t) ||
    /\bdon'?t connect\b/.test(t) ||
    /\bcancel (the )?handoff\b/.test(t) ||
    /\bstay with (the )?(ai|bot|chat)\b/.test(t) ||
    /\bno[,.]?\s+(thanks|thank you|not now)\b/.test(t) ||
    /\bcontinue (with|chatting with) (the )?ai\b/.test(t)
  );
}

function wantsAcceptHandoff(text) {
  const t = String(text || '').toLowerCase();
  return (
    /\byes[,.]?\s+(please\s+)?connect\b/.test(t) ||
    /\bconnect me\b/.test(t) ||
    /\byes[,.]?\s+please\b/.test(t) ||
    /\bplease connect\b/.test(t)
  );
}

async function cancelHandoffByCustomer(session) {
  const state = ensureHandoffState(session);
  // Allow cancel from pending states; force if already terminal cancel
  if (
    state.status === HANDOFF_STATUSES.CANCELLED_BY_CUSTOMER ||
    state.status === HANDOFF_STATUSES.AGENT_JOINED ||
    state.status === HANDOFF_STATUSES.COMPLETED
  ) {
    if (state.status === HANDOFF_STATUSES.AGENT_JOINED) {
      return { ok: false, reason: 'agent_already_joined' };
    }
  }

  const from = state.status || HANDOFF_STATUSES.NOT_REQUESTED;
  if (!canTransitionHandoff(from, HANDOFF_STATUSES.CANCELLED_BY_CUSTOMER) && from !== HANDOFF_STATUSES.NOT_REQUESTED) {
    // Force cancel from offered/checking/queued/waiting even if map miss
    if (
      ![
        HANDOFF_STATUSES.OFFERED,
        HANDOFF_STATUSES.CHECKING_AVAILABILITY,
        HANDOFF_STATUSES.QUEUED,
        HANDOFF_STATUSES.WAITING_FOR_AGENT,
        HANDOFF_STATUSES.NOT_REQUESTED,
      ].includes(from)
    ) {
      return { ok: false, reason: 'invalid_transition', from };
    }
  }

  state.status = HANDOFF_STATUSES.CANCELLED_BY_CUSTOMER;
  state.cancelledAt = new Date().toISOString();
  state.activeResponder = ACTIVE_RESPONDERS.AI;
  state.assignedAgentId = null;
  state.version = (state.version || 0) + 1;
  state.lastStatusChangeAt = state.cancelledAt;
  session.handoffState = state;
  session.markModified?.('handoffState');

  // Only reset session status if a human never joined
  if (session.status === 'waiting_human' && !session.assignedAgent) {
    session.status = 'active';
    session.handoffRequestedAt = undefined;
  }

  await session.save();
  return { ok: true, state };
}

function offerHandoff(session, reason) {
  const customerFacingReason = getSafeHandoffMessage(reason);
  const state = ensureHandoffState(session);
  // Allow re-offering after cancel / unavailable / timeout
  if (
    [
      HANDOFF_STATUSES.CANCELLED_BY_CUSTOMER,
      HANDOFF_STATUSES.CANCELLED_BY_SYSTEM,
      HANDOFF_STATUSES.UNAVAILABLE,
      HANDOFF_STATUSES.OUTSIDE_BUSINESS_HOURS,
      HANDOFF_STATUSES.TIMED_OUT,
      HANDOFF_STATUSES.FAILED,
      HANDOFF_STATUSES.COMPLETED,
    ].includes(state.status)
  ) {
    state.status = HANDOFF_STATUSES.NOT_REQUESTED;
    session.handoffState = state;
  }
  setHandoffStatus(session, HANDOFF_STATUSES.OFFERED, {
    reason,
    customerFacingReason,
    requestedAt: new Date().toISOString(),
    activeResponder: ACTIVE_RESPONDERS.AI,
    cancelledAt: null,
  });
  return customerFacingReason;
}

function syncLegacyCredentialFields(session) {
  const wf = ensureWorkflowState(session);
  const fields = wf.collectedFields || {};
  if (session.pendingOrderNumber && !fields.orderNumber) {
    fields.orderNumber = session.pendingOrderNumber;
  }
  if (session.orderLookupEmail && !fields.email) {
    fields.email = session.orderLookupEmail;
  }
  if (fields.orderNumber && !session.pendingOrderNumber) {
    session.pendingOrderNumber = fields.orderNumber;
  }
  if (fields.email && !session.orderLookupEmail) {
    session.orderLookupEmail = fields.email;
  }
  wf.collectedFields = fields;
  session.workflowState = wf;
  session.markModified?.('workflowState');
}

function applyExtractedToWorkflow(session, extracted, { intent, workflow, step } = {}) {
  const wf = ensureWorkflowState(session);
  if (intent) wf.activeIntent = intent;
  if (workflow) wf.activeWorkflow = workflow;
  if (step) wf.workflowStep = step;

  wf.collectedFields = mergeCollectedFields(wf.collectedFields, {
    orderNumber: extracted.orderNumber || null,
    email: extracted.email || null,
    phone: extracted.phone || null,
    productQuery: extracted.productQuery || null,
    returnReason: extracted.returnReason || null,
    selectedLineItemId: extracted.selectedLineItemId || null,
    refundMethod: extracted.refundMethod || null,
    returnMethod: extracted.returnMethod || null,
    size: extracted.size || null,
    color: extracted.color || null,
  });

  // Mirror into legacy fields used by verifyOrderForSession
  if (wf.collectedFields.orderNumber) {
    session.pendingOrderNumber = wf.collectedFields.orderNumber;
  }
  if (wf.collectedFields.email) {
    session.orderLookupEmail = String(wf.collectedFields.email).toLowerCase();
  }

  wf.missingFields = getMissingFields(
    wf.activeWorkflow || workflow,
    wf.workflowStep || step || 'collect_identity',
    wf.collectedFields,
  );
  wf.version = (wf.version || 0) + 1;
  wf.updatedAt = new Date().toISOString();
  session.workflowState = wf;
  session.markModified?.('workflowState');
  return wf;
}

function mapIntentToWorkflow(intent) {
  switch (intent) {
    case 'order_status':
      return { workflow: 'track_order', step: 'collect_identity' };
    case 'refund':
      return { workflow: 'refund', step: 'collect_identity' };
    case 'cancel':
      return { workflow: 'cancel_order', step: 'collect_identity' };
    case 'product_search':
      return { workflow: 'product_search', step: 'understand_request' };
    case 'human_handoff':
      return { workflow: 'handoff', step: 'offered' };
    case 'policy':
      return { workflow: null, step: null };
    default:
      return { workflow: null, step: null };
  }
}

function buildHandoffWidgetPayload(session) {
  const state = ensureHandoffState(session);
  const status = state.status || HANDOFF_STATUSES.NOT_REQUESTED;
  const showSpinner = [
    HANDOFF_STATUSES.CHECKING_AVAILABILITY,
    HANDOFF_STATUSES.QUEUED,
    HANDOFF_STATUSES.WAITING_FOR_AGENT,
  ].includes(status);

  const removeStatusComponent = [
    HANDOFF_STATUSES.CANCELLED_BY_CUSTOMER,
    HANDOFF_STATUSES.CANCELLED_BY_SYSTEM,
    HANDOFF_STATUSES.NOT_REQUESTED,
    HANDOFF_STATUSES.COMPLETED,
    HANDOFF_STATUSES.OFFERED,
  ].includes(status);

  const titleSource = state.customerFacingReason || null;
  const titleParts = titleSource ? String(titleSource).split(/\n/) : [];
  const title = titleParts[0] || titleSource;
  const queueLabel =
    state.queueLabel ||
    (titleParts.length > 1 ? titleParts.slice(1).join(' ').trim() : null) ||
    null;

  return {
    id: `handoff_${session._id || 'session'}_${state.version || 0}`,
    status,
    activeResponder: state.activeResponder || ACTIVE_RESPONDERS.AI,
    version: state.version || 0,
    queuePosition: state.queuePosition ?? null,
    estimatedWaitMinutes: state.estimatedWaitMinutes ?? null,
    queueLabel,
    display: {
      title,
      queueLabel,
      showSpinner,
      removeStatusComponent,
    },
  };
}

module.exports = {
  HANDOFF_STATUSES,
  ACTIVE_RESPONDERS,
  defaultWorkflowState,
  defaultHandoffState,
  ensureWorkflowState,
  ensureHandoffState,
  mergeCollectedFields,
  getMissingFields,
  maskEmail,
  maskOrderNumber,
  getSafeHandoffMessage,
  canTransitionHandoff,
  setHandoffStatus,
  isHandoffPending,
  wantsCancelHandoff,
  wantsAcceptHandoff,
  cancelHandoffByCustomer,
  offerHandoff,
  syncLegacyCredentialFields,
  applyExtractedToWorkflow,
  mapIntentToWorkflow,
  buildHandoffWidgetPayload,
};
