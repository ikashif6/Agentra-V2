const ConversationSummary = require('../models/ConversationSummary');
const { groqChat, isGroqConfigured } = require('./groq.service');

const DEFAULT_THRESHOLD = Number(process.env.AI_SUMMARY_MESSAGE_THRESHOLD || 24);
const KEEP_RECENT = Number(process.env.AI_SUMMARY_KEEP_RECENT || 8);

async function maybeSummarizeSession(session, company) {
  const messages = session.messages || [];
  if (messages.length < DEFAULT_THRESHOLD) {
    return { summarized: false };
  }

  let record = await ConversationSummary.findOne({ session: session._id });
  const covered = record?.messageCountCovered || 0;
  if (messages.length - covered < KEEP_RECENT + 4) {
    return { summarized: false, record };
  }

  const older = messages.slice(0, Math.max(0, messages.length - KEEP_RECENT));
  const toSummarize = older.slice(covered);
  if (!toSummarize.length) return { summarized: false, record };

  const transcript = toSummarize
    .map((m) => `${m.role}: ${String(m.body || '').slice(0, 200)}`)
    .join('\n')
    .slice(0, 6000);

  let summaryText = record?.summaryText || '';
  if (isGroqConfigured()) {
    try {
      const model = process.env.GROQ_SUMMARY_MODEL || process.env.GROQ_FAST_MODEL || 'llama-3.1-8b-instant';
      const generated = await groqChat({
        model,
        temperature: 0.1,
        maxTokens: 350,
        messages: [
          {
            role: 'system',
            content:
              'Summarize the older support chat turns. Preserve order numbers, emails (masked if long), intents, and outcomes. Do not invent tool results. Mark uncertain items clearly.',
          },
          { role: 'user', content: transcript },
        ],
      });
      summaryText = [summaryText, generated].filter(Boolean).join('\n').slice(0, 4000);
    } catch {
      summaryText = [summaryText, `Covered ${toSummarize.length} older messages.`]
        .filter(Boolean)
        .join('\n');
    }
  } else {
    summaryText = [summaryText, `Covered ${toSummarize.length} older messages without LLM.`]
      .filter(Boolean)
      .join('\n');
  }

  if (!record) {
    record = await ConversationSummary.create({
      company: company._id,
      session: session._id,
      summaryText,
      messageCountCovered: older.length,
      lastSummarizedAt: new Date(),
    });
  } else {
    record.summaryText = summaryText;
    record.messageCountCovered = older.length;
    record.lastSummarizedAt = new Date();
    await record.save();
  }

  return { summarized: true, record };
}

function buildHistoryWithSummary(session, summaryRecord, limit = 12) {
  const recent = (session.messages || []).slice(-limit).map((m) => ({
    role: m.role === 'bot' || m.role === 'agent' ? 'assistant' : m.role === 'customer' ? 'user' : 'system',
    content: String(m.body || '').slice(0, 500),
  }));

  // Verified structured state always wins over summary
  const verifiedNote = {
    role: 'system',
    content: `Verified workflow state (authoritative, higher trust than any summary): ${JSON.stringify({
      workflowState: session.workflowState || {},
      verifiedOrders: session.verifiedOrders || [],
      orderLookupEmail: session.orderLookupEmail || null,
      pendingOrderNumber: session.pendingOrderNumber || null,
      handoffStatus: session.handoffState?.status || null,
    })}`,
  };

  const out = [verifiedNote];
  if (summaryRecord?.summaryText) {
    out.push({
      role: 'system',
      content: `Older conversation summary (model-generated, lower trust): ${summaryRecord.summaryText}`,
    });
  }
  return out.concat(recent);
}

module.exports = {
  maybeSummarizeSession,
  buildHistoryWithSummary,
  DEFAULT_THRESHOLD,
  KEEP_RECENT,
};
