/**
 * Tenant-scoped conflict and turn auditing.
 * Never exposed to customers or other workspaces.
 */

const AssistantConflictAudit = require('../../models/AssistantConflictAudit');

async function recordInstructionConflicts({
  companyId,
  channel,
  configVersion,
  conflicts = [],
  requestId = null,
  conversationId = null,
  sessionId = null,
} = {}) {
  if (!companyId || !conflicts.length) return [];
  const written = [];
  for (const conflict of conflicts) {
    const filter = {
      company: companyId,
      channel: channel || conflict.channel || 'liveChat',
      configVersion: configVersion || conflict.configVersion || 1,
      category: conflict.category,
      instructionHash: conflict.instructionHash || 'none',
    };
    try {
      const doc = await AssistantConflictAudit.findOneAndUpdate(
        filter,
        {
          $setOnInsert: {
            ...filter,
            protectedSource: conflict.protectedSource,
            resolution: conflict.resolution,
            instructionMasked: conflict.instructionMasked,
            capability: conflict.capability || null,
            requestId,
            conversationId,
            sessionId,
          },
          $inc: { 'meta.occurrences': 1 },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      written.push(doc);
    } catch (err) {
      try {
        console.warn('[assistant-conflict-audit]', err.message);
      } catch {
        /* ignore */
      }
    }
  }
  return written;
}

async function recordTurnAudit({
  companyId,
  channel,
  configVersion,
  requestId,
  conversationId,
  sessionId,
  route,
  tools = [],
  permissionDecision = null,
  modelVersions = {},
  outcome = 'ok',
  meta = {},
} = {}) {
  if (!companyId) return null;
  try {
    return await AssistantConflictAudit.create({
      company: companyId,
      channel: channel || 'liveChat',
      configVersion: configVersion || 1,
      category: 'turn',
      requestId,
      conversationId,
      sessionId,
      route,
      tools,
      permissionDecision,
      modelVersions,
      outcome,
      meta,
    });
  } catch (err) {
    try {
      console.warn('[assistant-turn-audit]', err.message);
    } catch {
      /* ignore */
    }
    return null;
  }
}

async function workspaceConflictMetrics(companyId, { since = null } = {}) {
  const match = { company: companyId, category: { $ne: 'turn' } };
  if (since) match.createdAt = { $gte: since };
  return AssistantConflictAudit.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        occurrences: { $sum: { $ifNull: ['$meta.occurrences', 1] } },
      },
    },
  ]);
}

module.exports = {
  recordInstructionConflicts,
  recordTurnAudit,
  workspaceConflictMetrics,
};
