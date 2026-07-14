const { groqChat, groqClassify, isGroqConfigured } = require('./groq.service');
const { mergeLiveChatConfig } = require('./live-chat-config.service');
const { retrieveKnowledge } = require('./live-chat-knowledge.service');
const {
  appendSessionMessage,
  verifyOrderForSession,
  isOrderVerified,
} = require('./live-chat-session.service');
const {
  extractOrderNumber,
  searchProducts,
  lookupOrderForEmail,
  executeRefundIfAllowed,
  formatProductCards,
  formatOrderCard,
} = require('./live-chat-tools.service');
const StoreOrder = require('../models/StoreOrder');
const { isTeamAvailableNow } = require('./live-chat-hours.service');
const { isChannelAiEnabled, resolveChannelAiConfig } = require('./ai-agent-config.service');

const SUPPORT_PLAYBOOK = `You are Agentra's ecommerce support assistant.
- Be warm, concise, and professional.
- Never invent order numbers, tracking, prices, or policies.
- For order-specific details, only use data provided in tool results.
- Before sharing order details or making changes, the customer must verify with order number + email.
- If unsure, offer to connect to a human agent.
- Do not discuss competitors or unrelated topics.
- For refunds over the store limit, escalate to a human.`;

function wantsHumanHandoff(text, keywords) {
  const lower = String(text).toLowerCase();
  return (keywords || []).some((kw) => lower.includes(String(kw).toLowerCase()));
}

function buildHistory(session, limit = 12) {
  return (session.messages || [])
    .slice(-limit)
    .filter((m) => m.contentType === 'text' && m.body)
    .map((m) => ({
      role: m.role === 'customer' ? 'user' : 'assistant',
      content: m.body,
    }));
}

async function processCustomerMessage(company, session, text, { onStatus } = {}) {
  const config = mergeLiveChatConfig(company);
  const channelAi = resolveChannelAiConfig(company, 'liveChat');
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Message is required');

  if (!isChannelAiEnabled(company, 'liveChat')) {
    await appendSessionMessage(session, {
      role: 'customer',
      body: trimmed,
      contentType: 'text',
      senderName: session.visitorEmail,
    });
    session.status = 'waiting_human';
    session.handoffRequestedAt = new Date();
    await session.save();
    const handoffMsg = await appendSessionMessage(session, {
      role: 'system',
      body: 'Connecting you with a support agent…',
      contentType: 'system_event',
      payload: { type: 'handoff_requested' },
      senderName: 'System',
    });
    return { messages: [handoffMsg], handoff: true };
  }

  await appendSessionMessage(session, {
    role: 'customer',
    body: trimmed,
    contentType: 'text',
    senderName: session.visitorEmail,
  });

  if (wantsHumanHandoff(trimmed, channelAi.escalationKeywords)) {
    const available = await isTeamAvailableNow(company);
    if (!available && config.behavior.handoffOnlyInBusinessHours) {
      const reply =
        config.content.offlineMessage ||
        'Our team is currently away. I can still help with orders and policies.';
      await appendSessionMessage(session, {
        role: 'bot',
        body: reply,
        contentType: 'text',
        senderName: config.content.agentName,
      });
      return { messages: [session.messages[session.messages.length - 1]], handoff: false };
    }
    session.status = 'waiting_human';
    session.handoffRequestedAt = new Date();
    await session.save();
    const handoffMsg = await appendSessionMessage(session, {
      role: 'system',
      body: 'Connecting you with a support agent…',
      contentType: 'system_event',
      payload: { type: 'handoff_requested' },
      senderName: 'System',
    });
    return { messages: [handoffMsg], handoff: true };
  }

  if (onStatus) onStatus('retrieving');
  const intent = await groqClassify(trimmed);
  const knowledge = await retrieveKnowledge(company._id, trimmed, 4);
  const knowledgeBlock = knowledge.length
    ? knowledge.map((k, i) => `[${i + 1}] ${k.title}\n${k.content}`).join('\n\n')
    : 'No specific policy documents found.';

  const orderNumber = extractOrderNumber(trimmed);
  let toolContext = '';
  const richMessages = [];

  if (intent === 'order_status' || intent === 'refund' || intent === 'cancel' || orderNumber) {
    if (onStatus) onStatus('checking_order');
    if (!orderNumber && config.behavior.requireOrderVerification) {
      const reply =
        'I can help with that. Please share your order number (for example #1042) so I can verify it with your email.';
      const msg = await appendSessionMessage(session, {
        role: 'bot',
        body: reply,
        contentType: 'text',
        senderName: config.content.agentName,
      });
      return { messages: [msg], handoff: false };
    }

    if (orderNumber) {
      const verification = await verifyOrderForSession(session, company, orderNumber);
      if (!verification.verified) {
        const reply =
          verification.reason === 'email_mismatch'
            ? "I couldn't verify that order with your email. Please double-check the order number."
            : "I couldn't find an order with that number. Please check and try again.";
        const msg = await appendSessionMessage(session, {
          role: 'bot',
          body: reply,
          contentType: 'text',
          senderName: config.content.agentName,
        });
        return { messages: [msg], handoff: false };
      }

      const orderCard = formatOrderCard(verification.order);
      toolContext = `Verified order: ${JSON.stringify(orderCard)}`;
      const orderMsg = await appendSessionMessage(session, {
        role: 'bot',
        body: `Here are the details for order ${orderCard.orderNumber}:`,
        contentType: 'order_card',
        payload: orderCard,
        senderName: config.content.agentName,
      });
      richMessages.push(orderMsg);

      if (intent === 'refund' && channelAi.allowedActions.refundOrder) {
        const storeOrder = await StoreOrder.findOne({
          company: company._id,
          externalId: verification.order.externalId,
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
            session.status = 'waiting_human';
            await session.save();
          }
          return { messages: richMessages, handoff: Boolean(refund.escalate) };
        }
      }

      if (intent === 'order_status') {
        return { messages: richMessages, handoff: false };
      }
    } else {
      const orders = await lookupOrderForEmail(company._id, session.visitorEmail);
      toolContext = orders.length
        ? `Recent orders: ${JSON.stringify(orders.map((o) => formatOrderCard(o)))}`
        : 'No orders found for this email.';
    }
  }

  if (intent === 'product_search' && channelAi.allowedActions.productRecommendations) {
    if (onStatus) onStatus('searching_products');
    const products = await searchProducts(company._id, trimmed, 4);
    if (products.length) {
      const cards = formatProductCards(products);
      const productMsg = await appendSessionMessage(session, {
        role: 'bot',
        body: 'Here are some products you might like:',
        contentType: 'product_cards',
        payload: { products: cards },
        senderName: config.content.agentName,
      });
      richMessages.push(productMsg);
      toolContext += `\nProducts: ${JSON.stringify(cards)}`;
    }
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
  const customInstructions = channelAi.instructions
    ? `\nStore instructions:\n${channelAi.instructions}`
    : '';
  const channelStyle = channelAi.styleGuidance ? `\n${channelAi.styleGuidance}` : '';
  const systemPrompt = `${SUPPORT_PLAYBOOK}${channelStyle}${customInstructions}\n\nKnowledge:\n${knowledgeBlock}\n\nTool data:\n${toolContext || 'None'}`;

  const replyText = await groqChat({
    messages: [{ role: 'system', content: systemPrompt }, ...buildHistory(session), { role: 'user', content: trimmed }],
    temperature: 0.35,
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
  return { messages: richMessages.filter((m) => m.contentType !== 'sources' || m.payload?.sources?.length), handoff: false };
}

module.exports = {
  processCustomerMessage,
};
