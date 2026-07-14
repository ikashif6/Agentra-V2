const ChatKnowledge = require('../models/ChatKnowledge');
const Ticket = require('../models/Ticket');
const { groqJson, isGroqConfigured } = require('./groq.service');
const { getHelpdeskAiConfig } = require('./helpdesk-ai-config.service');
const { retrieveKnowledge, createKnowledge } = require('./live-chat-knowledge.service');

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function topicKey(ticket) {
  return String(
    ticket.aiIntelligence?.intent ||
      ticket.details?.contactReason ||
      (ticket.tags || [])[0] ||
      tokenize(ticket.ticket_title).slice(0, 2).join('_') ||
      'general',
  )
    .toLowerCase()
    .trim()
    .slice(0, 80);
}

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Knowledge-gap detector — topics with repeated pain (handoff / reopen / escalate /
 * manual resolve) and weak or missing KB coverage.
 */
async function detectKnowledgeGaps(companyId, { days = 21, limit = 10 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const tickets = await Ticket.find({
    company: companyId,
    createdAt: { $gte: since },
  })
    .select(
      'ticket_code ticket_title status tags source details aiIntelligence aiQa closedAt createdAt',
    )
    .lean();

  const buckets = new Map();
  for (const t of tickets) {
    const key = topicKey(t);
    if (!buckets.has(key)) {
      buckets.set(key, {
        topic: key,
        tickets: [],
        handoffs: 0,
        reopened: 0,
        escalated: 0,
        lowQa: 0,
        manualNoSource: 0,
      });
    }
    const row = buckets.get(key);
    row.tickets.push(t);

    if (t.aiIntelligence?.handoffReason) row.handoffs += 1;
    if (['open', 'in_progress'].includes(t.status) && t.closedAt) row.reopened += 1;
    if ((t.aiIntelligence?.risks || []).some((r) => r?.type === 'escalation' || r?.severity === 'high')) {
      row.escalated += 1;
    }
    if (t.aiQa?.overall != null && t.aiQa.overall < 65) row.lowQa += 1;

    const sources = t.aiIntelligence?.sources || [];
    const resolvedManually = ['resolved', 'closed'].includes(t.status);
    if (resolvedManually && (!sources.length || sources.length === 0)) {
      row.manualNoSource += 1;
    }
  }

  const gaps = [];
  for (const row of buckets.values()) {
    const pain =
      row.handoffs + row.reopened + row.escalated + row.lowQa + row.manualNoSource;
    if (row.tickets.length < 2 && pain < 2) continue;

    const sampleQuery =
      row.tickets
        .map((t) => t.aiIntelligence?.summary || t.ticket_title)
        .filter(Boolean)
        .slice(0, 3)
        .join(' ') || row.topic;

    const matches = await retrieveKnowledge(companyId, sampleQuery, 3);
    const covered = matches.length > 0;
    const coverageScore = matches.length;

    // Flag when KB is missing or topic has significant unresolved pain signals
    if (covered && coverageScore >= 2 && pain < 3 && row.manualNoSource < 3) continue;

    const count = row.tickets.length;
    const reasonParts = [];
    if (!covered) reasonParts.push('no approved knowledge article answers this well');
    else if (coverageScore < 2) reasonParts.push('weak knowledge coverage');
    if (row.handoffs) reasonParts.push(`${row.handoffs} AI handoffs`);
    if (row.manualNoSource) reasonParts.push(`${row.manualNoSource} manual resolutions without KB sources`);
    if (row.lowQa) reasonParts.push(`${row.lowQa} low QA scores`);

    gaps.push({
      topic: row.topic,
      ticketCount: count,
      painScore: pain,
      coverageScore,
      covered,
      message: `${count} customers asked about “${row.topic.replace(/_/g, ' ')}”, but ${
        reasonParts[0] || 'this area needs a stronger knowledge source'
      }.`,
      reasons: reasonParts,
      sampleTitles: row.tickets.slice(0, 3).map((t) => t.ticket_title),
      ticketCodes: row.tickets.map((t) => t.ticket_code).slice(0, 8),
      relatedArticles: matches.map((m) => ({
        id: String(m._id),
        title: m.title,
      })),
    });
  }

  return gaps
    .sort((a, b) => b.painScore - a.painScore || b.ticketCount - a.ticketCount)
    .slice(0, limit);
}

async function generateDraftForGap(companyId, gap, kind = 'article') {
  if (!isGroqConfigured()) {
    return {
      title: `${gap.topic.replace(/_/g, ' ')} — draft`,
      content: `Customers frequently ask about ${gap.topic.replace(/_/g, ' ')}.\n\nSummary from recent tickets:\n${(gap.sampleTitles || [])
        .map((t) => `- ${t}`)
        .join('\n')}\n\nPlease expand this into a clear policy / help article before publishing.`,
      kind,
      category: kind === 'macro' ? 'macro' : 'ai_draft',
    };
  }

  const kindInstructions = {
    article: 'a customer-facing help-center article (markdown-friendly plain text)',
    macro: 'a short agent reply macro / canned response (2-4 short paragraphs max)',
    guide: 'an internal agent troubleshooting guide',
    policy: 'a clear store policy statement agents and AI can cite',
    troubleshooting: 'a step-by-step troubleshooting flow',
  };

  const raw = await groqJson({
    messages: [
      {
        role: 'system',
        content: `You draft support knowledge. Return ONLY JSON:
{"title":"string","content":"string","category":"shipping|returns|orders|products|policy|macro|general"}
Write ${kindInstructions[kind] || kindInstructions.article}. Be accurate, neutral, and mark unknowns as needing merchant confirmation.`,
      },
      {
        role: 'user',
        content: `Topic: ${gap.topic}
Gap: ${gap.message}
Sample ticket titles: ${(gap.sampleTitles || []).join(' | ')}
Ticket codes: ${(gap.ticketCodes || []).join(', ')}`,
      },
    ],
    temperature: 0.3,
    maxTokens: 1200,
  });

  return {
    title: String(raw.title || `${gap.topic} guide`).slice(0, 200),
    content: String(raw.content || '').slice(0, 50000),
    kind,
    category: String(raw.category || (kind === 'macro' ? 'macro' : 'ai_draft')).slice(0, 40),
  };
}

/**
 * Create draft articles/macros from current gaps (skips topics that already have a draft).
 */
async function generateKnowledgeDrafts(companyId, { limit = 4 } = {}) {
  const gaps = await detectKnowledgeGaps(companyId, { limit: 8 });
  const existingDrafts = await ChatKnowledge.find({
    company: companyId,
    status: 'draft',
    source: 'ai_draft',
  })
    .select('draftMeta.topic title')
    .lean();
  const existingTopics = new Set(
    existingDrafts.map((d) => String(d.draftMeta?.topic || '').toLowerCase()).filter(Boolean),
  );

  const created = [];
  for (const gap of gaps) {
    if (created.length >= limit) break;
    if (existingTopics.has(gap.topic)) continue;
    if (gap.covered && gap.painScore < 4) continue;

    const kinds =
      gap.ticketCount >= 5 && gap.manualNoSource >= 2
        ? ['article', 'macro']
        : ['article'];

    for (const kind of kinds) {
      if (created.length >= limit) break;
      try {
        const draft = await generateDraftForGap(companyId, gap, kind);
        if (!draft.content?.trim()) continue;
        const article = await createKnowledge(companyId, {
          title: draft.title,
          content: draft.content,
          category: draft.category,
          kind,
          status: 'draft',
          active: false,
          source: 'ai_draft',
          draftMeta: {
            topic: gap.topic,
            ticketCodes: gap.ticketCodes || [],
            reason: gap.message,
            generatedAt: new Date(),
          },
        });
        created.push(article);
        existingTopics.add(gap.topic);
      } catch (err) {
        console.error('[knowledge-ai] draft failed', err.message);
      }
    }
  }

  return created;
}

/**
 * Outdated knowledge — stale, conflicting, ignored, or policy-flavored vs ticket reality.
 */
async function detectOutdatedKnowledge(companyId, { days = 30, limit = 10 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const staleBefore = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const articles = await ChatKnowledge.find({
    company: companyId,
    status: { $ne: 'draft' },
    active: true,
  })
    .select('title content category kind updatedAt createdAt')
    .lean();

  if (!articles.length) return [];

  const tickets = await Ticket.find({
    company: companyId,
    createdAt: { $gte: since },
    'aiIntelligence.sources.0': { $exists: true },
  })
    .select('aiIntelligence.sources aiQa ticket_code')
    .limit(200)
    .lean();

  const citeCounts = new Map();
  const ignoreHints = new Map();
  for (const t of tickets) {
    for (const src of t.aiIntelligence?.sources || []) {
      const title = String(src.title || src || '').toLowerCase();
      if (!title) continue;
      citeCounts.set(title, (citeCounts.get(title) || 0) + 1);
    }
    if (t.aiQa?.flags?.includes('policy_miss')) {
      for (const src of t.aiIntelligence?.sources || []) {
        const title = String(src.title || src || '').toLowerCase();
        if (title) ignoreHints.set(title, (ignoreHints.get(title) || 0) + 1);
      }
    }
  }

  // title-token overlap clusters for conflicting articles
  const findings = [];
  for (const article of articles) {
    const reasons = [];
    const titleKey = String(article.title || '').toLowerCase();
    const age = article.updatedAt || article.createdAt;
    if (age && age < staleBefore) {
      reasons.push('Not updated in 90+ days');
    }

    const cites = citeCounts.get(titleKey) || 0;
    const policyMisses = ignoreHints.get(titleKey) || 0;
    if (cites === 0 && age && age < since) {
      // old article never cited recently — mild signal only if stale
      if (age < staleBefore) reasons.push('Agents and AI rarely cite this article');
    }
    if (policyMisses >= 2) {
      reasons.push(`Flagged in ${policyMisses} QA policy-miss reviews`);
    }

    const tokens = tokenize(article.title).slice(0, 4);
    if (tokens.length >= 2) {
      const related = articles.filter((other) => {
        if (String(other._id) === String(article._id)) return false;
        const hay = `${other.title} ${other.content}`.toLowerCase();
        const hit = tokens.filter((t) => hay.includes(t)).length;
        return hit >= Math.min(2, tokens.length);
      });
      if (related.length >= 2) {
        // Check for conflicting numbers (days, $, %) between article and relatives
        const numSelf = (article.content || '').match(/\d+\s*(day|days|hour|hours|%|\$)/gi) || [];
        const conflict = related.some((other) => {
          const nums = (other.content || '').match(/\d+\s*(day|days|hour|hours|%|\$)/gi) || [];
          return numSelf.length && nums.length && numSelf.some((n) => !nums.includes(n));
        });
        if (conflict) {
          reasons.push(
            `May conflict with related articles: ${related
              .slice(0, 2)
              .map((r) => r.title)
              .join(', ')}`,
          );
        }
      }
    }

    // shipping/returns heuristics: "business days" etc. without recent update
    if (/\b(shipping|delivery|return|refund|exchange)\b/i.test(`${article.title} ${article.content}`)) {
      if (age && age < staleBefore) {
        reasons.push('Policy-style article may be outdated vs current store operations');
      }
    }

    if (!reasons.length) continue;
    findings.push({
      articleId: String(article._id),
      title: article.title,
      category: article.category,
      kind: article.kind || 'article',
      updatedAt: article.updatedAt,
      reasons: [...new Set(reasons)].slice(0, 4),
      severity: reasons.some((r) => /conflict|policy-miss/i.test(r)) ? 'high' : 'medium',
    });
  }

  // Optional AI pass for top candidates
  if (isGroqConfigured() && findings.length) {
    const top = findings.slice(0, 5);
    try {
      const raw = await groqJson({
        messages: [
          {
            role: 'system',
            content:
              'Review knowledge article staleness signals. Return ONLY JSON: {"items":[{"articleId":"","note":"one sentence"}]}',
          },
          {
            role: 'user',
            content: JSON.stringify(
              top.map((f) => ({
                articleId: f.articleId,
                title: f.title,
                reasons: f.reasons,
                snippet: stripHtml(
                  articles.find((a) => String(a._id) === f.articleId)?.content || '',
                ).slice(0, 280),
              })),
            ),
          },
        ],
        temperature: 0.2,
        maxTokens: 600,
      });
      const notes = new Map(
        (raw.items || []).map((i) => [String(i.articleId), String(i.note || '').slice(0, 200)]),
      );
      for (const f of findings) {
        if (notes.has(f.articleId)) f.aiNote = notes.get(f.articleId);
      }
    } catch {
      // non-blocking
    }
  }

  return findings
    .sort((a, b) => (a.severity === 'high' ? -1 : 1) - (b.severity === 'high' ? -1 : 1))
    .slice(0, limit);
}

async function listDrafts(companyId) {
  return ChatKnowledge.find({ company: companyId, status: 'draft' })
    .sort({ createdAt: -1 })
    .lean();
}

async function publishDraft(companyId, draftId) {
  const draft = await ChatKnowledge.findOne({
    _id: draftId,
    company: companyId,
    status: 'draft',
  });
  if (!draft) {
    const err = new Error('Draft not found');
    err.statusCode = 404;
    throw err;
  }
  draft.status = 'published';
  draft.active = true;
  draft.source = draft.source || 'ai_draft';
  await draft.save();
  return draft;
}

async function dismissDraft(companyId, draftId) {
  const draft = await ChatKnowledge.findOneAndDelete({
    _id: draftId,
    company: companyId,
    status: 'draft',
  });
  if (!draft) {
    const err = new Error('Draft not found');
    err.statusCode = 404;
    throw err;
  }
  return draft;
}

async function getKnowledgeIntelligence(company, { generateDrafts = false } = {}) {
  const config = getHelpdeskAiConfig(company);
  const companyId = company._id;

  const [gaps, outdated, drafts] = await Promise.all([
    config.knowledgeGaps ? detectKnowledgeGaps(companyId) : Promise.resolve([]),
    config.outdatedKnowledge ? detectOutdatedKnowledge(companyId) : Promise.resolve([]),
    config.draftArticles ? listDrafts(companyId) : Promise.resolve([]),
  ]);

  let createdDrafts = [];
  if (config.draftArticles && generateDrafts && gaps.length) {
    createdDrafts = await generateKnowledgeDrafts(companyId, { limit: 3 });
  }

  const allDrafts =
    config.draftArticles && createdDrafts.length
      ? await listDrafts(companyId)
      : drafts;

  return {
    gaps,
    outdated,
    drafts: allDrafts.map((d) => ({
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
    createdCount: createdDrafts.length,
  };
}

module.exports = {
  detectKnowledgeGaps,
  generateKnowledgeDrafts,
  detectOutdatedKnowledge,
  listDrafts,
  publishDraft,
  dismissDraft,
  getKnowledgeIntelligence,
};
