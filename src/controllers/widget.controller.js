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
      teamOnline: await isTeamAvailableNow(company),
    });
  } catch (err) {
    if (err.message && !err.statusCode) return response.badRequest(res, err.message);
    next(err);
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

    const wsHub = req.app.locals.liveChatWs;
    const onStatus = (status) => {
      if (wsHub?.notifyStatus) {
        wsHub.notifyStatus(String(company._id), session.sessionToken, status);
      }
    };

    const result = await processCustomerMessage(company, session, req.body?.message, {
      onStatus,
      widgetAction: req.body?.action || req.body?.widgetAction || null,
    });

    const customer = await require('../services/live-chat-session.service').findOrCreateCustomerByEmail(
      company,
      session.visitorEmail,
    );
    if (session.ticket) {
      await syncMessageToTicket(session.ticket, {
        role: 'customer',
        body: req.body?.message,
        senderName: session.visitorEmail,
        customerUser: customer,
      });
      for (const msg of result.messages || []) {
        if (msg.body) {
          await syncMessageToTicket(session.ticket, {
            role: msg.role === 'bot' ? 'bot' : msg.role === 'system' ? 'system' : 'system',
            body: msg.body,
            senderName: msg.senderName,
            customerUser: customer,
            eventType: msg.payload?.type || (msg.contentType === 'system_event' ? 'notice' : undefined),
          });
        }
      }
    }

    if (wsHub?.notifyMessage) {
      for (const msg of result.messages || []) {
        wsHub.notifyMessage(String(company._id), session.sessionToken, msg);
      }
    }

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
          await maybeAutoAssignTicket(company, ticket, { urgency: 'high' });
        }
      } catch (assignErr) {
        console.warn('[live-chat] handoff assign skipped:', assignErr.message);
      }
    }

    return response.success(res, {
      messages: result.messages,
      handoff: result.handoff,
      handoffState: result.handoffState || null,
      clearConnecting: Boolean(result.clearConnecting),
      sessionStatus: session.status,
      orchestratorBuild: result.orchestratorBuild || require('../services/live-chat-turn-route.service').ORCHESTRATOR_BUILD,
      turnDebug: result.turnDebug || null,
      widgetBuild: '2026-07-16-01',
    });
  } catch (err) {
    if (err.message && !err.statusCode) return response.badRequest(res, err.message);
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
      },
      teamOnline: await isTeamAvailableNow(company),
    });
  } catch (err) {
    next(err);
  }
};

module.exports.loadCompanyByWidgetKey = loadCompanyByWidgetKey;
