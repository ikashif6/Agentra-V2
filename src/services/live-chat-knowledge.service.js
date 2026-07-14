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
  const docs = await ChatKnowledge.find({
    company: companyId,
    active: true,
    status: { $ne: 'draft' },
  })
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

async function listKnowledge(companyId, { includeDrafts = true } = {}) {
  const filter = { company: companyId };
  if (!includeDrafts) filter.status = { $ne: 'draft' };
  return ChatKnowledge.find(filter).sort({ status: 1, sortOrder: 1, createdAt: -1 }).lean();
}

async function createKnowledge(companyId, payload) {
  const doc = {
    company: companyId,
    title: payload.title,
    content: payload.content,
    category: payload.category,
    active: payload.active !== false && payload.status !== 'draft',
    sortOrder: payload.sortOrder ?? 0,
  };
  if (payload.kind) doc.kind = payload.kind;
  if (payload.status) doc.status = payload.status;
  if (payload.source) doc.source = payload.source;
  if (payload.draftMeta) doc.draftMeta = payload.draftMeta;
  if (payload.status === 'draft') doc.active = false;
  return ChatKnowledge.create(doc);
}

async function updateKnowledge(companyId, id, payload = {}) {
  const patch = {};
  if (payload.title !== undefined) patch.title = String(payload.title || '').trim();
  if (payload.content !== undefined) patch.content = String(payload.content || '');
  if (payload.category !== undefined) patch.category = String(payload.category || '').trim();
  if (payload.active !== undefined) patch.active = Boolean(payload.active);
  if (payload.sortOrder !== undefined) patch.sortOrder = Number(payload.sortOrder);
  if (payload.kind !== undefined) patch.kind = payload.kind;
  if (payload.status !== undefined) {
    patch.status = payload.status;
    if (payload.status === 'published' && payload.active === undefined) {
      patch.active = true;
    }
    if (payload.status === 'draft') patch.active = false;
  }

  if (patch.title !== undefined && !patch.title) {
    const err = new Error('Title is required');
    err.statusCode = 400;
    throw err;
  }
  if (patch.content !== undefined && !String(patch.content).trim()) {
    const err = new Error('Content is required');
    err.statusCode = 400;
    throw err;
  }

  return ChatKnowledge.findOneAndUpdate({ _id: id, company: companyId }, patch, {
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
