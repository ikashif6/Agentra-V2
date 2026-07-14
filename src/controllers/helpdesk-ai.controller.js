const response = require('../utils/apiResponse');
const {
  getHelpdeskAiConfig,
  updateHelpdeskAiConfig,
} = require('../services/helpdesk-ai-config.service');
const { generateTicketIntelligence } = require('../services/ticket-intelligence.service');
const { suggestReply, transformReply, TRANSFORMS } = require('../services/ai-copilot.service');
const { getCustomerIntelligenceForTicket } = require('../services/customer-intelligence.service');
const {
  buildTicketOpsSnapshot,
  detectIncidents,
  checkResolutionCompleteness,
  mergeTickets,
} = require('../services/ticket-ops-ai.service');
const { getManagerIntelligence, scoreTicketQuality } = require('../services/manager-ai.service');
const {
  getKnowledgeIntelligence,
  generateKnowledgeDrafts,
  publishDraft,
  dismissDraft,
} = require('../services/knowledge-ai.service');
const Ticket = require('../models/Ticket');

exports.getSettings = async (req, res, next) => {
  try {
    return response.success(res, { helpdeskAi: getHelpdeskAiConfig(req.company) });
  } catch (err) {
    next(err);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const helpdeskAi = await updateHelpdeskAiConfig(req.company, req.body || {});
    return response.success(res, { helpdeskAi }, 'Helpdesk AI settings updated');
  } catch (err) {
    next(err);
  }
};

exports.getIntelligence = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({
      company: req.company._id,
      ticket_code: req.params.code,
    }).select('aiIntelligence assigned_agent priority tags details');
    if (!ticket) return response.notFound(res, 'Ticket not found');
    return response.success(res, {
      aiIntelligence: ticket.aiIntelligence || null,
      assigned_agent: ticket.assigned_agent,
      priority: ticket.priority,
      tags: ticket.tags,
      details: ticket.details,
    });
  } catch (err) {
    next(err);
  }
};

exports.refreshIntelligence = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({
      company: req.company._id,
      ticket_code: req.params.code,
    }).select('_id');
    if (!ticket) return response.notFound(res, 'Ticket not found');

    const result = await generateTicketIntelligence(req.company._id, ticket._id, { force: true });
    if (result.skipped && result.reason === 'groq') {
      return response.badRequest(res, 'AI is not configured (GROQ_API_KEY)');
    }
    if (result.skipped && result.reason === 'disabled') {
      return response.badRequest(res, 'Helpdesk AI overview is disabled');
    }

    return response.success(
      res,
      {
        aiIntelligence: result.aiIntelligence || null,
        assignment: result.assignment || null,
        cached: Boolean(result.cached),
      },
      'AI overview updated',
    );
  } catch (err) {
    if (err.message?.includes('JSON')) return response.badRequest(res, err.message);
    next(err);
  }
};

exports.getCustomerIntelligence = async (req, res, next) => {
  try {
    const config = getHelpdeskAiConfig(req.company);
    const ticket = await Ticket.findOne({
      company: req.company._id,
      ticket_code: req.params.code,
    }).populate('createdBy', 'email firstName lastName');
    if (!ticket) return response.notFound(res, 'Ticket not found');

    const payload = await getCustomerIntelligenceForTicket(req.company._id, ticket);
    return response.success(res, {
      profile: config.customerProfile ? payload.profile : null,
      timeline: config.customerTimeline ? payload.timeline : [],
      similarTickets: config.similarTickets
        ? ticket.aiIntelligence?.similarTickets?.length
          ? ticket.aiIntelligence.similarTickets
          : payload.similarTickets
        : [],
    });
  } catch (err) {
    next(err);
  }
};

exports.getOpsIntelligence = async (req, res, next) => {
  try {
    const config = getHelpdeskAiConfig(req.company);
    const ticket = await Ticket.findOne({
      company: req.company._id,
      ticket_code: req.params.code,
    }).populate('createdBy', 'email firstName lastName');
    if (!ticket) return response.notFound(res, 'Ticket not found');

    if (config.incidentDetection) {
      detectIncidents(req.company._id).catch(() => {});
    }

    const ops = await buildTicketOpsSnapshot(req.company._id, ticket);
    return response.success(res, {
      sla: config.slaPrediction ? ops.sla : null,
      mergeCandidates: config.mergeSuggestions ? ops.mergeCandidates : [],
      incident: config.incidentDetection ? ops.incident : null,
      activeIncidents: config.incidentDetection ? ops.activeIncidents : [],
    });
  } catch (err) {
    next(err);
  }
};

exports.checkResolution = async (req, res, next) => {
  try {
    const config = getHelpdeskAiConfig(req.company);
    if (!config.resolutionCheck) {
      return response.success(res, { ok: true, issues: [], skipped: true });
    }
    const ticket = await Ticket.findOne({
      company: req.company._id,
      ticket_code: req.params.code,
    });
    if (!ticket) return response.notFound(res, 'Ticket not found');
    const result = await checkResolutionCompleteness(req.company._id, ticket, {
      draftReply: req.body?.draftReply,
    });
    return response.success(res, result);
  } catch (err) {
    next(err);
  }
};

exports.mergeTicket = async (req, res, next) => {
  try {
    const config = getHelpdeskAiConfig(req.company);
    if (!config.mergeSuggestions) {
      return response.badRequest(res, 'Merge suggestions are disabled');
    }
    const sourceCode = req.body?.sourceCode;
    if (!sourceCode) return response.badRequest(res, 'sourceCode is required');
    const result = await mergeTickets(
      req.company._id,
      req.params.code,
      sourceCode,
      req.user?._id,
    );
    return response.success(
      res,
      {
        target: result.target,
        source: result.source,
      },
      `Merged ${result.source.ticket_code} into ${result.target.ticket_code}`,
    );
  } catch (err) {
    if (err.statusCode === 400) return response.badRequest(res, err.message);
    if (err.statusCode === 404) return response.notFound(res, err.message);
    next(err);
  }
};

exports.copilot = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({
      company: req.company._id,
      ticket_code: req.params.code,
    }).select('_id');
    if (!ticket) return response.notFound(res, 'Ticket not found');

    const mode = req.body?.mode || 'suggest';
    if (mode === 'suggest') {
      const result = await suggestReply(req.company._id, ticket._id);
      return response.success(res, result);
    }
    if (mode === 'transform') {
      const result = await transformReply(req.company._id, ticket._id, {
        draft: req.body?.draft,
        transform: req.body?.transform,
      });
      return response.success(res, result);
    }
    return response.badRequest(res, 'Invalid mode');
  } catch (err) {
    if (err.statusCode === 400) return response.badRequest(res, err.message);
    if (err.statusCode === 404) return response.notFound(res, err.message);
    if (err.statusCode === 503) return response.badRequest(res, err.message);
    next(err);
  }
};

exports.listTransforms = async (req, res, next) => {
  try {
    return response.success(res, {
      transforms: Object.keys(TRANSFORMS).map((id) => ({
        id,
        label: id.replace(/_/g, ' '),
      })),
    });
  } catch (err) {
    next(err);
  }
};

exports.getManagerIntelligence = async (req, res, next) => {
  try {
    const data = await getManagerIntelligence(req.company);
    return response.success(res, { managerAi: data });
  } catch (err) {
    next(err);
  }
};

exports.scoreTicketQa = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({
      company: req.company._id,
      ticket_code: req.params.code,
    }).select('_id');
    if (!ticket) return response.notFound(res, 'Ticket not found');
    const result = await scoreTicketQuality(req.company._id, ticket._id);
    if (result.skipped) {
      return response.badRequest(res, `QA skipped: ${result.reason}`);
    }
    return response.success(res, result, 'QA score saved');
  } catch (err) {
    if (err.message?.includes('JSON')) return response.badRequest(res, err.message);
    next(err);
  }
};

exports.getKnowledgeIntelligence = async (req, res, next) => {
  try {
    const generateDrafts = String(req.query.generate || '') === '1';
    const data = await getKnowledgeIntelligence(req.company, { generateDrafts });
    return response.success(res, { knowledgeAi: data });
  } catch (err) {
    next(err);
  }
};

exports.generateKnowledgeDrafts = async (req, res, next) => {
  try {
    const config = getHelpdeskAiConfig(req.company);
    if (!config.draftArticles) {
      return response.badRequest(res, 'Draft articles are disabled');
    }
    const drafts = await generateKnowledgeDrafts(req.company._id, {
      limit: Math.min(Number(req.body?.limit) || 4, 8),
    });
    return response.success(
      res,
      {
        drafts: drafts.map((d) => ({
          id: String(d._id),
          title: d.title,
          content: d.content,
          kind: d.kind || 'article',
          category: d.category,
          topic: d.draftMeta?.topic || '',
          reason: d.draftMeta?.reason || '',
          ticketCodes: d.draftMeta?.ticketCodes || [],
          createdAt: d.createdAt,
        })),
      },
      drafts.length ? `Generated ${drafts.length} draft(s)` : 'No new drafts needed',
    );
  } catch (err) {
    if (err.message?.includes('JSON') || err.message?.includes('GROQ')) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};

exports.publishKnowledgeDraft = async (req, res, next) => {
  try {
    const article = await publishDraft(req.company._id, req.params.id);
    return response.success(res, { article }, 'Draft published');
  } catch (err) {
    if (err.statusCode === 404) return response.notFound(res, err.message);
    next(err);
  }
};

exports.dismissKnowledgeDraft = async (req, res, next) => {
  try {
    await dismissDraft(req.company._id, req.params.id);
    return response.success(res, {}, 'Draft dismissed');
  } catch (err) {
    if (err.statusCode === 404) return response.notFound(res, err.message);
    next(err);
  }
};
