const Ticket = require('../models/Ticket');
const SupportIncident = require('../models/SupportIncident');
const mongoose = require('mongoose');
const { groqJson, isGroqConfigured } = require('./groq.service');
const { getHelpdeskAiConfig } = require('./helpdesk-ai-config.service');
const {
  customerEmailFromTicket,
  buildCustomerProfile,
} = require('./customer-intelligence.service');

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function avg(nums) {
  const list = nums.filter((n) => Number.isFinite(n));
  if (!list.length) return null;
  return Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10;
}

async function scoreTicketQuality(companyId, ticketId) {
  const ticket = await Ticket.findById(ticketId).populate('assigned_agent', 'firstName lastName');
  if (!ticket || String(ticket.company) !== String(companyId)) {
    return { skipped: true, reason: 'ticket' };
  }
  if (!['resolved', 'closed', 'self_closed'].includes(ticket.status)) {
    return { skipped: true, reason: 'not_closed' };
  }
  if (!isGroqConfigured()) {
    return { skipped: true, reason: 'groq' };
  }

  const transcript = (ticket.messages || [])
    .filter((m) => m.body && !m.isInternal)
    .slice(-20)
    .map((m) => {
      const who = m.isAi ? 'AI' : 'AGENT_OR_CUSTOMER';
      return `${who}: ${stripHtml(m.body).slice(0, 400)}`;
    })
    .join('\n');

  const raw = await groqJson({
    messages: [
      {
        role: 'system',
        content: `You are a QA reviewer for ecommerce support. Return ONLY JSON:
{
  "scores": {
    "accuracy": 0-100,
    "empathy": 0-100,
    "tone": 0-100,
    "policyCompliance": 0-100,
    "resolutionQuality": 0-100,
    "overall": 0-100
  },
  "flags": ["unnecessary_refund","missed_sale","policy_miss","slow","other"],
  "summary": "2 sentences",
  "needsManagerReview": boolean,
  "coachingTip": "one actionable tip for the agent"
}`,
      },
      {
        role: 'user',
        content: `Ticket ${ticket.ticket_code}: ${ticket.ticket_title}
Priority: ${ticket.priority}
Status: ${ticket.status}
Resolution field: ${ticket.details?.resolution || '(none)'}
Thread:\n${transcript || '(empty)'}`,
      },
    ],
    temperature: 0.2,
    maxTokens: 900,
  });

  const scores = raw.scores || {};
  const clamp = (n) => Math.min(100, Math.max(0, Number(n) || 0));
  const aiQa = {
    accuracy: clamp(scores.accuracy),
    empathy: clamp(scores.empathy),
    tone: clamp(scores.tone),
    policyCompliance: clamp(scores.policyCompliance),
    resolutionQuality: clamp(scores.resolutionQuality),
    overall: clamp(scores.overall || avg(Object.values(scores).map(Number))),
    flags: Array.isArray(raw.flags) ? raw.flags.map(String).slice(0, 6) : [],
    summary: String(raw.summary || '').slice(0, 500),
    needsManagerReview: Boolean(raw.needsManagerReview),
    coachingTip: String(raw.coachingTip || '').slice(0, 300),
    scoredAt: new Date(),
    model: process.env.GROQ_FAST_MODEL || process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  };

  ticket.aiQa = aiQa;
  ticket.markModified('aiQa');
  await ticket.save();
  return { skipped: false, aiQa, ticketCode: ticket.ticket_code };
}

function scheduleTicketQa(companyId, ticketId) {
  setImmediate(() => {
    scoreTicketQuality(companyId, ticketId).catch((err) => {
      console.error('[manager-ai] QA failed', err.message);
    });
  });
}

async function buildAgentCoaching(companyId, { days = 14, limit = 12 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const tickets = await Ticket.find({
    company: companyId,
    status: { $in: ['resolved', 'closed'] },
    closedAt: { $gte: since },
    assigned_agent: { $ne: null },
    'aiQa.overall': { $exists: true },
  })
    .select('assigned_agent aiQa ticket_code ticket_title priority tags')
    .populate('assigned_agent', 'firstName lastName email role')
    .lean();

  const byAgent = new Map();
  for (const t of tickets) {
    const id = String(t.assigned_agent?._id || t.assigned_agent);
    if (!byAgent.has(id)) {
      byAgent.set(id, {
        agent: t.assigned_agent,
        tickets: [],
        overall: [],
        empathy: [],
        accuracy: [],
        tips: [],
        flags: [],
        reviewCount: 0,
      });
    }
    const row = byAgent.get(id);
    row.tickets.push(t);
    if (t.aiQa?.overall != null) row.overall.push(t.aiQa.overall);
    if (t.aiQa?.empathy != null) row.empathy.push(t.aiQa.empathy);
    if (t.aiQa?.accuracy != null) row.accuracy.push(t.aiQa.accuracy);
    if (t.aiQa?.coachingTip) row.tips.push(t.aiQa.coachingTip);
    if (t.aiQa?.needsManagerReview) row.reviewCount += 1;
    for (const f of t.aiQa?.flags || []) row.flags.push(f);
  }

  const coaching = [...byAgent.values()]
    .map((row) => {
      const flagCounts = {};
      for (const f of row.flags) flagCounts[f] = (flagCounts[f] || 0) + 1;
      const topFlags = Object.entries(flagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([flag, count]) => ({ flag, count }));

      const overallAvg = avg(row.overall);
      const empathyAvg = avg(row.empathy);
      const accuracyAvg = avg(row.accuracy);

      let recommendation = row.tips[0] || '';
      if (!recommendation) {
        if (empathyAvg != null && empathyAvg < 70) {
          recommendation =
            'Acknowledge frustration earlier in replies; you resolve well but empathy scores are lower.';
        } else if (accuracyAvg != null && accuracyAvg < 70) {
          recommendation = 'Double-check order facts and policy before promising outcomes.';
        } else {
          recommendation = 'Keep consolidating your strongest reply patterns on delivery and refund cases.';
        }
      }

      const agent = row.agent;
      const name =
        agent && typeof agent === 'object'
          ? [agent.firstName, agent.lastName].filter(Boolean).join(' ') || agent.email
          : 'Agent';

      return {
        agentId: agent?._id ? String(agent._id) : null,
        agentName: name,
        scoredTickets: row.overall.length,
        overallAvg,
        empathyAvg,
        accuracyAvg,
        needsReviewCount: row.reviewCount,
        topFlags,
        recommendation: String(recommendation).slice(0, 320),
      };
    })
    .sort((a, b) => (a.overallAvg ?? 100) - (b.overallAvg ?? 100))
    .slice(0, limit);

  return coaching;
}

async function buildRootCauseAnalysis(companyId, { days = 7 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const tickets = await Ticket.find({
    company: companyId,
    createdAt: { $gte: since },
  })
    .select('ticket_title tags source priority aiIntelligence.intent aiIntelligence.summary details.contactReason createdAt')
    .lean();

  const buckets = new Map();
  for (const t of tickets) {
    const key =
      t.aiIntelligence?.intent ||
      t.details?.contactReason ||
      (t.tags || [])[0] ||
      tokenizeFallback(t.ticket_title);
    const k = String(key || 'general').toLowerCase();
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(t);
  }

  const ranked = [...buckets.entries()]
    .map(([topic, list]) => ({
      topic,
      count: list.length,
      share: tickets.length ? Math.round((list.length / tickets.length) * 100) : 0,
      sampleTitles: list.slice(0, 3).map((t) => t.ticket_title),
      sources: summarizeField(list.map((t) => t.source)),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const top = ranked[0];
  let narrative = 'Not enough recent ticket volume for a root-cause read.';
  if (top && top.count >= 3) {
    narrative = `${top.topic} issues account for about ${top.share}% of tickets in the last ${days} days (${top.count} tickets).`;
    if (isGroqConfigured() && tickets.length >= 5) {
      try {
        const raw = await groqJson({
          messages: [
            {
              role: 'system',
              content:
                'Return ONLY JSON {"narrative":"2-3 sentences explaining likely operational root cause","likelyCause":"short label","recommendedFocus":"one action for managers"}',
            },
            {
              role: 'user',
              content: `Topics: ${JSON.stringify(ranked.slice(0, 5))}`,
            },
          ],
          temperature: 0.2,
          maxTokens: 400,
        });
        if (raw.narrative) narrative = String(raw.narrative).slice(0, 500);
        return {
          days,
          narrative,
          likelyCause: String(raw.likelyCause || top.topic).slice(0, 120),
          recommendedFocus: String(raw.recommendedFocus || '').slice(0, 200),
          topics: ranked,
        };
      } catch {
        // fall through
      }
    }
  }

  return {
    days,
    narrative,
    likelyCause: top?.topic || '',
    recommendedFocus: top ? `Review processes related to ${top.topic}` : '',
    topics: ranked,
  };
}

function tokenizeFallback(title) {
  return String(title || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 2)
    .join('_') || 'general';
}

function summarizeField(values) {
  const counts = {};
  for (const v of values) {
    const key = v || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({ name, count }));
}

async function buildChurnRecovery(companyId, { limit = 8 } = {}) {
  const openish = await Ticket.find({
    company: companyId,
    status: { $in: ['open', 'in_progress', 'on_hold'] },
  })
    .select('ticket_code ticket_title priority details customer createdBy aiIntelligence email')
    .populate('createdBy', 'email firstName lastName')
    .limit(60)
    .lean();

  const byEmail = new Map();
  for (const t of openish) {
    const email = customerEmailFromTicket(t);
    if (!email || email.includes('agentra.local')) continue;
    if (!byEmail.has(email)) byEmail.set(email, []);
    byEmail.get(email).push(t);
  }

  const recommendations = [];
  for (const [email, tickets] of byEmail.entries()) {
    const profile = await buildCustomerProfile(companyId, email);
    const angry = tickets.some((t) =>
      ['angry', 'frustrated'].includes(t.aiIntelligence?.sentiment),
    );
    const highRisk = tickets.some((t) =>
      (t.aiIntelligence?.risks || []).some((r) =>
        ['chargeback', 'vip_churn', 'legal', 'public_threat'].includes(r.type),
      ),
    );
    const isVip = profile.loyaltyLevel === 'vip' || profile.totalSpend >= 500;
    const repeatRefunds = (profile.refundLikeTags || 0) >= 2;

    if (!angry && !highRisk && !isVip && tickets.length < 2) continue;

    let action = 'apology_only';
    let reason = 'Customer has open support friction.';
    if (highRisk && /chargeback|legal/.test(JSON.stringify(tickets.map((t) => t.aiIntelligence?.risks)))) {
      action = 'manager_intervention';
      reason = 'Legal/chargeback risk signals present.';
    } else if (repeatRefunds && !isVip) {
      action = 'no_compensation';
      reason = 'Repeated refund/return patterns — review for abuse before compensating.';
    } else if (isVip && angry) {
      action = 'replacement_or_refund';
      reason = 'VIP customer with negative sentiment — prioritize recovery.';
    } else if (isVip) {
      action = 'small_discount';
      reason = 'High-value customer with open issues — a goodwill gesture may help.';
    } else if (angry) {
      action = 'free_shipping';
      reason = 'Frustrated customer — goodwill shipping credit is a low-cost recovery option.';
    }

    recommendations.push({
      email,
      name: profile.name || email,
      loyaltyLevel: profile.loyaltyLevel,
      totalSpend: profile.totalSpend,
      openTickets: tickets.length,
      action,
      reason,
      ticketCodes: tickets.map((t) => t.ticket_code).slice(0, 5),
    });
  }

  return recommendations
    .sort((a, b) => (b.totalSpend || 0) - (a.totalSpend || 0))
    .slice(0, limit);
}

async function buildManagerFeed(companyId, { days = 7 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const prevSince = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000);

  const [createdNow, createdPrev, handoffs, lowQa, incidents, bySource] = await Promise.all([
    Ticket.countDocuments({ company: companyId, createdAt: { $gte: since } }),
    Ticket.countDocuments({
      company: companyId,
      createdAt: { $gte: prevSince, $lt: since },
    }),
    Ticket.countDocuments({
      company: companyId,
      createdAt: { $gte: since },
      'aiIntelligence.handoffReason': { $exists: true, $ne: '' },
    }),
    Ticket.find({
      company: companyId,
      'aiQa.needsManagerReview': true,
      closedAt: { $gte: since },
    })
      .select('ticket_code ticket_title aiQa.overall aiQa.summary assigned_agent')
      .populate('assigned_agent', 'firstName lastName')
      .limit(10)
      .lean(),
    SupportIncident.find({
      company: companyId,
      lastSeenAt: { $gte: since },
    })
      .sort({ ticketCount: -1 })
      .limit(5)
      .lean(),
    Ticket.aggregate([
      {
        $match: {
          company: mongoose.Types.ObjectId.isValid(companyId)
            ? new mongoose.Types.ObjectId(String(companyId))
            : companyId,
          createdAt: { $gte: since },
        },
      },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
  ]);

  const volumeDelta =
    createdPrev === 0 ? (createdNow > 0 ? 100 : 0) : Math.round(((createdNow - createdPrev) / createdPrev) * 100);

  const findings = [];
  findings.push({
    type: 'volume',
    severity: Math.abs(volumeDelta) >= 25 ? 'high' : 'info',
    title: 'Ticket volume change',
    body: `${createdNow} tickets in the last ${days} days (${volumeDelta >= 0 ? '+' : ''}${volumeDelta}% vs prior window).`,
  });
  if (handoffs) {
    findings.push({
      type: 'handoff',
      severity: 'info',
      title: 'AI Agent handoffs',
      body: `${handoffs} tickets include an AI handoff reason in this period.`,
    });
  }
  for (const inc of incidents) {
    findings.push({
      type: 'incident',
      severity: 'high',
      title: inc.title || 'Incident spike',
      body: inc.summary || `${inc.ticketCount} related tickets`,
    });
  }
  for (const t of lowQa) {
    const agent =
      t.assigned_agent && typeof t.assigned_agent === 'object'
        ? [t.assigned_agent.firstName, t.assigned_agent.lastName].filter(Boolean).join(' ')
        : 'Agent';
    findings.push({
      type: 'qa_review',
      severity: 'medium',
      title: `Review ${t.ticket_code}`,
      body: `${agent}: ${t.aiQa?.summary || t.ticket_title} (score ${t.aiQa?.overall ?? 'n/a'})`,
      ticketCode: t.ticket_code,
    });
  }

  return {
    days,
    createdNow,
    createdPrev,
    volumeDelta,
    handoffs,
    bySource: bySource.map((r) => ({ source: r._id || 'unknown', count: r.count })),
    findings: findings.slice(0, 20),
  };
}

async function getManagerIntelligence(company) {
  const config = getHelpdeskAiConfig(company);
  const companyId = company._id;

  // Backfill a small QA batch for closed tickets missing scores
  if (config.qualityAssurance && isGroqConfigured()) {
    const pending = await Ticket.find({
      company: companyId,
      status: { $in: ['resolved', 'closed'] },
      closedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      'aiQa.overall': { $exists: false },
    })
      .select('_id')
      .limit(3)
      .lean();
    for (const row of pending) {
      scheduleTicketQa(companyId, row._id);
    }
  }

  const [feed, coaching, rootCause, churn] = await Promise.all([
    config.managerFeed ? buildManagerFeed(companyId) : Promise.resolve(null),
    config.agentCoaching ? buildAgentCoaching(companyId) : Promise.resolve([]),
    config.rootCauseAnalysis ? buildRootCauseAnalysis(companyId) : Promise.resolve(null),
    config.churnRecovery ? buildChurnRecovery(companyId) : Promise.resolve([]),
  ]);

  const recentQa = config.qualityAssurance
    ? await Ticket.find({
        company: companyId,
        'aiQa.scoredAt': { $exists: true },
      })
        .select('ticket_code ticket_title aiQa assigned_agent closedAt')
        .populate('assigned_agent', 'firstName lastName')
        .sort({ 'aiQa.scoredAt': -1 })
        .limit(12)
        .lean()
    : [];

  return {
    feed,
    coaching,
    rootCause,
    churn,
    recentQa: recentQa.map((t) => ({
      ticketCode: t.ticket_code,
      title: t.ticket_title,
      overall: t.aiQa?.overall,
      needsManagerReview: t.aiQa?.needsManagerReview,
      summary: t.aiQa?.summary,
      coachingTip: t.aiQa?.coachingTip,
      flags: t.aiQa?.flags || [],
      agentName:
        t.assigned_agent && typeof t.assigned_agent === 'object'
          ? [t.assigned_agent.firstName, t.assigned_agent.lastName].filter(Boolean).join(' ')
          : '',
      scoredAt: t.aiQa?.scoredAt,
    })),
  };
}

module.exports = {
  scoreTicketQuality,
  scheduleTicketQa,
  buildAgentCoaching,
  buildRootCauseAnalysis,
  buildChurnRecovery,
  buildManagerFeed,
  getManagerIntelligence,
};
