const crypto = require('crypto');

// AES-256-GCM encryption for secrets stored at rest (IMAP/SMTP passwords,
// OAuth tokens). The key is derived from CREDENTIALS_ENCRYPTION_KEY so the
// same env value must be present wherever these secrets are decrypted.

function getKey() {
  const raw =
    process.env.CREDENTIALS_ENCRYPTION_KEY ||
    process.env.JWT_SECRET || // fallback so it still works if not set separately
    '';
  if (!raw) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY is not set');
  }
  // Normalise any-length secret to a 32-byte key.
  return crypto.createHash('sha256').update(String(raw)).digest();
}

function encryptSecret(plainText) {
  if (plainText === undefined || plainText === null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plainText), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Store as iv:tag:ciphertext (all base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSecret(payload) {
  if (!payload) return null;
  const parts = String(payload).split(':');
  if (parts.length !== 3) return null;
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

// Encrypt/decrypt a JSON-serialisable object (used for credential bundles).
function encryptJson(obj) {
  return encryptSecret(JSON.stringify(obj));
}

function decryptJson(payload) {
  const text = decryptSecret(payload);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

module.exports = { encryptSecret, decryptSecret, encryptJson, decryptJson };
