const Ticket = require('../models/Ticket');
const SupportIncident = require('../models/SupportIncident');
const { groqJson, isGroqConfigured } = require('./groq.service');
const { customerEmailFromTicket } = require('./customer-intelligence.service');

const SLA_HOURS = {
  urgent: 2,
  high: 8,
  medium: 24,
  low: 48,
};

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}

function incidentSignature(ticket) {
  const intent = ticket.aiIntelligence?.intent || '';
  const tags = (ticket.tags || []).slice(0, 3).join('-');
  const titleTokens = tokenize(ticket.ticket_title).slice(0, 4).join('-');
  return [intent || 'general', tags || titleTokens || 'misc'].filter(Boolean).join('::').toLowerCase();
}

/**
 * Cluster open tickets in a recent window that share intent/title signals.
 */
async function detectIncidents(companyId, { windowMinutes = 45, minTickets = 3 } = {}) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const open = await Ticket.find({
    company: companyId,
    status: { $in: ['open', 'in_progress', 'on_hold'] },
    createdAt: { $gte: since },
    mergedInto: { $exists: false },
  })
    .select('ticket_code ticket_title tags source aiIntelligence.intent createdAt')
    .lean();

  const buckets = new Map();
  for (const t of open) {
    const key = incidentSignature(t);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(t);
  }

  const incidents = [];
  for (const [key, tickets] of buckets.entries()) {
    if (tickets.length < minTickets) continue;
    const title = `Spike: ${tickets[0].aiIntelligence?.intent || tickets[0].ticket_title || 'related issues'}`;
    const summary = `${tickets.length} customers reported a similar issue in the last ${windowMinutes} minutes.`;
    const ticketCodes = tickets.map((t) => t.ticket_code);

    const doc = await SupportIncident.findOneAndUpdate(
      { company: companyId, key },
      {
        $set: {
          title: String(title).slice(0, 160),
          summary,
          ticketCodes,
          ticketCount: tickets.length,
          windowMinutes,
          status: 'open',
          lastSeenAt: new Date(),
        },
        $setOnInsert: { firstSeenAt: new Date() },
      },
      { upsert: true, new: true },
    );

    incidents.push({
      id: String(doc._id),
      key: doc.key,
      title: doc.title,
      summary: doc.summary,
      ticketCount: doc.ticketCount,
      ticketCodes: doc.ticketCodes,
      windowMinutes: doc.windowMinutes,
      lastSeenAt: doc.lastSeenAt,
    });
  }

  return incidents.sort((a, b) => b.ticketCount - a.ticketCount);
}

async function listActiveIncidents(companyId, { limit = 10 } = {}) {
  const rows = await SupportIncident.find({
    company: companyId,
    status: { $in: ['open', 'monitoring'] },
    lastSeenAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  })
    .sort({ ticketCount: -1, lastSeenAt: -1 })
    .limit(limit)
    .lean();

  return rows.map((doc) => ({
    id: String(doc._id),
    key: doc.key,
    title: doc.title,
    summary: doc.summary,
    ticketCount: doc.ticketCount,
    ticketCodes: doc.ticketCodes,
    windowMinutes: doc.windowMinutes,
    lastSeenAt: doc.lastSeenAt,
  }));
}

/**
 * Same customer, open tickets on other channels / near-duplicate titles.
 */
async function findMergeCandidates(companyId, ticket) {
  const email = customerEmailFromTicket(ticket);
  if (!email) return [];

  const emailRe = new RegExp(`^${String(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  const others = await Ticket.find({
    company: companyId,
    _id: { $ne: ticket._id },
    status: { $in: ['open', 'in_progress', 'on_hold'] },
    mergedInto: { $exists: false },
    $or: [{ 'details.customerEmail': emailRe }, { 'email.fromAddress': emailRe }],
  })
    .select('ticket_code ticket_title source status priority createdAt messages aiIntelligence.summary')
    .sort({ createdAt: -1 })
    .limit(12)
    .lean();

  const baseTokens = tokenize(
    [ticket.ticket_title, ticket.aiIntelligence?.summary, ...(ticket.tags || [])].join(' '),
  );

  return others
    .map((o) => {
      const score = jaccard(
        baseTokens,
        tokenize([o.ticket_title, o.aiIntelligence?.summary].join(' ')),
      );
      const crossChannel = o.source && ticket.source && o.source !== ticket.source;
      const confidence = Math.round((score * 0.7 + (crossChannel ? 0.3 : 0.1)) * 100);
      return {
        ticketCode: o.ticket_code,
        title: o.ticket_title,
        source: o.source,
        confidence: Math.min(99, Math.max(confidence, crossChannel ? 55 : 20)),
        reason: crossChannel
          ? `Same customer on ${o.source} — likely the same issue`
          : 'Similar open ticket from the same customer',
      };
    })
    .filter((c) => c.confidence >= 50)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

async function predictSlaBreach(companyId, ticket) {
  const priority = ticket.priority || 'medium';
  const targetHours = SLA_HOURS[priority] || SLA_HOURS.medium;
  const ageMs = Date.now() - new Date(ticket.createdAt || Date.now()).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  const remainingHours = targetHours - ageHours;

  const openQueue = await Ticket.countDocuments({
    company: companyId,
    status: { $in: ['open', 'in_progress'] },
    mergedInto: { $exists: false },
  });

  const msgCount = (ticket.messages || []).length;
  const complexityBoost = msgCount > 12 ? 12 : msgCount > 6 ? 6 : 0;
  const queueBoost = openQueue > 40 ? 18 : openQueue > 20 ? 10 : 0;
  const urgencyBoost = ['high', 'urgent'].includes(priority) ? 8 : 0;

  let probability = 15;
  if (remainingHours <= 0) probability = 95;
  else if (remainingHours <= targetHours * 0.25) probability = 78;
  else if (remainingHours <= targetHours * 0.5) probability = 55;
  else if (remainingHours <= targetHours * 0.75) probability = 35;

  probability = Math.min(99, probability + complexityBoost + queueBoost + urgencyBoost);

  return {
    probability,
    targetHours,
    ageHours: Math.round(ageHours * 10) / 10,
    remainingHours: Math.round(remainingHours * 10) / 10,
    openQueue,
    message:
      remainingHours <= 0
        ? `Resolution SLA (${targetHours}h for ${priority}) is already overdue.`
        : `About ${probability}% chance of breaching the ${targetHours}h ${priority} SLA within the next window.`,
  };
}

async function checkResolutionCompleteness(companyId, ticket, { draftReply = '' } = {}) {
  const issues = [];
  const transcript = (ticket.messages || [])
    .filter((m) => m.body && !m.isInternal)
    .map((m) => stripHtml(m.body))
    .join('\n')
    .toLowerCase();
  const draft = stripHtml(draftReply || ticket.aiIntelligence?.suggestedReply || '').toLowerCase();
  const combined = `${transcript}\n${draft}`;

  if (/refund|money back|reimburse/.test(combined) && !/refunded|processed the refund|refund is done/.test(transcript)) {
    issues.push({
      code: 'refund_promised',
      severity: 'high',
      message: 'A refund is mentioned, but no completed refund confirmation was found in the thread.',
    });
  }

  if (/replac(e|ement)|reship/.test(combined) && !/replacement (sent|shipped)|reshipped|new order/.test(transcript)) {
    issues.push({
      code: 'replacement_promised',
      severity: 'medium',
      message: 'A replacement/reship is discussed, but fulfillment confirmation is missing.',
    });
  }

  const lastCustomerQs = (ticket.messages || [])
    .filter((m) => m.body && !m.isAi && !m.isInternal)
    .slice(-4)
    .map((m) => stripHtml(m.body))
    .filter((b) => b.includes('?'));
  if (lastCustomerQs.length && draft && draft.length < 40) {
    issues.push({
      code: 'possibly_unanswered',
      severity: 'medium',
      message: 'The customer asked questions recently; the closing reply looks too short to cover them.',
    });
  }

  if (!ticket.details?.resolution) {
    issues.push({
      code: 'missing_resolution_field',
      severity: 'low',
      message: 'Resolution field is empty — add a short resolution note before closing.',
    });
  }

  if (ticket.aiIntelligence?.contradictions?.length) {
    issues.push({
      code: 'open_contradictions',
      severity: 'high',
      message: 'Unresolved contradictions are still flagged on this ticket.',
    });
  }

  if (isGroqConfigured() && (transcript.length > 80 || draft.length > 20)) {
    try {
      const raw = await groqJson({
        messages: [
          {
            role: 'system',
            content: `You check if a support ticket is safe to close. Return ONLY JSON:
{"ok":boolean,"issues":[{"code":"slug","severity":"low|medium|high","message":"..."}]}
Flag: unanswered customer questions, promised actions not completed, unsupported claims, missing tracking when shipping was promised.`,
          },
          {
            role: 'user',
            content: `Title: ${ticket.ticket_title}
Draft/closing context: ${draft || '(none)'}
Thread:\n${transcript.slice(0, 5000)}`,
          },
        ],
        temperature: 0.1,
        maxTokens: 700,
      });
      if (Array.isArray(raw.issues)) {
        for (const issue of raw.issues.slice(0, 5)) {
          if (issue?.message) {
            issues.push({
              code: String(issue.code || 'ai_check').slice(0, 40),
              severity: ['low', 'medium', 'high'].includes(issue.severity) ? issue.severity : 'medium',
              message: String(issue.message).slice(0, 300),
            });
          }
        }
      }
    } catch {
      // Heuristics alone are enough if Groq fails
    }
  }

  const seen = new Set();
  const unique = [];
  for (const issue of issues) {
    if (seen.has(issue.message)) continue;
    seen.add(issue.message);
    unique.push(issue);
  }

  return {
    ok: unique.filter((i) => i.severity === 'high').length === 0,
    issues: unique.slice(0, 8),
  };
}

/**
 * Merge source ticket into target: append messages, close source.
 */
async function mergeTickets(companyId, targetCode, sourceCode, actorUserId) {
  if (String(targetCode).toUpperCase() === String(sourceCode).toUpperCase()) {
    const err = new Error('Cannot merge a ticket into itself');
    err.statusCode = 400;
    throw err;
  }

  const [target, source] = await Promise.all([
    Ticket.findOne({ company: companyId, ticket_code: String(targetCode).toUpperCase() }),
    Ticket.findOne({ company: companyId, ticket_code: String(sourceCode).toUpperCase() }),
  ]);

  if (!target || !source) {
    const err = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }
  if (source.mergedInto) {
    const err = new Error('Source ticket is already merged');
    err.statusCode = 400;
    throw err;
  }

  const stamp = `\n\n--- Merged from ${source.ticket_code} (${source.source || 'unknown channel'}) ---`;
  for (const msg of source.messages || []) {
    target.messages.push({
      sender: msg.sender,
      senderEmail: msg.senderEmail,
      body: `${msg.body || ''}${stamp}`,
      attachments: msg.attachments || [],
      isInternal: Boolean(msg.isInternal),
      isAi: Boolean(msg.isAi),
      sentAt: msg.sentAt || new Date(),
    });
  }

  target.tags = [...new Set([...(target.tags || []), ...(source.tags || []), 'merged'])].slice(0, 30);
  if (!target.mergedFromCodes) target.mergedFromCodes = [];
  target.mergedFromCodes = [...new Set([...(target.mergedFromCodes || []), source.ticket_code])];
  target.lastActivity = new Date();
  target.markModified('messages');

  source.mergedInto = target._id;
  source.mergedIntoCode = target.ticket_code;
  source.status = 'closed';
  source.closedAt = new Date();
  source.closedBy = actorUserId || null;
  source.tags = [...new Set([...(source.tags || []), 'merged-away'])];
  source.lastActivity = new Date();

  await Promise.all([target.save(), source.save()]);

  return { target, source };
}

async function buildTicketOpsSnapshot(companyId, ticket) {
  const companyStub = { helpdeskAi: undefined };
  // Caller passes real company when possible; we only need toggles later in controller
  void companyStub;

  const [mergeCandidates, sla, incidents] = await Promise.all([
    findMergeCandidates(companyId, ticket),
    predictSlaBreach(companyId, ticket),
    listActiveIncidents(companyId, { limit: 5 }),
  ]);

  const relatedIncident = incidents.find((inc) =>
    (inc.ticketCodes || []).includes(ticket.ticket_code),
  );

  return {
    mergeCandidates,
    sla,
    incident: relatedIncident || null,
    activeIncidents: incidents,
  };
}

module.exports = {
  SLA_HOURS,
  detectIncidents,
  listActiveIncidents,
  findMergeCandidates,
  predictSlaBreach,
  checkResolutionCompleteness,
  mergeTickets,
  buildTicketOpsSnapshot,
};
