const ChatKnowledge = require('../models/ChatKnowledge');

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function scoreChunk(queryTokens, doc) {
  const hay = `${doc.title} ${doc.content}`.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (hay.includes(token)) score += 1;
  }
  if (doc.title && queryTokens.some((t) => doc.title.toLowerCase().includes(t))) {
    score += 2;
  }
  return score;
}

async function retrieveKnowledge(companyId, query, limit = 5) {
  const docs = await ChatKnowledge.find({ company: companyId, active: true })
    .sort({ sortOrder: 1, updatedAt: -1 })
    .lean();
  if (!docs.length) return [];

  const tokens = tokenize(query);
  if (!tokens.length) return docs.slice(0, limit);

  return docs
    .map((doc) => ({ doc, score: scoreChunk(tokens, doc) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.doc);
}

async function listKnowledge(companyId) {
  return ChatKnowledge.find({ company: companyId }).sort({ sortOrder: 1, createdAt: -1 }).lean();
}

async function createKnowledge(companyId, payload) {
  return ChatKnowledge.create({ company: companyId, ...payload });
}

async function updateKnowledge(companyId, id, payload) {
  return ChatKnowledge.findOneAndUpdate({ _id: id, company: companyId }, payload, {
    new: true,
    runValidators: true,
  });
}

async function deleteKnowledge(companyId, id) {
  return ChatKnowledge.findOneAndDelete({ _id: id, company: companyId });
}

module.exports = {
  retrieveKnowledge,
  listKnowledge,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
};
