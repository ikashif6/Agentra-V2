const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_ROOT = path.join(__dirname, '../../uploads');
const BASE_URL = process.env.APP_API_URL || `http://localhost:${process.env.PORT || 5000}`;

const BLOCKED_EXTENSIONS = new Set(['.exe', '.bat', '.sh', '.cmd', '.ps1', '.vbs', '.js', '.jar', '.php']);

function buildFilename(originalFilename) {
  const ext = path.extname(originalFilename || '').toLowerCase();
  const safeExt = BLOCKED_EXTENSIONS.has(ext) ? '' : ext;
  const base = path.basename(originalFilename || 'attachment', ext).replace(/\s+/g, '_') || 'attachment';
  const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  return `${unique}-${base}${safeExt}`;
}

/**
 * Persist a buffer under uploads/<subdomain>/<date>/ and return a public URL.
 */
async function saveBufferToUploads(subdomain, buffer, options = {}) {
  const { originalFilename = 'attachment', mimetype } = options;
  const today = new Date().toISOString().slice(0, 10);
  const dir = path.join(UPLOAD_ROOT, subdomain || 'shared', today);
  fs.mkdirSync(dir, { recursive: true });

  const filename = buildFilename(originalFilename);
  const filePath = path.join(dir, filename);
  await fs.promises.writeFile(filePath, buffer);

  const relativePath = path.relative(UPLOAD_ROOT, filePath).replace(/\\/g, '/');
  return {
    url: `${BASE_URL}/api/uploads/${relativePath}`,
    filename: originalFilename || filename,
    mimetype,
    size: buffer.length,
  };
}

module.exports = { saveBufferToUploads, UPLOAD_ROOT, BASE_URL };
