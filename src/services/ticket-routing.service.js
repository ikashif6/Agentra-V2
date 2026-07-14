const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * Lightweight auto-assign: prefer least-loaded active agent among eligible pool.
 * Chat sources prefer company.liveChat.agents when set.
 */
async function maybeAutoAssignTicket(company, ticket, intelligence = {}) {
  if (ticket.assigned_agent) {
    return { skipped: true, reason: 'already_assigned' };
  }

  let agentIds = [];
  const liveChatAgents = (company.liveChat?.agents || []).map((id) => String(id));
  const isChat = ticket.source === 'chatbot' || ticket.source === 'chat';

  if (isChat && liveChatAgents.length) {
    agentIds = liveChatAgents;
  } else {
    const staff = await User.find({
      company: company._id,
      role: { $in: ['agent', 'admin', 'owner'] },
      isActive: { $ne: false },
      email: { $ne: 'bot@agentra.local' },
    })
      .select('_id')
      .lean();
    agentIds = staff.map((u) => String(u._id));
  }

  if (!agentIds.length) {
    return { skipped: true, reason: 'no_agents' };
  }

  const Ticket = require('../models/Ticket');
  const objectIds = agentIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const openCounts = await Ticket.aggregate([
    {
      $match: {
        company: company._id,
        assigned_agent: { $in: objectIds },
        status: { $in: ['open', 'in_progress', 'on_hold'] },
      },
    },
    { $group: { _id: '$assigned_agent', count: { $sum: 1 } } },
  ]);

  const countMap = new Map(openCounts.map((r) => [String(r._id), r.count]));
  const urgencyBoost = ['high', 'critical'].includes(intelligence.urgency);

  const candidates = await User.find({ _id: { $in: objectIds } })
    .select('_id isOnline firstName lastName')
    .lean();

  candidates.sort((a, b) => {
    if (urgencyBoost) {
      const onlineDiff = Number(Boolean(b.isOnline)) - Number(Boolean(a.isOnline));
      if (onlineDiff !== 0) return onlineDiff;
    }
    return (countMap.get(String(a._id)) || 0) - (countMap.get(String(b._id)) || 0);
  });

  const chosen = candidates[0];
  if (!chosen) return { skipped: true, reason: 'no_agents' };

  ticket.assigned_agent = chosen._id;
  if (ticket.status === 'open') ticket.status = 'in_progress';

  try {
    const { pushAgentJoinedEvent } = require('./ticket-system-events.service');
    await pushAgentJoinedEvent(ticket, chosen, company);
  } catch (_) {
    /* non-blocking */
  }

  await ticket.save();

  // Keep live chat session in sync when a human takes over
  if (isChat) {
    try {
      const ChatSession = require('../models/ChatSession');
      const { agentDisplayName } = require('./ticket-system-events.service');
      const { broadcastToSession } = require('./live-chat-websocket.service');
      const sessions = await ChatSession.find({
        company: company._id,
        ticket: ticket._id,
        status: { $in: ['active', 'waiting_human'] },
      });
      const joinBody = `${agentDisplayName(chosen)} has joined the conversation`;
      for (const session of sessions) {
        session.status = 'with_human';
        session.assignedAgent = chosen._id;
        const systemMsg = {
          role: 'system',
          body: joinBody,
          contentType: 'system_event',
          payload: { type: 'agent_joined', agentId: String(chosen._id) },
          senderName: 'System',
          sentAt: new Date(),
        };
        session.messages.push(systemMsg);
        session.lastActivityAt = new Date();
        await session.save();
        broadcastToSession(String(company._id), session.sessionToken, {
          type: 'system_event',
          data: {
            event: 'agent_joined',
            agentName: agentDisplayName(chosen),
          },
        });
        broadcastToSession(String(company._id), session.sessionToken, {
          type: 'message',
          data: systemMsg,
        });
      }
    } catch (_) {
      /* non-blocking */
    }
  }

  return {
    skipped: false,
    assignedAgentId: String(chosen._id),
    assignedAgentName: require('./ticket-system-events.service').agentDisplayName(chosen),
  };
}

module.exports = {
  maybeAutoAssignTicket,
};
