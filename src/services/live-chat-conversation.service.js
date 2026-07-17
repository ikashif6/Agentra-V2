/**
 * Authoritative conversation turn pipeline.
 * One understanding → one route → one response. No legacy fallthrough.
 */

const crypto = require('crypto');
const {
  understandCustomerMessage,
} = require('./live-chat-understanding.service');
const {
  ensureConversationState,
  setCurrentGoal,
  switchWorkflow,
  mergeEntities,
  applyCorrections,
  invalidateToolResults,
  syncLegacyMirrors,
  fingerprint,
} = require('./live-chat-conversation-state.service');
const {
  ensureHandoffState,
  buildHandoffWidgetPayload,
  HANDOFF_STATUSES,
  cancelHandoffByCustomer,
} = require('./live-chat-workflow.service');
const {
  appendSessionMessage,
  verifyOrderForSession,
} = require('./live-chat-session.service');
const {
  formatOrderCard,
  formatProductCards,
  searchProducts,
  buildOrderLookupForm,
} = require('./live-chat-tools.service');
const { moneyObject } = require('./live-chat-money.service');
const { planResponse, renderFromPlan } = require('./live-chat-response-plan.service');
const { getSupportAvailability, formatNextOpeningForCustomer } = require('./live-chat-hours.service');
const { groqChat, isGroqConfigured } = require('./groq.service');
const { retrieveKnowledge } = require('./live-chat-knowledge.service');
const { mergeLiveChatConfig } = require('./live-chat-config.service');
const { resolveChannelAiConfig } = require('./ai-agent-config.service');
const ContactRequest = require('../models/ContactRequest');

const PIPELINE_BUILD = '2026-07-16-conv-v2';

function recentTurns(session, limit = 10) {
  const msgs = Array.isArray(session.messages) ? session.messages : [];
  return msgs.slice(-limit).map((m) => ({
    role: m.role === 'bot' ? 'assistant' : m.role,
    body: m.body || '',
  }));
}

function lastAssistantMessage(session) {
  const msgs = Array.isArray(session.messages) ? session.messages : [];
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    if (msgs[i].role === 'bot' || msgs[i].role === 'assistant') return msgs[i].body || '';
  }
  return '';
}

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

function componentSemanticId(component) {
  if (!component || !component.type) return null;
  if (component.type === 'order_card') {
    const n = component.order?.orderNumber || component.order?.externalId || 'unknown';
    return `order-card:${n}`;
  }
  if (component.type === 'product_cards') {
    const ids = (component.products || []).map((p) => p.id || p.handle || p.title).join(',');
    return `product-search:${fingerprint([ids])}`;
  }
  if (component.type === 'input_form') {
    return `input-form:${component.form?.formId || 'generic'}`;
  }
  return `${component.type}:once`;
}

async function emit(session, config, plan) {
  const state = session.workflowState;
  const rendered = await renderFromPlan(plan, {
    groqChat,
    isGroqConfigured: isGroqConfigured(),
    agentName: config.content.agentName,
  });

  // Drop components already shown this conversation unless data fingerprint changed
  const priorIds = new Set(state?.lastComponentIds || []);
  const freshComponents = [];
  for (const component of plan.components || []) {
    const id = componentSemanticId(component);
    if (id && priorIds.has(id) && plan.responseType !== 'product_results') {
      continue;
    }
    freshComponents.push(component);
    if (id && state) {
      const next = Array.isArray(state.lastComponentIds) ? state.lastComponentIds : [];
      next.push(id);
      state.lastComponentIds = next.slice(-20);
    }
  }
  plan.components = freshComponents;

  if (state) {
    state.lastResponsePlan = {
      responseType: plan.responseType,
      messageGoal: plan.messageGoal,
      allowedFacts: plan.allowedFacts || {},
      forbiddenClaims: plan.forbiddenClaims || [],
      componentIds: (state.lastComponentIds || []).slice(-8),
    };
  }

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
    senderName: config.content.agentName,
  });
  if (rendered.quickReplies?.length) msg._quickReplies = rendered.quickReplies;
  return msg;
}

function logTurn(debug) {
  try {
    console.info('[live-chat-turn-v2]', JSON.stringify(debug));
  } catch {
    /* ignore */
  }
}

function resolveRoute(understanding, state) {
  const intent = understanding.primaryIntent;
  const turnType = understanding.turnType;

  // Precedence: handoff → continue AI → correction → rejection → clarification →
  // confirmation → contact leave → explicit new intent → field response → continuation
  if (understanding.requestsHuman || turnType === 'handoff_request' || intent === 'contact_support') {
    return { route: 'handoff', intent: 'contact_support', reason: 'handoff_request' };
  }

  // continueWithAI is ONLY for canceling handoff / staying with AI — never when the
  // customer clearly stated an ecommerce goal (Groq often sets this flag wrongly).
  const explicitGoal = new Set([
    'track_order',
    'shipping_status',
    'delivery_estimate',
    'order_status',
    'financial_status',
    'refund_status',
    'refund_not_received',
    'request_refund',
    'start_return',
    'exchange_item',
    'cancel_order',
    'change_delivery_address',
    'product_recommendation',
    'product_search',
    'product_comparison',
    'product_availability',
    'size_help',
    'return_policy',
    'store_policy_question',
    'leave_contact_details',
    'damaged_item',
    'wrong_item',
    'missing_item',
    'payment_question',
    'discount_question',
  ]);
  if (
    (intent === 'continue_with_ai' ||
      (understanding.continueWithAI &&
        (turnType === 'cancellation' || intent === 'continue_with_ai'))) &&
    !explicitGoal.has(intent)
  ) {
    return { route: 'continue_ai', intent: 'continue_with_ai', reason: 'continue_with_ai' };
  }
  if (turnType === 'correction' || understanding.isCorrection || intent === 'correct_previous_information') {
    return { route: 'correction', intent, reason: 'correction' };
  }
  if (turnType === 'rejection' || understanding.rejectsPreviousAnswer) {
    return { route: 'rejection', intent, reason: 'rejection' };
  }
  if (turnType === 'clarification' || intent === 'clarify_previous_response') {
    return { route: 'clarification', intent: 'clarify_previous_response', reason: 'clarification' };
  }
  if (turnType === 'confirmation') {
    return { route: 'confirmation', intent, reason: 'confirmation' };
  }
  if (turnType === 'cancellation' && intent !== 'leave_contact_details' && !explicitGoal.has(intent)) {
    return { route: 'continue_ai', intent: 'continue_with_ai', reason: 'cancellation' };
  }
  if (
    turnType === 'casual_conversation' ||
    intent === 'greeting' ||
    intent === 'thank_you' ||
    intent === 'goodbye'
  ) {
    return { route: 'casual', intent, reason: 'casual' };
  }
  if (intent === 'leave_contact_details') {
    return { route: 'contact_request', intent: 'leave_contact_details', reason: 'contact' };
  }

  // Explicit new intents always win over active workflow
  const goalIntents = new Set([
    'track_order',
    'shipping_status',
    'delivery_estimate',
    'order_status',
    'financial_status',
    'refund_status',
    'refund_not_received',
    'request_refund',
    'start_return',
    'exchange_item',
    'cancel_order',
    'change_delivery_address',
    'product_recommendation',
    'product_search',
    'product_comparison',
    'product_availability',
    'size_help',
    'return_policy',
    'store_policy_question',
    'leave_contact_details',
    'greeting',
  ]);

  if (turnType === 'new_intent' || (goalIntents.has(intent) && turnType !== 'field_response')) {
    return { route: mapIntentRoute(intent), intent, reason: 'new_intent' };
  }

  if (turnType === 'field_response' && state.activeWorkflow) {
    return { route: mapWorkflowRoute(state.activeWorkflow), intent, reason: 'field_response' };
  }

  if (turnType === 'workflow_continuation' && state.activeWorkflow) {
    return { route: mapWorkflowRoute(state.activeWorkflow), intent, reason: 'continuation' };
  }

  if (goalIntents.has(intent)) {
    return { route: mapIntentRoute(intent), intent, reason: 'intent' };
  }

  return { route: 'fallback', intent, reason: 'fallback' };
}

function mapIntentRoute(intent) {
  switch (intent) {
    case 'track_order':
    case 'shipping_status':
    case 'delivery_estimate':
    case 'order_status':
      return 'track_order';
    case 'financial_status':
      return 'financial_status';
    case 'refund_status':
    case 'refund_not_received':
      return 'refund_not_received';
    case 'request_refund':
    case 'start_return':
    case 'damaged_item':
    case 'wrong_item':
    case 'missing_item':
      return 'return_or_refund';
    case 'exchange_item':
      return 'exchange';
    case 'product_recommendation':
    case 'product_search':
    case 'product_comparison':
    case 'product_availability':
    case 'size_help':
      return 'product';
    case 'return_policy':
    case 'store_policy_question':
    case 'shipping_question':
      return 'policy';
    case 'leave_contact_details':
      return 'contact_request';
    case 'greeting':
    case 'thank_you':
    case 'goodbye':
      return 'casual';
    default:
      return 'fallback';
  }
}

function mapWorkflowRoute(workflow) {
  switch (workflow) {
    case 'track_order':
      return 'track_order';
    case 'refund_investigation':
      return 'refund_not_received';
    case 'refund':
    case 'return_request':
      return 'return_or_refund';
    case 'exchange_item':
      return 'exchange';
    case 'product_search':
      return 'product';
    case 'contact_request':
      return 'contact_request';
    case 'handoff':
      return 'handoff';
    default:
      return 'fallback';
  }
}

async function ensureOrderIdentity(session, state, config, understanding) {
  const orderNumber = state.collectedContext.orderNumber;
  const email = state.collectedContext.email;
  if (!orderNumber || !email) {
    switchWorkflow(state, {
      workflow: 'track_order',
      step: 'collect_identity',
      expectedFields: [
        !orderNumber ? 'orderNumber' : null,
        !email ? 'email' : null,
      ].filter(Boolean),
      reason: 'need_identity',
    });
    syncLegacyMirrors(session, state);
    await session.save();
    const plan = planResponse({
      responseType: 'collect_identity',
      messageGoal: 'Ask only for missing order identity fields',
      suggestedText: !orderNumber && !email
        ? 'Please share your order number and the email used at checkout.'
        : !orderNumber
          ? 'What is the order number?'
          : 'What email was used at checkout?',
      components: [
        {
          type: 'input_form',
          form: buildOrderLookupForm(Boolean(orderNumber), Boolean(email)),
        },
      ],
      allowedFacts: { missing: state.expectedFields },
    });
    const msg = await emit(session, config, plan);
    return { blocked: true, messages: [msg] };
  }
  return { blocked: false };
}

function enrichOrderCard(order) {
  const card = formatOrderCard(order);
  const money = moneyObject(card.totalPrice, card.currency);
  return {
    ...card,
    totalPrice: money.amount != null ? Number(money.amount) : card.totalPrice,
    totalDisplay: money.display,
    currency: money.currency,
  };
}

function trackingAnswer(card) {
  const fin = String(card.financialStatus || '').toLowerCase();
  const ful = String(card.fulfillmentStatus || '').toLowerCase();
  const refunded = /refund/.test(fin);
  const cancelled = /cancel|void/.test(fin) || ful === 'cancelled';

  if (refunded) {
    return {
      responseType: 'tracking_unavailable_refunded',
      suggestedText: `Order #${card.orderNumber} does not have a shipment to track because it was refunded and restocked, so it will not ship.`,
      includeCard: false,
      allowedFacts: {
        orderNumber: card.orderNumber,
        shipmentExists: false,
        reason: 'refunded_restocked',
        financialStatus: card.financialStatus,
        fulfillmentStatus: card.fulfillmentStatus,
      },
    };
  }
  if (cancelled) {
    return {
      responseType: 'tracking_unavailable_cancelled',
      suggestedText: `Order #${card.orderNumber} was cancelled, so there is no shipment to track.`,
      includeCard: false,
      allowedFacts: { orderNumber: card.orderNumber, shipmentExists: false },
    };
  }
  if (card.tracking?.url || card.tracking?.number) {
    return {
      responseType: 'tracking',
      suggestedText: `Here is the shipping update for order #${card.orderNumber}.`,
      includeCard: true,
      allowedFacts: {
        orderNumber: card.orderNumber,
        shipmentExists: true,
        fulfillmentStatus: card.fulfillmentStatus,
        trackingNumber: card.tracking?.number || null,
        trackingUrl: card.tracking?.url || null,
      },
    };
  }
  if (!ful || ful === 'null' || /unfulfilled|pending/.test(ful)) {
    return {
      responseType: 'not_shipped',
      suggestedText: `Order #${card.orderNumber} has not shipped yet.`,
      includeCard: true,
      allowedFacts: {
        orderNumber: card.orderNumber,
        shipmentExists: false,
        fulfillmentStatus: card.fulfillmentStatus || 'unfulfilled',
      },
    };
  }
  return {
    responseType: 'tracking_limited',
    suggestedText: `Order #${card.orderNumber} shows fulfillment status “${card.fulfillmentStatus || 'unknown'}”, but live carrier tracking is not available yet.`,
    includeCard: true,
    allowedFacts: {
      orderNumber: card.orderNumber,
      fulfillmentStatus: card.fulfillmentStatus,
    },
  };
}

async function handleTrack(company, session, state, config, understanding) {
  setCurrentGoal(state, 'track_order', understanding.customerGoal || 'Track shipping status');
  switchWorkflow(state, { workflow: 'track_order', step: 'verify_order', reason: 'track' });
  syncLegacyMirrors(session, state);

  const id = await ensureOrderIdentity(session, state, config, understanding);
  if (id.blocked) return baseResult(session, id.messages);

  const verification = await verifyOrderForSession(
    session,
    company,
    state.collectedContext.orderNumber,
    state.collectedContext.email,
  );
  if (!verification?.order) {
    const plan = planResponse({
      responseType: 'order_not_found',
      suggestedText:
        "I couldn't verify that order with the email provided. Double-check the order number and checkout email, or I can connect you with support.",
      quickReplies: [
        { id: 'handoff', label: 'Talk to support', action: 'handoff' },
        { id: 'retry', label: 'Try another order', action: 'track_order' },
      ],
    });
    const msg = await emit(session, config, plan);
    return baseResult(session, [msg]);
  }

  state.verifiedContext.orderNumber = state.collectedContext.orderNumber;
  state.verifiedContext.email = state.collectedContext.email;
  const card = enrichOrderCard(verification.order);
  const answer = trackingAnswer(card);
  if (!state.lastToolResults || typeof state.lastToolResults !== 'object') {
    state.lastToolResults = {};
  }
  state.lastToolResults.order_lookup = {
    fingerprint: fingerprint([card.orderNumber, state.collectedContext.email]),
    card,
  };
  syncLegacyMirrors(session, state);
  await session.save();

  const plan = planResponse({
    responseType: answer.responseType,
    messageGoal: understanding.customerGoal || 'Answer shipping/tracking question',
    suggestedText: answer.suggestedText,
    allowedFacts: answer.allowedFacts,
    forbiddenClaims: [
      'Payment was returned',
      'Refund completed',
      'Money is in your account',
      'The financial status is',
    ],
    components: answer.includeCard ? [{ type: 'order_card', order: card }] : [],
    quickReplies: answer.responseType.includes('refund')
      ? [
          { id: 'refund', label: 'Check refund status', action: 'refund_not_received' },
          { id: 'handoff', label: 'Talk to support', action: 'handoff' },
        ]
      : [],
  });
  const msg = await emit(session, config, plan);
  return baseResult(session, [msg], { responsePlanType: answer.responseType });
}

async function handleRefundNotReceived(company, session, state, config, understanding) {
  setCurrentGoal(
    state,
    'refund_not_received',
    understanding.customerGoal || 'Customer has not received refund funds',
  );
  switchWorkflow(state, {
    workflow: 'refund_investigation',
    step: 'explain_refund_timeline',
    reason: 'refund_not_received',
  });

  let card = state.lastToolResults?.order_lookup?.card || null;
  if (!card) {
    syncLegacyMirrors(session, state);
    const id = await ensureOrderIdentity(session, state, config, understanding);
    if (id.blocked) return baseResult(session, id.messages);
    const verification = await verifyOrderForSession(
      session,
      company,
      state.collectedContext.orderNumber,
      state.collectedContext.email,
    );
    if (verification?.order) card = enrichOrderCard(verification.order);
  }

  const marked = card && /refund/i.test(String(card.financialStatus || ''));
  const body = marked
    ? `The store has marked order #${card.orderNumber} as refunded, but that status alone does not confirm when the money will appear in your account. Refunds go to the payment provider first, then your bank or card issuer, which can take several business days.`
    : 'I can look into a missing refund. Share the order number and checkout email if you have not already, and I will check what the store has on file.';

  syncLegacyMirrors(session, state);
  await session.save();
  const plan = planResponse({
    responseType: 'refund_not_received',
    messageGoal: 'Explain refund timeline without claiming funds received',
    suggestedText: body,
    allowedFacts: {
      orderNumber: card?.orderNumber || null,
      storeMarkedRefunded: Boolean(marked),
      financialStatus: card?.financialStatus || null,
    },
    forbiddenClaims: [
      'Refund completed',
      'Payment was returned',
      'The refund has reached your bank',
      'Money is in your account',
    ],
    components: [],
    quickReplies: [
      { id: 'handoff', label: 'Talk to support', action: 'handoff' },
      { id: 'contact', label: 'Leave contact details', action: 'start_contact_request' },
    ],
  });
  const msg = await emit(session, config, plan);
  return baseResult(session, [msg], { responsePlanType: 'refund_not_received' });
}

async function handleProduct(company, session, state, config, understanding) {
  setCurrentGoal(
    state,
    'product_recommendation',
    understanding.customerGoal || 'Help find a product',
  );
  switchWorkflow(state, {
    workflow: 'product_search',
    step: 'search_or_clarify',
    reason: 'product',
  });
  mergeEntities(state, understanding.entities);
  const prefs = state.collectedContext.productPreferences || {};

  const bits = [
    prefs.color,
    prefs.occasion,
    prefs.category,
    prefs.size,
    prefs.style,
    prefs.productQuery,
    understanding.entities.productQuery,
  ].filter(Boolean);

  const enough =
    bits.length >= 2 ||
    (prefs.occasion && (prefs.size || prefs.color || prefs.budgetMax)) ||
    (prefs.productQuery && String(prefs.productQuery).length > 3);

  if (!enough) {
    syncLegacyMirrors(session, state);
    await session.save();
    const plan = planResponse({
      responseType: 'product_need_prefs',
      messageGoal: 'Ask one broad preference question',
      suggestedText:
        'What are you shopping for? You can mention the occasion, style, size, color, or budget.',
      allowedFacts: { known: prefs },
    });
    const msg = await emit(session, config, plan);
    return baseResult(session, [msg], { responsePlanType: 'product_need_prefs' });
  }

  const q = bits.join(' ').slice(0, 120);
  const products = await searchProducts(company._id, q, 4);
  syncLegacyMirrors(session, state);
  await session.save();

  if (!products.length) {
    const plan = planResponse({
      responseType: 'product_no_results',
      suggestedText:
        "I couldn't find an exact match yet. Share another detail like budget, color, or style and I will search again.",
      allowedFacts: { query: q, prefs },
    });
    const msg = await emit(session, config, plan);
    return baseResult(session, [msg]);
  }

  const cards = formatProductCards(products);
  if (!state.lastToolResults || typeof state.lastToolResults !== 'object') {
    state.lastToolResults = {};
  }
  state.lastToolResults.product_search = {
    fingerprint: fingerprint([q, prefs.size, prefs.color, prefs.budgetMax]),
    products: cards,
  };
  const plan = planResponse({
    responseType: 'product_results',
    messageGoal: 'Present catalog matches without inventing stock',
    suggestedText: 'Here are options that may fit. Tell me if you want a different size, color, or budget.',
    allowedFacts: { query: q, count: cards.length, prefs },
    forbiddenClaims: ['In stock forever', 'Arrives tomorrow'],
    components: [{ type: 'product_cards', products: cards }],
  });
  const msg = await emit(session, config, plan);
  return baseResult(session, [msg], { responsePlanType: 'product_results' });
}

async function handleReturnOrRefund(company, session, state, config, understanding) {
  setCurrentGoal(
    state,
    understanding.primaryIntent || 'request_refund',
    understanding.customerGoal || 'Start a refund or return',
  );
  switchWorkflow(state, {
    workflow: 'return_request',
    step: 'collect_identity',
    reason: 'return_or_refund',
  });
  syncLegacyMirrors(session, state);

  const id = await ensureOrderIdentity(session, state, config, understanding);
  if (id.blocked) return baseResult(session, id.messages);

  const verification = await verifyOrderForSession(
    session,
    company,
    state.collectedContext.orderNumber,
    state.collectedContext.email,
  );
  if (!verification?.order) {
    const plan = planResponse({
      responseType: 'order_not_found',
      suggestedText:
        "I couldn't verify that order. Check the number and checkout email, or I can connect you with support.",
    });
    const msg = await emit(session, config, plan);
    return baseResult(session, [msg]);
  }

  const card = enrichOrderCard(verification.order);
  if (/refund/i.test(String(card.financialStatus || ''))) {
    return handleRefundNotReceived(company, session, state, config, understanding);
  }

  const plan = planResponse({
    responseType: 'return_intake',
    messageGoal: 'Confirm order and ask return reason, without claiming completion',
    suggestedText: `I found order #${card.orderNumber}. What would you like to return, and what is the reason?`,
    allowedFacts: {
      orderNumber: card.orderNumber,
      financialStatus: card.financialStatus,
      fulfillmentStatus: card.fulfillmentStatus,
    },
    forbiddenClaims: ['Return created', 'Refund processed', 'Label has been emailed'],
    components: [{ type: 'order_card', order: card }],
    quickReplies: [
      { id: 'handoff', label: 'Talk to support', action: 'handoff' },
    ],
  });
  const msg = await emit(session, config, plan);
  return baseResult(session, [msg], { responsePlanType: 'return_intake' });
}

async function handleHandoff(company, session, state, config, channelAi) {
  setCurrentGoal(state, 'contact_support', 'Customer requested a human');
  switchWorkflow(state, { workflow: 'handoff', step: 'checking_availability', reason: 'handoff' });
  syncLegacyMirrors(session, state);

  const availability = await getSupportAvailability(company);
  if (!availability.queueOpen) {
    const next = formatNextOpeningForCustomer(company);
    ensureHandoffState(session).status =
      availability.reason === 'outside_business_hours'
        ? HANDOFF_STATUSES.OUTSIDE_BUSINESS_HOURS
        : HANDOFF_STATUSES.UNAVAILABLE;
    session.markModified('handoffState');
    await session.save();
    const body = !availability.liveSupportEnabled
      ? 'Live support is not available on this channel right now.'
      : availability.reason === 'outside_business_hours'
        ? `Our support team is currently offline.${next ? ` ${next}` : ''}`
        : 'No support agents are available right now.';
    const plan = planResponse({
      responseType: 'agents_unavailable',
      suggestedText: body,
      quickReplies: [
        { id: 'contact', label: 'Leave contact details', action: 'start_contact_request' },
        { id: 'ai', label: 'Keep chatting with AI', action: 'cancel_handoff_and_continue_ai' },
      ],
      components: [{ type: 'offline_contact_options' }],
    });
    const msg = await emit(session, config, plan);
    return baseResult(session, [msg], { responsePlanType: 'agents_unavailable' });
  }

  // Defer to existing queue handoff in AI service via forceHandoff flag
  await session.save();
  return {
    handled: false,
    forceHandoff: true,
    orchestratorBuild: PIPELINE_BUILD,
    turnDebug: { route: 'handoff', queueOpen: true },
  };
}

async function handleContactRequest(company, session, state, config, understanding, text) {
  setCurrentGoal(state, 'leave_contact_details', 'Collect offline contact details');
  switchWorkflow(state, {
    workflow: 'contact_request',
    step: 'collect_contact_method',
    reason: 'contact',
  });

  const lower = String(text || '').toLowerCase();
  const choosesEmail = /\b(use )?email\b/i.test(lower);
  const choosesPhone = /\b(use )?phone\b/i.test(lower);
  const confirms = /^(yes|confirm|submit|send it)\b/i.test(lower.trim());
  const email =
    understanding.entities.email ||
    (state.collectedContext.contactEmailExplicit ? state.collectedContext.email : null);
  const phone =
    understanding.entities.phone ||
    (state.collectedContext.contactPhoneExplicit ? state.collectedContext.phone : null);

  if (!choosesEmail && !choosesPhone && !email && !phone && !confirms) {
    syncLegacyMirrors(session, state);
    await session.save();
    const plan = planResponse({
      responseType: 'collect_contact_method',
      suggestedText:
        'You can leave an email address or phone number here, and the support team can follow up.',
      quickReplies: [
        { id: 'use_email', label: 'Use email', action: 'use_email' },
        { id: 'use_phone', label: 'Use phone', action: 'use_phone' },
        { id: 'ai', label: 'Keep chatting with AI', action: 'cancel_handoff_and_continue_ai' },
      ],
    });
    const msg = await emit(session, config, plan);
    return baseResult(session, [msg], { contactRequestCreated: false });
  }

  if ((choosesEmail || state.workflowStep === 'collect_email') && !email) {
    state.workflowStep = 'collect_email';
    syncLegacyMirrors(session, state);
    await session.save();
    const plan = planResponse({
      responseType: 'collect_contact',
      suggestedText: 'Enter the email the support team should use.',
      components: [
        {
          type: 'input_form',
          form: {
            formId: 'contact_request_email',
            title: 'Contact email',
            fields: [
              { name: 'email', type: 'email', label: 'Email', required: true, placeholder: 'you@example.com' },
            ],
            submitLabel: 'Continue',
          },
        },
      ],
    });
    const msg = await emit(session, config, plan);
    return baseResult(session, [msg], { contactRequestCreated: false });
  }

  if (email && !confirms) {
    state.collectedContext.email = email;
    state.collectedContext.contactEmailExplicit = true;
    state.collectedContext.contactMethod = 'email';
    state.workflowStep = 'review_contact_request';
    syncLegacyMirrors(session, state);
    await session.save();
    const plan = planResponse({
      responseType: 'review_contact_request',
      suggestedText: `Please confirm: we should contact you at ${email} about your request.`,
      quickReplies: [
        { id: 'confirm', label: 'Yes, submit', action: 'confirm_contact' },
        { id: 'edit', label: 'Change email', action: 'use_email' },
      ],
    });
    const msg = await emit(session, config, plan);
    return baseResult(session, [msg], { contactRequestCreated: false });
  }

  if (confirms && state.collectedContext.contactMethod && (email || phone)) {
    const requestId = `contact_${crypto.randomBytes(8).toString('hex')}`;
    const idempotencyKey = `contact:${session._id}:${email || ''}:${phone || ''}`;
    await ContactRequest.create({
      company: company._id,
      session: session._id,
      requestId,
      status: 'submitted',
      email: email || null,
      phone: phone || null,
      preferredMethod: state.collectedContext.contactMethod,
      issueSummary: String(state.currentGoal?.intent || 'support'),
      consentToContact: true,
      idempotencyKey,
      submittedAt: new Date(),
    });
    state.workflowStep = 'submitted';
    syncLegacyMirrors(session, state);
    await session.save();
    const next = formatNextOpeningForCustomer(company);
    const msg = await appendSessionMessage(session, {
      role: 'bot',
      body: `Thanks, your request has been sent to the support team.${next ? ` ${next}` : ' They will follow up during the next business day.'}`,
      contentType: 'text',
      senderName: config.content.agentName,
    });
    return baseResult(session, [msg], { contactRequestCreated: true });
  }

  syncLegacyMirrors(session, state);
  await session.save();
  const plan = planResponse({
    responseType: 'collect_contact_method',
    suggestedText:
      'You can leave an email address or phone number here, and the support team can follow up.',
    quickReplies: [
      { id: 'use_email', label: 'Use email', action: 'use_email' },
      { id: 'use_phone', label: 'Use phone', action: 'use_phone' },
    ],
  });
  const msg = await emit(session, config, plan);
  return baseResult(session, [msg], { contactRequestCreated: false });
}

async function handleClarification(session, state, config, understanding) {
  const last = state.lastResponsePlan || {};
  const plan = planResponse({
    responseType: 'clarification',
    messageGoal: 'Explain prior answer simply without repeating the same card dump',
    suggestedText:
      last.responseType === 'tracking_unavailable_refunded'
        ? 'It means the store recorded a refund and will not ship that order, so there is no package tracking available.'
        : last.responseType === 'refund_not_received'
          ? 'It means the store marked or submitted a refund, but your bank or card provider may still be processing it before you see the money.'
          : understanding.clarificationQuestion ||
            'Happy to clarify. Which part was unclear: the order status, shipping, or refund?',
    allowedFacts: last.allowedFacts || {},
    components: [],
  });
  const msg = await emit(session, config, plan);
  return baseResult(session, [msg], { responsePlanType: 'clarification' });
}

async function handleRejection(company, session, state, config, understanding) {
  // Recover prior customer goal from previousGoal or recent intent
  const recovered =
    state.previousGoal?.intent ||
    (understanding.customerGoal?.toLowerCase().includes('track')
      ? 'track_order'
      : understanding.primaryIntent);

  if (recovered === 'track_order' || recovered === 'shipping_status') {
    return handleTrack(company, session, state, config, {
      ...understanding,
      primaryIntent: 'track_order',
      customerGoal: 'Provide shipping tracking, not financial status',
    });
  }
  if (recovered === 'refund_not_received') {
    return handleRefundNotReceived(company, session, state, config, understanding);
  }

  const plan = planResponse({
    responseType: 'ack_rejection',
    suggestedText:
      "You're right, I answered the wrong thing. Tell me what you need instead: tracking, refund, return, or product help.",
  });
  const msg = await emit(session, config, plan);
  return baseResult(session, [msg]);
}

async function handlePolicy(company, session, config, text) {
  const knowledge = await retrieveKnowledge(company._id, text, 4);
  if (!knowledge.length) {
    const msg = await appendSessionMessage(session, {
      role: 'bot',
      body: "I don't have a published policy article for that yet. I can connect you with support, or help with an order or return.",
      contentType: 'text',
      senderName: config.content.agentName,
    });
    return baseResult(session, [msg]);
  }
  const plan = planResponse({
    responseType: 'policy_answer',
    messageGoal: 'Answer only from retrieved knowledge',
    suggestedText: knowledge[0].content.slice(0, 400),
    allowedFacts: { title: knowledge[0].title },
  });
  const msg = await emit(session, config, plan);
  return baseResult(session, [msg]);
}

async function handleCasual(session, config, understanding) {
  const intent = understanding.primaryIntent;
  const text =
    intent === 'thank_you'
      ? "You're welcome. Anything else I can help with?"
      : intent === 'goodbye'
        ? 'Glad to help. Feel free to message again anytime.'
        : 'Hi! I can help with orders, shipping, returns, refunds, and product recommendations. What do you need?';
  const msg = await appendSessionMessage(session, {
    role: 'bot',
    body: text,
    contentType: 'text',
    senderName: config.content.agentName,
  });
  return baseResult(session, [msg]);
}

/**
 * Main entry — single authoritative turn.
 */
async function processConversationTurn({
  company,
  session,
  latestMessage,
  widgetAction = null,
  onStatus = null,
} = {}) {
  const requestId = crypto.randomBytes(8).toString('hex');
  const started = Date.now();
  const config = mergeLiveChatConfig(company);
  const channelAi = resolveChannelAiConfig(company, 'liveChat');
  const text = String(latestMessage || '').trim();

  const state = ensureConversationState(session);
  ensureHandoffState(session);

  const understanding = await understandCustomerMessage(text, {
    activeWorkflow: state.activeWorkflow,
    workflowStep: state.workflowStep,
    expectedFields: state.expectedFields,
    currentGoal: state.currentGoal,
    verifiedContext: state.verifiedContext,
    collectedContext: state.collectedContext,
    lastAssistantMessage: lastAssistantMessage(session),
    lastResponsePlan: state.lastResponsePlan,
    recentTurns: recentTurns(session, 10),
  });

  // Apply entities + corrections before routing
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

  // Widget actions
  let forcedRoute = null;
  if (widgetAction === 'start_contact_request' || widgetAction === 'use_email' || widgetAction === 'use_phone') {
    forcedRoute = { route: 'contact_request', intent: 'leave_contact_details', reason: 'widget_action' };
  }
  if (widgetAction === 'handoff') {
    forcedRoute = { route: 'handoff', intent: 'contact_support', reason: 'widget_action' };
  }

  const route = forcedRoute || resolveRoute(understanding, state);
  if (
    !['correction', 'rejection', 'clarification', 'confirmation'].includes(route.route)
  ) {
    setCurrentGoal(state, route.intent || understanding.primaryIntent, understanding.customerGoal);
  }

  const debug = {
    requestId,
    conversationId: session.ticket ? String(session.ticket) : null,
    sessionId: String(session._id),
    message: text.slice(0, 200),
    activeWorkflowBefore: state.activeWorkflow,
    understanding: {
      primaryIntent: understanding.primaryIntent,
      turnType: understanding.turnType,
      customerGoal: understanding.customerGoal,
      confidence: understanding.confidence,
      isCorrection: understanding.isCorrection,
      rejectsPreviousAnswer: understanding.rejectsPreviousAnswer,
    },
    resolvedRoute: route.route,
    routeReason: route.reason,
    pipelineBuild: PIPELINE_BUILD,
    legacyResponderCalled: false,
  };

  if (onStatus) onStatus('retrieving');

  let result;
  switch (route.route) {
    case 'handoff':
      result = await handleHandoff(company, session, state, config, channelAi);
      break;
    case 'contact_request':
      result = await handleContactRequest(company, session, state, config, understanding, text);
      break;
    case 'correction': {
      const goalAfter =
        state.previousGoal?.intent ||
        state.currentGoal?.intent ||
        state.activeWorkflow ||
        understanding.primaryIntent;
      if (
        goalAfter === 'product_recommendation' ||
        goalAfter === 'product_search' ||
        state.activeWorkflow === 'product_search'
      ) {
        result = await handleProduct(company, session, state, config, understanding);
      } else if (
        goalAfter === 'refund_not_received' ||
        state.activeWorkflow === 'refund_investigation'
      ) {
        result = await handleRefundNotReceived(company, session, state, config, understanding);
      } else if (
        goalAfter === 'request_refund' ||
        goalAfter === 'start_return' ||
        state.activeWorkflow === 'return_request'
      ) {
        result = await handleReturnOrRefund(company, session, state, config, understanding);
      } else if (
        goalAfter === 'leave_contact_details' ||
        state.activeWorkflow === 'contact_request'
      ) {
        result = await handleContactRequest(
          company,
          session,
          state,
          config,
          understanding,
          text,
        );
      } else {
        result = await handleTrack(company, session, state, config, understanding);
      }
      break;
    }
    case 'rejection':
      result = await handleRejection(company, session, state, config, understanding);
      break;
    case 'clarification':
      result = await handleClarification(session, state, config, understanding);
      break;
    case 'track_order':
    case 'financial_status':
      if (onStatus) onStatus('checking_order');
      result = await handleTrack(company, session, state, config, understanding);
      break;
    case 'refund_not_received':
      if (onStatus) onStatus('checking_order');
      result = await handleRefundNotReceived(company, session, state, config, understanding);
      break;
    case 'return_or_refund':
      if (onStatus) onStatus('checking_order');
      result = await handleReturnOrRefund(company, session, state, config, understanding);
      break;
    case 'product':
      if (onStatus) onStatus('searching_products');
      result = await handleProduct(company, session, state, config, understanding);
      break;
    case 'policy':
      result = await handlePolicy(company, session, config, text);
      break;
    case 'casual':
      result = await handleCasual(session, config, understanding);
      break;
    case 'continue_ai':
      await cancelHandoffByCustomer(session);
      switchWorkflow(state, { workflow: null, step: null, reason: 'continue_with_ai' });
      result = await handleCasual(session, config, { primaryIntent: 'greeting' });
      break;
    default: {
      // Clarifying fallback — never silent legacy Groq
      const plan = planResponse({
        responseType: 'need_clarification',
        suggestedText:
          understanding.clarificationQuestion ||
          'I want to make sure I help with the right thing. Are you looking for order tracking, a refund, a return, or a product recommendation?',
        quickReplies: [
          { id: 'track', label: 'Track my order', action: 'track_order' },
          { id: 'refund', label: 'Refund help', action: 'refund_not_received' },
          { id: 'product', label: 'Product ideas', action: 'product_search' },
          { id: 'handoff', label: 'Talk to support', action: 'handoff' },
        ],
      });
      const msg = await emit(session, config, plan);
      result = baseResult(session, [msg], { responsePlanType: 'need_clarification' });
      break;
    }
  }

  syncLegacyMirrors(session, state);
  await session.save();

  debug.activeWorkflowAfter = state.activeWorkflow;
  debug.durationMs = Date.now() - started;
  debug.handled = result?.handled !== false;
  logTurn(debug);

  return {
    ...result,
    understanding,
    conversationState: state,
    turnDebug: debug,
    orchestratorBuild: PIPELINE_BUILD,
  };
}

module.exports = {
  PIPELINE_BUILD,
  processConversationTurn,
  resolveRoute,
  trackingAnswer,
  enrichOrderCard,
};
