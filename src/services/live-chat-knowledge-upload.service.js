const path = require('path');
const pdfParse = require('pdf-parse');
const { createKnowledge } = require('./live-chat-knowledge.service');

const MAX_CONTENT = 45000;
const MAX_CHUNKS = 12;
const ALLOWED_EXT = new Set(['.txt', '.md', '.markdown', '.csv', '.pdf']);

function titleFromFilename(filename) {
  const base = path.basename(String(filename || 'Document'), path.extname(filename || ''));
  return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180) || 'Uploaded document';
}

function chunkText(text, maxLen = MAX_CONTENT) {
  const cleaned = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const chunks = [];
  let i = 0;
  while (i < cleaned.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(i + maxLen, cleaned.length);
    if (end < cleaned.length) {
      const paraBreak = cleaned.lastIndexOf('\n\n', end);
      const lineBreak = cleaned.lastIndexOf('\n', end);
      if (paraBreak > i + maxLen * 0.4) end = paraBreak;
      else if (lineBreak > i + maxLen * 0.4) end = lineBreak;
    }
    const slice = cleaned.slice(i, end).trim();
    if (slice) chunks.push(slice);
    i = end;
  }
  return chunks;
}

async function extractTextFromBuffer(buffer, filename, mimetype) {
  const ext = path.extname(filename || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    const err = new Error('Unsupported file type. Use PDF, TXT, MD, or CSV.');
    err.statusCode = 400;
    throw err;
  }

  if (ext === '.pdf' || mimetype === 'application/pdf') {
    const parsed = await pdfParse(buffer);
    return String(parsed?.text || '').trim();
  }

  return buffer.toString('utf8').trim();
}

async function createKnowledgeFromDocument(companyId, file) {
  if (!file?.buffer) {
    const err = new Error('No file uploaded');
    err.statusCode = 400;
    throw err;
  }

  const text = await extractTextFromBuffer(file.buffer, file.originalname, file.mimetype);
  if (!text || text.length < 20) {
    const err = new Error('Could not extract enough text from that document');
    err.statusCode = 400;
    throw err;
  }

  const baseTitle = titleFromFilename(file.originalname);
  const chunks = chunkText(text);
  const articles = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const title =
      chunks.length === 1 ? baseTitle : `${baseTitle} (${i + 1}/${chunks.length})`;
    // eslint-disable-next-line no-await-in-loop
    const article = await createKnowledge(companyId, {
      title,
      content: chunks[i],
      category: 'document',
      active: true,
      sortOrder: i,
    });
    articles.push(article);
  }

  return {
    articles,
    sourceFileName: file.originalname,
    chunkCount: articles.length,
  };
}

module.exports = {
  ALLOWED_EXT,
  createKnowledgeFromDocument,
  extractTextFromBuffer,
  titleFromFilename,
};
