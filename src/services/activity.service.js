const ActivityLog = require('../models/ActivityLog');
const { EVENT_LABELS, FILTERABLE_EVENTS } = require('../constants/activity-events');

function actorSnapshot(user) {
  if (!user) return {};
  return {
    actor: user._id,
    actorEmail: user.email,
    actorName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
  };
}

function requestMeta(req) {
  if (!req) return {};
  return {
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers?.['user-agent'],
  };
}

async function recordActivity(payload) {
  const {
    companyId,
    actor,
    event,
    objectType,
    objectId,
    objectLabel,
    req,
    metadata,
  } = payload;

  return ActivityLog.create({
    company: companyId,
    ...actorSnapshot(actor),
    event,
    eventLabel: EVENT_LABELS[event] || event,
    objectType,
    objectId: objectId != null ? String(objectId) : undefined,
    objectLabel,
    ...requestMeta(req),
    metadata,
  });
}

function recordActivitySafe(payload) {
  recordActivity(payload).catch((err) => {
    console.error('[ActivityLog]', err.message);
  });
}

async function listActivityLogs(companyId, query = {}) {
  const {
    actorId,
    event,
    from,
    to,
    page = 1,
    limit = 25,
  } = query;

  const filter = { company: companyId };

  if (actorId) filter.actor = actorId;
  if (event) filter.event = event;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [logs, total] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('actor', 'firstName lastName email avatar'),
    ActivityLog.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)) || 1,
    },
    events: FILTERABLE_EVENTS,
  };
}

function logUserLogin({ company, user, req }) {
  recordActivitySafe({
    companyId: company._id,
    actor: user,
    event: 'user.login',
    objectType: 'user',
    objectId: user._id,
    objectLabel: `User ${user.email}`,
    req,
  });
}

function logWorkspaceCreated({ company, user, req }) {
  recordActivitySafe({
    companyId: company._id,
    actor: user,
    event: 'workspace.created',
    objectType: 'workspace',
    objectId: company._id,
    objectLabel: `Workspace ${company.name}`,
    req,
  });
}

function logUserInvited({ company, actor, target, req }) {
  recordActivitySafe({
    companyId: company._id,
    actor,
    event: 'user.invited',
    objectType: 'user',
    objectId: target._id,
    objectLabel: `User ${target.email}`,
    req,
    metadata: { role: target.role },
  });
}

function logUserUpdated({ company, actor, target, req, changes }) {
  recordActivitySafe({
    companyId: company._id,
    actor,
    event: 'user.updated',
    objectType: 'user',
    objectId: target._id,
    objectLabel: `User ${target.email}`,
    req,
    metadata: changes,
  });
}

function logUserRemoved({ company, actor, target, req }) {
  recordActivitySafe({
    companyId: company._id,
    actor,
    event: 'user.removed',
    objectType: 'user',
    objectId: target._id,
    objectLabel: `User ${target.email}`,
    req,
  });
}

function logBillingPlanCanceled({ company, actor, req }) {
  recordActivitySafe({
    companyId: company._id,
    actor,
    event: 'billing.plan_canceled',
    objectType: 'billing',
    objectId: company._id,
    objectLabel: 'Agentra Pro',
    req,
  });
}

function logBillingPlanReactivated({ company, actor, req }) {
  recordActivitySafe({
    companyId: company._id,
    actor,
    event: 'billing.plan_reactivated',
    objectType: 'billing',
    objectId: company._id,
    objectLabel: 'Agentra Pro',
    req,
  });
}

function logStoreConnected({ company, actor, provider, req }) {
  recordActivitySafe({
    companyId: company._id,
    actor,
    event: 'store.connected',
    objectType: 'store',
    objectId: provider,
    objectLabel: `Store ${provider}`,
    req,
  });
}

function logStoreDisconnected({ company, actor, req }) {
  recordActivitySafe({
    companyId: company._id,
    actor,
    event: 'store.disconnected',
    objectType: 'store',
    objectId: company._id,
    objectLabel: 'Store integration',
    req,
  });
}

function logBusinessHoursUpdated({ company, actor, req, scope }) {
  recordActivitySafe({
    companyId: company._id,
    actor,
    event: 'business_hours.updated',
    objectType: 'business_hours',
    objectId: company._id,
    objectLabel: scope === 'custom' ? 'Custom schedule' : 'Default schedule',
    req,
    metadata: { scope },
  });
}

function logTeamCreated({ company, actor, team, req }) {
  recordActivitySafe({
    companyId: company._id,
    actor,
    event: 'team.created',
    objectType: 'team',
    objectId: team._id,
    objectLabel: `Team ${team.name}`,
    req,
  });
}

function logProfileUpdated({ company, actor, req }) {
  recordActivitySafe({
    companyId: company._id,
    actor,
    event: 'profile.updated',
    objectType: 'user',
    objectId: actor._id,
    objectLabel: `User ${actor.email}`,
    req,
  });
}

function logPasswordChanged({ company, actor, req }) {
  recordActivitySafe({
    companyId: company._id,
    actor,
    event: 'security.password_changed',
    objectType: 'user',
    objectId: actor._id,
    objectLabel: `User ${actor.email}`,
    req,
  });
}

module.exports = {
  recordActivity,
  recordActivitySafe,
  listActivityLogs,
  logUserLogin,
  logWorkspaceCreated,
  logUserInvited,
  logUserUpdated,
  logUserRemoved,
  logBillingPlanCanceled,
  logBillingPlanReactivated,
  logStoreConnected,
  logStoreDisconnected,
  logBusinessHoursUpdated,
  logTeamCreated,
  logProfileUpdated,
  logPasswordChanged,
};
