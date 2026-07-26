const Company = require('../models/Company');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const StoreOrder = require('../models/StoreOrder');
const { groqChat, groqClassify, isGroqConfigured } = require('./groq.service');
const { retrieveKnowledge } = require('./live-chat-knowledge.service');
const {
  extractOrderNumber,
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
- Do not discuss competitors or unrelated topics.`;

const STORE_SECRET_SELECT =
  '+storeIntegration.shopify.accessToken +storeIntegration.shopify.refreshToken ' +
  '+storeIntegration.woocommerce.consumerKey ' +
  '+storeIntegration.woocommerce.consumerSecret ' +
  '+storeIntegration.custom.apiKey';

function wantsHumanHandoff(text, keywords) {
  const lower = String(text).toLowerCase();
  return (keywords || []).some((kw) => lower.includes(String(kw).toLowerCase()));
}

function isSyntheticEmail(email) {
  const value = String(email || '').toLowerCase();
  return (
    !value ||
    value.includes('@messenger.local') ||
    value.includes('@instagram.local') ||
    value.includes('@whatsapp.local') ||
    value.endsWith('@fb.local')
  );
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

async function resolveBotSender(company) {
  let bot = await User.findOne({
    company: company._id,
    email: 'bot@agentra.local',
  });
  if (bot) return bot;

  // Prefer company owner as message sender so Ticket schema (required sender) is satisfied;
  // AI messages are flagged with isAi + bot@agentra.local.
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
    // Live chat is handled by the widget AI path.
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
      await appendAiMessageAndSend(company, ticket, agentName, reply);
      return { skipped: false, handoff: false, offline: true };
    }

    const {
      CHANNEL_HANDOFF_REPLY,
      pushHandoffRequestedEvent,
    } = require('./ticket-system-events.service');

    // Customer-visible note on email / social channels
    await appendAiMessageAndSend(company, ticket, agentName, CHANNEL_HANDOFF_REPLY);
    await pushHandoffRequestedEvent(ticket, company);
    ticket.isUnread = true;
    ticket.lastActivity = new Date();
    await ticket.save();

    const { scheduleTicketIntelligence } = require('./ticket-intelligence.service');
    scheduleTicketIntelligence(company._id, ticket._id, { force: true });
    return { skipped: false, handoff: true };
  }

  if (!isGroqConfigured()) {
    return { skipped: true, reason: 'groq' };
  }

  const customer = await User.findById(ticket.createdBy).select('email firstName lastName');
  const visitorEmail = customer?.email || '';
  const canVerifyOrders = !isSyntheticEmail(visitorEmail);

  const intent = await groqClassify(trimmed);
  const knowledge = await retrieveKnowledge(company._id, trimmed, 4);
  const knowledgeBlock = knowledge.length
    ? knowledge.map((k, i) => `[${i + 1}] ${k.title}\n${k.content}`).join('\n\n')
    : 'No specific policy documents found.';

  const orderNumber = extractOrderNumber(trimmed);
  let toolContext = '';
  const prefaceParts = [];

  if (
    canVerifyOrders &&
    (intent === 'order_status' || intent === 'refund' || intent === 'cancel' || orderNumber)
  ) {
    if (!orderNumber && config.requireOrderVerification) {
      const reply =
        'I can help with that. Please share your order number (for example #1042) so I can look it up with your email.';
      await appendAiMessageAndSend(company, ticket, agentName, reply);
      return { skipped: false, handoff: false };
    }

    if (orderNumber) {
      const orders = await lookupOrderForEmail(company._id, visitorEmail);
      const match = orders.find((o) => {
        const num = String(o.orderNumber || o.name || '').replace(/^#/, '');
        return num === String(orderNumber).replace(/^#/, '');
      });

      if (!match) {
        const byCode = await StoreOrder.findOne({
          company: company._id,
          $or: [
            { orderNumber: orderNumber },
            { orderNumber: `#${String(orderNumber).replace(/^#/, '')}` },
            { name: orderNumber },
            { name: `#${String(orderNumber).replace(/^#/, '')}` },
          ],
        });
        if (!byCode) {
          const reply =
            "I couldn't find an order with that number for this email. Please check and try again, or ask to speak with a human agent.";
          await appendAiMessageAndSend(company, ticket, agentName, reply);
          return { skipped: false, handoff: false };
        }
        const card = formatOrderCard(byCode);
        toolContext = `Order: ${JSON.stringify(card)}`;
        prefaceParts.push(`Order ${card.orderNumber}: status ${card.status || 'unknown'}.`);
      } else {
        const card = formatOrderCard(match);
        toolContext = `Order: ${JSON.stringify(card)}`;
        prefaceParts.push(`Order ${card.orderNumber}: status ${card.status || 'unknown'}.`);
      }

      if (intent === 'refund' && config.allowedActions.refundOrder) {
        // Ticket path: escalate refunds for human confirmation on non-chat channels.
        ticket.isUnread = true;
        const { pushHandoffRequestedEvent } = require('./ticket-system-events.service');
        const reply =
          'I can help start a refund request. A team member will review and complete it shortly.';
        await appendAiMessageAndSend(company, ticket, agentName, reply);
        await pushHandoffRequestedEvent(ticket, company);
        await ticket.save();
        const { scheduleTicketIntelligence } = require('./ticket-intelligence.service');
        scheduleTicketIntelligence(company._id, ticket._id, { force: true });
        return { skipped: false, handoff: true };
      }
    } else {
      const orders = await lookupOrderForEmail(company._id, visitorEmail);
      toolContext = orders.length
        ? `Recent orders: ${JSON.stringify(orders.slice(0, 3).map((o) => formatOrderCard(o)))}`
        : 'No orders found for this email.';
    }
  }

  if (intent === 'product_search' && config.allowedActions.productRecommendations) {
    const products = await searchProducts(company._id, trimmed, 4);
    if (products.length) {
      const cards = formatProductCards(products);
      toolContext += `\nProducts: ${JSON.stringify(cards)}`;
      prefaceParts.push(
        'Products:\n' +
          cards
            .map((p) => `- ${p.title}${p.price != null ? ` (${p.price})` : ''}`)
            .join('\n'),
      );
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

async function appendAiMessageAndSend(company, ticket, agentName, replyText) {
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

/** Fire-and-forget wrapper for inbound hooks */
function scheduleTicketAiReply(companyId, ticketId, customerText) {
  setImmediate(() => {
    processTicketAiReply(companyId, ticketId, customerText).catch((err) => {
      console.error('[ai-agent] ticket reply failed', err.message);
    });
  });
}

module.exports = {
  processTicketAiReply,
  scheduleTicketAiReply,
};
