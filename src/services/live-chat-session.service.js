const crypto = require('crypto');
const ChatSession = require('../models/ChatSession');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');
const { mergeLiveChatConfig } = require('./live-chat-config.service');

function generateSessionToken() {
  return crypto.randomBytes(24).toString('hex');
}

async function findOrCreateCustomerByEmail(company, email) {
  const normalized = String(email).toLowerCase().trim();
  let customer = await User.findOne({ email: normalized, company: company._id });
  if (customer) return customer;

  const localPart = normalized.split('@')[0] || 'Customer';
  const nameParts = localPart.replace(/[._+-]/g, ' ').split(/\s+/).filter(Boolean);
  customer = await User.create({
    email: normalized,
    company: company._id,
    firstName: nameParts[0] || 'Chat',
    lastName: nameParts.slice(1).join(' ') || 'Visitor',
    role: 'customer',
    password: crypto.randomBytes(32).toString('hex'),
    isEmailVerified: false,
  });
  return customer;
}

async function createChatTicket(company, customer, email, firstMessage) {
  const ticketCode = await Ticket.generateCode(company._id, 'TKT');
  const config = mergeLiveChatConfig(company);
  const title = firstMessage
    ? String(firstMessage).replace(/\s+/g, ' ').trim().slice(0, 80) || 'Live chat conversation'
    : 'Live chat conversation';

  const ticket = await Ticket.create({
    ticket_code: ticketCode,
    company_subdomain: company.subdomain,
    company: company._id,
    ticket_title: title,
    ticket_description: config.content.welcomeMessage,
    source: 'chatbot',
    status: 'open',
    createdBy: customer._id,
    assigned_agent: null,
    peoples: [{ user: customer._id, role: 'customer' }],
    details: {
      customerEmail: email,
    },
    messages: [],
    lastActivity: new Date(),
  });

  await Counter.increment(`company:${company._id}`, 'totalTickets');
  return ticket;
}

function sanitizeCustomerFacingText(text) {
  return String(text || '')
    .replace(/\u2014|\u2013/g, ',') // em/en dash → comma
    .replace(/\s*,\s*,+/g, ',')
    .replace(/\s+--\s+/g, ', ')
    .replace(/(^|[^\-])--([^\-]|$)/g, '$1, $2')
    .replace(/\s+,/g, ',')
    .replace(/,\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function appendSessionMessage(session, message) {
  let body = message.body || '';
  if ((message.role === 'bot' || message.role === 'system') && body) {
    body = sanitizeCustomerFacingText(body);
  }
  session.messages.push({
    role: message.role,
    body,
    contentType: message.contentType || 'text',
    payload: message.payload,
    senderName: message.senderName,
    sentAt: message.sentAt || new Date(),
  });
  session.lastActivityAt = new Date();
  await session.save();
  return session.messages[session.messages.length - 1];
}

async function syncMessageToTicket(ticket, { role, body, senderName, customerUser, agentUser, eventType }) {
  if (!ticket || !body) return;
  let senderId;
  let senderEmail;
  let isAi = false;
  let isSystem = false;
  let contentType = 'text';

  if (role === 'customer') {
    senderId = customerUser._id;
    senderEmail = customerUser.email;
  } else if (role === 'agent' && agentUser) {
    senderId = agentUser._id;
    senderEmail = agentUser.email;
  } else if (role === 'bot') {
    senderId = customerUser._id;
    senderEmail = 'bot@agentra.local';
    isAi = true;
  } else if (role === 'system') {
    senderId = customerUser?._id || agentUser?._id;
    if (!senderId) return;
    senderEmail = 'system@agentra.local';
    isSystem = true;
    contentType = 'system_event';
  } else {
    return;
  }

  ticket.messages.push({
    sender: senderId,
    senderEmail,
    body: isSystem ? String(body) : `[${senderName || role}] ${body}`,
    sentAt: new Date(),
    isInternal: false,
    isAi,
    isSystem,
    contentType,
    eventType: isSystem ? eventType || 'notice' : undefined,
  });
  ticket.lastActivity = new Date();
  if (ticket.status === 'closed' || ticket.status === 'resolved') {
    ticket.status = 'open';
  }
  await ticket.save();
}

async function startSession(company, { email, pageUrl, origin, userAgent }) {
  const normalizedEmail = String(email).toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('A valid email address is required');
  }

  const customer = await findOrCreateCustomerByEmail(company, normalizedEmail);
  const ticket = await createChatTicket(company, customer, normalizedEmail);
  const sessionToken = generateSessionToken();
  const config = mergeLiveChatConfig(company);

  const session = await ChatSession.create({
    company: company._id,
    ticket: ticket._id,
    sessionToken,
    visitorEmail: normalizedEmail,
    status: 'active',
    metadata: { pageUrl, origin, userAgent },
    messages: [
      {
        role: 'bot',
        body: config.content.welcomeMessage,
        contentType: 'text',
        senderName: config.content.agentName,
        sentAt: new Date(),
      },
    ],
  });

  return { session, ticket, customer, config };
}

async function getSessionByToken(sessionToken) {
  return ChatSession.findOne({ sessionToken }).populate('ticket').populate('assignedAgent');
}

/**
 * Verify an order using BOTH order number and email in one query.
 * Never look up by order number alone — that would leak whether an order exists.
 */
async function verifyOrderForSession(session, company, orderNumber, email) {
  const StoreOrder = require('../models/StoreOrder');
  const normalizedNumber = String(orderNumber || '').replace(/^#/, '').trim();
  const normalizedEmail = String(email || '').toLowerCase().trim();

  if (!normalizedNumber || !normalizedEmail) {
    return { verified: false, reason: 'missing_details' };
  }

  // Combined query only — identical failure for wrong number, wrong email, or both.
  const order = await StoreOrder.findOne({
    company: company._id,
    'customer.email': normalizedEmail,
    $or: [
      { externalId: normalizedNumber },
      { orderNumber: new RegExp(`${normalizedNumber}$`, 'i') },
      { name: new RegExp(`#?${normalizedNumber}$`, 'i') },
    ],
  }).lean();

  if (!order) {
    // Clear pending pair so the next attempt must re-supply both (avoids retrying a bad email).
    session.pendingOrderNumber = undefined;
    session.orderLookupEmail = undefined;
    await session.save();
    return { verified: false, reason: 'no_match' };
  }

  session.orderLookupEmail = normalizedEmail;
  session.pendingOrderNumber = undefined;
  const existing = session.verifiedOrders.find((v) => v.externalId === order.externalId);
  if (!existing) {
    session.verifiedOrders.push({
      externalId: order.externalId,
      orderNumber: order.orderNumber || order.name,
    });
  }
  await session.save();

  return { verified: true, order };
}

function isOrderVerified(session, externalId) {
  return session.verifiedOrders.some((v) => v.externalId === String(externalId));
}

module.exports = {
  startSession,
  getSessionByToken,
  appendSessionMessage,
  syncMessageToTicket,
  verifyOrderForSession,
  isOrderVerified,
  findOrCreateCustomerByEmail,
  sanitizeCustomerFacingText,
};
