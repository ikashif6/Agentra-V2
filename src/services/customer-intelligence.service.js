const Ticket = require('../models/Ticket');
const StoreOrder = require('../models/StoreOrder');
const User = require('../models/User');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function customerEmailFromTicket(ticket) {
  const detailsEmail = ticket.details?.customerEmail;
  if (detailsEmail) return String(detailsEmail).trim().toLowerCase();
  if (ticket.email?.fromAddress) return String(ticket.email.fromAddress).trim().toLowerCase();
  const creator = ticket.createdBy;
  if (creator && typeof creator === 'object' && creator.email) {
    return String(creator.email).trim().toLowerCase();
  }
  return '';
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function jaccard(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

async function findSimilarResolvedTickets(companyId, ticket, { limit = 5 } = {}) {
  const queryText = [
    ticket.ticket_title,
    ticket.ticket_description,
    ticket.aiIntelligence?.summary,
    ticket.aiIntelligence?.intent,
    ...(ticket.tags || []),
  ]
    .filter(Boolean)
    .join(' ');
  const queryTokens = tokenize(queryText);
  if (queryTokens.length < 2) return [];

  const candidates = await Ticket.find({
    company: companyId,
    _id: { $ne: ticket._id },
    status: { $in: ['resolved', 'closed', 'self_closed'] },
  })
    .select(
      'ticket_code ticket_title ticket_description status priority tags messages closedAt assigned_agent details.resolution aiIntelligence.summary aiIntelligence.suggestedReply',
    )
    .populate('assigned_agent', 'firstName lastName')
    .sort({ closedAt: -1, updatedAt: -1 })
    .limit(80)
    .lean();

  const scored = candidates
    .map((c) => {
      const hay = [
        c.ticket_title,
        c.ticket_description,
        c.details?.resolution,
        c.aiIntelligence?.summary,
        ...(c.tags || []),
      ]
        .filter(Boolean)
        .join(' ');
      const score = jaccard(queryTokens, tokenize(hay));
      const lastStaff = [...(c.messages || [])]
        .reverse()
        .find(
          (m) =>
            m.body &&
            !m.isInternal &&
            !m.isAi &&
            !String(m.senderEmail || '').includes('bot@agentra'),
        );
      const lastAny = [...(c.messages || [])].reverse().find((m) => m.body && !m.isInternal);
      const agent = c.assigned_agent;
      const agentName =
        agent && typeof agent === 'object'
          ? [agent.firstName, agent.lastName].filter(Boolean).join(' ')
          : '';

      return {
        ticketCode: c.ticket_code,
        title: c.ticket_title,
        status: c.status,
        similarity: Math.round(score * 100),
        outcome: c.details?.resolution || c.aiIntelligence?.summary || '',
        responseThatWorked: stripHtml(
          c.aiIntelligence?.suggestedReply || lastStaff?.body || lastAny?.body || '',
        ).slice(0, 320),
        resolvedBy: agentName || 'Unassigned',
        closedAt: c.closedAt || null,
      };
    })
    .filter((c) => c.similarity >= 18)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored;
}

async function buildCustomerProfile(companyId, email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    return {
      email: '',
      available: false,
      totalOrders: 0,
      totalSpend: 0,
      currency: 'USD',
      loyaltyLevel: 'unknown',
      openTickets: 0,
      closedTickets: 0,
      refundLikeTags: 0,
      preferredLanguage: '',
      productsPurchased: [],
      previousProblems: [],
      unresolvedIssues: [],
    };
  }

  const emailRe = new RegExp(`^${escapeRegex(normalized)}$`, 'i');
  const [orders, tickets, user] = await Promise.all([
    StoreOrder.find({ company: companyId, email: emailRe }).sort({ placedAt: -1 }).limit(40).lean(),
    Ticket.find({
      company: companyId,
      $or: [{ 'details.customerEmail': emailRe }, { 'email.fromAddress': emailRe }],
    })
      .select('ticket_code ticket_title status priority tags source createdAt closedAt details aiIntelligence.summary')
      .sort({ createdAt: -1 })
      .limit(40)
      .lean(),
    User.findOne({ company: companyId, email: emailRe }).select('firstName lastName locale').lean(),
  ]);

  const totalSpend = orders.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);
  const currency = orders[0]?.currency || 'USD';
  const productsPurchased = [
    ...new Set(
      orders.flatMap((o) => (o.lineItems || []).map((li) => li.title).filter(Boolean)).slice(0, 12),
    ),
  ];

  const openTickets = tickets.filter((t) =>
    ['open', 'in_progress', 'on_hold'].includes(t.status),
  ).length;
  const closedTickets = tickets.filter((t) =>
    ['resolved', 'closed', 'self_closed'].includes(t.status),
  ).length;

  const refundLikeTags = tickets.filter((t) =>
    [...(t.tags || []), t.details?.contactReason || '', t.aiIntelligence?.summary || '']
      .join(' ')
      .toLowerCase()
      .match(/refund|return|chargeback|cancel/),
  ).length;

  let loyaltyLevel = 'new';
  if (orders.length >= 8 || totalSpend >= 1000) loyaltyLevel = 'vip';
  else if (orders.length >= 3 || totalSpend >= 250) loyaltyLevel = 'returning';
  else if (orders.length >= 1) loyaltyLevel = 'active';

  const previousProblems = tickets
    .filter((t) => ['resolved', 'closed', 'self_closed'].includes(t.status))
    .slice(0, 6)
    .map((t) => ({
      ticketCode: t.ticket_code,
      title: t.ticket_title,
      summary: t.aiIntelligence?.summary || t.details?.resolution || '',
      status: t.status,
      at: t.closedAt || t.createdAt,
    }));

  const unresolvedIssues = tickets
    .filter((t) => ['open', 'in_progress', 'on_hold'].includes(t.status))
    .slice(0, 6)
    .map((t) => ({
      ticketCode: t.ticket_code,
      title: t.ticket_title,
      priority: t.priority,
      source: t.source,
      at: t.createdAt,
    }));

  return {
    email: normalized,
    available: true,
    name: user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '',
    totalOrders: orders.length,
    totalSpend: Math.round(totalSpend * 100) / 100,
    currency,
    loyaltyLevel,
    openTickets,
    closedTickets,
    refundLikeTags,
    preferredLanguage: user?.locale || '',
    productsPurchased,
    previousProblems,
    unresolvedIssues,
  };
}

async function buildCustomerTimeline(companyId, email, { limit = 20 } = {}) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return [];

  const emailRe = new RegExp(`^${escapeRegex(normalized)}$`, 'i');
  const [orders, tickets] = await Promise.all([
    StoreOrder.find({ company: companyId, email: emailRe }).sort({ placedAt: -1 }).limit(25).lean(),
    Ticket.find({
      company: companyId,
      $or: [{ 'details.customerEmail': emailRe }, { 'email.fromAddress': emailRe }],
    })
      .select('ticket_code ticket_title status source createdAt closedAt details aiIntelligence.summary')
      .sort({ createdAt: -1 })
      .limit(25)
      .lean(),
  ]);

  const events = [];

  for (const o of orders) {
    events.push({
      at: o.placedAt || o.createdAt,
      type: 'order',
      title: `Ordered ${o.orderNumber || o.name || 'order'}`,
      detail: `${o.fulfillmentStatus || o.financialStatus || 'placed'}${
        o.totalPrice != null ? ` · ${o.currency || ''} ${o.totalPrice}` : ''
      }`,
      ref: String(o._id),
    });
  }

  for (const t of tickets) {
    events.push({
      at: t.createdAt,
      type: 'ticket_opened',
      title: `Opened ${t.ticket_code}`,
      detail: t.ticket_title,
      ref: t.ticket_code,
    });
    if (t.closedAt) {
      events.push({
        at: t.closedAt,
        type: 'ticket_closed',
        title: `Closed ${t.ticket_code}`,
        detail: t.details?.resolution || t.aiIntelligence?.summary || t.status,
        ref: t.ticket_code,
      });
    }
  }

  return events
    .filter((e) => e.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit);
}

function detectHeuristicContradictions(ticket, ctx) {
  const findings = [];
  const transcript = String(ctx.transcript || '').toLowerCase();
  const aiReplies = (ctx.aiActions || []).join(' ').toLowerCase();

  if (/already (got|received|have) (a |the )?refund/.test(transcript) && /refund/.test(transcript)) {
    findings.push({
      type: 'possible_repeat_refund',
      severity: 'high',
      message: 'Customer mentions a prior refund in the same conversation — verify before issuing another.',
    });
  }

  if (
    ctx.orders?.some((o) => String(o.status || '').toLowerCase().includes('refund')) &&
    /refund|money back/.test(transcript)
  ) {
    findings.push({
      type: 'order_already_refunded',
      severity: 'high',
      message: 'Order data suggests a refund already exists, but the customer is still asking about refunds.',
    });
  }

  if (aiReplies && /free|guarantee|certainly|definitely will/.test(aiReplies)) {
    findings.push({
      type: 'ai_promise_check',
      severity: 'medium',
      message: 'The AI Agent may have made a strong commitment before handoff — confirm it against policy.',
    });
  }

  const emailsInThread = (transcript.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map((e) =>
    e.toLowerCase(),
  );
  const uniqueEmails = [...new Set(emailsInThread)];
  if (uniqueEmails.length > 1 && ctx.email && uniqueEmails.some((e) => e !== String(ctx.email).toLowerCase())) {
    findings.push({
      type: 'conflicting_contact',
      severity: 'medium',
      message: 'Multiple email addresses appear in this conversation — verify the identity before sharing order details.',
    });
  }

  return findings.slice(0, 5);
}

async function getCustomerIntelligenceForTicket(companyId, ticket) {
  const email = customerEmailFromTicket(ticket);
  const [profile, timeline, similarTickets] = await Promise.all([
    buildCustomerProfile(companyId, email),
    buildCustomerTimeline(companyId, email),
    findSimilarResolvedTickets(companyId, ticket),
  ]);
  return { email, profile, timeline, similarTickets };
}

module.exports = {
  customerEmailFromTicket,
  findSimilarResolvedTickets,
  buildCustomerProfile,
  buildCustomerTimeline,
  detectHeuristicContradictions,
  getCustomerIntelligenceForTicket,
};
