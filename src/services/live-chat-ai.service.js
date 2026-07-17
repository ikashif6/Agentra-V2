const { groqChat, groqClassify, isGroqConfigured } = require('./groq.service');
const { mergeLiveChatConfig } = require('./live-chat-config.service');
const { retrieveKnowledge } = require('./live-chat-knowledge.service');
const {
  appendSessionMessage,
  verifyOrderForSession,
} = require('./live-chat-session.service');
const {
  extractOrderNumber,
  extractEmail,
  searchProducts,
  executeRefundIfAllowed,
  formatProductCards,
  formatOrderCard,
  buildOrderLookupForm,
  buildShippingAddressForm,
  parseShippingAddressFromText,
} = require('./live-chat-tools.service');
const StoreOrder = require('../models/StoreOrder');
const { hasOnlineLiveChatAgents, isWithinBusinessHours } = require('./live-chat-hours.service');
const { isChannelAiEnabled, resolveChannelAiConfig } = require('./ai-agent-config.service');
const { updateStoreOrder } = require('./store-order-actions.service');
const {
  HANDOFF_STATUSES,
  ACTIVE_RESPONDERS,
  ensureWorkflowState,
  ensureHandoffState,
  applyExtractedToWorkflow,
  mapIntentToWorkflow,
  offerHandoff,
  cancelHandoffByCustomer,
  wantsCancelHandoff,
  wantsAcceptHandoff,
  isHandoffPending,
  setHandoffStatus,
  buildHandoffWidgetPayload,
  getSafeHandoffMessage,
} = require('./live-chat-workflow.service');
const { orchestrateTurn } = require('./live-chat-orchestrator.service');
const { processConversationTurn } = require('./live-chat-conversation.service');
const {
  processTurn: processAssistantTurn,
  resolveEngineMode,
} = require('./assistant-engine/assistant-engine.service');

const SUPPORT_PLAYBOOK = `You are a live store support agent for THIS store only.
- Sound like a real human support rep: warm, clear, and brief (2–4 short sentences unless listing products).
- Stay on-topic for this store (products, orders, shipping, returns, store policies). If the customer asks about unrelated topics (hotels, news, other brands, general trivia), politely say you can only help with this store and offer a relevant next step.
- Never invent products, stock, prices, policies, order numbers, or tracking. If tool/knowledge data is missing, say so and ask one clarifying question.
- For product help: ask what they need (occasion, style, size, budget) before dumping a long list. When tool data includes products, recommend from those only.
- For orders: collect BOTH order number and the email used on the order in chat before sharing details. Do not assume the pre-chat email is correct.
- When the widget shows an input form for order details or address, the customer may submit structured fields — treat those values as authoritative.
- If tool data includes a verified order, use it and do not re-ask for details you already have.
- Security: never reveal whether an order number exists alone, or which email is on file. On failed lookup say only that the order number and email don't match our records.
- Do not offer to connect a human unless the customer asks, they are frustrated, or you truly cannot help. If teammates are offline / unavailable, do not promise an immediate live agent — keep helping and note that the team will follow up.
- Prefer resolving the issue yourself. End with one clear question or next step when useful.
- Never mention being an AI, language models, or internal tools.
- Do not use em dashes, en dashes, or double hyphens (--). Prefer commas, periods, or short sentences.`;

const ORDER_DETAILS_PROMPT_BOTH =
  "I can help with that. Please share your order number (for example #1042) and the email address used when placing the order.";
const ORDER_DETAILS_PROMPT_NUMBER = "Thanks, what's your order number? (for example #1042)";
const ORDER_DETAILS_PROMPT_EMAIL =
  "Thanks, what's the email address used when that order was placed?";
const ORDER_NO_MATCH =
  "That order number and email don't match our records. Please double-check both and try again, or ask me to connect you with a human agent.";
const AGENTS_OFFLINE_REPLY =
  "I don't have a teammate online right now. I can keep helping with your order or store questions, and our team will see this chat when someone is available. What else can I help with?";

const HANDOFF_PHRASES = [
  /\b(connect|transfer)\s+(me\s+)?(with|to)\b/i,
  /\b(talk|speak|chat)\s+to\s+(a\s+)?(human|agent|person|representative|someone|manager)\b/i,
  /\b(real|live)\s+(person|human|agent)\b/i,
  /\bhuman\s+agent\b/i,
  /\b(i\s+want|i\s+need|need|want)\s+(a\s+)?(human|agent|person|representative)\b/i,
];

const FRUSTRATION_PHRASES = [
  /\b(this\s+is\s+)?(ridiculous|useless|unacceptable|horrible)\b/i,
  /\b(i'?m|i\s+am)\s+(angry|frustrated|furious|upset)\b/i,
  /\bworse?\s+(support|service|experience)\b/i,
  /\byou('re|\s+are)\s+(useless|unhelpful|not\s+helping)\b/i,
];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wantsHumanHandoff(text, keywords) {
  const lower = String(text || '').toLowerCase().trim();
  if (!lower) return false;
  if (HANDOFF_PHRASES.some((re) => re.test(lower))) return true;
  if (FRUSTRATION_PHRASES.some((re) => re.test(lower))) return true;

  for (const kw of keywords || []) {
    const k = String(kw).toLowerCase().trim();
    if (!k) continue;
    if (k.includes(' ')) {
      if (lower.includes(k)) return true;
      continue;
    }
    if (k.length < 4) continue;
    const wordRe = new RegExp(`\\b${escapeRegex(k)}\\b`, 'i');
    if (!wordRe.test(lower)) continue;
    // Single-word keywords: short messages or clear request verbs nearby
    if (lower.length <= 48) return true;
    if (/\b(please|need|want|connect|talk|speak|transfer|real|live)\b/i.test(lower)) return true;
  }
  return false;
}

function buildHistory(session, limit = 12) {
  const rows = [];
  const msgs = session.messages || [];
  for (let i = msgs.length - 1; i >= 0 && rows.length < limit; i -= 1) {
    const m = msgs[i];
    if (m.contentType === 'text' && m.body) {
      rows.unshift({
        role: m.role === 'customer' ? 'user' : 'assistant',
        content: m.body,
      });
    } else if (m.contentType === 'order_card' && m.payload) {
      rows.unshift({
        role: 'assistant',
        content: `${m.body ? `${m.body}\n` : ''}Shared order details: ${summarizeOrderForPrompt(m.payload)}`,
      });
    }
  }
  return rows;
}

function summarizeOrderForPrompt(order) {
  if (!order) return 'none';
  const items = (order.lineItems || [])
    .map((li) => `${li.title} × ${li.quantity || 1}`)
    .join('; ');
  return [
    `order ${order.orderNumber || order.externalId}`,
    `financial=${order.financialStatus || 'unknown'}`,
    `fulfillment=${order.fulfillmentStatus || 'unknown'}`,
    order.totalPrice != null ? `total=${order.currency || ''} ${order.totalPrice}` : null,
    items ? `items=${items}` : null,
    order.tracking?.number ? `tracking=${order.tracking.company || ''} ${order.tracking.number}` : null,
  ]
    .filter(Boolean)
    .join(' | ');
}

function humanizeStatus(value) {
  const v = String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim();
  if (!v || v === 'null' || v === 'undefined') return '';
  const map = {
    refunded: 'refunded',
    'partially refunded': 'partially refunded',
    voided: 'cancelled',
    cancelled: 'cancelled',
    paid: 'paid',
    pending: 'pending payment',
    authorized: 'payment authorized',
    unfulfilled: 'not shipped yet',
    partial: 'partially shipped',
    fulfilled: 'fulfilled',
    restocked: 'returned to inventory',
    shipped: 'shipped',
    delivered: 'delivered',
  };
  return map[v] || v;
}

function narrateOrder(orderCard, intent) {
  const num = orderCard.orderNumber || orderCard.externalId || 'your order';
  const fin = String(orderCard.financialStatus || '').toLowerCase();
  const ful = String(orderCard.fulfillmentStatus || '').toLowerCase();
  const track = orderCard.tracking;

  if (fin === 'refunded' || fin === 'partially_refunded') {
    const kind = fin === 'partially_refunded' ? 'partially refunded' : 'fully refunded';
    return `I found ${num}. This order was ${kind}, so the payment was returned and it won't ship. Want me to check anything else about it?`;
  }
  if (fin === 'voided' || fin === 'cancelled' || ful === 'cancelled') {
    return `I found ${num}. This order is cancelled, so it won't ship. If that was unexpected, tell me what happened and I'll help from here.`;
  }
  if (intent === 'cancel') {
    if (ful === 'fulfilled' || /ship|deliver/.test(ful)) {
      return `I found ${num}. It's already on its way or delivered, so it can't be cancelled in chat. I can help with returns or refunds instead.`;
    }
    return `I found ${num}. I can help you request a cancellation — want me to start that, or connect you with a teammate if one is available?`;
  }
  if (track?.url || track?.number) {
    const trackBit = track.number
      ? ` Tracking: ${track.company ? `${track.company} ` : ''}${track.number}.`
      : '';
    return `I found ${num}. It's ${humanizeStatus(ful) || 'in progress'}.${trackBit} Use the tracking button on the order card for live updates.`;
  }
  if (!ful || ful === 'unfulfilled' || ful === 'null' || ful === 'restocked') {
    return `I found ${num}. Payment is ${humanizeStatus(fin) || 'on file'}, and it hasn't shipped yet. What would you like to check next?`;
  }
  return `I found ${num}. Payment: ${humanizeStatus(fin) || 'unknown'}. Shipping: ${humanizeStatus(ful)}. Want tracking help or something else on this order?`;
}

function promptForMissingOrderDetails(hasOrderNumber, hasEmail) {
  if (!hasOrderNumber && !hasEmail) return ORDER_DETAILS_PROMPT_BOTH;
  if (!hasOrderNumber) return ORDER_DETAILS_PROMPT_NUMBER;
  return ORDER_DETAILS_PROMPT_EMAIL;
}

function wantsAddressChange(text) {
  const t = String(text || '');
  return (
    /\b(change|update|edit|correct|fix)\b.{0,40}\b(address|shipping)\b/i.test(t) ||
    /\b(address|shipping)\b.{0,40}\b(change|update|edit|wrong|incorrect|new)\b/i.test(t) ||
    /\b(new|wrong)\s+(shipping\s+)?address\b/i.test(t)
  );
}

async function appendOrderLookupForm(session, config, hasOrderNumber, hasEmail) {
  const reply = promptForMissingOrderDetails(hasOrderNumber, hasEmail);
  const form = buildOrderLookupForm(hasOrderNumber, hasEmail);
  if (!form.fields.length) {
    const msg = await appendSessionMessage(session, {
      role: 'bot',
      body: reply,
      contentType: 'text',
      senderName: config.content.agentName,
    });
    return msg;
  }
  return appendSessionMessage(session, {
    role: 'bot',
    body: reply,
    contentType: 'input_form',
    payload: form,
    senderName: config.content.agentName,
  });
}

async function loadVerifiedOrder(session, company, externalId) {
  const id = externalId || session.verifiedOrders?.[session.verifiedOrders.length - 1]?.externalId;
  if (!id) return null;
  const order = await StoreOrder.findOne({ company: company._id, externalId: String(id) }).lean();
  return order || null;
}

/**
 * Collect order number + order email from this message (and pending session state).
 * Never uses the pre-chat visitorEmail for verification — customer must confirm email in chat.
 */
async function resolveOrderForTurn(session, company, text) {
  const extractedNumber = extractOrderNumber(text);
  const extractedEmail = extractEmail(text);

  let dirty = false;
  if (extractedEmail) {
    session.orderLookupEmail = extractedEmail;
    dirty = true;
  }
  if (extractedNumber) {
    session.pendingOrderNumber = extractedNumber;
    dirty = true;
  }
  if (dirty) await session.save();

  const orderNumber = extractedNumber || session.pendingOrderNumber || null;
  const lookupEmail = extractedEmail || session.orderLookupEmail || null;

  if (orderNumber && lookupEmail) {
    const verification = await verifyOrderForSession(session, company, orderNumber, lookupEmail);
    return {
      orderNumber,
      lookupEmail,
      verification,
      fromMemory: false,
      hasOrderNumber: true,
      hasEmail: true,
    };
  }

  // Already verified — reuse for follow-ups when no new credentials were typed
  if (session.verifiedOrders?.length && !extractedNumber && !extractedEmail) {
    const order = await loadVerifiedOrder(session, company);
    if (order) {
      return {
        orderNumber: order.orderNumber || order.externalId,
        lookupEmail: session.orderLookupEmail || null,
        verification: { verified: true, order },
        fromMemory: true,
        hasOrderNumber: true,
        hasEmail: Boolean(session.orderLookupEmail),
      };
    }
  }

  return {
    orderNumber,
    lookupEmail,
    verification: null,
    fromMemory: false,
    needsDetails: true,
    hasOrderNumber: Boolean(orderNumber),
    hasEmail: Boolean(lookupEmail),
  };
}

async function attemptHumanHandoff(company, session, config, channelAi, { reason = 'customer_requested' } = {}) {
  if (channelAi.allowedActions?.requestHuman === false) {
    const reply =
      "I'll keep helping you here. Tell me a bit more about what you need and I'll do my best.";
    const msg = await appendSessionMessage(session, {
      role: 'bot',
      body: reply,
      contentType: 'text',
      senderName: config.content.agentName,
    });
    return {
      messages: [msg],
      handoff: false,
      handoffState: buildHandoffWidgetPayload(session),
    };
  }

  setHandoffStatus(session, HANDOFF_STATUSES.CHECKING_AVAILABILITY, {
    reason,
    customerFacingReason: getSafeHandoffMessage(reason),
    activeResponder: ACTIVE_RESPONDERS.QUEUED,
  });

  const agentsOnline = await hasOnlineLiveChatAgents(company);
  const inHours = isWithinBusinessHours(company);

  if (!agentsOnline) {
    setHandoffStatus(session, HANDOFF_STATUSES.UNAVAILABLE, {
      activeResponder: ACTIVE_RESPONDERS.AI,
    });
    if (session.status === 'waiting_human' && !session.assignedAgent) {
      session.status = 'active';
    }
    await session.save();
    const reply =
      AGENTS_OFFLINE_REPLY ||
      config.content.offlineMessage ||
      'No one from the support team is available right now. I can keep helping, or you can leave a message for the team.';
    const msg = await appendSessionMessage(session, {
      role: 'bot',
      body: reply,
      contentType: 'text',
      senderName: config.content.agentName,
    });
    return {
      messages: [msg],
      handoff: false,
      handoffState: buildHandoffWidgetPayload(session),
    };
  }

  if (config.behavior.handoffOnlyInBusinessHours && !inHours) {
    setHandoffStatus(session, HANDOFF_STATUSES.OUTSIDE_BUSINESS_HOURS, {
      activeResponder: ACTIVE_RESPONDERS.AI,
    });
    if (session.status === 'waiting_human' && !session.assignedAgent) {
      session.status = 'active';
    }
    await session.save();
    const reply =
      config.content.offlineMessage ||
      'Our support team is currently offline. I can keep helping with your order or store questions.';
    const msg = await appendSessionMessage(session, {
      role: 'bot',
      body: reply,
      contentType: 'text',
      senderName: config.content.agentName,
    });
    return {
      messages: [msg],
      handoff: false,
      handoffState: buildHandoffWidgetPayload(session),
    };
  }

  session.status = 'waiting_human';
  session.handoffRequestedAt = new Date();
  setHandoffStatus(session, HANDOFF_STATUSES.WAITING_FOR_AGENT, {
    requestedAt: new Date().toISOString(),
    activeResponder: ACTIVE_RESPONDERS.QUEUED,
  });
  await session.save();
  const handoffMsg = await appendSessionMessage(session, {
    role: 'system',
    body: 'Connecting you with a support agent…',
    contentType: 'system_event',
    payload: { type: 'handoff_requested' },
    senderName: 'System',
  });
  return {
    messages: [handoffMsg],
    handoff: true,
    handoffState: buildHandoffWidgetPayload(session),
  };
}

async function processCustomerMessage(company, session, text, { onStatus, widgetAction = null } = {}) {
  const config = mergeLiveChatConfig(company);
  const channelAi = resolveChannelAiConfig(company, 'liveChat');
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Message is required');

  ensureWorkflowState(session);
  ensureHandoffState(session);

  if (!isChannelAiEnabled(company, 'liveChat')) {
    await appendSessionMessage(session, {
      role: 'customer',
      body: trimmed,
      contentType: 'text',
      senderName: session.visitorEmail,
    });
    return attemptHumanHandoff(company, session, config, channelAi);
  }

  await appendSessionMessage(session, {
    role: 'customer',
    body: trimmed,
    contentType: 'text',
    senderName: session.visitorEmail,
  });

  // Human already joined — AI must not keep answering
  if (session.status === 'with_human' && session.assignedAgent) {
    return {
      messages: [],
      handoff: false,
      handoffState: buildHandoffWidgetPayload(session),
      activeResponder: ACTIVE_RESPONDERS.HUMAN,
    };
  }

  // Customer declines offered / pending handoff → resume AI, clear connecting
  if (wantsCancelHandoff(trimmed) && (isHandoffPending(session) || ensureHandoffState(session).status === HANDOFF_STATUSES.OFFERED)) {
    await cancelHandoffByCustomer(session);
    const msg = await appendSessionMessage(session, {
      role: 'bot',
      body: "Okay, I'll keep helping you here. What would you like to do next?",
      contentType: 'text',
      senderName: config.content.agentName,
    });
    return {
      messages: [msg],
      handoff: false,
      handoffState: buildHandoffWidgetPayload(session),
      clearConnecting: true,
    };
  }

  // Customer accepts an offered handoff (chips / "yes connect me")
  if (wantsAcceptHandoff(trimmed) && ensureHandoffState(session).status === HANDOFF_STATUSES.OFFERED) {
    return attemptHumanHandoff(company, session, config, channelAi, {
      reason: ensureHandoffState(session).reason || 'customer_requested',
    });
  }

  // Authoritative conversational pipeline — v3 engine, v2 rollback, or legacy v1
  if (onStatus) onStatus('retrieving');
  const engineMode = resolveEngineMode(company);

  if (engineMode === 'v3' || engineMode === 'shadow') {
    const turned = await processAssistantTurn({
      workspace: company,
      channel: 'liveChat',
      session,
      message: trimmed,
      widgetAction: widgetAction || null,
      onStatus,
      mode: engineMode,
    });

    if (engineMode === 'shadow') {
      // Shadow: analysis only; v2 still answers customers
      const v2 = await processConversationTurn({
        company,
        session,
        latestMessage: trimmed,
        widgetAction: widgetAction || null,
        onStatus,
      });
      if (v2?.forceHandoff) {
        const handoffResult = await attemptHumanHandoff(company, session, config, channelAi);
        return {
          ...handoffResult,
          turnDebug: {
            ...(v2.turnDebug || {}),
            shadow: turned?.turnDebug || null,
            handled: true,
            legacyGroqCalled: false,
            responsePlanType: 'force_handoff_queue',
          },
          orchestratorBuild: v2.orchestratorBuild,
        };
      }
      if (v2?.handled) {
        return {
          ...v2,
          turnDebug: {
            ...(v2.turnDebug || {}),
            shadow: turned?.turnDebug || null,
          },
        };
      }
    } else {
      if (turned?.forceHandoff) {
        const handoffResult = await attemptHumanHandoff(company, session, config, channelAi);
        return {
          ...handoffResult,
          turnDebug: {
            ...(turned.turnDebug || {}),
            handled: true,
            legacyGroqCalled: false,
            responsePlanType: 'force_handoff_queue',
          },
          orchestratorBuild: turned.orchestratorBuild,
        };
      }
      if (turned?.handled) {
        return turned;
      }
    }
  } else if (engineMode !== 'v1') {
    const turned = await processConversationTurn({
      company,
      session,
      latestMessage: trimmed,
      widgetAction: widgetAction || null,
      onStatus,
    });

    if (turned?.forceHandoff) {
      const handoffResult = await attemptHumanHandoff(company, session, config, channelAi);
      return {
        ...handoffResult,
        turnDebug: {
          ...(turned.turnDebug || {}),
          handled: true,
          legacyGroqCalled: false,
          responsePlanType: 'force_handoff_queue',
        },
        orchestratorBuild: turned.orchestratorBuild,
      };
    }

    if (turned?.handled) {
      return turned;
    }
  } else {
    const orchestrated = await orchestrateTurn(company, session, trimmed, config, channelAi, {
      onStatus,
    });

    if (orchestrated?.forceHandoff) {
      const handoffResult = await attemptHumanHandoff(company, session, config, channelAi);
      return {
        ...handoffResult,
        turnDebug: {
          ...(orchestrated.turnDebug || {}),
          handled: true,
          legacyGroqCalled: false,
          responsePlanType: 'force_handoff_queue',
        },
        orchestratorBuild: orchestrated.orchestratorBuild,
      };
    }

    if (orchestrated?.handled) {
      return orchestrated;
    }
  }

  // Legacy path is disabled by default. Only reachable if pipeline returns handled:false
  // without forceHandoff (should be rare with v2).
  const disableLegacy =
    String(process.env.AI_DISABLE_LEGACY_CHAT_FALLBACK || 'true').toLowerCase() !== 'false' &&
    process.env.AI_DISABLE_LEGACY_CHAT_FALLBACK !== '0';

  if (disableLegacy) {
    console.warn('[live-chat] UNHANDLED_ORCHESTRATION_TURN', {
      message: trimmed.slice(0, 120),
      workflow: session.workflowState?.activeWorkflow,
    });
    const msg = await appendSessionMessage(session, {
      role: 'bot',
      body: 'I want to make sure I help with the right thing. Are you looking for order tracking, a refund, a return, or a product recommendation?',
      contentType: 'text',
      senderName: config.content.agentName,
    });
    return {
      messages: [msg],
      handoff: false,
      handoffState: buildHandoffWidgetPayload(session),
      turnDebug: {
        handled: true,
        legacyGroqCalled: false,
        responsePlanType: 'UNHANDLED_ORCHESTRATION_TURN',
      },
      error: 'UNHANDLED_ORCHESTRATION_TURN',
    };
  }

  if (wantsHumanHandoff(trimmed, channelAi.escalationKeywords)) {
    return attemptHumanHandoff(company, session, config, channelAi);
  }

  const intent = await groqClassify(trimmed);

  if (intent === 'human_handoff') {
    return attemptHumanHandoff(company, session, config, channelAi);
  }

  if (intent === 'off_topic') {
    const reply =
      "I'm here to help with this store — orders, products, shipping, and returns. What can I help you with today?";
    const msg = await appendSessionMessage(session, {
      role: 'bot',
      body: reply,
      contentType: 'text',
      senderName: config.content.agentName,
    });
    return { messages: [msg], handoff: false };
  }

  // Submitted shipping-address form (after order already verified)
  const shippingAddr = parseShippingAddressFromText(trimmed);
  if (shippingAddr && session.verifiedOrders?.length) {
    const order = await loadVerifiedOrder(session, company);
    if (order) {
      try {
        if (onStatus) onStatus('checking_order');
        await updateStoreOrder(company, order._id, { shippingAddress: shippingAddr });
        const msg = await appendSessionMessage(session, {
          role: 'bot',
          body: "Done — I've updated the shipping address on your order. Anything else I can help with?",
          contentType: 'text',
          senderName: config.content.agentName,
        });
        return { messages: [msg], handoff: false };
      } catch (err) {
        const msg = await appendSessionMessage(session, {
          role: 'bot',
          body:
            err.message ||
            "I couldn't update that address right now. Please double-check the details or ask me to connect you with a teammate.",
          contentType: 'text',
          senderName: config.content.agentName,
        });
        return { messages: [msg], handoff: false };
      }
    }
  }

  // Offer interactive address form when customer wants to change shipping
  if (wantsAddressChange(trimmed) && session.verifiedOrders?.length) {
    const msg = await appendSessionMessage(session, {
      role: 'bot',
      body: 'Sure — enter the new shipping address below and I’ll update your order.',
      contentType: 'input_form',
      payload: buildShippingAddressForm(),
      senderName: config.content.agentName,
    });
    return { messages: [msg], handoff: false };
  }

  if (wantsAddressChange(trimmed) && !session.verifiedOrders?.length) {
    const msg = await appendOrderLookupForm(session, config, false, false);
    return { messages: [msg], handoff: false };
  }

  const knowledge = await retrieveKnowledge(company._id, trimmed, 4);
  const knowledgeBlock = knowledge.length
    ? knowledge.map((k, i) => `[${i + 1}] ${k.title}\n${k.content}`).join('\n\n')
    : 'No specific policy documents found.';

  let toolContext = '';
  const richMessages = [];
  const orderIntents = intent === 'order_status' || intent === 'refund' || intent === 'cancel';
  const extractedUpFront = extractOrderNumber(trimmed);
  const extractedEmailUpFront = extractEmail(trimmed);
  const awaitingOrderDetails = Boolean(session.pendingOrderNumber || session.orderLookupEmail);

  // Persist deterministic entities into workflow state before any LLM turn
  const mapped = mapIntentToWorkflow(intent);
  if (orderIntents || extractedUpFront || extractedEmailUpFront || awaitingOrderDetails) {
    applyExtractedToWorkflow(
      session,
      { orderNumber: extractedUpFront, email: extractedEmailUpFront },
      {
        intent,
        workflow: mapped.workflow || session.workflowState?.activeWorkflow || 'track_order',
        step: 'collect_identity',
      },
    );
    await session.save();
  }

  // Treat email/order follow-ups as order flow even if the classifier says "general"
  const inOrderFlow =
    orderIntents ||
    extractedUpFront ||
    extractedEmailUpFront ||
    awaitingOrderDetails ||
    session.verifiedOrders?.length;

  if (inOrderFlow) {
    if (onStatus) onStatus('checking_order');

    const collectingCredentials =
      orderIntents ||
      extractedUpFront ||
      extractedEmailUpFront ||
      (awaitingOrderDetails && !session.verifiedOrders?.length) ||
      (awaitingOrderDetails && (extractedUpFront || extractedEmailUpFront));

    if (collectingCredentials || (orderIntents && !session.verifiedOrders?.length)) {
      const resolved = await resolveOrderForTurn(session, company, trimmed);

      if (resolved.needsDetails && !resolved.verification?.verified) {
        const msg = await appendOrderLookupForm(
          session,
          config,
          resolved.hasOrderNumber,
          resolved.hasEmail,
        );
        return { messages: [msg], handoff: false };
      }

      if (resolved.verification && !resolved.verification.verified) {
        // Unified message — never confirm that an order number exists or name the chat email
        const form = buildOrderLookupForm(false, false);
        const msg = await appendSessionMessage(session, {
          role: 'bot',
          body: ORDER_NO_MATCH,
          contentType: 'input_form',
          payload: form,
          senderName: config.content.agentName,
        });
        return { messages: [msg], handoff: false };
      }

      if (resolved.verification?.verified && resolved.verification.order) {
        const orderCard = formatOrderCard(resolved.verification.order);
        toolContext = `Active verified order for this chat: ${JSON.stringify(orderCard)}`;

        const orderMsg = await appendSessionMessage(session, {
          role: 'bot',
          body: narrateOrder(orderCard, intent),
          contentType: 'order_card',
          payload: orderCard,
          senderName: config.content.agentName,
        });
        richMessages.push(orderMsg);

        if (intent === 'refund' && channelAi.allowedActions.refundOrder) {
          const storeOrder = await StoreOrder.findOne({
            company: company._id,
            externalId: resolved.verification.order.externalId,
          });
          if (storeOrder) {
            const refund = await executeRefundIfAllowed(company, session, storeOrder, {
              allowedActions: channelAi.allowedActions,
            });
            const refundMsg = await appendSessionMessage(session, {
              role: 'bot',
              body: refund.message,
              contentType: 'text',
              senderName: config.content.agentName,
            });
            richMessages.push(refundMsg);
            if (refund.escalate) {
              // Offer handoff — do NOT auto-queue or show connecting until customer accepts
              offerHandoff(session, refund.handoffReason || 'refund_requires_review');
              await session.save();
              return {
                messages: richMessages,
                handoff: false,
                handoffState: buildHandoffWidgetPayload(session),
              };
            }
            return {
              messages: richMessages,
              handoff: false,
              handoffState: buildHandoffWidgetPayload(session),
            };
          }
        }

        // Always stop after a verified order card — never fall through to groq re-asking
        return {
          messages: richMessages,
          handoff: false,
          handoffState: buildHandoffWidgetPayload(session),
        };
      }
    } else if (session.verifiedOrders?.length) {
      const order = await loadVerifiedOrder(session, company);
      if (order) {
        toolContext = `Previously verified order still in context: ${JSON.stringify(formatOrderCard(order))}`;
      }
    }
  }

  if (intent === 'product_search' && channelAi.allowedActions.productRecommendations) {
    if (onStatus) onStatus('searching_products');
    const products = await searchProducts(company._id, trimmed, 4);
    if (products.length) {
      const cards = formatProductCards(products);
      const productMsg = await appendSessionMessage(session, {
        role: 'bot',
        body: 'Here are a few options that may fit. Tell me the occasion, style, or size and I can narrow these down.',
        contentType: 'product_cards',
        payload: { products: cards },
        senderName: config.content.agentName,
      });
      richMessages.push(productMsg);
      toolContext += `\nProducts: ${JSON.stringify(cards)}`;
      return { messages: richMessages, handoff: false };
    }
    toolContext +=
      '\nProduct search returned no matching items. Ask a short clarifying question about what they want from this store.';
  }

  if (!isGroqConfigured()) {
    const fallback = await appendSessionMessage(session, {
      role: 'bot',
      body: 'Thanks for your message. An agent will follow up shortly.',
      contentType: 'text',
      senderName: config.content.agentName,
    });
    richMessages.push(fallback);
    return { messages: richMessages, handoff: true };
  }

  if (onStatus) onStatus('thinking');

  if (!toolContext && session.verifiedOrders?.length) {
    const order = await loadVerifiedOrder(session, company);
    if (order) {
      toolContext = `Previously verified order still in context: ${JSON.stringify(formatOrderCard(order))}`;
    }
  }

  const customInstructions = channelAi.instructions
    ? `\nStore instructions:\n${channelAi.instructions}`
    : '';
  const channelStyle = channelAi.styleGuidance ? `\n${channelAi.styleGuidance}` : '';
  const verifiedNote = session.verifiedOrders?.length
    ? 'Customer has a verified order in this chat — use tool data; do not re-ask for order number/email.'
    : 'No verified order yet. For order questions, ask for order number and order email in chat.';
  const agentsOnlineNote = (await hasOnlineLiveChatAgents(company))
    ? 'Live agents: at least one teammate is online (only offer connect if needed).'
    : 'Live agents: none online right now — do not promise an immediate live handoff; keep helping and say the team will follow up.';
  const systemPrompt = `${SUPPORT_PLAYBOOK}${channelStyle}${customInstructions}\n\n${verifiedNote}\n${agentsOnlineNote}\n\nStore name: ${company.name || 'this store'}\n\nKnowledge:\n${knowledgeBlock}\n\nTool data:\n${toolContext || 'None'}`;

  // History already includes the just-appended customer message — do not duplicate it.
  const replyText = await groqChat({
    messages: [{ role: 'system', content: systemPrompt }, ...buildHistory(session)],
    temperature: 0.25,
    maxTokens: 500,
  });

  const textMsg = await appendSessionMessage(session, {
    role: 'bot',
    body: replyText,
    contentType: 'text',
    senderName: config.content.agentName,
  });

  if (knowledge.length && config.behavior.retrievalIndicator) {
    await appendSessionMessage(session, {
      role: 'bot',
      body: '',
      contentType: 'sources',
      payload: {
        sources: knowledge.map((k) => ({ title: k.title, category: k.category })),
      },
      senderName: config.content.agentName,
    });
  }

  richMessages.push(textMsg);
  return {
    messages: richMessages.filter((m) => m.contentType !== 'sources' || m.payload?.sources?.length),
    handoff: false,
    handoffState: buildHandoffWidgetPayload(session),
  };
}

module.exports = {
  processCustomerMessage,
  // exported for tests / tooling
  narrateOrder,
};
