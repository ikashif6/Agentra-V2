const Company = require('../models/Company');
const response = require('../utils/apiResponse');
const {
  buildPublicWidgetConfig,
  isOriginAllowed,
  mergeLiveChatConfig,
} = require('../services/live-chat-config.service');
const { startSession, getSessionByToken, syncMessageToTicket } = require('../services/live-chat-session.service');
const { processCustomerMessage } = require('../services/live-chat-ai.service');
const { isTeamAvailableNow } = require('../services/live-chat-hours.service');

const STORE_SECRET_SELECT =
  '+storeIntegration.shopify.accessToken +storeIntegration.shopify.refreshToken ' +
  '+storeIntegration.woocommerce.consumerKey ' +
  '+storeIntegration.woocommerce.consumerSecret ' +
  '+storeIntegration.custom.apiKey';

async function loadCompanyByWidgetKey(widgetKey) {
  if (!widgetKey) return null;
  return Company.findOne({ 'liveChat.widgetKey': widgetKey }).populate({
    path: 'liveChat.agents',
    select: 'firstName lastName avatar role isActive isOnline',
  });
}

async function loadCompanyByWidgetKeyWithSecrets(widgetKey) {
  if (!widgetKey) return null;
  return Company.findOne({ 'liveChat.widgetKey': widgetKey }).select(STORE_SECRET_SELECT);
}

function getWidgetKey(req) {
  return (
    req.query.widgetKey ||
    req.query.key ||
    req.body?.widgetKey ||
    req.headers['x-widget-key'] ||
    ''
  );
}

/**
 * The widget is public, so only errors explicitly marked customer-safe may be
 * shown. Anything else (driver/database/internal failures) is logged and
 * replaced with a generic message.
 */
function respondWidgetError(res, err, fallback) {
  if (err.expose && err.message) {
    return response.badRequest(res, err.message);
  }
  console.error('[widget]', err);
  return response.error(res, fallback, 500);
}

function assertOrigin(company, req) {
  const origin = req.get('origin') || req.body?.origin;
  if (!isOriginAllowed(company, origin)) {
    const err = new Error('This domain is not allowed to use the chat widget');
    err.statusCode = 403;
    throw err;
  }
}

exports.getConfig = async (req, res, next) => {
  try {
    const widgetKey = getWidgetKey(req);
    const company = await loadCompanyByWidgetKey(widgetKey);
    if (!company || !company.liveChat?.enabled) {
      return response.success(res, { enabled: false });
    }
    assertOrigin(company, req);
    const config = buildPublicWidgetConfig(company, req);
    const teamOnline = await isTeamAvailableNow(company);
    return response.success(res, { ...config, teamOnline });
  } catch (err) {
    if (err.statusCode) return response.forbidden(res, err.message);
    next(err);
  }
};

exports.startSession = async (req, res, next) => {
  try {
    const widgetKey = getWidgetKey(req);
    const company = await loadCompanyByWidgetKey(widgetKey);
    if (!company || !company.liveChat?.enabled) {
      return response.badRequest(res, 'Live chat is not enabled for this workspace');
    }
    assertOrigin(company, req);

    const { email, pageUrl, origin, userAgent } = req.body || {};
    const { session, ticket, config } = await startSession(company, {
      email,
      pageUrl,
      origin: origin || req.get('origin'),
      userAgent: userAgent || req.get('user-agent'),
    });

    return response.success(res, {
      sessionToken: session.sessionToken,
      sessionId: session._id,
      ticketCode: ticket.ticket_code,
      welcomeMessage: config.content.welcomeMessage,
      messages: session.messages,
      feedback: session.feedback || null,
      teamOnline: await isTeamAvailableNow(company),
    });
  } catch (err) {
    if (err.statusCode === 403) return response.forbidden(res, err.message);
    return respondWidgetError(res, err, 'We could not start the chat right now. Please try again.');
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const widgetKey = getWidgetKey(req);
    const company = await loadCompanyByWidgetKeyWithSecrets(widgetKey);
    if (!company || !company.liveChat?.enabled) {
      return response.badRequest(res, 'Live chat is not enabled');
    }
    assertOrigin(company, req);

    const sessionToken = req.body?.sessionToken || req.headers['x-session-token'];
    const session = await getSessionByToken(sessionToken);
    if (!session || String(session.company) !== String(company._id)) {
      return response.notFound(res, 'Chat session not found');
    }
    if (session.status === 'closed') {
      return response.badRequest(res, 'This chat session has ended');
    }

    const {
      normalizeLiveChatAttachments,
    } = require('../services/live-chat-session.service');
    const attachments = normalizeLiveChatAttachments(req.body?.attachments);
    const messageText = String(req.body?.message || '').trim();
    if (!messageText && !attachments.length) {
      return response.badRequest(res, 'Message is required');
    }

    const wsHub = req.app.locals.liveChatWs;
    const onStatus = (status) => {
      if (wsHub?.notifyStatus) {
        wsHub.notifyStatus(String(company._id), session.sessionToken, status);
      }
    };

    const result = await processCustomerMessage(company, session, messageText, {
      onStatus,
      widgetAction: req.body?.action || req.body?.widgetAction || null,
      attachments,
    });

    const customer = await require('../services/live-chat-session.service').findOrCreateCustomerByEmail(
      company,
      session.visitorEmail,
    );
    if (session.ticket) {
      await syncMessageToTicket(session.ticket, {
        role: 'customer',
        body: messageText || (attachments.length ? '(Attachment)' : ''),
        senderName: session.visitorEmail,
        customerUser: customer,
        attachments,
      });
      for (const msg of result.messages || []) {
        if (msg.body) {
          await syncMessageToTicket(session.ticket, {
            role: msg.role === 'bot' ? 'bot' : msg.role === 'system' ? 'system' : 'system',
            body: msg.body,
            senderName: msg.senderName,
            customerUser: customer,
            eventType: msg.payload?.type || (msg.contentType === 'system_event' ? 'notice' : undefined),
            attachments: msg.attachments,
          });
        }
      }
    }

    if (wsHub?.notifyMessage) {
      for (const msg of result.messages || []) {
        wsHub.notifyMessage(String(company._id), session.sessionToken, msg);
      }
    }

    // Assignment below writes its own session copy, so the state captured during
    // the turn goes stale the moment an agent joins.
    let handoffState = result.handoffState || null;
    let sessionStatus = session.status;

    if (result.handoff && session.ticket) {
      const ticketId = session.ticket._id || session.ticket;
      const { scheduleTicketIntelligence } = require('../services/ticket-intelligence.service');
      scheduleTicketIntelligence(company._id, ticketId, { force: true });

      // Assign an online live-chat agent immediately (does not wait on Helpdesk auto-routing)
      try {
        const Ticket = require('../models/Ticket');
        const { maybeAutoAssignTicket } = require('../services/ticket-routing.service');
        const ticket = await Ticket.findById(ticketId);
        if (ticket && !ticket.assigned_agent) {
          const assignment = await maybeAutoAssignTicket(company, ticket, { urgency: 'high' });
          if (assignment && !assignment.skipped) {
            const ChatSession = require('../models/ChatSession');
            const { buildHandoffWidgetPayload } = require('../services/live-chat-workflow.service');
            const fresh = await ChatSession.findById(session._id);
            if (fresh) {
              handoffState = buildHandoffWidgetPayload(fresh);
              sessionStatus = fresh.status;
            }
          }
        }
      } catch (assignErr) {
        console.warn('[live-chat] handoff assign skipped:', assignErr.message);
      }
    }

    return response.success(res, {
      messages: result.messages,
      handoff: result.handoff,
      handoffState,
      clearConnecting: Boolean(result.clearConnecting),
      sessionStatus,
      orchestratorBuild: result.orchestratorBuild || require('../services/live-chat-turn-route.service').ORCHESTRATOR_BUILD,
      turnDebug: result.turnDebug || null,
      widgetBuild: '2026-07-30-01',
    });
  } catch (err) {
    if (err.statusCode === 403) return response.forbidden(res, err.message);
    return respondWidgetError(res, err, 'Something went wrong sending your message. Please try again.');
  }
};

/**
 * POST /widget/session/upload
 * Visitor file upload — only after a human agent has joined the chat.
 */
exports.uploadSessionFile = async (req, res, next) => {
  try {
    const widgetKey = getWidgetKey(req);
    const company = await loadCompanyByWidgetKey(widgetKey);
    if (!company || !company.liveChat?.enabled) {
      return response.badRequest(res, 'Live chat is not enabled');
    }
    assertOrigin(company, req);

    const sessionToken =
      req.body?.sessionToken || req.headers['x-session-token'] || req.query.sessionToken;
    const session = await getSessionByToken(sessionToken);
    if (!session || String(session.company) !== String(company._id)) {
      return response.notFound(res, 'Chat session not found');
    }
    if (session.status === 'closed') {
      return response.badRequest(res, 'This chat session has ended');
    }

    const { isHumanAgentJoined } = require('../services/live-chat-session.service');
    if (!isHumanAgentJoined(session)) {
      return response.badRequest(res, 'Attachments are only available after an agent joins');
    }

    if (!req.files || req.files.length === 0) {
      return response.badRequest(res, 'No files uploaded');
    }

    const path = require('path');
    const UPLOAD_ROOT = path.join(__dirname, '../../uploads');
    const BASE_URL =
      process.env.APP_API_URL ||
      process.env.API_PUBLIC_URL ||
      `http://localhost:${process.env.PORT || 5000}`;

    const attachments = req.files.map((file) => {
      const relativePath = path.relative(UPLOAD_ROOT, file.path).replace(/\\/g, '/');
      return {
        url: `${BASE_URL.replace(/\/$/, '')}/api/uploads/${relativePath}`,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      };
    });

    return response.success(res, { attachments }, 'Files uploaded successfully');
  } catch (err) {
    next(err);
  }
};

exports.getSession = async (req, res, next) => {
  try {
    const widgetKey = getWidgetKey(req);
    const company = await loadCompanyByWidgetKey(widgetKey);
    if (!company) return response.notFound(res, 'Widget not found');

    const session = await getSessionByToken(req.params.sessionToken);
    if (!session || String(session.company) !== String(company._id)) {
      return response.notFound(res, 'Session not found');
    }

    return response.success(res, {
      session: {
        status: session.status,
        messages: session.messages,
        visitorEmail: session.visitorEmail,
        feedback: session.feedback || null,
        handoffState: require('../services/live-chat-workflow.service').buildHandoffWidgetPayload(session),
        assignedAgent: session.assignedAgent
          ? {
              name: require('../services/ticket-system-events.service').agentDisplayName(session.assignedAgent),
              avatar: session.assignedAgent.avatar || null,
            }
          : null,
      },
      teamOnline: await isTeamAvailableNow(company),
    });
  } catch (err) {
    next(err);
  }
};

exports.submitFeedback = async (req, res, next) => {
  try {
    const widgetKey = getWidgetKey(req);
    const company = await loadCompanyByWidgetKey(widgetKey);
    if (!company || !company.liveChat?.enabled) {
      return response.badRequest(res, 'Live chat is not enabled');
    }
    assertOrigin(company, req);

    const { submitLiveChatRating } = require('../services/live-chat-resolution.service');
    const rating = await submitLiveChatRating({
      company,
      sessionToken: req.body?.sessionToken,
      rating: req.body?.rating,
    });
    return response.success(res, {
      rating: rating.rating,
      label: rating.label,
      submittedAt: rating.submittedAt,
    }, 'Thanks for your feedback');
  } catch (err) {
    if (err.statusCode === 404) return response.notFound(res, err.message);
    if (err.statusCode === 409) return response.badRequest(res, err.message);
    if (err.statusCode === 400) return response.badRequest(res, err.message);
    next(err);
  }
};

exports.endSession = async (req, res, next) => {
  try {
    const widgetKey = getWidgetKey(req);
    const company = await loadCompanyByWidgetKey(widgetKey);
    if (!company || !company.liveChat?.enabled) {
      return response.badRequest(res, 'Live chat is not enabled');
    }
    assertOrigin(company, req);

    const session = await getSessionByToken(req.body?.sessionToken);
    if (!session || String(session.company) !== String(company._id)) {
      return response.notFound(res, 'Session not found');
    }
    if (!session.ticket) {
      return response.badRequest(res, 'This conversation has no linked ticket');
    }

    const Ticket = require('../models/Ticket');
    const ticketId = session.ticket._id || session.ticket;
    const ticket = await Ticket.findOne({ _id: ticketId, company: company._id });
    if (!ticket) return response.notFound(res, 'Ticket not found');

    let resolutionMessage = null;
    if (session.status !== 'closed') {
      ticket.status = 'resolved';
      ticket.closedAt = new Date();
      ticket.closedBy = null;
      ticket.lastActivity = new Date();
      await ticket.save();

      const {
        resolveLiveChatForTicket,
      } = require('../services/live-chat-resolution.service');
      const resolvedSessions = await resolveLiveChatForTicket(company, ticket, null, {
        resolvedByCustomer: true,
      });
      const resolvedSession = resolvedSessions[0];
      resolutionMessage = resolvedSession?.messages?.[resolvedSession.messages.length - 1] || null;
    }

    return response.success(
      res,
      {
        status: 'closed',
        ratingRequested: true,
        message: resolutionMessage,
      },
      'Conversation ended',
    );
  } catch (err) {
    if (err.statusCode === 403) return response.forbidden(res, err.message);
    return respondWidgetError(
      res,
      err,
      'We could not end the conversation right now. Please try again.',
    );
  }
};

/**
 * GET /widget/feedback?widgetKey=&session=&rating=
 * Landing page for rating links inside the conversation transcript email.
 * Origin is not required — mail clients never send one.
 */
exports.feedbackLanding = async (req, res) => {
  const widgetKey = getWidgetKey(req);
  const sessionToken = String(req.query.session || req.query.sessionToken || '');
  const rating = Number(req.query.rating);
  const brandFallback = 'Support';

  const thanksPage = (title, body, brand = brandFallback) => `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
  body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#F3F4F6;color:#111827;}
  .card{max-width:420px;margin:10vh auto;background:#fff;border:1px solid #E5E7EB;border-radius:14px;padding:28px 24px;text-align:center;}
  h1{font-size:20px;margin:0 0 10px;} p{margin:0;color:#6B7280;line-height:1.5;font-size:14px;}
</style></head><body><div class="card"><h1>${title}</h1><p>${body}</p>
<p style="margin-top:18px;font-size:12px;color:#9CA3AF;">${brand}</p></div></body></html>`;

  try {
    const company = await loadCompanyByWidgetKey(widgetKey);
    const brand = company?.name || brandFallback;
    if (!company || !company.liveChat?.enabled) {
      return res.status(400).type('html').send(thanksPage('Unable to save rating', 'This feedback link is no longer valid.', brand));
    }
    const { submitLiveChatRating } = require('../services/live-chat-resolution.service');
    await submitLiveChatRating({ company, sessionToken, rating });
    return res
      .status(200)
      .type('html')
      .send(
        thanksPage(
          'Thanks for your feedback',
          'Your rating was recorded and helps us improve support.',
          brand,
        ),
      );
  } catch (err) {
    const message =
      err.statusCode === 409
        ? 'You already rated this conversation.'
        : err.message || 'This feedback link is no longer valid.';
    return res
      .status(err.statusCode && err.statusCode < 500 ? err.statusCode : 400)
      .type('html')
      .send(thanksPage('Thanks anyway', message));
  }
};

module.exports.loadCompanyByWidgetKey = loadCompanyByWidgetKey;
