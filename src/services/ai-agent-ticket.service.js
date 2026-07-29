const Company = require('../models/Company');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { groqChat, groqClassify, isGroqConfigured } = require('./groq.service');
const { retrieveKnowledge } = require('./live-chat-knowledge.service');
const {
  extractOrderNumber,
  extractEmail,
  searchProducts,
  lookupOrderForEmail,
  executeRefundIfAllowed,
  formatProductCards,
  formatOrderCard,
} = require('./live-chat-tools.service');
const { isTeamAvailableNow } = require('./live-chat-hours.service');
const {
  channelKeyFromTicketSource,
  resolveChannelAiConfig,
  isChannelAiEnabled,
} = require('./ai-agent-config.service');
const facebookService = require('./facebook.service');
const instagramService = require('./instagram.service');
const whatsappService = require('./whatsapp.service');
const emailChannelService = require('./email-channel.service');

const SUPPORT_PLAYBOOK = `You are Agentra's ecommerce support assistant.
- Be warm and professional.
- Never invent order numbers, tracking, prices, or policies.
- For order-specific details, only use data provided in tool results.
- If unsure, offer to connect to a human agent.
- Do not discuss competitors or unrelated topics.
- Reply in plain text only (no HTML, markdown cards, or widgets).`;

const STORE_SECRET_SELECT =
  '+storeIntegration.shopify.accessToken +storeIntegration.shopify.refreshToken ' +
  '+storeIntegration.woocommerce.consumerKey ' +
  '+storeIntegration.woocommerce.consumerSecret ' +
  '+storeIntegration.custom.apiKey';

const ORDER_INTENTS = new Set(['order_status', 'refund', 'cancel', 'return', 'exchange']);

/** Debounce rapid inbound messages per ticket (ms). */
const REPLY_DEBOUNCE_MS = 1500;
const pendingAiReplies = new Map();

const AI_TICKET_STATUSES = new Set(['open', 'in_progress', 'on_hold', 'resolved']);

function applyAiTicketStatus(ticket, status, actorId = null) {
  if (!ticket || !AI_TICKET_STATUSES.has(status)) return;

  ticket.status = status;
  if (status === 'resolved') {
    ticket.closedAt = new Date();
    ticket.closedBy = actorId || null;
  } else {
    ticket.closedAt = undefined;
    ticket.closedBy = undefined;
  }
}

function wantsHumanHandoff(text, keywords) {
  const lower = String(text || '').toLowerCase();
  if ((keywords || []).some((kw) => lower.includes(String(kw).toLowerCase()))) {
    return true;
  }
  return (
    /\b(talk to (a )?(human|agent|person|someone)|real (person|human)|speak to (a )?(human|agent)|customer service|manager)\b/i.test(
      lower,
    ) || /\b(this (is|isn't|is not) helping|useless bot|stupid ai)\b/i.test(lower)
  );
}

/**
 * Placeholder identities created for Messenger / IG / WhatsApp customers.
 * Real checkout emails never use *.agentra.local.
 */
function isSyntheticEmail(email) {
  const value = String(email || '').toLowerCase().trim();
  if (!value) return true;
  if (value.endsWith('@agentra.local')) return true;
  if (value.includes('.agentra.local')) return true;
  // Legacy / mistaken domains from older checks
  if (
    value.includes('@messenger.local') ||
    value.includes('@instagram.local') ||
    value.includes('@whatsapp.local') ||
    value.endsWith('@fb.local')
  ) {
    return true;
  }
  return false;
}

function buildTicketHistory(ticket, limit = 12) {
  return (ticket.messages || [])
    .slice(-limit)
    .filter((m) => m.body && !m.isInternal)
    .map((m) => ({
      role: m.isAi || String(m.senderEmail || '').includes('bot@agentra') ? 'assistant' : 'user',
      content: String(m.body).replace(/^\[.*?\]\s*/, ''),
    }));
}

function recentCustomerText(ticket, latest) {
  const prior = (ticket.messages || [])
    .filter((m) => m.body && !m.isInternal && !m.isAi && !m.isSystem)
    .slice(-6)
    .map((m) => String(m.body))
    .join('\n');
  return `${prior}\n${latest || ''}`.trim();
}

function resolveLookupEmail(ticket, customer, messageText) {
  const fromDetails = String(ticket.details?.customerEmail || '').trim().toLowerCase();
  if (fromDetails && !isSyntheticEmail(fromDetails)) return fromDetails;

  const fromCustomer = String(customer?.email || '').trim().toLowerCase();
  if (fromCustomer && !isSyntheticEmail(fromCustomer)) return fromCustomer;

  const fromMessage = extractEmail(messageText);
  if (fromMessage && !isSyntheticEmail(fromMessage)) return fromMessage;

  return '';
}

function formatOrderPlainText(card) {
  if (!card) return '';
  const lines = [
    `Order ${card.orderNumber || ''}`.trim(),
    card.fulfillmentStatus ? `Fulfillment: ${card.fulfillmentStatus}` : null,
    card.financialStatus ? `Payment: ${card.financialStatus}` : null,
    card.totalDisplay ? `Total: ${card.totalDisplay}` : null,
    card.tracking?.number
      ? `Tracking: ${[card.tracking.company, card.tracking.number].filter(Boolean).join(' ')}`
      : null,
    card.tracking?.url ? `Tracking link: ${card.tracking.url}` : null,
    card.statusUrl ? `Order status: ${card.statusUrl}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

function formatProductsPlainText(cards) {
  if (!cards?.length) return '';
  return (
    'Products:\n' +
    cards
      .map((p) => {
        const price = p.price != null ? ` (${p.price}${p.currency ? ` ${p.currency}` : ''})` : '';
        const url = p.url ? ` — ${p.url}` : '';
        return `- ${p.title}${price}${url}`;
      })
      .join('\n')
  );
}

async function resolveBotSender(company) {
  let bot = await User.findOne({
    company: company._id,
    email: 'bot@agentra.local',
  });
  if (bot) return bot;

  bot = await User.findById(company.owner).select('_id email firstName lastName');
  return bot;
}

async function deliverChannelReply(companyId, ticket, body) {
  if (ticket.source === 'facebook') {
    await facebookService.sendReplyForTicket(companyId, ticket, body);
  } else if (ticket.source === 'instagram') {
    await instagramService.sendReplyForTicket(companyId, ticket, body);
  } else if (ticket.source === 'whatsapp') {
    await whatsappService.sendReplyForTicket(companyId, ticket, body);
  } else if (ticket.source === 'email') {
    await emailChannelService.sendReplyForTicket(companyId, ticket, body);
  }
}

async function markHandoff(ticket, company, agentName, customerReply) {
  const {
    CHANNEL_HANDOFF_REPLY,
    pushHandoffRequestedEvent,
  } = require('./ticket-system-events.service');

  await appendAiMessageAndSend(
    company,
    ticket,
    agentName,
    customerReply || CHANNEL_HANDOFF_REPLY,
    { nextStatus: 'open' },
  );
  await pushHandoffRequestedEvent(ticket, company);
  ticket.isUnread = true;
  ticket.lastActivity = new Date();
  await ticket.save();

  const { scheduleTicketIntelligence } = require('./ticket-intelligence.service');
  scheduleTicketIntelligence(company._id, ticket._id, { force: true });
}

async function findOrderForLookup(companyId, email, orderNumber) {
  if (!email) return null;
  if (orderNumber) {
    const matched = await lookupOrderForEmail(companyId, email, orderNumber);
    if (matched.length) return matched[0];
    return null;
  }
  const recent = await lookupOrderForEmail(companyId, email);
  return recent[0] || null;
}

/**
 * Generate and send an AI reply for an inbox ticket on enabled channels.
 * Live chat continues to use live-chat-ai.service (session + rich cards).
 */
async function processTicketAiReply(companyId, ticketId, customerText) {
  const trimmed = String(customerText || '').trim();
  if (!trimmed) return { skipped: true, reason: 'empty' };

  const company = await Company.findById(companyId)
    .select(STORE_SECRET_SELECT)
    .populate('owner', '_id email');
  if (!company) return { skipped: true, reason: 'company' };

  const ticket = await Ticket.findById(ticketId);
  if (!ticket || String(ticket.company) !== String(company._id)) {
    return { skipped: true, reason: 'ticket' };
  }

  const channelKey = channelKeyFromTicketSource(ticket.source);
  if (!channelKey || channelKey === 'liveChat') {
    return { skipped: true, reason: 'channel' };
  }
  if (!isChannelAiEnabled(company, channelKey)) {
    return { skipped: true, reason: 'disabled' };
  }

  // Human already owning the thread — don't auto-reply.
  if (ticket.assigned_agent) {
    return { skipped: true, reason: 'assigned' };
  }

  const config = resolveChannelAiConfig(company, channelKey);
  const agentName = config.agentName || 'Support Assistant';

  if (wantsHumanHandoff(trimmed, config.escalationKeywords)) {
    const available = await isTeamAvailableNow(company);
    if (!available && config.handoffOnlyInBusinessHours) {
      const reply =
        config.offlineMessage ||
        'Our team is currently away. Leave a message and we will get back to you.';
      await appendAiMessageAndSend(company, ticket, agentName, reply, {
        nextStatus: 'open',
      });
      return { skipped: false, handoff: false, offline: true };
    }

    await markHandoff(ticket, company, agentName);
    return { skipped: false, handoff: true };
  }

  if (!isGroqConfigured()) {
    return { skipped: true, reason: 'groq' };
  }

  // The unassigned ticket is now actively being handled by the AI.
  applyAiTicketStatus(ticket, 'in_progress');
  ticket.lastActivity = new Date();
  await ticket.save();

  const customer = await User.findById(ticket.createdBy).select('email firstName lastName');
  const historyBlob = recentCustomerText(ticket, trimmed);
  let lookupEmail = resolveLookupEmail(ticket, customer, historyBlob);
  const orderNumber = extractOrderNumber(trimmed) || extractOrderNumber(historyBlob);

  if (lookupEmail && isSyntheticEmail(String(customer?.email || ''))) {
    ticket.details = ticket.details || {};
    if (ticket.details.customerEmail !== lookupEmail) {
      ticket.details.customerEmail = lookupEmail;
      ticket.markModified('details');
      await ticket.save();
    }
  }

  const intent = await groqClassify(trimmed);
  const needsOrderHelp =
    ORDER_INTENTS.has(intent) || Boolean(orderNumber) || /\b(order|tracking|shipment|delivery|refund|cancel)\b/i.test(trimmed);

  const knowledge = await retrieveKnowledge(company._id, trimmed, 4);
  const knowledgeBlock = knowledge.length
    ? knowledge.map((k, i) => `[${i + 1}] ${k.title}\n${k.content}`).join('\n\n')
    : 'No specific policy documents found.';

  let toolContext = '';
  const prefaceParts = [];
  let matchedOrder = null;

  if (needsOrderHelp && config.allowedActions?.lookupOrder !== false) {
    const wantsSpecificOrder =
      ORDER_INTENTS.has(intent) || Boolean(orderNumber) || /\b(tracking|shipment|delivery|refund|cancel)\b/i.test(trimmed);
    const needOrderNumber =
      Boolean(config.requireOrderVerification) &&
      !orderNumber &&
      (intent === 'order_status' || intent === 'refund' || intent === 'cancel');

    if (wantsSpecificOrder && (!lookupEmail || needOrderNumber)) {
      const askParts = [];
      if (!orderNumber) askParts.push('your order number (for example #1042)');
      if (!lookupEmail) askParts.push('the email address used when placing the order');
      if (askParts.length) {
        const reply =
          askParts.length === 2
            ? `I can help with that. Please reply with ${askParts[0]} and ${askParts[1]} so I can look it up securely.`
            : `I can help with that. Please reply with ${askParts[0]} so I can look it up.`;
        await appendAiMessageAndSend(company, ticket, agentName, reply);
        return { skipped: false, handoff: false, askedIdentity: true };
      }
    }

    matchedOrder = await findOrderForLookup(company._id, lookupEmail, orderNumber);

    if (orderNumber && !matchedOrder) {
      const reply = lookupEmail
        ? "I couldn't find an order with that number for this email. Please double-check the details, or ask to speak with a human agent."
        : "I couldn't find that order. Please share the email used on the order so I can look it up.";
      await appendAiMessageAndSend(company, ticket, agentName, reply);
      return { skipped: false, handoff: false };
    }

    if (matchedOrder) {
      // Social placeholders must not unlock order data without a real email match.
      if (lookupEmail) {
        const orderEmail = String(matchedOrder.customer?.email || '').toLowerCase();
        if (orderEmail && orderEmail !== lookupEmail) {
          const reply =
            "That order number doesn't match the email you provided. Please check both and try again, or ask to speak with a human agent.";
          await appendAiMessageAndSend(company, ticket, agentName, reply);
          return { skipped: false, handoff: false };
        }
      } else if (isSyntheticEmail(customer?.email)) {
        const reply =
          'To protect your privacy, please share the email address used on the order along with the order number.';
        await appendAiMessageAndSend(company, ticket, agentName, reply);
        return { skipped: false, handoff: false, askedIdentity: true };
      }

      const card = formatOrderCard(matchedOrder);
      toolContext = `Order: ${JSON.stringify(card)}`;
      prefaceParts.push(formatOrderPlainText(card));

      if (intent === 'refund') {
        if (!config.allowedActions?.refundOrder) {
          await markHandoff(
            ticket,
            company,
            agentName,
            'I can help start a refund request. A team member will review and complete it shortly.',
          );
          return { skipped: false, handoff: true };
        }

        const verifiedSession = {
          verifiedOrders: [{ externalId: matchedOrder.externalId }],
        };
        const refundResult = await executeRefundIfAllowed(company, verifiedSession, matchedOrder, {
          allowedActions: config.allowedActions,
        });

        if (refundResult.ok) {
          await appendAiMessageAndSend(company, ticket, agentName, refundResult.message, {
            // A verified refund is a completed action, so the AI may resolve it.
            nextStatus: 'resolved',
          });
          return { skipped: false, handoff: false, refunded: true };
        }

        await markHandoff(
          ticket,
          company,
          agentName,
          refundResult.message ||
            'This refund needs a quick review from our support team. Someone will follow up shortly.',
        );
        return { skipped: false, handoff: true, escalate: true };
      }

      if (intent === 'cancel') {
        if (!config.allowedActions?.cancelOrder) {
          await markHandoff(
            ticket,
            company,
            agentName,
            'I can pass this cancellation request to our team. Someone will follow up shortly.',
          );
          return { skipped: false, handoff: true };
        }
        await markHandoff(
          ticket,
          company,
          agentName,
          'I found your order. A team member will confirm and complete the cancellation shortly.',
        );
        return { skipped: false, handoff: true };
      }
    } else if (lookupEmail) {
      const orders = await lookupOrderForEmail(company._id, lookupEmail);
      toolContext = orders.length
        ? `Recent orders: ${JSON.stringify(orders.slice(0, 3).map((o) => formatOrderCard(o)))}`
        : 'No orders found for this email.';
      if (orders.length === 1) {
        prefaceParts.push(formatOrderPlainText(formatOrderCard(orders[0])));
      }
    }
  }

  if (intent === 'product_search' && config.allowedActions?.productRecommendations) {
    const products = await searchProducts(company._id, trimmed, 4);
    if (products.length) {
      const cards = formatProductCards(products);
      toolContext += `\nProducts: ${JSON.stringify(cards)}`;
      prefaceParts.push(formatProductsPlainText(cards));
    }
  }

  const customInstructions = config.instructions
    ? `\nStore instructions:\n${config.instructions}`
    : '';
  const channelStyle = config.styleGuidance ? `\n${config.styleGuidance}` : '';
  const systemPrompt = `${SUPPORT_PLAYBOOK}${channelStyle}${customInstructions}\n\nKnowledge:\n${knowledgeBlock}\n\nTool data:\n${toolContext || 'None'}`;

  const replyText = await groqChat({
    messages: [
      { role: 'system', content: systemPrompt },
      ...buildTicketHistory(ticket),
      { role: 'user', content: trimmed },
    ],
    temperature: 0.35,
  });

  const body = [...prefaceParts, replyText].filter(Boolean).join('\n\n');
  await appendAiMessageAndSend(company, ticket, agentName, body);
  return { skipped: false, handoff: false };
}

async function appendAiMessageAndSend(
  company,
  ticket,
  agentName,
  replyText,
  { nextStatus = 'on_hold' } = {},
) {
  const sender = await resolveBotSender(company);
  if (!sender) throw new Error('No sender available for AI reply');

  const text = String(replyText || '').trim();
  if (!text) return;

  ticket.messages.push({
    sender: sender._id,
    senderEmail: 'bot@agentra.local',
    senderName: agentName || undefined,
    body: text,
    attachments: [],
    isInternal: false,
    isAi: true,
    sentAt: new Date(),
  });
  // Most AI replies wait for the customer to confirm, clarify, or continue.
  // Human escalations explicitly use `open`; completed actions use `resolved`.
  applyAiTicketStatus(ticket, nextStatus, sender._id);
  ticket.lastActivity = new Date();
  // Keep unread so humans see AI handled it and can take over.
  ticket.isUnread = true;
  await ticket.save();

  try {
    await deliverChannelReply(company._id, ticket, text);
  } catch (err) {
    console.error('[ai-agent] channel delivery failed', ticket.source, err.message);
  }
}

/**
 * Fire-and-forget wrapper for inbound hooks.
 * Debounces per ticket so rapid DMs collapse into one reply on the latest text.
 */
function scheduleTicketAiReply(companyId, ticketId, customerText) {
  const key = String(ticketId);
  const existing = pendingAiReplies.get(key);
  if (existing?.timer) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    const job = pendingAiReplies.get(key);
    pendingAiReplies.delete(key);
    const text = job?.text || customerText;
    processTicketAiReply(companyId, ticketId, text).catch((err) => {
      console.error('[ai-agent] ticket reply failed', err.message);
    });
  }, REPLY_DEBOUNCE_MS);

  pendingAiReplies.set(key, {
    timer,
    text: customerText,
    companyId,
  });
}

module.exports = {
  processTicketAiReply,
  scheduleTicketAiReply,
  isSyntheticEmail,
  wantsHumanHandoff,
};
