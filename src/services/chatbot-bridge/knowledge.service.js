/**
 * Knowledge articles for the standalone chatbot (mode: agentra).
 */

const ChatKnowledge = require('../../models/ChatKnowledge');
const { findCompanyByWorkspaceId } = require('./workspace-config.service');

async function listKnowledgeDocs(workspaceId) {
  const company = await findCompanyByWorkspaceId(workspaceId);
  if (!company) return [];

  const rows = await ChatKnowledge.find({
    company: company._id,
    active: { $ne: false },
    $or: [{ status: 'published' }, { status: { $exists: false } }, { status: null }],
  })
    .sort({ sortOrder: 1, updatedAt: -1 })
    .lean();

  return rows.map((row) => ({
    id: String(row._id),
    title: row.title,
    tags: [row.category, row.kind].filter(Boolean),
    body: row.content,
  }));
}

async function searchKnowledgeDocs(workspaceId, query, limit = 5) {
  const docs = await listKnowledgeDocs(workspaceId);
  const terms = String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  if (!terms.length) return docs.slice(0, limit);

  const scored = docs
    .map((doc) => {
      const hay = `${doc.title} ${doc.tags.join(' ')} ${doc.body}`.toLowerCase();
      const score = terms.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
      return { doc, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return (scored.length ? scored.map((x) => x.doc) : docs).slice(0, limit);
}

module.exports = {
  listKnowledgeDocs,
  searchKnowledgeDocs,
};
