/**
 * Conversation state schema v2 — goals, verified vs collected, invalidation.
 */

const SCHEMA_VERSION = 2;

function emptyProductPreferences() {
  return {
    productQuery: null,
    category: null,
    occasion: null,
    size: null,
    color: null,
    style: null,
    material: null,
    budgetMin: null,
    budgetMax: null,
    deliveryDeadline: null,
  };
}

function defaultConversationState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    currentGoal: null,
    previousGoal: null,
    unresolvedIssues: [],
    verifiedContext: {
      customerId: null,
      email: null,
      orderNumber: null,
      orderId: null,
    },
    collectedContext: {
      orderNumber: null,
      email: null,
      phone: null,
      returnReason: null,
      contactMethod: null,
      preferredContactTime: null,
      productPreferences: emptyProductPreferences(),
      contactEmailExplicit: false,
      contactPhoneExplicit: false,
      consentToContact: false,
    },
    activeWorkflow: null,
    workflowStep: null,
    expectedFields: [],
    pendingActionId: null,
    pendingActionToken: null,
    handoffState: null,
    lastResponsePlan: null,
    lastToolResults: {},
    lastComponentIds: [],
    conversationVersion: 0,
    updatedAt: new Date().toISOString(),
  };
}

function ensureConversationState(session) {
  const wf = session.workflowState && typeof session.workflowState === 'object'
    ? session.workflowState
    : {};

  if (wf.schemaVersion === SCHEMA_VERSION && wf.collectedContext) {
    // Backfill any fields missing from a previously-persisted v2 state so
    // handlers can safely assign nested keys (e.g. lastToolResults.order_lookup).
    const defaults = defaultConversationState();
    if (!wf.lastToolResults || typeof wf.lastToolResults !== 'object') wf.lastToolResults = {};
    if (!Array.isArray(wf.lastComponentIds)) wf.lastComponentIds = [];
    if (!wf.verifiedContext || typeof wf.verifiedContext !== 'object') {
      wf.verifiedContext = defaults.verifiedContext;
    }
    if (!wf.collectedContext.productPreferences) {
      wf.collectedContext.productPreferences = emptyProductPreferences();
    }
    if (!Array.isArray(wf.unresolvedIssues)) wf.unresolvedIssues = [];
    if (!Array.isArray(wf.expectedFields)) wf.expectedFields = [];
    session.workflowState = wf;
    session.markModified?.('workflowState');
    return wf;
  }

  // Migrate legacy Mixed workflowState into v2
  const next = defaultConversationState();
  next.activeWorkflow = wf.activeWorkflow || null;
  next.workflowStep = wf.workflowStep || null;
  next.expectedFields = Array.isArray(wf.missingFields) ? wf.missingFields : [];
  next.pendingActionId = wf.pendingActionId || null;
  next.pendingActionToken = wf.pendingActionToken || null;
  next.lastResponsePlan = wf.lastResponsePlan || null;
  next.conversationVersion = Number(wf.version || 0);

  const collected = wf.collectedFields || {};
  next.collectedContext.orderNumber = collected.orderNumber || session.pendingOrderNumber || null;
  next.collectedContext.email = collected.email || session.orderLookupEmail || null;
  next.collectedContext.phone = collected.phone || null;
  next.collectedContext.returnReason = collected.returnReason || null;
  next.collectedContext.contactMethod = collected.contactMethod || null;
  next.collectedContext.contactEmailExplicit = Boolean(collected.contactEmailExplicit);
  next.collectedContext.contactPhoneExplicit = Boolean(collected.contactPhoneExplicit);
  next.collectedContext.productPreferences = {
    ...emptyProductPreferences(),
    productQuery: collected.productQuery || null,
    size: collected.size || null,
    color: collected.color || null,
  };

  if (wf.verifiedFields?.emailOwnership && next.collectedContext.email) {
    next.verifiedContext.email = next.collectedContext.email;
  }
  if (wf.verifiedFields?.order && next.collectedContext.orderNumber) {
    next.verifiedContext.orderNumber = next.collectedContext.orderNumber;
  }
  if (wf.activeIntent) {
    next.currentGoal = {
      intent: wf.activeIntent,
      description: wf.activeIntent,
      startedAt: wf.updatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  session.workflowState = next;
  session.markModified?.('workflowState');
  return next;
}

function bumpVersion(state) {
  state.conversationVersion = (state.conversationVersion || 0) + 1;
  state.updatedAt = new Date().toISOString();
  return state;
}

function setCurrentGoal(state, intent, description) {
  if (state.currentGoal?.intent && state.currentGoal.intent !== intent) {
    state.previousGoal = state.currentGoal;
  }
  state.currentGoal = {
    intent,
    description: description || intent,
    startedAt: state.currentGoal?.intent === intent
      ? state.currentGoal.startedAt
      : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return bumpVersion(state);
}

function switchWorkflow(state, { workflow, step = null, expectedFields = [], reason } = {}) {
  if (state.activeWorkflow && state.activeWorkflow !== workflow) {
    state.previousWorkflow = state.activeWorkflow;
    const hist = Array.isArray(state.workflowHistory) ? state.workflowHistory : [];
    hist.push({
      workflow: state.activeWorkflow,
      step: state.workflowStep,
      at: new Date().toISOString(),
      reason: reason || 'switch',
    });
    state.workflowHistory = hist.slice(-12);
  }
  state.activeWorkflow = workflow || null;
  state.workflowStep = step;
  state.expectedFields = expectedFields || [];
  state.lastResponsePlan = null;
  return bumpVersion(state);
}

function mergeEntities(state, entities = {}, { isCorrection = false } = {}) {
  const c = state.collectedContext;
  const prefs = c.productPreferences || emptyProductPreferences();

  const assign = (target, key, value) => {
    if (value == null || value === '') return;
    if (isCorrection || !target[key]) {
      target[key] = value;
      return;
    }
    if (String(target[key]).toLowerCase() !== String(value).toLowerCase()) {
      target[key] = value;
    }
  };

  assign(c, 'orderNumber', entities.orderNumber);
  assign(c, 'email', entities.email ? String(entities.email).toLowerCase() : null);
  assign(c, 'phone', entities.phone);
  assign(c, 'returnReason', entities.returnReason);
  assign(c, 'contactMethod', entities.contactMethod);
  assign(c, 'preferredContactTime', entities.preferredContactTime);

  [
    'productQuery',
    'category',
    'occasion',
    'size',
    'color',
    'style',
    'material',
    'budgetMin',
    'budgetMax',
    'deliveryDeadline',
  ].forEach((k) => assign(prefs, k, entities[k]));

  c.productPreferences = prefs;

  // Mirror legacy fields used by verifyOrderForSession
  return bumpVersion(state);
}

function applyCorrections(state, corrections = {}) {
  const changed = [];
  Object.entries(corrections || {}).forEach(([key, value]) => {
    if (value == null || value === '') return;
    if (key === 'productPreferences' && typeof value === 'object') {
      state.collectedContext.productPreferences = {
        ...state.collectedContext.productPreferences,
        ...value,
      };
      changed.push('productPreferences');
      invalidateToolResults(state, ['product_search']);
      return;
    }
    if (['orderNumber', 'email', 'phone'].includes(key)) {
      state.collectedContext[key] = key === 'email' ? String(value).toLowerCase() : value;
      if (key === 'orderNumber' || key === 'email') {
        // Order identity changed — drop verification + caches
        if (key === 'orderNumber') state.verifiedContext.orderNumber = null;
        if (key === 'email') state.verifiedContext.email = null;
        state.verifiedContext.orderId = null;
        invalidateToolResults(state, ['order_lookup', 'tracking', 'refund']);
        state.lastComponentIds = (state.lastComponentIds || []).filter(
          (id) => !String(id).startsWith('order-card:'),
        );
      }
      changed.push(key);
    }
  });
  if (changed.length) bumpVersion(state);
  return changed;
}

function invalidateToolResults(state, keys = []) {
  const next = { ...(state.lastToolResults || {}) };
  if (!keys.length) {
    state.lastToolResults = {};
  } else {
    keys.forEach((k) => {
      delete next[k];
    });
    state.lastToolResults = next;
  }
  state.lastResponsePlan = null;
  return state;
}

function syncLegacyMirrors(session, state) {
  if (state.collectedContext.orderNumber) {
    session.pendingOrderNumber = state.collectedContext.orderNumber;
  }
  if (state.collectedContext.email) {
    session.orderLookupEmail = String(state.collectedContext.email).toLowerCase();
  }
  // Keep legacy collectedFields in sync for older helpers
  session.workflowState = state;
  session.workflowState.collectedFields = {
    orderNumber: state.collectedContext.orderNumber,
    email: state.collectedContext.email,
    phone: state.collectedContext.phone,
    returnReason: state.collectedContext.returnReason,
    productQuery: state.collectedContext.productPreferences?.productQuery,
    size: state.collectedContext.productPreferences?.size,
    color: state.collectedContext.productPreferences?.color,
    contactMethod: state.collectedContext.contactMethod,
    contactEmailExplicit: state.collectedContext.contactEmailExplicit,
    contactPhoneExplicit: state.collectedContext.contactPhoneExplicit,
  };
  session.workflowState.activeWorkflow = state.activeWorkflow;
  session.workflowState.workflowStep = state.workflowStep;
  session.workflowState.activeIntent = state.currentGoal?.intent || null;
  session.workflowState.version = state.conversationVersion;
  session.markModified?.('workflowState');
}

function fingerprint(parts) {
  return parts.filter((p) => p != null && p !== '').map(String).join('|');
}

module.exports = {
  SCHEMA_VERSION,
  defaultConversationState,
  emptyProductPreferences,
  ensureConversationState,
  bumpVersion,
  setCurrentGoal,
  switchWorkflow,
  mergeEntities,
  applyCorrections,
  invalidateToolResults,
  syncLegacyMirrors,
  fingerprint,
};
