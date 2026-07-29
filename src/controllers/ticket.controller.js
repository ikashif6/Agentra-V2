const Ticket = require('../models/Ticket');
const TicketTrackSession = require('../models/TicketTrackSession');
const Company = require('../models/Company');
const Counter = require('../models/Counter');
const User = require('../models/User');
const emailService = require('../services/email.service');
const facebookService = require('../services/facebook.service');
const instagramService = require('../services/instagram.service');
const whatsappService = require('../services/whatsapp.service');
const emailChannelService = require('../services/email-channel.service');
const tokenUtil = require('../utils/token');
const response = require('../utils/apiResponse');
const { buildInboxDemoConfigs, buildLiveChatDemoConfigs } = require('../data/demo-ticket-configs');

const TRACK_OTP_TTL_MS = (parseInt(process.env.TRACK_OTP_EXPIRES_MINUTES) || 10) * 60 * 1000;
const TRACK_OTP_MAX_ATTEMPTS = 5;

const ACTIVE_STATUSES = ['open', 'in_progress', 'on_hold'];
const CLOSED_STATUSES = ['closed', 'self_closed', 'resolved'];
const INBOX_VIEWS = ['assigned', 'all', 'snoozed', 'closed', 'trash', 'spam'];
const LIVE_CHAT_SOURCES = ['chatbot', 'chat'];
/** AI Agent workspace views — ownership-based, not source-based */
const AI_AGENT_VIEWS = ['queue', 'closed', 'trash'];
/** @deprecated alias — kept for older clients sending assigned */
const LIVE_CHAT_VIEWS = ['queue', 'assigned', 'closed', 'trash'];
// Inbox channel filter (includes live chat once a human owns the thread)
const INBOX_CHANNELS = ['email', 'facebook', 'instagram', 'whatsapp', 'tiktok', 'portal', 'chatbot', 'chat'];
const AI_AGENT_CHANNELS = ['email', 'facebook', 'instagram', 'whatsapp', 'tiktok', 'portal', 'chatbot', 'chat'];

function isLiveChatScope(scope) {
  return scope === 'live_chat' || scope === 'ai_agents';
}

/**
 * Tickets currently owned by the AI Agent (any channel):
 * unassigned, not yet handed to a human, and AI has been handling the thread
 * (live chat source and/or AI/bot messages).
 */
function aiAgentOwnedClause() {
  return {
    assigned_agent: null,
    $and: [
      {
        $or: [
          { 'aiIntelligence.handoffReason': { $exists: false } },
          { 'aiIntelligence.handoffReason': null },
          { 'aiIntelligence.handoffReason': '' },
        ],
      },
      {
        $or: [
          { source: { $in: LIVE_CHAT_SOURCES } },
          { messages: { $elemMatch: { isAi: true } } },
          { messages: { $elemMatch: { senderEmail: 'bot@agentra.local' } } },
        ],
      },
    ],
  };
}

function mergeAnd(query, clause) {
  if (!query.$and) query.$and = [];
  query.$and.push(clause);
  return query;
}

function applyAiAgentOwnership(query) {
  return mergeAnd(query, aiAgentOwnedClause());
}

/** Human inbox — everything except AI-owned active threads */
function excludeAiAgentOwned(query) {
  return mergeAnd(query, { $nor: [aiAgentOwnedClause()] });
}
const DEMO_STATS_MATCH = (companyId) => ({
  company: companyId,
  inboxFolder: { $nin: ['trash', 'spam'] },
});

const REMOVED_TICKET_SOURCES = ['phone', 'api'];
const ANALYTICS_SOURCE_LABELS = {
  email: 'Email',
  portal: 'Help center',
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  live_chat: 'Live chat',
  ai_agent: 'Live chat',
};

async function migrateRemovedTicketSources(companyId) {
  await Ticket.updateMany(
    { company: companyId, source: { $in: REMOVED_TICKET_SOURCES } },
    { $set: { source: 'email' } },
  );
}

function normalizeAnalyticsSource(source) {
  if (!source || REMOVED_TICKET_SOURCES.includes(source)) return null;
  if (source === 'chat' || source === 'chatbot') return 'live_chat';
  return source;
}

function buildAnalyticsBySource(rows) {
  const merged = new Map();

  for (const row of rows) {
    const key = normalizeAnalyticsSource(row._id);
    if (!key) continue;

    const existing = merged.get(key);
    if (existing) {
      existing.count += row.count;
    } else {
      merged.set(key, {
        _id: key,
        name: ANALYTICS_SOURCE_LABELS[key] || key,
        count: row.count,
      });
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.count - a.count);
}

async function countTicketsByStatus(companyId) {
  const statuses = ['open', 'in_progress', 'on_hold', 'resolved', 'closed', 'self_closed'];
  const entries = await Promise.all(
    statuses.map(async (status) => {
      const count = await Ticket.countDocuments({
        ...DEMO_STATS_MATCH(companyId),
        status,
      });
      return [status, count];
    }),
  );

  return Object.fromEntries(entries.filter(([, count]) => count > 0));
}

/**
 * Decide whether the current requester can see / act on a ticket.
 *
 * req.user       → authenticated user  (owner / admin / agent / customer)
 * req.trackSession → guest customer who passed the OTP track flow
 */
function canAccessTicket(ticket, req) {
  if (req.trackSession) {
    // Guest track-session: must be THIS ticket
    return ticket._id.toString() === req.trackSession.ticketId.toString();
  }

  const user = req.user;
  const company = req.company;

  // Owner, admin, manager, and agent can access every ticket in their company
  if (['owner', 'admin', 'manager', 'agent'].includes(user.role)) {
    return ticket.company.toString() === company._id.toString();
  }

  // Customer can only access tickets they are listed in
  if (user.role === 'customer') {
    return ticket.peoples.some((p) => p.user.toString() === user._id.toString());
  }

  return false;
}

/**
 * Check whether the requester is staff (owner/admin/agent) or an authorised customer/guest
 * who is listed in the ticket.
 */
function isStaff(req) {
  if (!req.user) return false;
  return ['owner', 'admin', 'manager', 'agent'].includes(req.user.role);
}

/**
 * Build the query scope for listing tickets based on role
 */
function buildListQuery(req) {
  const company = req.company;
  const user = req.user;
  const base = { company: company._id };

  if (['owner', 'admin', 'manager', 'agent'].includes(user.role)) {
    return base; // all tickets in company
  }

  // Customer only sees tickets they are in
  return { ...base, 'peoples.user': user._id };
}

async function releaseExpiredSnoozes(companyId) {
  await Ticket.updateMany(
    { company: companyId, inboxFolder: { $exists: false } },
    { $set: { inboxFolder: 'inbox' } },
  );

  await Ticket.updateMany(
    {
      company: companyId,
      inboxFolder: 'snoozed',
      snoozedUntil: { $lte: new Date() },
    },
    { $set: { inboxFolder: 'inbox', snoozedUntil: null } },
  );
}

function applyInboxView(query, view, user) {
  if (!view || !INBOX_VIEWS.includes(view)) return query;

  switch (view) {
    case 'assigned':
      query.assigned_agent = user._id;
      query.inboxFolder = 'inbox';
      query.status = { $in: ACTIVE_STATUSES };
      break;
    case 'all':
      query.inboxFolder = 'inbox';
      query.status = { $in: ACTIVE_STATUSES };
      break;
    case 'snoozed':
      query.inboxFolder = 'snoozed';
      break;
    case 'closed':
      query.inboxFolder = 'inbox';
      query.status = { $in: CLOSED_STATUSES };
      break;
    case 'trash':
      query.inboxFolder = 'trash';
      break;
    case 'spam':
      query.inboxFolder = 'spam';
      break;
    default:
      break;
  }

  return query;
}

function applyAiAgentView(query, view, user) {
  applyAiAgentOwnership(query);

  const normalized = AI_AGENT_VIEWS.includes(view)
    ? view
    : view === 'assigned'
      ? 'queue'
      : 'queue';

  switch (normalized) {
    case 'queue':
      query.inboxFolder = 'inbox';
      query.status = { $in: ACTIVE_STATUSES };
      break;
    case 'closed':
      query.inboxFolder = 'inbox';
      query.status = { $in: CLOSED_STATUSES };
      break;
    case 'trash':
      query.inboxFolder = 'trash';
      break;
    default:
      query.inboxFolder = 'inbox';
      query.status = { $in: ACTIVE_STATUSES };
      break;
  }

  return query;
}

function inboxCountQuery(base, view, user) {
  const query = applyInboxView({ ...base }, view, user);
  return excludeAiAgentOwned(query);
}

function liveChatCountQuery(base, view, user) {
  return applyAiAgentView({ ...base }, view, user);
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * POST /tickets
 * Roles: admin, agent, customer  (owner CANNOT create)
 */
exports.createTicket = async (req, res, next) => {
  try {
    const { ticket_title, ticket_description, department, teams, priority, attachments } = req.body;
    const company = req.company;
    const user = req.user;

    if (user.role === 'owner') {
      return response.forbidden(res, 'Owners cannot create tickets');
    }

    const prefix = company.settings?.ticketPrefix || 'TKT';
    const ticket_code = await Ticket.generateCode(company._id, prefix);

    const ticket = await Ticket.create({
      ticket_code,
      company_subdomain: company.subdomain,
      company: company._id,
      ticket_title,
      ticket_description,
      department: department || undefined,
      teams: teams || [],
      priority: priority || company.settings?.defaultTicketPriority || 'medium',
      status: 'open',
      attachments: attachments || [],
      createdBy: user._id,
      peoples: [
        {
          user: user._id,
          role: user.role === 'customer' ? 'customer' : 'agent',
        },
      ],
      lastActivity: new Date(),
    });

    await Counter.increment(`company:${company._id}`, 'totalTickets');

    return response.created(res, { ticket }, 'Ticket created successfully');
  } catch (err) {
    next(err);
  }
};

async function findOrCreateDemoCustomer(company, profile) {
  const email = profile.email ?? `demo.customer@${company.subdomain}.agentraa.local`;

  let customer = await User.findOne({ email, company: company._id });
  if (customer) return customer;

  customer = await User.create({
    firstName: profile.firstName,
    lastName: profile.lastName,
    email,
    company: company._id,
    role: 'customer',
    isEmailVerified: true,
    isActive: true,
    onboardingCompleted: true,
  });

  return customer;
}

async function resolveDemoAssignee(company, user) {
  if (user.role === 'agent') return user._id;
  const agent = await User.findOne({ company: company._id, role: 'agent', isActive: true }).select('_id');
  return agent?._id || user._id;
}

async function stripLegacyDemoTitles(companyId) {
  const tickets = await Ticket.find({
    company: companyId,
    ticket_title: { $regex: /^Demo \(.+\): / },
  });

  for (const ticket of tickets) {
    ticket.ticket_title = ticket.ticket_title.replace(/^Demo \(.+\): /, '');
    await ticket.save();
  }
}

async function ensureDemoTicket(company, user, config) {
  const seedTag = config.seedKey ? `seed:${config.seedKey}` : null;
  const legacyTitles = [
    ...(config.legacyTitles ?? []),
    ...(config.title !== config.legacyTitle && config.legacyTitle ? [config.legacyTitle] : []),
  ].filter(Boolean);

  let ticket = null;

  if (seedTag) {
    ticket = await Ticket.findOne({ company: company._id, tags: seedTag });
  }

  if (!ticket && config.legacySeedKeys?.length) {
    for (const legacyKey of config.legacySeedKeys) {
      ticket = await Ticket.findOne({ company: company._id, tags: `seed:${legacyKey}` });
      if (ticket) break;
    }
  }

  if (!ticket && legacyTitles.length) {
    ticket = await Ticket.findOne({
      company: company._id,
      ticket_title: { $in: legacyTitles },
    });
  }

  if (!ticket) {
    ticket = await Ticket.findOne({
      company: company._id,
      ticket_title: config.title,
      source: config.source,
    });
  }

  if (ticket) {
    let changed = false;

    if (ticket.ticket_title !== config.title) {
      ticket.ticket_title = config.title;
      changed = true;
    }
    if (ticket.source !== config.source) {
      ticket.source = config.source;
      changed = true;
    }
    if (config.openingMessage && ticket.ticket_description !== config.openingMessage) {
      ticket.ticket_description = config.openingMessage;
      changed = true;
    }
    if (config.openingMessage && ticket.messages?.length) {
      const firstMessage = ticket.messages[0];
      if (firstMessage?.body !== config.openingMessage) {
        firstMessage.body = config.openingMessage;
        ticket.markModified('messages');
        changed = true;
      }
    }
    if (config.status && ticket.status !== config.status) {
      ticket.status = config.status;
      changed = true;
    }
    if (seedTag && !(ticket.tags ?? []).includes(seedTag)) {
      ticket.tags = [...(ticket.tags ?? []), seedTag];
      changed = true;
    }
    if (changed) await ticket.save();
    return { ticket, created: false };
  }

  const customer = await findOrCreateDemoCustomer(company, config.customer);
  const assignee = await resolveDemoAssignee(company, user);
  const now = Date.now();
  const prefix = company.settings?.ticketPrefix || 'TKT';
  const ticket_code = await Ticket.generateCode(company._id, prefix);
  const tags = [...(config.tags ?? []), ...(seedTag ? [seedTag] : [])];

  ticket = await Ticket.create({
    ticket_code,
    company_subdomain: company.subdomain,
    company: company._id,
    ticket_title: config.title,
    ticket_description: config.openingMessage,
    priority: config.priority,
    status: config.status || 'open',
    inboxFolder: 'inbox',
    source: config.source,
    tags,
    details: config.details,
    assigned_agent: assignee,
    createdBy: customer._id,
    peoples: [
      { user: customer._id, role: 'customer' },
      { user: assignee, role: 'agent', addedBy: user._id },
    ],
    messages: config.messages(customer._id, assignee, now),
    lastActivity: new Date(now - (config.lastActivityMinutesAgo ?? 12) * 60 * 1000),
  });

  await Counter.increment(`company:${company._id}`, 'totalTickets');
  return { ticket, created: true };
}

/**
 * POST /tickets/demo
 * Creates sample inbox + live chat conversations for previewing the workspace UI.
 */
exports.createDemoTicket = async (req, res, next) => {
  try {
    const company = req.company;
    const user = req.user;

    await stripLegacyDemoTitles(company._id);
    await migrateRemovedTicketSources(company._id);

    const configs = [
      ...buildInboxDemoConfigs(),
      ...buildLiveChatDemoConfigs(company.subdomain),
    ];

    const results = [];
    for (const config of configs) {
      results.push(await ensureDemoTicket(company, user, config));
    }

    const created = results.filter((result) => result.created).length;
    const tickets = results.map((result) => result.ticket);

    const populated = await Ticket.find({ _id: { $in: tickets.map((t) => t._id) } })
      .populate('createdBy', 'firstName lastName email avatar')
      .populate('assigned_agent', 'firstName lastName email avatar')
      .populate('peoples.user', 'firstName lastName email avatar role')
      .populate('messages.sender', 'firstName lastName email avatar role')
      .sort({ lastActivity: -1 });

    return response.success(
      res,
      {
        tickets: populated,
        ticket: populated[0],
        created,
        inboxCount: buildInboxDemoConfigs().length,
        liveChatCount: buildLiveChatDemoConfigs(company.subdomain).length,
        aiAgentCount: buildLiveChatDemoConfigs(company.subdomain).length,
      },
      `Demo data ready (${created} new, ${populated.length} total)`,
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /tickets
 * Scoped list based on role.
 * Query params: status, priority, page, limit, search, department, team
 */
exports.listTickets = async (req, res, next) => {
  try {
    const {
      status, priority, page = 1, limit = 15,
      search, department, team, view, scope, channel,
    } = req.query;

    await releaseExpiredSnoozes(req.company._id);

    const query = buildListQuery(req);

    if (isLiveChatScope(scope)) {
      const liveChatView = LIVE_CHAT_VIEWS.includes(view) ? view : 'queue';
      applyAiAgentView(query, liveChatView, req.user);
    } else if (scope === 'dashboard') {
      query.inboxFolder = { $nin: ['trash', 'spam'] };
      excludeAiAgentOwned(query);
    } else if (scope === 'inbox' || view) {
      applyInboxView(query, view, req.user);
      excludeAiAgentOwned(query);
    } else if (status) {
      query.status = status;
      excludeAiAgentOwned(query);
    } else if (['owner', 'admin', 'manager', 'agent'].includes(req.user.role)) {
      applyInboxView(query, req.user.role === 'agent' ? 'assigned' : 'all', req.user);
      excludeAiAgentOwned(query);
    }

    // Channel filter — inbox + AI Agent
    if (isLiveChatScope(scope) && AI_AGENT_CHANNELS.includes(channel)) {
      query.source = channel === 'chat' || channel === 'chatbot'
        ? { $in: LIVE_CHAT_SOURCES }
        : channel;
    } else if (!isLiveChatScope(scope) && INBOX_CHANNELS.includes(channel)) {
      query.source = channel === 'chat' || channel === 'chatbot'
        ? { $in: LIVE_CHAT_SOURCES }
        : channel;
    }

    if (priority) query.priority = priority;
    if (department) query.department = department;
    if (team)       query.teams = team; // teams is an array field — $in is not needed for equality on arrays in Mongoose

    if (search) {
      const searchFilter = {
        $or: [
          { ticket_title: { $regex: search, $options: 'i' } },
          { ticket_code: { $regex: search, $options: 'i' } },
        ],
      };
      if (query.$and) {
        query.$and.push(searchFilter);
      } else {
        query.$and = [searchFilter];
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [tickets, total] = await Promise.all([
      Ticket.find(query)
        .sort({ lastActivity: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('createdBy',     'firstName lastName email avatar')
        .populate('assigned_agent','firstName lastName email avatar')
        .populate('department',    'name')
        .populate('teams',         'name')
        .populate('peoples.user',  'firstName lastName email avatar role'),
      Ticket.countDocuments(query),
    ]);

    return response.success(res, {
      tickets,
      pagination: {
        total,
        page:  Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /tickets/:code
 * Get a single ticket by its ticket_code (e.g. TKT-00001)
 * Also usable by track-session guests (middleware sets req.trackSession)
 */
exports.getTicket = async (req, res, next) => {
  try {
    const { code } = req.params;
    const company = req.company;

    const ticket = await Ticket.findOne({
      ticket_code: code.toUpperCase(),
      company: company._id,
    })
      .populate('createdBy', 'firstName lastName email avatar')
      .populate('assigned_agent', 'firstName lastName email avatar')
      .populate('peoples.user', 'firstName lastName email avatar role')
      .populate('messages.sender', 'firstName lastName email avatar role');

    if (!ticket) {
      return response.notFound(res, 'Ticket not found');
    }

    // Track-session guest: check this is the right ticket
    if (req.trackSession && ticket._id.toString() !== req.trackSession.ticketId.toString()) {
      return response.forbidden(res, 'Access denied');
    }

    // Authenticated user: check access
    if (req.user && !canAccessTicket(ticket, req)) {
      return response.forbidden(res, 'You do not have access to this ticket');
    }

    // Strip internal notes from non-staff
    if (!isStaff(req)) {
      ticket.messages = ticket.messages.filter((m) => !m.isInternal);
    }

    return response.success(res, { ticket });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /tickets/inbox/counts
 * Counts for each inbox sidebar view.
 */
exports.getInboxCounts = async (req, res, next) => {
  try {
    await releaseExpiredSnoozes(req.company._id);

    const base = buildListQuery(req);
    const scope = isLiveChatScope(req.query.scope) ? 'live_chat' : 'inbox';

    if (scope === 'live_chat') {
      const views = AI_AGENT_VIEWS;

      const entries = await Promise.all(
        views.map(async (view) => {
          const count = await Ticket.countDocuments(liveChatCountQuery(base, view, req.user));
          return [view, count];
        }),
      );

      return response.success(res, { counts: Object.fromEntries(entries) });
    }

    const views = INBOX_VIEWS.filter(
      (view) => view !== 'assigned' || req.user.role === 'agent',
    );

    const entries = await Promise.all(
      views.map(async (view) => {
        const count = await Ticket.countDocuments(inboxCountQuery(base, view, req.user));
        return [view, count];
      }),
    );

    return response.success(res, { counts: Object.fromEntries(entries) });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /tickets/:code
 * Update metadata: title, description, priority, status, department, teams, assigned_agent
 * Roles: admin, agent, owner can update anything
 *        customer can ONLY self-close (set status = 'self_closed')
 */
exports.updateTicket = async (req, res, next) => {
  try {
    const { code } = req.params;
    const company = req.company;
    const user = req.user;

    const ticket = await Ticket.findOne({ ticket_code: code.toUpperCase(), company: company._id });

    if (!ticket) return response.notFound(res, 'Ticket not found');
    if (!canAccessTicket(ticket, req)) return response.forbidden(res, 'Access denied');

    const isCustomer = user.role === 'customer';

    // Customers can only self-close
    if (isCustomer) {
      const { status } = req.body;
      if (!status || status !== 'self_closed') {
        return response.forbidden(res, 'Customers can only self-close a ticket');
      }

      ticket.status = 'self_closed';
      ticket.closedAt = new Date();
      ticket.closedBy = user._id;
      ticket.lastActivity = new Date();
      await ticket.save();
      return response.success(res, { ticket }, 'Ticket self-closed');
    }

    // Live chat: only configured agents can be assigned when an allowlist exists
    if (
      req.body.assigned_agent &&
      ['chatbot', 'chat'].includes(String(ticket.source))
    ) {
      const liveAgents = (req.company.liveChat?.agents || []).map((id) => String(id));
      if (liveAgents.length > 0 && !liveAgents.includes(String(req.body.assigned_agent))) {
        return response.badRequest(
          res,
          'That agent is not on the live chat agents list. Update Live chat settings to add them.',
        );
      }
    }

    // Staff / owner update
    const previousStatus = ticket.status;
    const previousAssignee = ticket.assigned_agent ? String(ticket.assigned_agent) : null;
    const allowedFields = [
      'ticket_title',
      'ticket_description',
      'priority',
      'status',
      'department',
      'teams',
      'assigned_agent',
      'attachments',
      'inboxFolder',
      'snoozedUntil',
      'tags',
      'source',
      'isUnread',
    ];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        ticket[field] = req.body[field];
      }
    }

    if (req.body.details && typeof req.body.details === 'object') {
      const detailFields = [
        'contactReason',
        'product',
        'resolution',
        'customerType',
        'customerNote',
        'customerPhone',
        'customerEmail',
      ];
      ticket.details = ticket.details || {};
      for (const field of detailFields) {
        if (req.body.details[field] !== undefined) {
          ticket.details[field] = req.body.details[field];
        }
      }
      ticket.markModified('details');
    }

    if (req.body.inboxFolder === 'snoozed' && !req.body.snoozedUntil) {
      ticket.snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    if (req.body.inboxFolder === 'inbox') {
      ticket.snoozedUntil = null;
    }

    // Track close metadata
    const justClosed =
      ['closed', 'resolved'].includes(ticket.status) &&
      !['closed', 'resolved'].includes(previousStatus);
    if (justClosed) {
      ticket.closedAt = new Date();
      ticket.closedBy = user._id;
    }

    // If agent was assigned, make sure they are in peoples
    if (req.body.assigned_agent) {
      const alreadyIn = ticket.peoples.some(
        (p) => p.user.toString() === req.body.assigned_agent.toString()
      );
      if (!alreadyIn) {
        ticket.peoples.push({
          user: req.body.assigned_agent,
          role: 'agent',
          addedBy: user._id,
        });
      }
    }

    const nextAssignee = ticket.assigned_agent ? String(ticket.assigned_agent) : null;
    if (nextAssignee && nextAssignee !== previousAssignee) {
      try {
        const { pushAgentJoinedEvent } = require('../services/ticket-system-events.service');
        const assigneeUser = await User.findById(nextAssignee).select(
          'firstName lastName email avatar',
        );
        if (assigneeUser) {
          await pushAgentJoinedEvent(ticket, assigneeUser, company);
        }
        if (['chatbot', 'chat'].includes(String(ticket.source))) {
          const ChatSession = require('../models/ChatSession');
          const { agentDisplayName } = require('../services/ticket-system-events.service');
          const { broadcastToSession } = require('../services/live-chat-websocket.service');
          const sessions = await ChatSession.find({
            company: company._id,
            ticket: ticket._id,
            status: { $in: ['active', 'waiting_human'] },
          });
          const joinBody = `${agentDisplayName(assigneeUser)} has joined the conversation`;
          for (const session of sessions) {
            session.status = 'with_human';
            session.assignedAgent = nextAssignee;
            const systemMsg = {
              role: 'system',
              body: joinBody,
              contentType: 'system_event',
              payload: {
                type: 'agent_joined',
                agentId: nextAssignee,
                agentName: agentDisplayName(assigneeUser),
                agentAvatar: assigneeUser?.avatar || undefined,
              },
              senderName: 'System',
              sentAt: new Date(),
            };
            session.messages.push(systemMsg);
            session.lastActivityAt = new Date();
            await session.save();
            broadcastToSession(String(company._id), session.sessionToken, {
              type: 'message',
              data: systemMsg,
            });
          }
        }
      } catch (_) {
        /* non-blocking */
      }
    }

    ticket.lastActivity = new Date();
    await ticket.save();

    if (justClosed) {
      try {
        const {
          resolveLiveChatForTicket,
        } = require('../services/live-chat-resolution.service');
        await resolveLiveChatForTicket(company, ticket, user);
      } catch (resolutionErr) {
        console.error('[live-chat resolve]', resolutionErr.message);
      }
      try {
        const { getHelpdeskAiConfig } = require('../services/helpdesk-ai-config.service');
        const { scheduleTicketQa } = require('../services/manager-ai.service');
        if (getHelpdeskAiConfig(req.company).qualityAssurance) {
          scheduleTicketQa(req.company._id, ticket._id);
        }
      } catch (_) {
        /* non-blocking */
      }
    }

    return response.success(res, { ticket }, 'Ticket updated');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /tickets/:code
 * Hard delete — owner and admin only
 */
exports.deleteTicket = async (req, res, next) => {
  try {
    const { code } = req.params;
    const company = req.company;

    const ticket = await Ticket.findOneAndDelete({ ticket_code: code.toUpperCase(), company: company._id });

    if (!ticket) return response.notFound(res, 'Ticket not found');

    return response.success(res, {}, 'Ticket deleted');
  } catch (err) {
    next(err);
  }
};

// ─── Close / Reopen ──────────────────────────────────────────────────────────

/**
 * POST /tickets/:code/close
 * Owner/admin/agent → status = 'closed'
 * Customer → status = 'self_closed'
 * Guest track-session → status = 'self_closed'
 */
exports.closeTicket = async (req, res, next) => {
  try {
    const { code } = req.params;
    const company = req.company;

    // Support both authenticated users and track-session guests
    const isGuest = !!req.trackSession;
    const isCustomerRole = req.user?.role === 'customer';

    const ticket = await Ticket.findOne({ ticket_code: code.toUpperCase(), company: company._id });
    if (!ticket) return response.notFound(res, 'Ticket not found');

    // Access check
    if (isGuest && ticket._id.toString() !== req.trackSession.ticketId.toString()) {
      return response.forbidden(res, 'Access denied');
    }
    if (!isGuest && req.user && !canAccessTicket(ticket, req)) {
      return response.forbidden(res, 'Access denied');
    }

    const newStatus = (isGuest || isCustomerRole) ? 'self_closed' : 'closed';

    ticket.status = newStatus;
    ticket.closedAt = new Date();
    ticket.closedBy = isGuest ? null : req.user._id;
    ticket.lastActivity = new Date();
    await ticket.save();

    if (!isGuest && !isCustomerRole) {
      try {
        const {
          resolveLiveChatForTicket,
        } = require('../services/live-chat-resolution.service');
        await resolveLiveChatForTicket(company, ticket, req.user);
      } catch (resolutionErr) {
        console.error('[live-chat close]', resolutionErr.message);
      }
      try {
        const { getHelpdeskAiConfig } = require('../services/helpdesk-ai-config.service');
        const { scheduleTicketQa } = require('../services/manager-ai.service');
        if (getHelpdeskAiConfig(company).qualityAssurance) {
          scheduleTicketQa(company._id, ticket._id);
        }
      } catch (_) {
        /* non-blocking */
      }
    }

    return response.success(res, { ticket }, `Ticket ${newStatus.replace('_', ' ')}`);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /tickets/:code/email-transcript
 * Staff only — email the full live-chat conversation to the customer
 */
exports.emailTranscript = async (req, res, next) => {
  try {
    const { code } = req.params;
    const company = req.company;
    const force = Boolean(req.body?.force);

    const ticket = await Ticket.findOne({
      ticket_code: code.toUpperCase(),
      company: company._id,
    }).populate('createdBy', 'firstName lastName email');

    if (!ticket) return response.notFound(res, 'Ticket not found');
    if (!canAccessTicket(ticket, req)) return response.forbidden(res, 'Access denied');

    const {
      sendConversationTranscriptEmail,
    } = require('../services/conversation-transcript-email.service');
    const result = await sendConversationTranscriptEmail(company, ticket, { force });

    if (result.skipped) {
      return response.success(
        res,
        result,
        'Conversation transcript was already emailed to the customer',
      );
    }

    return response.success(
      res,
      result,
      `Conversation transcript emailed to ${result.to}`,
    );
  } catch (err) {
    if (err.statusCode === 400) return response.badRequest(res, err.message);
    next(err);
  }
};

/**
 * POST /tickets/:code/reopen
 * Owner / admin / agent only
 */
exports.reopenTicket = async (req, res, next) => {
  try {
    const { code } = req.params;
    const company = req.company;

    const ticket = await Ticket.findOne({ ticket_code: code.toUpperCase(), company: company._id });
    if (!ticket) return response.notFound(res, 'Ticket not found');

    ticket.status = 'open';
    ticket.closedAt = undefined;
    ticket.closedBy = undefined;
    ticket.lastActivity = new Date();
    await ticket.save();

    return response.success(res, { ticket }, 'Ticket reopened');
  } catch (err) {
    next(err);
  }
};

// ─── People management ────────────────────────────────────────────────────────

/**
 * POST /tickets/:code/peoples
 * Add a user (customer / agent / cc) to the ticket
 * Admin / agent only
 */
exports.addPerson = async (req, res, next) => {
  try {
    const { code } = req.params;
    const { userId, role } = req.body;
    const company = req.company;

    if (!['customer', 'agent', 'cc'].includes(role)) {
      return response.badRequest(res, 'Role must be customer, agent, or cc');
    }

    const ticket = await Ticket.findOne({ ticket_code: code.toUpperCase(), company: company._id });
    if (!ticket) return response.notFound(res, 'Ticket not found');

    // Verify the user to add belongs to the same company
    const targetUser = await User.findOne({ _id: userId, company: company._id });
    if (!targetUser) return response.notFound(res, 'User not found in this workspace');

    const alreadyIn = ticket.peoples.some((p) => p.user.toString() === userId);
    if (alreadyIn) return response.conflict(res, 'User is already in this ticket');

    ticket.peoples.push({ user: userId, role, addedBy: req.user._id });
    ticket.lastActivity = new Date();
    await ticket.save();

    return response.success(res, { ticket }, 'Person added to ticket');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /tickets/:code/peoples/:userId
 * Remove a person from the ticket
 * Admin / agent only
 */
exports.removePerson = async (req, res, next) => {
  try {
    const { code, userId } = req.params;
    const company = req.company;

    const ticket = await Ticket.findOne({ ticket_code: code.toUpperCase(), company: company._id });
    if (!ticket) return response.notFound(res, 'Ticket not found');

    const before = ticket.peoples.length;
    ticket.peoples = ticket.peoples.filter((p) => p.user.toString() !== userId);

    if (ticket.peoples.length === before) {
      return response.notFound(res, 'User not found in ticket');
    }

    ticket.lastActivity = new Date();
    await ticket.save();

    return response.success(res, { ticket }, 'Person removed from ticket');
  } catch (err) {
    next(err);
  }
};

// ─── Messages ─────────────────────────────────────────────────────────────────

/**
 * POST /tickets/:code/messages
 * Add a message to the ticket thread.
 * Available to: authenticated users who have access + track-session guests
 */
exports.addMessage = async (req, res, next) => {
  try {
    const { code } = req.params;
    const { body: msgBody, attachments, isInternal } = req.body;
    const company = req.company;
    const isGuest = !!req.trackSession;

    const ticket = await Ticket.findOne({ ticket_code: code.toUpperCase(), company: company._id });
    if (!ticket) return response.notFound(res, 'Ticket not found');

    // Access checks
    if (isGuest && ticket._id.toString() !== req.trackSession.ticketId.toString()) {
      return response.forbidden(res, 'Access denied');
    }
    if (!isGuest && req.user && !canAccessTicket(ticket, req)) {
      return response.forbidden(res, 'Access denied');
    }

    // Guests and customers cannot post internal notes
    const internal = !isGuest && isStaff(req) && isInternal === true;

    // For guest sessions, we need a placeholder sender — use a virtual/system user id
    // In practice the front-end should display senderEmail for these
    let senderId;
    let senderEmail;

    if (isGuest) {
      // Find the customer's User doc by email in this company
      const guestUser = await User.findOne({ email: req.trackSession.email, company: company._id });
      if (!guestUser) {
        return response.forbidden(res, 'Guest user not found in company');
      }
      senderId = guestUser._id;
      senderEmail = req.trackSession.email;
    } else {
      senderId = req.user._id;
      senderEmail = req.user.email;
    }

    const files = Array.isArray(attachments) ? attachments : [];
    const textBody = String(msgBody || '').trim() || (files.length ? '(Attachment)' : '');

    ticket.messages.push({
      sender: senderId,
      senderEmail,
      body: textBody,
      attachments: files,
      isInternal: internal,
      sentAt: new Date(),
    });

    // Auto-reopen if closed/self_closed when a reply comes in (unless staff explicitly closed)
    if (['resolved', 'closed', 'self_closed'].includes(ticket.status)) {
      ticket.status = 'open';
    }

    ticket.lastActivity = new Date();
    await ticket.save();

    const newMsg = ticket.messages[ticket.messages.length - 1];
    response.created(res, { message: newMsg }, 'Message added');

    // Deliver agent replies back to the channel AFTER responding, so the inbox
    // is not blocked waiting on the Graph API round-trip.
    if (!internal && isStaff(req)) {
      if (ticket.source === 'facebook') {
        facebookService
          .sendReplyForTicket(company._id, ticket, textBody)
          .catch((fbErr) => console.error('[facebook reply]', fbErr.message));
      } else if (ticket.source === 'instagram') {
        instagramService
          .sendReplyForTicket(company._id, ticket, textBody)
          .catch((igErr) => console.error('[instagram reply]', igErr.message));
      } else if (ticket.source === 'whatsapp') {
        whatsappService
          .sendReplyForTicket(company._id, ticket, textBody)
          .catch((waErr) => console.error('[whatsapp reply]', waErr.message));
      } else if (ticket.source === 'email') {
        emailChannelService
          .sendReplyForTicket(company._id, ticket, textBody)
          .catch((emErr) => console.error('[email reply]', emErr.message));
      } else if (['chat', 'chatbot'].includes(String(ticket.source))) {
        // Live chat has no outbound API — push into the session and the widget socket.
        deliverLiveChatReply(company, ticket, textBody, req.user, files).catch((chatErr) =>
          console.error('[live-chat reply]', chatErr.message),
        );
      }
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Mirror a staff reply into the linked live chat session(s) so the widget shows it
 * live over the websocket and again after a refresh.
 */
async function deliverLiveChatReply(company, ticket, body, agentUser, attachments = []) {
  // The composer sends rich text; the widget renders message bodies as plain text,
  // so tags would show up literally in the customer's bubble.
  const text = facebookService.htmlToPlainText(body || '');
  const {
    normalizeLiveChatAttachments,
  } = require('../services/live-chat-session.service');
  const files = normalizeLiveChatAttachments(attachments);
  if (!text && !files.length) return;
  const ChatSession = require('../models/ChatSession');
  const { appendSessionMessage } = require('../services/live-chat-session.service');
  const { agentDisplayName } = require('../services/ticket-system-events.service');
  const { broadcastToSession } = require('../services/live-chat-websocket.service');

  const sessions = await ChatSession.find({
    company: company._id,
    ticket: ticket._id,
    status: { $in: ['active', 'waiting_human', 'with_human'] },
  });

  const senderName = agentUser ? agentDisplayName(agentUser) : 'Support';
  const senderAvatar = agentUser?.avatar || undefined;
  for (const session of sessions) {
    const saved = await appendSessionMessage(session, {
      role: 'agent',
      body: text || (files.length ? '(Attachment)' : ''),
      contentType: 'text',
      attachments: files,
      senderName,
      senderAvatar,
    });
    broadcastToSession(String(company._id), session.sessionToken, {
      type: 'message',
      data: saved,
    });
  }
}

// ─── Track Ticket (OTP flow — customers only) ────────────────────────────────

/**
 * POST /tickets/track/request
 * Body: { ticket_code, email, subdomain }
 *
 * Does NOT require authentication.
 * Verifies the email is a customer listed in the ticket, then sends OTP.
 */
exports.trackRequest = async (req, res, next) => {
  try {
    const { ticket_code, email, subdomain } = req.body;

    if (!ticket_code || !email || !subdomain) {
      return response.badRequest(res, 'ticket_code, email, and subdomain are required');
    }

    // Resolve company by subdomain
    const company = await Company.findOne({ subdomain: subdomain.toLowerCase(), isActive: true });
    if (!company) {
      // Generic response to prevent company enumeration
      return response.success(res, {}, 'If that ticket exists and your email is registered, an OTP has been sent.');
    }

    // Find ticket
    const ticket = await Ticket.findOne({
      ticket_code: ticket_code.toUpperCase(),
      company: company._id,
    });

    if (!ticket) {
      return response.success(res, {}, 'If that ticket exists and your email is registered, an OTP has been sent.');
    }

    // Check email is a customer in this ticket
    const matchedUser = await User.findOne({
      email: email.toLowerCase(),
      company: company._id,
      role: 'customer',
    });

    if (!matchedUser) {
      return response.success(res, {}, 'If that ticket exists and your email is registered, an OTP has been sent.');
    }

    const isInTicket = ticket.peoples.some(
      (p) => p.user.toString() === matchedUser._id.toString()
    );

    if (!isInTicket) {
      return response.success(res, {}, 'If that ticket exists and your email is registered, an OTP has been sent.');
    }

    // Rate-limit: delete any existing unverified session for this email+ticket
    await TicketTrackSession.deleteMany({
      ticket: ticket._id,
      email: email.toLowerCase(),
      verified: false,
    });

    // Generate OTP
    const otp = tokenUtil.generateOtp(6);
    const otpHash = tokenUtil.hashToken(otp);

    await TicketTrackSession.create({
      ticket: ticket._id,
      ticket_code: ticket.ticket_code,
      company_subdomain: company.subdomain,
      email: email.toLowerCase(),
      otpHash,
      otpExpires: new Date(Date.now() + TRACK_OTP_TTL_MS),
      requestIp: req.ip,
    });

    // Send OTP email
    try {
      await emailService.sendTicketTrackOtp({
        email: email.toLowerCase(),
        firstName: matchedUser.firstName,
        otp,
        ticket_code: ticket.ticket_code,
        subdomain: company.subdomain,
      });
    } catch (emailErr) {
      console.error('Failed to send track OTP:', emailErr.message);
      return response.error(res, 'Failed to send OTP email. Please try again.');
    }

    return response.success(res, {}, 'If that ticket exists and your email is registered, an OTP has been sent.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /tickets/track/verify
 * Body: { ticket_code, email, otp, subdomain }
 *
 * Returns a short-lived track token (JWT) scoped to this ticket.
 */
exports.trackVerify = async (req, res, next) => {
  try {
    const { ticket_code, email, otp, subdomain } = req.body;

    if (!ticket_code || !email || !otp || !subdomain) {
      return response.badRequest(res, 'ticket_code, email, otp, and subdomain are required');
    }

    const company = await Company.findOne({ subdomain: subdomain.toLowerCase(), isActive: true });
    if (!company) return response.unauthorized(res, 'Invalid OTP or ticket');

    const session = await TicketTrackSession.findOne({
      ticket_code: ticket_code.toUpperCase(),
      email: email.toLowerCase(),
      verified: false,
    }).select('+otpHash');

    if (!session) return response.unauthorized(res, 'Invalid or expired OTP');

    if (session.otpExpires < new Date()) {
      await session.deleteOne();
      return response.unauthorized(res, 'OTP has expired. Please request a new one.');
    }

    if (session.attempts >= TRACK_OTP_MAX_ATTEMPTS) {
      await session.deleteOne();
      return response.forbidden(res, 'Too many incorrect attempts. Please request a new OTP.');
    }

    const hashedInput = tokenUtil.hashToken(String(otp));

    if (hashedInput !== session.otpHash) {
      session.attempts += 1;
      await session.save();
      const remaining = TRACK_OTP_MAX_ATTEMPTS - session.attempts;
      return response.unauthorized(res, `Invalid OTP. ${remaining} attempt(s) remaining.`);
    }

    // Mark as verified then delete
    session.verified = true;
    await session.save();
    await session.deleteOne();

    // Issue a track token — JWT scoped to this ticket (30 min TTL)
    const trackToken = tokenUtil.signTrackToken({
      ticketId: session.ticket.toString(),
      ticket_code: session.ticket_code,
      email: session.email,
      companyId: company._id.toString(),
      subdomain: company.subdomain,
    });

    return response.success(res, { trackToken, ticket_code: session.ticket_code }, 'OTP verified. Use trackToken to access the ticket.');
  } catch (err) {
    next(err);
  }
};

// ─── Dashboard stats ──────────────────────────────────────────────────────────

/**
 * GET /tickets/stats/dashboard
 * Returns ticket counts by status, by department, and by team for the company.
 * Owner / admin only.
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const companyId = req.company._id;
    await migrateRemovedTicketSources(companyId);
    const baseMatch = DEMO_STATS_MATCH(companyId);

    const byStatus = await countTicketsByStatus(companyId);

    const bySource = await Ticket.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const byDepartment = await Ticket.aggregate([
      { $match: { ...baseMatch, department: { $exists: true, $ne: null } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
      { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          count: 1,
          name: { $ifNull: ['$dept.name', 'Unassigned department'] },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const byTeam = await Ticket.aggregate([
      { $match: { ...baseMatch, teams: { $exists: true, $not: { $size: 0 } } } },
      { $unwind: '$teams' },
      { $group: { _id: '$teams', count: { $sum: 1 } } },
      { $lookup: { from: 'teams', localField: '_id', foreignField: '_id', as: 'team' } },
      { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          count: 1,
          name: { $ifNull: ['$team.name', 'Unknown team'] },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    return response.success(res, {
      byStatus,
      byDepartment,
      byTeam,
      bySource: buildAnalyticsBySource(bySource),
    });
  } catch (err) {
    next(err);
  }
};
