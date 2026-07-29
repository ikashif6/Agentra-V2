const ChatSession = require('../models/ChatSession');
const Ticket = require('../models/Ticket');
const LiveChatRating = require('../models/LiveChatRating');
const { broadcastToSession } = require('./live-chat-websocket.service');
const { agentDisplayName } = require('./ticket-system-events.service');

const RATING_LABELS = {
  1: 'very_bad',
  2: 'bad',
  3: 'okay',
  4: 'good',
  5: 'excellent',
};

/**
 * End every live session linked to a solved ticket and ask the visitor for CSAT.
 * The event is persisted before broadcast, so refresh/reconnect shows it too.
 */
async function resolveLiveChatForTicket(
  company,
  ticket,
  actor,
  { resolvedByCustomer = false } = {},
) {
  if (!['chat', 'chatbot'].includes(String(ticket.source))) return [];

  const sessions = await ChatSession.find({
    company: company._id || company,
    ticket: ticket._id,
    status: { $ne: 'closed' },
  });
  const now = new Date();
  const agentId = ticket.assigned_agent || actor?._id || actor;
  const resolverName = resolvedByCustomer
    ? 'You'
    : actor
      ? agentDisplayName(actor)
      : 'Your support agent';
  const resolutionBody = resolvedByCustomer
    ? 'You ended this conversation.'
    : `${resolverName} marked this conversation as solved.`;
  const updated = [];

  for (const session of sessions) {
    session.status = 'closed';
    session.closedAt = now;
    session.resolution = {
      resolvedAt: now,
      resolvedBy: actor?._id || actor || undefined,
      resolvedAgent: agentId || undefined,
    };
    session.feedback = {
      ...(session.feedback?.toObject?.() || session.feedback || {}),
      requestedAt: now,
    };
    const message = {
      role: 'system',
      body: resolutionBody,
      contentType: 'system_event',
      payload: {
        type: 'conversation_resolved',
        resolvedByName: resolverName,
        ratingRequested: true,
      },
      senderName: 'System',
      sentAt: now,
    };
    session.messages.push(message);
    session.lastActivityAt = now;
    await session.save();

    const saved = session.messages[session.messages.length - 1];
    broadcastToSession(String(company._id || company), session.sessionToken, {
      type: 'message',
      data: saved,
    });
    updated.push(session);
  }

  if (updated.length) {
    ticket.customerSatisfaction = {
      ...(ticket.customerSatisfaction?.toObject?.() || ticket.customerSatisfaction || {}),
      session: updated[0]._id,
      requestedAt: now,
    };
    if (agentId) ticket.customerSatisfaction.agent = agentId;
    ticket.markModified('customerSatisfaction');
    await ticket.save();
  }

  // Email a Shopify-style conversation copy after resolve (non-blocking).
  try {
    const {
      sendConversationTranscriptEmail,
    } = require('./conversation-transcript-email.service');
    sendConversationTranscriptEmail(company, ticket).catch((err) =>
      console.error('[transcript email]', err.message),
    );
  } catch (err) {
    console.error('[transcript email]', err.message);
  }

  return updated;
}

async function submitLiveChatRating({ company, sessionToken, rating }) {
  const numericRating = Number(rating);
  if (!Number.isInteger(numericRating) || !RATING_LABELS[numericRating]) {
    const err = new Error('Rating must be an integer from 1 to 5');
    err.statusCode = 400;
    throw err;
  }

  const session = await ChatSession.findOne({
    company: company._id || company,
    sessionToken,
  });
  if (!session) {
    const err = new Error('Chat session not found');
    err.statusCode = 404;
    throw err;
  }
  const agent = session.resolution?.resolvedAgent || session.assignedAgent;
  if (session.status !== 'closed' || !session.feedback?.requestedAt || !session.ticket) {
    const err = new Error('This conversation is not awaiting feedback');
    err.statusCode = 400;
    throw err;
  }
  if (session.feedback?.submittedAt) {
    const err = new Error('Feedback has already been submitted');
    err.statusCode = 409;
    throw err;
  }

  const now = new Date();
  const label = RATING_LABELS[numericRating];
  let record;
  try {
    record = await LiveChatRating.create({
      company: company._id || company,
      ticket: session.ticket,
      session: session._id,
      ...(agent ? { agent } : {}),
      rating: numericRating,
      label,
      visitorEmail: session.visitorEmail,
      resolvedAt: session.resolution?.resolvedAt || session.closedAt,
      submittedAt: now,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const conflict = new Error('Feedback has already been submitted');
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  }

  session.feedback.rating = numericRating;
  session.feedback.label = label;
  session.feedback.submittedAt = now;
  session.markModified('feedback');
  await session.save();

  const customerSatisfaction = {
    'customerSatisfaction.rating': numericRating,
    'customerSatisfaction.label': label,
    'customerSatisfaction.session': session._id,
    'customerSatisfaction.submittedAt': now,
  };
  if (agent) customerSatisfaction['customerSatisfaction.agent'] = agent;

  await Ticket.updateOne(
    { _id: session.ticket, company: company._id || company },
    {
      $set: customerSatisfaction,
    },
  );

  return record;
}

module.exports = {
  RATING_LABELS,
  resolveLiveChatForTicket,
  submitLiveChatRating,
};
