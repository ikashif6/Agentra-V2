const User = require('../models/User');

function agentDisplayName(user) {
  if (!user) return 'An agent';
  const name = [user.firstName, user.lastName]
    .map((p) => String(p || '').trim())
    .filter((p) => p && p !== '-')
    .join(' ');
  return name || user.email || 'An agent';
}

async function resolveSystemSender(companyOrId, preferredUserId) {
  if (preferredUserId) {
    const preferred = await User.findById(preferredUserId).select('_id email');
    if (preferred) return preferred;
  }

  const companyId = companyOrId?._id || companyOrId;
  let bot = await User.findOne({ company: companyId, email: 'bot@agentra.local' }).select('_id email');
  if (bot) return bot;

  const ownerId = companyOrId?.owner?._id || companyOrId?.owner;
  if (ownerId) {
    const owner = await User.findById(ownerId).select('_id email');
    if (owner) return owner;
  }

  return User.findOne({
    company: companyId,
    role: { $in: ['owner', 'admin', 'manager', 'agent'] },
  }).select('_id email');
}

/**
 * Push a centered system event onto ticket.messages (does not save).
 */
async function pushSystemEvent(ticket, { body, eventType = 'notice', actorId = null, company = null } = {}) {
  const text = String(body || '').trim();
  if (!text || !ticket) return null;

  const sender = await resolveSystemSender(company || ticket.company, actorId || ticket.assigned_agent);
  if (!sender) return null;

  const message = {
    sender: sender._id,
    senderEmail: 'system@agentra.local',
    body: text,
    attachments: [],
    sentAt: new Date(),
    isInternal: false,
    isAi: false,
    isSystem: true,
    contentType: 'system_event',
    eventType: String(eventType || 'notice').slice(0, 60),
  };

  ticket.messages.push(message);
  ticket.lastActivity = new Date();
  return message;
}

async function pushAgentJoinedEvent(ticket, agentUser, company = null) {
  const name = agentDisplayName(agentUser);
  return pushSystemEvent(ticket, {
    body: `${name} has joined the conversation`,
    eventType: 'agent_joined',
    actorId: agentUser?._id || agentUser,
    company,
  });
}

async function pushHandoffRequestedEvent(ticket, company = null) {
  return pushSystemEvent(ticket, {
    body: 'Connecting you with a support agent…',
    eventType: 'handoff_requested',
    company,
  });
}

const CHANNEL_HANDOFF_REPLY =
  'Thanks for your patience — I\'m connecting you with a member of our support team now. They will join this conversation shortly and follow up with you.';

module.exports = {
  agentDisplayName,
  pushSystemEvent,
  pushAgentJoinedEvent,
  pushHandoffRequestedEvent,
  CHANNEL_HANDOFF_REPLY,
};
