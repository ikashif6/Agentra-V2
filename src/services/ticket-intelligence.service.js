const Company = require('../models/Company');
const Ticket = require('../models/Ticket');
const StoreOrder = require('../models/StoreOrder');
const { groqJson, isGroqConfigured } = require('./groq.service');
const { retrieveKnowledge } = require('./live-chat-knowledge.service');
const { getHelpdeskAiConfig } = require('./helpdesk-ai-config.service');
const { maybeAutoAssignTicket } = require('./ticket-routing.service');
const {
  findSimilarResolvedTickets,
  detectHeuristicContradictions,
} = require('./customer-intelligence.service');

const ACTION_TYPES = [
  'refund',
  'cancel',
  'reship',
  'edit_address',
  'discount',
  'contact_warehouse',
  'request_info',
  'escalate_manager',
  'none',
];

const RISK_TYPES = [
  'chargeback',
  'legal',
  'fraud',
  'angry_customer',
  'public_threat',
  'repeated_delivery_failure',
  'vip_churn',
  'safety',
  'permission',
];

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function conversationTranscript(ticket, limit = 24) {
  return (ticket.messages || [])
    .filter((m) => m.body && !m.isInternal)
    .slice(-limit)
    .map((m) => {
      const who = m.isAi
        ? 'AI_AGENT'
        : String(m.senderEmail || '').includes('bot@agentra')
          ? 'AI_AGENT'
          : 'USER';
      return `${who}: ${stripHtml(m.body).replace(/^\[.*?\]\s*/, '')}`;
    })
    .join('\n');
}

function customerEmailFromTicket(ticket) {
  const detailsEmail = ticket.details?.customerEmail;
  if (detailsEmail) return detailsEmail;
  if (ticket.email?.fromAddress) return ticket.email.fromAddress;
  const creator = ticket.createdBy;
  if (creator && typeof creator === 'object' && creator.email) return creator.email;
  return '';
}

async function buildContextPack(company, ticket) {
  const email = customerEmailFromTicket(ticket);
  const transcript = conversationTranscript(ticket);
  const lastCustomer = [...(ticket.messages || [])]
    .reverse()
    .find((m) => m.body && !m.isInternal && !m.isAi && !String(m.senderEmail || '').includes('bot@agentra'));
  const queryText = stripHtml(lastCustomer?.body || ticket.ticket_title || ticket.ticket_description || '');

  const [knowledge, orders, priorTickets] = await Promise.all([
    retrieveKnowledge(company._id, queryText || transcript.slice(0, 400), 5),
    email
      ? StoreOrder.find({ company: company._id, email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
          .sort({ placedAt: -1 })
          .limit(5)
          .lean()
      : Promise.resolve([]),
    email
      ? Ticket.find({
          company: company._id,
          _id: { $ne: ticket._id },
          $or: [
            { 'details.customerEmail': email },
            { 'email.fromAddress': email },
          ],
        })
          .select('ticket_code ticket_title status priority tags createdAt closedAt')
          .sort({ createdAt: -1 })
          .limit(5)
          .lean()
      : Promise.resolve([]),
  ]);

  const aiActions = (ticket.messages || [])
    .filter((m) => m.isAi || String(m.senderEmail || '').includes('bot@agentra'))
    .slice(-8)
    .map((m) => stripHtml(m.body).replace(/^\[.*?\]\s*/, '').slice(0, 180));

  return {
    email,
    transcript,
    knowledge,
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber || o.name,
      status: o.fulfillmentStatus || o.financialStatus,
      total: o.totalPrice,
      currency: o.currency,
      placedAt: o.placedAt,
    })),
    priorTickets: priorTickets.map((t) => ({
      code: t.ticket_code,
      title: t.ticket_title,
      status: t.status,
      priority: t.priority,
      tags: t.tags,
    })),
    aiActions,
    ticketMeta: {
      code: ticket.ticket_code,
      title: ticket.ticket_title,
      source: ticket.source,
      priority: ticket.priority,
      tags: ticket.tags || [],
    },
  };
}

function normalizeIntelligence(raw, config) {
  const actionType = ACTION_TYPES.includes(raw?.recommendedAction?.type)
    ? raw.recommendedAction.type
    : 'none';

  const risks = config.riskDetection
    ? (Array.isArray(raw?.risks) ? raw.risks : [])
        .filter((r) => r && r.message)
        .slice(0, 5)
        .map((r) => ({
          type: RISK_TYPES.includes(r.type) ? r.type : 'angry_customer',
          severity: ['low', 'medium', 'high', 'critical'].includes(r.severity) ? r.severity : 'medium',
          message: String(r.message).slice(0, 400),
        }))
    : [];

  const sources = (Array.isArray(raw?.sources) ? raw.sources : [])
    .map((s) => String(s).slice(0, 120))
    .slice(0, 8);

  const contradictions = config.contradictions
    ? (Array.isArray(raw?.contradictions) ? raw.contradictions : [])
        .filter((c) => c && c.message)
        .slice(0, 5)
        .map((c) => ({
          type: String(c.type || 'conflict').slice(0, 60),
          severity: ['low', 'medium', 'high', 'critical'].includes(c.severity) ? c.severity : 'medium',
          message: String(c.message).slice(0, 400),
        }))
    : [];

  const waitingOn = [
    '',
    'customer',
    'warehouse',
    'courier',
    'manager',
    'payment_provider',
    'agent',
    'none',
  ].includes(raw?.waitingOn)
    ? raw.waitingOn
    : '';

  const suggestedPriority = ['low', 'medium', 'high', 'urgent'].includes(raw?.suggestedPriority)
    ? raw.suggestedPriority
    : '';

  return {
    summary: String(raw?.summary || '').slice(0, 800),
    customerWant: String(raw?.customerWant || '').slice(0, 400),
    sentiment: ['positive', 'neutral', 'frustrated', 'angry', 'unknown'].includes(raw?.sentiment)
      ? raw.sentiment
      : 'unknown',
    urgency: ['low', 'medium', 'high', 'critical', 'unknown'].includes(raw?.urgency)
      ? raw.urgency
      : 'unknown',
    intent: String(raw?.intent || '').slice(0, 80),
    language: String(raw?.language || '').slice(0, 40),
    handoffReason: String(raw?.handoffReason || '').slice(0, 400),
    actionsAlreadyTried: (Array.isArray(raw?.actionsAlreadyTried) ? raw.actionsAlreadyTried : [])
      .map((s) => String(s).slice(0, 200))
      .slice(0, 8),
    recommendedAction: config.recommendedAction
      ? {
          type: actionType,
          label: String(raw?.recommendedAction?.label || (actionType === 'none' ? 'No action' : actionType)).slice(
            0,
            120,
          ),
          reason: String(raw?.recommendedAction?.reason || '').slice(0, 400),
          confidence: Math.min(100, Math.max(0, Number(raw?.recommendedAction?.confidence) || 0)),
        }
      : { type: 'none', label: '', reason: '', confidence: 0 },
    risks,
    suggestedReply: config.suggestedReply ? String(raw?.suggestedReply || '').slice(0, 4000) : '',
    suggestedTags: config.autoTag
      ? (Array.isArray(raw?.suggestedTags) ? raw.suggestedTags : [])
          .map((t) => String(t).trim().slice(0, 40))
          .filter(Boolean)
          .slice(0, 8)
      : [],
    suggestedPriority: config.autoTag ? suggestedPriority : '',
    sources,
    contradictions,
    similarTickets: [],
    waitingOn,
    generatedAt: new Date(),
    model: process.env.GROQ_FAST_MODEL || process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  };
}

async function generateTicketIntelligence(companyId, ticketId, { force = false } = {}) {
  const company = await Company.findById(companyId);
  if (!company) return { skipped: true, reason: 'company' };

  const config = getHelpdeskAiConfig(company);
  if (!config.overview && !config.suggestedReply && !config.autoRouting) {
    return { skipped: true, reason: 'disabled' };
  }

  const ticket = await Ticket.findById(ticketId).populate('createdBy', 'email firstName lastName');
  if (!ticket || String(ticket.company) !== String(company._id)) {
    return { skipped: true, reason: 'ticket' };
  }

  if (!force && ticket.aiIntelligence?.generatedAt && ticket.aiIntelligence?.summary) {
    const ageMs = Date.now() - new Date(ticket.aiIntelligence.generatedAt).getTime();
    if (ageMs < 2 * 60 * 1000) {
      return { skipped: false, cached: true, aiIntelligence: ticket.aiIntelligence };
    }
  }

  if (!isGroqConfigured()) {
    return { skipped: true, reason: 'groq' };
  }

  const ctx = await buildContextPack(company, ticket);
  const knowledgeBlock = ctx.knowledge.length
    ? ctx.knowledge.map((k, i) => `[${i + 1}] ${k.title}\n${k.content}`).join('\n\n')
    : 'None';

  const system = `You are Agentra helpdesk intelligence. Analyze the support ticket and return ONLY valid JSON with this shape:
{
  "summary": "1-3 sentences: customer main issue",
  "customerWant": "what they want next",
  "sentiment": "positive|neutral|frustrated|angry|unknown",
  "urgency": "low|medium|high|critical|unknown",
  "intent": "short intent slug",
  "language": "en|ur|etc",
  "handoffReason": "why a human is needed (if handoff)",
  "actionsAlreadyTried": ["AI/agent actions already attempted"],
  "recommendedAction": {
    "type": "refund|cancel|reship|edit_address|discount|contact_warehouse|request_info|escalate_manager|none",
    "label": "short label",
    "reason": "why",
    "confidence": 0-100
  },
  "risks": [{"type":"chargeback|legal|fraud|angry_customer|public_threat|repeated_delivery_failure|vip_churn|safety|permission","severity":"low|medium|high|critical","message":"..."}],
  "suggestedReply": "complete draft reply the human agent can send (professional, channel-appropriate)",
  "suggestedTags": ["tag"],
  "suggestedPriority": "low|medium|high|urgent",
  "sources": ["knowledge titles you used"],
  "contradictions": [{"type":"conflict_slug","severity":"low|medium|high|critical","message":"..."}],
  "waitingOn": "customer|warehouse|courier|manager|payment_provider|agent|none"
}
Never invent order facts. Prefer request_info when data is missing. Flag contradictions when customer claims conflict with order data, prior AI promises look unsafe, or agents made conflicting commitments.`;

  const user = `Ticket: ${JSON.stringify(ctx.ticketMeta)}
Customer email: ${ctx.email || 'unknown'}
Orders: ${JSON.stringify(ctx.orders)}
Prior tickets: ${JSON.stringify(ctx.priorTickets)}
AI actions already tried:
${ctx.aiActions.join('\n') || 'None'}

Knowledge:
${knowledgeBlock}

Conversation:
${ctx.transcript || '(empty)'}`;

  const raw = await groqJson({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.25,
    maxTokens: 2400,
  });

  const aiIntelligence = normalizeIntelligence(raw, config);
  if (!aiIntelligence.actionsAlreadyTried.length && ctx.aiActions.length) {
    aiIntelligence.actionsAlreadyTried = ctx.aiActions.slice(0, 5);
  }
  if (!aiIntelligence.sources.length && ctx.knowledge.length) {
    aiIntelligence.sources = ctx.knowledge.map((k) => k.title).slice(0, 5);
  }

  if (config.contradictions) {
    const heuristic = detectHeuristicContradictions(ticket, ctx);
    const seen = new Set(aiIntelligence.contradictions.map((c) => c.message));
    for (const item of heuristic) {
      if (!seen.has(item.message)) aiIntelligence.contradictions.push(item);
    }
    aiIntelligence.contradictions = aiIntelligence.contradictions.slice(0, 6);
  }

  if (config.similarTickets) {
    // Prefer storing summary first so similar scoring can use it
    ticket.aiIntelligence = { ...aiIntelligence, similarTickets: [] };
    aiIntelligence.similarTickets = await findSimilarResolvedTickets(company._id, ticket, {
      limit: 5,
    });
  }

  ticket.aiIntelligence = aiIntelligence;

  if (config.autoTag) {
    if (aiIntelligence.suggestedPriority) {
      ticket.priority = aiIntelligence.suggestedPriority;
    }
    if (aiIntelligence.suggestedTags?.length) {
      const merged = new Set([...(ticket.tags || []), ...aiIntelligence.suggestedTags]);
      ticket.tags = [...merged].slice(0, 20);
    }
    if (aiIntelligence.intent && !ticket.details?.contactReason) {
      if (!ticket.details) ticket.details = {};
      ticket.details.contactReason = aiIntelligence.intent;
    }
  }

  ticket.markModified('aiIntelligence');
  ticket.markModified('details');

  // Retry on concurrent handoff/refresh saves (VersionError)
  let saved = false;
  for (let attempt = 0; attempt < 3 && !saved; attempt++) {
    try {
      if (attempt > 0) {
        const latest = await Ticket.findById(ticketId);
        if (!latest) return { skipped: true, reason: 'ticket' };
        latest.aiIntelligence = ticket.aiIntelligence;
        latest.priority = ticket.priority;
        latest.tags = ticket.tags;
        if (ticket.details) latest.details = ticket.details;
        latest.markModified('aiIntelligence');
        latest.markModified('details');
        await latest.save();
        ticket = latest;
      } else {
        await ticket.save();
      }
      saved = true;
    } catch (err) {
      if (err.name !== 'VersionError' || attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
    }
  }

  let assignment = null;
  if (config.autoRouting) {
    assignment = await maybeAutoAssignTicket(company, ticket, aiIntelligence);
  }

  return {
    skipped: false,
    cached: false,
    aiIntelligence: ticket.aiIntelligence,
    assignment,
    ticket,
  };
}

function scheduleTicketIntelligence(companyId, ticketId, opts = {}) {
  setImmediate(() => {
    generateTicketIntelligence(companyId, ticketId, opts).catch((err) => {
      console.error('[helpdesk-ai] intelligence failed', err.message);
    });
  });
}

module.exports = {
  generateTicketIntelligence,
  scheduleTicketIntelligence,
  buildContextPack,
  ACTION_TYPES,
};
