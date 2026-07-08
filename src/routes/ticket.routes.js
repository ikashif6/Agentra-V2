const express = require('express');
const { body, param, query } = require('express-validator');
const rateLimit = require('express-rate-limit');

const ticketController = require('../controllers/ticket.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { resolveTrackSession, requireTicketAccess } = require('../middleware/ticket.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

// ─── Rate limiters ────────────────────────────────────────────────────────────

const trackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many track requests. Please try again later.' },
});

// ─── Validation rules ─────────────────────────────────────────────────────────

const createRules = [
  body('ticket_title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('ticket_description').trim().notEmpty().withMessage('Description is required').isLength({ max: 50000 }),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('attachments').optional().isArray(),
  body('attachments.*.url').optional().isURL().withMessage('Attachment URL must be a valid URL'),
];

const updateRules = [
  body('ticket_title').optional().trim().isLength({ max: 200 }),
  body('ticket_description').optional().trim().isLength({ max: 50000 }),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('status').optional().isIn(['open', 'in_progress', 'on_hold', 'resolved', 'closed', 'self_closed']),
  body('inboxFolder').optional().isIn(['inbox', 'snoozed', 'trash', 'spam']),
  body('snoozedUntil').optional().isISO8601().toDate(),
  body('tags').optional().isArray(),
  body('tags.*').optional().isString().trim().isLength({ max: 64 }),
  body('source').optional().isIn(['portal', 'email', 'chat', 'chatbot', 'instagram', 'facebook', 'whatsapp']),
  body('isUnread').optional().isBoolean(),
  body('details').optional().isObject(),
  body('details.contactReason').optional().isString().isLength({ max: 200 }),
  body('details.product').optional().isString().isLength({ max: 200 }),
  body('details.resolution').optional().isString().isLength({ max: 200 }),
  body('details.customerType').optional().isString().isLength({ max: 100 }),
  body('details.customerNote').optional().isString().isLength({ max: 2000 }),
  body('details.customerPhone').optional().isString().isLength({ max: 40 }),
  body('attachments').optional().isArray(),
];

const messageRules = [
  body('body').trim().notEmpty().withMessage('Message body is required').isLength({ max: 50000 }),
  body('attachments').optional().isArray(),
  body('attachments.*.url').optional().isURL(),
  body('isInternal').optional().isBoolean(),
];

const addPersonRules = [
  body('userId').notEmpty().isMongoId().withMessage('Valid userId required'),
  body('role').isIn(['customer', 'agent', 'cc']).withMessage('Role must be customer, agent, or cc'),
];

const trackRequestRules = [
  body('ticket_code').trim().notEmpty().withMessage('Ticket code required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('subdomain').trim().notEmpty().withMessage('Subdomain required'),
];

const trackVerifyRules = [
  body('ticket_code').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be a 6-digit number'),
  body('subdomain').trim().notEmpty(),
];

// ─── Public: Track-ticket OTP flow (no authentication required) ───────────────

/**
 * POST /tickets/track/request
 * Step 1: Customer provides ticket_code + email → OTP sent
 */
router.post(
  '/track/request',
  trackLimiter,
  trackRequestRules,
  validate,
  ticketController.trackRequest
);

/**
 * POST /tickets/track/verify
 * Step 2: Customer submits OTP → receives a track token
 */
router.post(
  '/track/verify',
  trackLimiter,
  trackVerifyRules,
  validate,
  ticketController.trackVerify
);

// ─── All routes below require tenant context ──────────────────────────────────
router.use(resolveTenant);

// ─── Protected: normal authenticated routes ───────────────────────────────────

/**
 * POST /tickets   — create (admin, agent, customer — NOT owner)
 */
router.post(
  '/',
  protect,
  authorize('admin', 'agent', 'customer'),
  createRules,
  validate,
  ticketController.createTicket
);

/**
 * POST /tickets/demo — sample conversation for inbox preview
 */
router.post(
  '/demo',
  protect,
  authorize('owner', 'admin', 'agent'),
  ticketController.createDemoTicket
);

/**
 * GET /tickets    — list (all authenticated roles)
 */
router.get(
  '/',
  protect,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['open', 'in_progress', 'on_hold', 'resolved', 'closed', 'self_closed']),
    query('view').optional().isIn(['assigned', 'all', 'snoozed', 'closed', 'trash', 'spam', 'queue']),
    query('scope').optional().isIn(['inbox', 'live_chat', 'ai_agents', 'dashboard']),
    query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    query('department').optional().isMongoId(),
    query('team').optional().isMongoId(),
  ],
  validate,
  ticketController.listTickets
);

/**
 * GET /tickets/stats/dashboard  — aggregated stats for dashboard
 * Owner / admin / agent only
 */
router.get(
  '/stats/dashboard',
  protect,
  authorize('owner', 'admin', 'agent'),
  ticketController.getDashboardStats
);

/**
 * GET /tickets/inbox/counts — sidebar counts for inbox views
 */
router.get(
  '/inbox/counts',
  protect,
  authorize('owner', 'admin', 'agent'),
  ticketController.getInboxCounts
);

// ─── Routes that accept BOTH normal JWT and track-session token ───────────────
// resolveTrackSession runs first; if it sets req.trackSession it bypasses protect()
// For normal users, protect() sets req.user. requireTicketAccess ensures at least one is set.

/**
 * GET /tickets/:code
 */
router.get(
  '/:code',
  resolveTrackSession,
  protect,
  requireTicketAccess,
  param('code').trim().notEmpty(),
  validate,
  ticketController.getTicket
);

/**
 * PATCH /tickets/:code
 * Staff: full update. Customer: only self-close. Guest track-session: NOT allowed (read-only patch).
 */
router.patch(
  '/:code',
  resolveTrackSession,
  protect,
  requireTicketAccess,
  updateRules,
  validate,
  ticketController.updateTicket
);

/**
 * POST /tickets/:code/close
 * Staff → 'closed'. Customer/guest → 'self_closed'
 */
router.post(
  '/:code/close',
  resolveTrackSession,
  protect,
  requireTicketAccess,
  ticketController.closeTicket
);

/**
 * POST /tickets/:code/reopen
 * Staff only
 */
router.post(
  '/:code/reopen',
  protect,
  authorize('owner', 'admin', 'agent'),
  ticketController.reopenTicket
);

/**
 * DELETE /tickets/:code
 * Owner / admin only
 */
router.delete(
  '/:code',
  protect,
  authorize('owner', 'admin'),
  ticketController.deleteTicket
);

// ─── People management ────────────────────────────────────────────────────────

/**
 * POST /tickets/:code/peoples
 */
router.post(
  '/:code/peoples',
  protect,
  authorize('admin', 'agent'),
  addPersonRules,
  validate,
  ticketController.addPerson
);

/**
 * DELETE /tickets/:code/peoples/:userId
 */
router.delete(
  '/:code/peoples/:userId',
  protect,
  authorize('admin', 'agent'),
  param('userId').isMongoId(),
  validate,
  ticketController.removePerson
);

// ─── Messages ─────────────────────────────────────────────────────────────────

/**
 * POST /tickets/:code/messages
 * Authenticated users + OTP track-session guests
 */
router.post(
  '/:code/messages',
  resolveTrackSession,
  protect,
  requireTicketAccess,
  messageRules,
  validate,
  ticketController.addMessage
);

module.exports = router;
