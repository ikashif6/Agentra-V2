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
  const config = mergeLiveChatConfig(company);
  const prefix = company.settings?.ticketPrefix || 'TKT';
  const title = firstMessage
    ? String(firstMessage).replace(/\s+/g, ' ').trim().slice(0, 80) || 'Live chat conversation'
    : 'Live chat conversation';

  const ticket = await Ticket.createWithCode(company._id, prefix, {
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
  const attachments = normalizeLiveChatAttachments(message.attachments);
  session.messages.push({
    role: message.role,
    body,
    contentType: message.contentType || 'text',
    payload: message.payload,
    attachments,
    senderName: message.senderName,
    senderAvatar: message.senderAvatar,
    sentAt: message.sentAt || new Date(),
  });
  session.lastActivityAt = new Date();
  await session.save();
  return session.messages[session.messages.length - 1];
}

function uploadsBaseUrl() {
  return (
    process.env.APP_API_URL ||
    process.env.API_PUBLIC_URL ||
    `http://localhost:${process.env.PORT || 5000}`
  ).replace(/\/$/, '');
}

function isAllowedUploadUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return false;
  const base = `${uploadsBaseUrl()}/api/uploads/`;
  try {
    const parsed = new URL(raw);
    const allowed = new URL(base);
    return parsed.origin === allowed.origin && parsed.pathname.startsWith('/api/uploads/');
  } catch {
    return false;
  }
}

function normalizeLiveChatAttachments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && item.url && item.filename && isAllowedUploadUrl(item.url))
    .slice(0, 5)
    .map((item) => ({
      url: String(item.url).trim().slice(0, 2000),
      filename: String(item.filename).trim().slice(0, 255),
      mimetype: item.mimetype ? String(item.mimetype).slice(0, 120) : undefined,
      size: Number.isFinite(Number(item.size)) ? Number(item.size) : undefined,
    }));
}

function isHumanAgentJoined(session) {
  if (!session) return false;
  if (session.status === 'with_human' && session.assignedAgent) return true;
  const status = session.handoffState?.status;
  const responder = session.handoffState?.activeResponder;
  return status === 'agent_joined' || responder === 'human';
}

async function syncMessageToTicket(ticket, { role, body, senderName, customerUser, agentUser, eventType, attachments }) {
  const files = normalizeLiveChatAttachments(attachments);
  const text = String(body || '').trim() || (files.length ? '(Attachment)' : '');
  if (!ticket || !text) return;
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
    senderName: isSystem ? undefined : senderName || undefined,
    body: text,
    attachments: files,
    sentAt: new Date(),
    isInternal: false,
    isAi,
    isSystem,
    contentType,
    eventType: isSystem ? eventType || 'notice' : undefined,
  });

  // Keep the helpdesk ticket lifecycle in sync with the live-chat responder.
  // Customer/agent activity is active work; an AI answer waits on the customer.
  if (role === 'customer' || role === 'agent') {
    ticket.status = 'in_progress';
    ticket.closedAt = undefined;
    ticket.closedBy = undefined;
  } else if (role === 'bot' && !ticket.assigned_agent) {
    ticket.status = 'on_hold';
    ticket.closedAt = undefined;
    ticket.closedBy = undefined;
  }

  ticket.lastActivity = new Date();
  await ticket.save();
}

async function startSession(company, { email, pageUrl, origin, userAgent }) {
  const normalizedEmail = String(email).toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    const err = new Error('A valid email address is required');
    err.statusCode = 400;
    err.expose = true;
    throw err;
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
  normalizeLiveChatAttachments,
  isHumanAgentJoined,
  isAllowedUploadUrl,
};
