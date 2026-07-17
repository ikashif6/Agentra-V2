/**
 * Explicit turn routing — global commands and new intents beat active workflow.
 */

const { ensureWorkflowState } = require('./live-chat-workflow.service');
const { mapIntentToWorkflowName } = require('./live-chat-workflow-engine.service');

const ORCHESTRATOR_BUILD = '2026-07-16-01';

const PRODUCT_PREF_FIELDS = new Set([
  'occasion',
  'size',
  'color',
  'budget',
  'budgetMax',
  'budgetMin',
  'productQuery',
  'category',
]);

/**
 * High-priority deterministic intent from customer text.
 * Returns { intent, confidence } or null.
 */
function matchDeterministicIntent(text) {
  const lower = String(text || '')
    .toLowerCase()
    .trim();
  if (!lower) return null;

  if (
    /connect me with an agent|connect me to an agent|talk to (a )?support|speak to (a )?support|human agent|real person|representative|customer service|talk to (an? )?(human|agent|person)|speak (to|with) (an? )?(human|agent|person)/i.test(
      lower,
    )
  ) {
    return { intent: 'speak_to_human', confidence: 0.99 };
  }

  if (
    /where can i leave (my )?contact|leave (my )?(contact details|details)|leave my (email|phone)|contact me later|how (do|can) i leave contact/i.test(
      lower,
    )
  ) {
    return { intent: 'start_contact_request', confidence: 0.99 };
  }

  if (
    /haven'?t received (the )?(payment|refund|money)|did not receive (the )?(payment|refund|money)|refund not received|where is my refund|money not received|payment (has )?not (been )?received|still waiting (for|on) (my )?(refund|payment|money)/i.test(
      lower,
    )
  ) {
    return { intent: 'refund_not_received', confidence: 0.99 };
  }

  if (
    /\bi need a refund\b|refund my order|want (a |my )?refund|give me a refund|request(ing)? a refund/i.test(
      lower,
    )
  ) {
    return { intent: 'refund_request', confidence: 0.99 };
  }

  if (
    /track my order|where is my order|order status|shipment status|where is my package|where'?s my (order|package)/i.test(
      lower,
    )
  ) {
    return { intent: 'track_order', confidence: 0.99 };
  }

  if (
    /recommend me (a )?product|show me products|find me a (dress|gown|product)|product recommendation|looking for (a )?(dress|gown|product)/i.test(
      lower,
    )
  ) {
    return { intent: 'product_search', confidence: 0.95 };
  }

  if (/\bstart (a )?return\b|i (want to|need to) return\b/i.test(lower)) {
    return { intent: 'start_return', confidence: 0.95 };
  }

  return null;
}

/**
 * Does this message plausibly answer the expected field(s)?
 * Strong new intents are never treated as field answers.
 */
function isPlausibleFieldResponse(message, expectedFields) {
  const fields = Array.isArray(expectedFields) ? expectedFields.filter(Boolean) : [];
  if (!fields.length) return true;

  const text = String(message || '').trim();
  if (!text) return false;

  if (matchDeterministicIntent(text)) return false;

  const lower = text.toLowerCase();

  for (const field of fields) {
    if (field === 'email' && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) return true;
    if (field === 'orderNumber' && /#?\d{3,}|\b[A-Z]{1,4}-\d+\b/i.test(text)) return true;
    if (field === 'phone' && /\+?\d[\d\s()-]{7,}\d/.test(text)) return true;
    if (field === 'size' && /\b(xxs|xs|s|m|l|xl|xxl|xxx[l]?|\d{1,2})\b/i.test(text)) return true;
    if (
      field === 'color' &&
      /\b(black|white|red|blue|green|ivory|gold|silver|pink|beige|navy|cream|champagne|blush)\b/i.test(
        text,
      )
    ) {
      return true;
    }
    if (
      (field === 'budget' || field === 'budgetMax' || field === 'budgetMin') &&
      (/\$?\d{2,}/.test(text) || /\b(under|budget|around)\b/i.test(text))
    ) {
      return true;
    }
    if (field === 'returnReason' && text.length >= 3 && !/\b(track|agent|refund|product)\b/i.test(lower)) {
      return true;
    }
    if (PRODUCT_PREF_FIELDS.has(field)) {
      // Product prefs must look like preferences, not a new support intent
      if (
        /\b(wedding|prom|party|formal|casual|cocktail|bride|bridesmaid|size|color|budget|under \$)\b/i.test(
          lower,
        ) ||
        (text.length <= 40 &&
          !/\b(refund|order|track|agent|payment|return|contact)\b/i.test(lower))
      ) {
        return true;
      }
    }
  }

  return false;
}

function intentToRoute(intent) {
  switch (intent) {
    case 'speak_to_human':
      return {
        routeType: 'switch_workflow',
        intent: 'speak_to_human',
        workflow: 'handoff',
        reason: 'explicit_global_command',
      };
    case 'start_contact_request':
      return {
        routeType: 'switch_workflow',
        intent: 'start_contact_request',
        workflow: 'contact_request',
        reason: 'explicit_global_command',
      };
    case 'refund_not_received':
      return {
        routeType: 'switch_workflow',
        intent: 'refund_not_received',
        workflow: 'refund_investigation',
        reason: 'explicit_new_intent',
      };
    case 'refund_request':
    case 'refund_status':
      return {
        routeType: 'switch_workflow',
        intent: intent === 'refund_status' ? 'refund_request' : intent,
        workflow: 'refund',
        reason: 'explicit_new_intent',
      };
    case 'track_order':
    case 'order_status':
      return {
        routeType: 'switch_workflow',
        intent: 'track_order',
        workflow: 'track_order',
        reason: 'explicit_new_intent',
      };
    case 'product_search':
    case 'product_recommendation':
    case 'product_comparison':
    case 'product_availability':
    case 'size_help':
      return {
        routeType: 'switch_workflow',
        intent: 'product_search',
        workflow: 'product_search',
        reason: 'explicit_new_intent',
      };
    case 'start_return':
    case 'damaged_item':
    case 'wrong_item':
    case 'missing_item':
      return {
        routeType: 'switch_workflow',
        intent: 'start_return',
        workflow: 'return_request',
        reason: 'explicit_new_intent',
      };
    case 'exchange_item':
      return {
        routeType: 'switch_workflow',
        intent: 'exchange_item',
        workflow: 'exchange_item',
        reason: 'explicit_new_intent',
      };
    default:
      return null;
  }
}

/**
 * Resolve how this turn should be handled.
 */
function resolveTurnRoute({
  latestMessage,
  detectedIntent,
  confidence = 0,
  activeWorkflow = null,
  expectedFields = [],
  pendingAction = null,
} = {}) {
  const det = matchDeterministicIntent(latestMessage);
  const intent = det?.intent || detectedIntent || 'unknown';
  const conf = det?.confidence ?? confidence ?? 0;

  if (pendingAction && /^(yes|confirm|ok|okay|proceed)\b/i.test(String(latestMessage || '').trim())) {
    return {
      routeType: 'pending_confirmation',
      intent,
      workflow: activeWorkflow,
      reason: 'pending_confirmation_response',
    };
  }

  // 1–2. Explicit global / new intent from deterministic match always wins
  if (det) {
    const routed = intentToRoute(det.intent);
    if (routed) {
      if (activeWorkflow && routed.workflow === activeWorkflow) {
        return { ...routed, routeType: 'continue_workflow', reason: 'same_workflow_explicit' };
      }
      return routed;
    }
  }

  // 3–5. Active workflow only continues if message plausibly answers expected fields
  if (activeWorkflow && expectedFields?.length) {
    if (isPlausibleFieldResponse(latestMessage, expectedFields)) {
      return {
        routeType: 'continue_workflow',
        intent: detectedIntent || intent,
        workflow: activeWorkflow,
        reason: 'plausible_field_response',
      };
    }
  }

  // Strong LLM/heuristic intent that maps to a different workflow
  const routed = intentToRoute(intent);
  if (routed) {
    if (activeWorkflow && routed.workflow === activeWorkflow) {
      return { ...routed, routeType: 'continue_workflow', reason: 'same_workflow_intent' };
    }
    if (!activeWorkflow || conf >= 0.55 || det) {
      return routed;
    }
  }

  const mapped = mapIntentToWorkflowName(intent);
  if (mapped && (!activeWorkflow || mapped !== activeWorkflow) && conf >= 0.7) {
    return {
      routeType: activeWorkflow ? 'switch_workflow' : 'start_workflow',
      intent,
      workflow: mapped,
      reason: 'explicit_new_intent',
    };
  }

  if (activeWorkflow) {
    // No expected fields (or empty) — only continue if intent still aligns
    if (!expectedFields?.length) {
      const activeMapped = mapIntentToWorkflowName(detectedIntent);
      if (routed && routed.workflow !== activeWorkflow) {
        return routed;
      }
      if (activeMapped && activeMapped !== activeWorkflow && conf >= 0.7) {
        return {
          routeType: 'switch_workflow',
          intent: detectedIntent,
          workflow: activeMapped,
          reason: 'explicit_new_intent',
        };
      }
    }
    return {
      routeType: 'continue_workflow',
      intent,
      workflow: activeWorkflow,
      reason: 'active_workflow_continuation',
    };
  }

  if (mapped) {
    return {
      routeType: 'start_workflow',
      intent,
      workflow: mapped,
      reason: 'new_intent',
    };
  }

  return {
    routeType: 'fallback',
    intent,
    workflow: null,
    reason: 'unhandled',
  };
}

/**
 * Switch active workflow; archive previous; keep verified identity fields.
 */
function switchWorkflow(session, { workflow, intent, reason } = {}) {
  const wf = ensureWorkflowState(session);
  if (wf.activeWorkflow && wf.activeWorkflow !== workflow) {
    wf.previousWorkflow = wf.activeWorkflow;
    const hist = Array.isArray(wf.workflowHistory) ? wf.workflowHistory : [];
    hist.push({
      workflow: wf.activeWorkflow,
      step: wf.workflowStep,
      intent: wf.activeIntent,
      at: new Date().toISOString(),
      reason: reason || 'switch',
    });
    wf.workflowHistory = hist.slice(-12);
  }

  wf.activeWorkflow = workflow || null;
  wf.activeIntent = intent || wf.activeIntent;
  wf.workflowStep = null;
  wf.missingFields = [];
  wf.recentlyRequestedFields = [];
  // Drop stale product query when leaving product search so it cannot poison later turns
  if (workflow !== 'product_search' && wf.collectedFields) {
    wf.collectedFields.productQuery = null;
  }
  wf.lastResponsePlan = null;
  wf.version = (wf.version || 0) + 1;
  wf.updatedAt = new Date().toISOString();
  session.workflowState = wf;
  session.markModified?.('workflowState');
  return wf;
}

function maskSensitive(text) {
  return String(text || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (m) => {
      const at = m.indexOf('@');
      return `${m[0]}***${m.slice(at)}`;
    })
    .replace(/\+?\d[\d\s()-]{8,}\d/g, '***phone***');
}

function buildTurnDebug(partial) {
  return {
    requestId: partial.requestId || null,
    conversationId: partial.conversationId || null,
    sessionId: partial.sessionId || null,
    workspaceId: partial.workspaceId || null,
    rawMessage: maskSensitive(partial.rawMessage),
    normalizedMessage: maskSensitive(partial.normalizedMessage),
    endpoint: partial.endpoint || 'POST /api/v1/widget/session/message',
    controller: partial.controller || 'widget.controller.sendMessage',
    servicePath: partial.servicePath || [],
    orchestratorCalled: Boolean(partial.orchestratorCalled),
    orchestratorVersion: ORCHESTRATOR_BUILD,
    understandingResult: partial.understandingResult || {},
    deterministicIntent: partial.deterministicIntent || null,
    llmIntent: partial.llmIntent || null,
    resolvedIntent: partial.resolvedIntent || null,
    previousWorkflow: partial.previousWorkflow || null,
    previousStep: partial.previousStep || null,
    newWorkflow: partial.newWorkflow || null,
    newStep: partial.newStep || null,
    routeType: partial.routeType || null,
    routeReason: partial.routeReason || null,
    handled: Boolean(partial.handled),
    legacyGroqCalled: Boolean(partial.legacyGroqCalled),
    responsePlanType: partial.responsePlanType || null,
    componentsReturned: partial.componentsReturned || [],
    handoffState: partial.handoffState || {},
    contactRequestCreated: Boolean(partial.contactRequestCreated),
    widgetBuild: partial.widgetBuild || null,
    orchestratorBuild: ORCHESTRATOR_BUILD,
  };
}

function logTurnDebug(debug) {
  try {
    console.info('[live-chat-turn]', JSON.stringify(debug));
  } catch {
    console.info('[live-chat-turn]', debug);
  }
}

module.exports = {
  ORCHESTRATOR_BUILD,
  matchDeterministicIntent,
  isPlausibleFieldResponse,
  resolveTurnRoute,
  switchWorkflow,
  intentToRoute,
  maskSensitive,
  buildTurnDebug,
  logTurnDebug,
};
