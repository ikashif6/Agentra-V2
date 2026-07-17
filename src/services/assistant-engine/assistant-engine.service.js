/**
 * Config-aware assistant engine — sole processTurn orchestrator for v3.
 * Preserves ChatSession/Ticket/widget contracts via existing persistence helpers.
 */

const crypto = require('crypto');
const { loadRuntimeConfig } = require('./assistant-runtime-config.service');
const { assembleTurnContext } = require('./assistant-context.service');
const { understandTurn } = require('./assistant-understanding.service');
const { routeTools } = require('./assistant-tool-router.service');
const {
  resolveAuthority,
  profileOwnerInstructions,
} = require('./assistant-authority.service');
const {
  buildGroundedPlan,
  buildPermissionDeniedPlan,
} = require('./assistant-response-plan.service');
const { generateFromPlan } = require('./assistant-response-generator.service');
const {
  recordInstructionConflicts,
  recordTurnAudit,
} = require('./assistant-conflict-audit.service');
const {
  processConversationTurn,
  resolveRoute,
  PIPELINE_BUILD: V2_BUILD,
} = require('../live-chat-conversation.service');
const {
  ensureConversationState,
  mergeEntities,
  applyCorrections,
  setCurrentGoal,
  syncLegacyMirrors,
} = require('../live-chat-conversation-state.service');
const {
  ensureHandoffState,
  buildHandoffWidgetPayload,
} = require('../live-chat-workflow.service');
const { appendSessionMessage } = require('../live-chat-session.service');
const { getSupportAvailability } = require('../live-chat-hours.service');
const { retrieveKnowledge } = require('../live-chat-knowledge.service');

const PIPELINE_BUILD = '2026-07-17-assistant-engine-v3';

function baseResult(session, messages, extra = {}) {
  return {
    handled: true,
    messages,
    handoff: Boolean(extra.handoff),
    handoffState: buildHandoffWidgetPayload(session),
    orchestratorBuild: PIPELINE_BUILD,
    ...extra,
  };
}

async function emitPlan(session, runtime, plan) {
  const rendered = await generateFromPlan(plan, {
    agentName: runtime.agentName,
    styleGuidance: plan.ownerInstructions || runtime.combinedBehavioralGuidance,
  });

  let contentType = 'text';
  let payload;
  const component = (plan.components || [])[0];
  if (component?.type === 'order_card') {
    contentType = 'order_card';
    payload = component.order;
  } else if (component?.type === 'product_cards') {
    contentType = 'product_cards';
    payload = { products: component.products };
  } else if (component?.type === 'input_form') {
    contentType = 'input_form';
    payload = component.form || component;
  }

  const msg = await appendSessionMessage(session, {
    role: 'bot',
    body: rendered.text,
    contentType,
    payload,
    senderName: runtime.agentName,
  });
  if (rendered.quickReplies?.length) msg._quickReplies = rendered.quickReplies;
  return msg;
}

/**
 * Resolve which engine mode to use for this workspace.
 * Workspace selector overrides global env; global kill switch forces v2.
 */
function resolveEngineMode(company) {
  const kill = String(process.env.AI_ASSISTANT_V3_KILL_SWITCH || '').toLowerCase();
  if (kill === '1' || kill === 'true') return 'v2';

  const fromCompany = String(company?.aiAgent?.assistantEngine || '').toLowerCase();
  if (fromCompany === 'v3' || fromCompany === 'shadow' || fromCompany === 'v2' || fromCompany === 'v1') {
    return fromCompany;
  }

  const global = String(process.env.AI_CONVERSATION_PIPELINE || 'v2').toLowerCase();
  if (global === 'v3' || global === 'shadow' || global === 'v2' || global === 'v1') return global;
  return 'v2';
}

/**
 * Shadow analysis: understanding/plan/audit only — no duplicate tools or bot writes.
 */
async function runShadowAnalysis({
  company,
  session,
  message,
  widgetAction,
  runtime,
  requestId,
}) {
  const state = ensureConversationState(session);
  const turnContext = assembleTurnContext({ session, conversationState: state });
  const understanding = await understandTurn({
    message,
    turnContext,
    runtimeConfig: runtime,
  });

  let forcedRoute = null;
  if (widgetAction === 'start_contact_request' || widgetAction === 'use_email' || widgetAction === 'use_phone') {
    forcedRoute = { route: 'contact_request', intent: 'leave_contact_details', reason: 'widget_action' };
  }
  if (widgetAction === 'handoff') {
    forcedRoute = { route: 'handoff', intent: 'contact_support', reason: 'widget_action' };
  }

  const route = forcedRoute || resolveRoute(understanding, state);
  const toolRouting = routeTools({
    route,
    runtimeConfig: runtime,
    turnContext,
    understanding,
  });
  const conflicts = profileOwnerInstructions(runtime);
  const authority = resolveAuthority({
    runtimeConfig: runtime,
    conversationContext: turnContext,
    collectedUnverified: turnContext.collected,
    latestMessage: message,
    summary: turnContext.summary,
  });

  await recordInstructionConflicts({
    companyId: company._id,
    channel: runtime.channel,
    configVersion: runtime.assistantConfigVersion,
    conflicts,
    requestId,
    conversationId: session.ticket ? String(session.ticket) : null,
    sessionId: String(session._id),
  });

  return {
    shadow: true,
    handled: false,
    understanding,
    route,
    toolRouting,
    conflicts,
    authority,
    turnDebug: {
      requestId,
      pipelineBuild: PIPELINE_BUILD,
      mode: 'shadow',
      assistantConfigVersion: runtime.assistantConfigVersion,
      primaryIntent: understanding.primaryIntent,
      route: route.route,
      permissionDecision: toolRouting.permission,
      conflictCount: conflicts.length,
      v2Build: V2_BUILD,
    },
  };
}

/**
 * Authoritative v3 turn.
 */
async function processTurn({
  workspace: company,
  channel = 'liveChat',
  session,
  message,
  widgetAction = null,
  onStatus = null,
  mode = null,
} = {}) {
  const requestId = crypto.randomBytes(8).toString('hex');
  const started = Date.now();
  const runtime = loadRuntimeConfig(company, channel, { bypassCache: true });
  const engineMode = mode || resolveEngineMode(company);

  ensureHandoffState(session);
  const state = ensureConversationState(session);

  if (engineMode === 'shadow') {
    return runShadowAnalysis({
      company,
      session,
      message,
      widgetAction,
      runtime,
      requestId,
    });
  }

  const turnContext = assembleTurnContext({ session, conversationState: state });
  const conflicts = profileOwnerInstructions(runtime);
  await recordInstructionConflicts({
    companyId: company._id,
    channel: runtime.channel,
    configVersion: runtime.assistantConfigVersion,
    conflicts,
    requestId,
    conversationId: session.ticket ? String(session.ticket) : null,
    sessionId: String(session._id),
  });

  const understanding = await understandTurn({
    message,
    turnContext,
    runtimeConfig: runtime,
  });

  mergeEntities(state, understanding.entities, { isCorrection: understanding.isCorrection });
  if (understanding.isCorrection || understanding.turnType === 'correction') {
    applyCorrections(state, {
      ...understanding.corrections,
      orderNumber: understanding.entities.orderNumber,
      email: understanding.entities.email,
      phone: understanding.entities.phone,
      productPreferences: {
        size: understanding.entities.size,
        color: understanding.entities.color,
        occasion: understanding.entities.occasion,
        budgetMax: understanding.entities.budgetMax,
      },
    });
  }

  let forcedRoute = null;
  if (widgetAction === 'start_contact_request' || widgetAction === 'use_email' || widgetAction === 'use_phone') {
    forcedRoute = { route: 'contact_request', intent: 'leave_contact_details', reason: 'widget_action' };
  }
  if (widgetAction === 'handoff') {
    forcedRoute = { route: 'handoff', intent: 'contact_support', reason: 'widget_action' };
  }

  const route = forcedRoute || resolveRoute(understanding, state);
  if (!['correction', 'rejection', 'clarification', 'confirmation'].includes(route.route)) {
    setCurrentGoal(state, route.intent || understanding.primaryIntent, understanding.customerGoal);
  }

  const toolRouting = routeTools({
    route,
    runtimeConfig: runtime,
    turnContext: assembleTurnContext({ session, conversationState: state }),
    understanding,
  });

  let knowledgeFacts = [];
  if (toolRouting.tools.includes('knowledge_retrieve') || route.route === 'policy') {
    try {
      const hits = await retrieveKnowledge(company._id, String(message || ''), 4);
      knowledgeFacts = (hits || []).map((h) => ({
        title: h.title,
        excerpt: String(h.content || '').slice(0, 400),
      }));
    } catch {
      knowledgeFacts = [];
    }
  }

  const availability =
    route.route === 'handoff' ? await getSupportAvailability(company) : null;

  const authority = resolveAuthority({
    runtimeConfig: runtime,
    verifiedFacts: state.verifiedContext || {},
    knowledgeFacts,
    conversationContext: assembleTurnContext({ session, conversationState: state }),
    collectedUnverified: state.collectedContext || {},
    latestMessage: message,
    summary: state.conversationSummary || null,
    availability,
  });

  // Capability unavailable: keep semantic intent, do not invoke tools
  if (
    toolRouting.skipToolExecution &&
    toolRouting.permission?.decision === 'unavailable_manual_review'
  ) {
    const plan = buildPermissionDeniedPlan({
      permission: toolRouting.permission,
      authority,
      customerGoal: understanding.customerGoal,
    });
    syncLegacyMirrors(session, state);
    const msg = await emitPlan(session, runtime, plan);
    await session.save();
    await recordTurnAudit({
      companyId: company._id,
      channel: runtime.channel,
      configVersion: runtime.assistantConfigVersion,
      requestId,
      conversationId: session.ticket ? String(session.ticket) : null,
      sessionId: String(session._id),
      route: route.route,
      tools: [],
      permissionDecision: toolRouting.permission,
      outcome: 'capability_unavailable',
      meta: { primaryIntent: understanding.primaryIntent },
    });
    return baseResult(session, [msg], {
      responsePlanType: 'capability_unavailable',
      understanding,
      turnDebug: {
        requestId,
        pipelineBuild: PIPELINE_BUILD,
        mode: 'v3',
        assistantConfigVersion: runtime.assistantConfigVersion,
        route: route.route,
        permissionDecision: toolRouting.permission,
        conflictCount: conflicts.length,
        durationMs: Date.now() - started,
      },
    });
  }

  // Delegate tool execution + workflow handlers to proven v2 path with v3 overlays
  if (onStatus) onStatus('retrieving');
  const turned = await processConversationTurn({
    company,
    session,
    latestMessage: message,
    widgetAction,
    onStatus,
    runtimeConfig: runtime,
    authority,
    precomputedUnderstanding: understanding,
    precomputedRoute: route,
    engineBuild: PIPELINE_BUILD,
  });

  await recordTurnAudit({
    companyId: company._id,
    channel: runtime.channel,
    configVersion: runtime.assistantConfigVersion,
    requestId,
    conversationId: session.ticket ? String(session.ticket) : null,
    sessionId: String(session._id),
    route: route.route,
    tools: toolRouting.tools,
    permissionDecision: toolRouting.permission,
    modelVersions: {
      understanding: process.env.GROQ_UNDERSTANDING_MODEL || null,
      response: process.env.GROQ_RESPONSE_MODEL || null,
    },
    outcome: turned?.forceHandoff ? 'force_handoff' : turned?.handled ? 'ok' : 'unhandled',
    meta: {
      primaryIntent: understanding.primaryIntent,
      responsePlanType: turned?.responsePlanType || turned?.turnDebug?.responsePlanType,
      conflictCount: conflicts.length,
    },
  });

  return {
    ...turned,
    understanding,
    orchestratorBuild: PIPELINE_BUILD,
    turnDebug: {
      ...(turned?.turnDebug || {}),
      requestId,
      pipelineBuild: PIPELINE_BUILD,
      mode: 'v3',
      assistantConfigVersion: runtime.assistantConfigVersion,
      permissionDecision: toolRouting.permission,
      conflictCount: conflicts.length,
      tools: toolRouting.tools,
      durationMs: Date.now() - started,
    },
  };
}

module.exports = {
  PIPELINE_BUILD,
  processTurn,
  resolveEngineMode,
  runShadowAnalysis,
  buildGroundedPlan,
};
