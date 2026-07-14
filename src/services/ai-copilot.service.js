const Company = require('../models/Company');
const Ticket = require('../models/Ticket');
const { groqChat, isGroqConfigured } = require('./groq.service');
const { getHelpdeskAiConfig } = require('./helpdesk-ai-config.service');
const { buildContextPack } = require('./ticket-intelligence.service');
const { retrieveKnowledge } = require('./live-chat-knowledge.service');

const TRANSFORMS = {
  professional: 'Rewrite to be more professional and polished. Keep meaning intact.',
  friendlier: 'Rewrite to sound warmer and friendlier while staying professional.',
  empathy: 'Rewrite to show more empathy and acknowledgment of the customer frustration.',
  shorter: 'Make this significantly shorter while keeping the key facts and next step.',
  simplify: 'Simplify the wording for easier reading. Avoid jargon.',
  grammar: 'Fix grammar, spelling, and punctuation only. Do not change meaning or tone.',
  steps: 'Turn this into clear step-by-step instructions for the customer.',
  brand: 'Rewrite to match a confident ecommerce support brand tone: clear, helpful, concise.',
  no_promises: 'Remove unsupported promises, guarantees, or commitments that are not evidenced in the draft.',
  translate_en: 'Translate to clear professional English.',
};

async function suggestReply(companyId, ticketId) {
  const company = await Company.findById(companyId);
  if (!company) throw Object.assign(new Error('Company not found'), { statusCode: 404 });
  const config = getHelpdeskAiConfig(company);
  if (!config.suggestedReply) {
    throw Object.assign(new Error('Suggested replies are disabled'), { statusCode: 400 });
  }

  const ticket = await Ticket.findById(ticketId).populate('createdBy', 'email firstName lastName');
  if (!ticket || String(ticket.company) !== String(company._id)) {
    throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  }

  if (ticket.aiIntelligence?.suggestedReply && ticket.aiIntelligence.generatedAt) {
    // Prefer cached draft when fresh
    const ageMs = Date.now() - new Date(ticket.aiIntelligence.generatedAt).getTime();
    if (ageMs < 10 * 60 * 1000) {
      return { reply: ticket.aiIntelligence.suggestedReply, cached: true };
    }
  }

  if (!isGroqConfigured()) {
    throw Object.assign(new Error('AI is not configured'), { statusCode: 503 });
  }

  const ctx = await buildContextPack(company, ticket);
  const knowledge = await retrieveKnowledge(
    company._id,
    ctx.transcript.slice(0, 400) || ticket.ticket_title,
    4,
  );
  const knowledgeBlock = knowledge.length
    ? knowledge.map((k) => `${k.title}: ${k.content}`).join('\n')
    : 'None';

  const reply = await groqChat({
    messages: [
      {
        role: 'system',
        content:
          'You draft support replies for human agents. Write a complete customer-ready reply. Do not invent order facts. Use knowledge when relevant. Return only the reply text.',
      },
      {
        role: 'user',
        content: `Ticket ${ticket.ticket_code}: ${ticket.ticket_title}
Orders: ${JSON.stringify(ctx.orders)}
Knowledge:\n${knowledgeBlock}
AI overview summary: ${ticket.aiIntelligence?.summary || 'n/a'}
Customer wants: ${ticket.aiIntelligence?.customerWant || 'n/a'}
Conversation:\n${ctx.transcript}`,
      },
    ],
    temperature: 0.35,
    maxTokens: 900,
  });

  if (ticket.aiIntelligence) {
    ticket.aiIntelligence.suggestedReply = reply;
    ticket.aiIntelligence.generatedAt = new Date();
    ticket.markModified('aiIntelligence');
    await ticket.save();
  }

  return { reply, cached: false };
}

async function transformReply(companyId, ticketId, { draft, transform }) {
  const company = await Company.findById(companyId);
  if (!company) throw Object.assign(new Error('Company not found'), { statusCode: 404 });
  const config = getHelpdeskAiConfig(company);
  if (!config.replyTools) {
    throw Object.assign(new Error('Reply tools are disabled'), { statusCode: 400 });
  }

  const instruction = TRANSFORMS[transform];
  if (!instruction) {
    throw Object.assign(new Error('Unknown transform'), { statusCode: 400 });
  }

  const text = String(draft || '').trim();
  if (!text) {
    throw Object.assign(new Error('Draft is required'), { statusCode: 400 });
  }

  if (!isGroqConfigured()) {
    throw Object.assign(new Error('AI is not configured'), { statusCode: 503 });
  }

  const reply = await groqChat({
    messages: [
      {
        role: 'system',
        content: `${instruction} Return only the rewritten reply text.`,
      },
      { role: 'user', content: text },
    ],
    temperature: 0.3,
    maxTokens: 900,
  });

  return { reply, transform };
}

module.exports = {
  TRANSFORMS,
  suggestReply,
  transformReply,
};
