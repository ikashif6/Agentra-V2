/**
 * Real live-chat queue: counts Agentra ChatSessions actually waiting for an agent.
 * Ignores abandoned / inactive waiting sessions so position & wait stay honest.
 */

const ChatSession = require('../models/ChatSession');
const { countOnlineLiveChatAgents } = require('./live-chat-hours.service');

/** Drop waiting sessions with no recent activity from the visible queue. */
const QUEUE_STALE_MS = 30 * 60 * 1000;
/** Rough handle time used when estimating wait from people ahead ÷ agents. */
const MINUTES_PER_CHAT = 4;

function formatQueueLabel(position, estimatedWaitMinutes) {
  if (position <= 1) {
    return `You're next · about ${estimatedWaitMinutes} min`;
  }
  return `You're #${position} in queue · about ${estimatedWaitMinutes} min`;
}

function formatConnectingMessage(queue) {
  return `Connecting you with a human agent.\n${queue.label}`;
}

/**
 * @param {object} company
 * @param {object} session - current ChatSession (must already be waiting or about to be)
 * @returns {Promise<{ position: number, estimatedWaitMinutes: number, queueSize: number, label: string, message: string }>}
 */
async function getLiveChatQueueStatus(company, session) {
  const companyId = company._id || company;
  const sessionId = String(session._id);
  const staleBefore = new Date(Date.now() - QUEUE_STALE_MS);

  const waiting = await ChatSession.find({
    company: companyId,
    status: 'waiting_human',
    assignedAgent: null,
    $or: [
      { handoffRequestedAt: { $gte: staleBefore } },
      {
        handoffRequestedAt: null,
        lastActivityAt: { $gte: staleBefore },
      },
    ],
  })
    .select('_id handoffRequestedAt lastActivityAt createdAt')
    .lean();

  const sorted = waiting.sort((a, b) => {
    const at = new Date(a.handoffRequestedAt || a.lastActivityAt || a.createdAt).getTime();
    const bt = new Date(b.handoffRequestedAt || b.lastActivityAt || b.createdAt).getTime();
    return at - bt;
  });

  let position = sorted.findIndex((s) => String(s._id) === sessionId) + 1;
  if (position < 1) {
    // Current session not persisted as waiting yet — treat as joining the end.
    position = sorted.length + 1;
  }

  const onlineAgents = Math.max(1, await countOnlineLiveChatAgents(company));
  const chatsAheadIncludingSelf = position;
  const estimatedWaitMinutes = Math.max(
    1,
    Math.ceil(chatsAheadIncludingSelf / onlineAgents) * MINUTES_PER_CHAT,
  );

  const label = formatQueueLabel(position, estimatedWaitMinutes);
  return {
    position,
    estimatedWaitMinutes,
    queueSize: Math.max(sorted.length, position),
    label,
    message: formatConnectingMessage({ label }),
  };
}

module.exports = {
  QUEUE_STALE_MS,
  MINUTES_PER_CHAT,
  getLiveChatQueueStatus,
  formatQueueLabel,
  formatConnectingMessage,
};
