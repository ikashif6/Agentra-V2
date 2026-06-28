const Ticket = require('../models/Ticket');
const TicketTrackSession = require('../models/TicketTrackSession');
const Company = require('../models/Company');
const Counter = require('../models/Counter');
const User = require('../models/User');
const emailService = require('../services/email.service');
const tokenUtil = require('../utils/token');
const response = require('../utils/apiResponse');

const TRACK_OTP_TTL_MS = (parseInt(process.env.TRACK_OTP_EXPIRES_MINUTES) || 10) * 60 * 1000;
const TRACK_OTP_MAX_ATTEMPTS = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

  // Owner and Admin can access every ticket in their company
  if (user.role === 'owner' || user.role === 'admin') {
    return ticket.company.toString() === company._id.toString();
  }

  // Agent can access every ticket in their company
  if (user.role === 'agent') {
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
  return ['owner', 'admin', 'agent'].includes(req.user.role);
}

/**
 * Build the query scope for listing tickets based on role
 */
function buildListQuery(req) {
  const company = req.company;
  const user = req.user;
  const base = { company: company._id };

  if (user.role === 'owner' || user.role === 'admin' || user.role === 'agent') {
    return base; // all tickets in company
  }

  // Customer only sees tickets they are in
  return { ...base, 'peoples.user': user._id };
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

    // Owner is not allowed to create tickets
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

/**
 * GET /tickets
 * Scoped list based on role.
 * Query params: status, priority, page, limit, search, department, team
 */
exports.listTickets = async (req, res, next) => {
  try {
    const {
      status, priority, page = 1, limit = 15,
      search, department, team,
    } = req.query;

    const query = buildListQuery(req);

    if (status)     query.status   = status;
    if (priority)   query.priority = priority;
    if (department) query.department = department;
    if (team)       query.teams = team; // teams is an array field — $in is not needed for equality on arrays in Mongoose

    if (search) {
      query.$or = [
        { ticket_title: { $regex: search, $options: 'i' } },
        { ticket_code:  { $regex: search, $options: 'i' } },
      ];
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

    // Staff / owner update
    const allowedFields = ['ticket_title', 'ticket_description', 'priority', 'status', 'department', 'teams', 'assigned_agent', 'attachments'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        ticket[field] = req.body[field];
      }
    }

    // Track close metadata
    if (['closed', 'resolved'].includes(ticket.status) && !ticket.closedAt) {
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

    ticket.lastActivity = new Date();
    await ticket.save();

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

    return response.success(res, { ticket }, `Ticket ${newStatus.replace('_', ' ')}`);
  } catch (err) {
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

    ticket.messages.push({
      sender: senderId,
      senderEmail,
      body: msgBody,
      attachments: attachments || [],
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
    return response.created(res, { message: newMsg }, 'Message added');
  } catch (err) {
    next(err);
  }
};

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
 * Owner / admin / agent only.
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const companyId = req.company._id;

    // Overall counts by status
    const byStatus = await Ticket.aggregate([
      { $match: { company: companyId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Counts by department (only tickets that have a department)
    const byDepartment = await Ticket.aggregate([
      { $match: { company: companyId, department: { $exists: true, $ne: null } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
      { $unwind: { path: '$dept', preserveNullAndEmpty: false } },
      { $project: { _id: 1, count: 1, name: '$dept.name' } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Counts by team (tickets that have at least one team)
    const byTeam = await Ticket.aggregate([
      { $match: { company: companyId, teams: { $exists: true, $not: { $size: 0 } } } },
      { $unwind: '$teams' },
      { $group: { _id: '$teams', count: { $sum: 1 } } },
      { $lookup: { from: 'teams', localField: '_id', foreignField: '_id', as: 'team' } },
      { $unwind: { path: '$team', preserveNullAndEmpty: false } },
      { $project: { _id: 1, count: 1, name: '$team.name' } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Normalise byStatus into a map
    const statusMap = {};
    for (const s of byStatus) statusMap[s._id] = s.count;

    return response.success(res, { byStatus: statusMap, byDepartment, byTeam });
  } catch (err) {
    next(err);
  }
};
