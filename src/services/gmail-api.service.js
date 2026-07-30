const {
  refreshGoogleToken,
  packOAuthSecret,
  unpackOAuthSecret,
  tokenExpiryDate,
} = require('./oauth-providers.service');

async function readJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function ensureAccessToken(company) {
  const email = company.channelIntegrations?.email;
  const secret = unpackOAuthSecret(email?.secret);
  if (!secret?.accessToken) throw new Error('Google mailbox tokens are missing');

  const expiresAt = secret.expiresAt ? new Date(secret.expiresAt) : null;
  if (expiresAt && expiresAt > new Date(Date.now() + 60_000)) {
    return secret;
  }
  if (!secret.refreshToken) throw new Error('Google refresh token missing — reconnect Gmail');

  const refreshed = await refreshGoogleToken(secret.refreshToken);
  const next = {
    ...secret,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || secret.refreshToken,
    expiresAt: tokenExpiryDate(refreshed.expires_in).toISOString(),
  };
  email.secret = packOAuthSecret(next);
  await company.save();
  return next;
}

async function gmailGet(path, accessToken, params = {}) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data?.error?.message || `Gmail API error (${res.status})`);
  return data;
}

function headerMap(payload) {
  const map = {};
  for (const h of payload?.headers || []) {
    map[String(h.name || '').toLowerCase()] = h.value;
  }
  return map;
}

function decodeBodyData(data) {
  if (!data) return '';
  const normalized = String(data).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function extractBodies(payload, out = { html: '', text: '' }) {
  if (!payload) return out;
  const mime = String(payload.mimeType || '');
  if (payload.body?.data) {
    const decoded = decodeBodyData(payload.body.data);
    if (mime === 'text/html' && !out.html) out.html = decoded;
    if (mime === 'text/plain' && !out.text) out.text = decoded;
  }
  for (const part of payload.parts || []) extractBodies(part, out);
  return out;
}

function toMailparserShape(message) {
  const headers = headerMap(message.payload);
  const bodies = extractBodies(message.payload);
  const fromMatch = String(headers.from || '').match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+@[^>]+)>?$/);
  const address = (fromMatch?.[2] || headers.from || '').trim().toLowerCase();
  const name = (fromMatch?.[1] || '').trim();
  return {
    messageId: headers['message-id'] || `<${message.id}@gmail.googleusercontent.com>`,
    inReplyTo: headers['in-reply-to'],
    references: headers.references,
    subject: headers.subject || '(no subject)',
    date: headers.date ? new Date(headers.date) : new Date(Number(message.internalDate) || Date.now()),
    from: { value: [{ address, name }], text: headers.from || address },
    html: bodies.html || null,
    text: bodies.text || null,
    attachments: [],
  };
}

async function fetchNewGmailMessages(company) {
  const secret = await ensureAccessToken(company);
  const afterUnix = secret.lastPolledAt
    ? Math.floor(new Date(secret.lastPolledAt).getTime() / 1000) - 60
    : Math.floor(Date.now() / 1000) - 7 * 24 * 3600;

  const list = await gmailGet('/users/me/messages', secret.accessToken, {
    q: `in:inbox after:${afterUnix}`,
    maxResults: 25,
  });

  const messages = [];
  for (const item of list.messages || []) {
    const full = await gmailGet(`/users/me/messages/${item.id}`, secret.accessToken, {
      format: 'full',
    });
    messages.push(toMailparserShape(full));
  }

  secret.lastPolledAt = new Date().toISOString();
  company.channelIntegrations.email.secret = packOAuthSecret(secret);
  return messages;
}

async function sendGmailMessage(company, { to, subject, html, text, headers = {} }) {
  const secret = await ensureAccessToken(company);
  const from = company.channelIntegrations.email.address;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
  ];
  if (headers['In-Reply-To']) lines.push(`In-Reply-To: ${headers['In-Reply-To']}`);
  if (headers.References) lines.push(`References: ${headers.References}`);
  const raw = `${lines.join('\r\n')}\r\n\r\n${html || text || ''}`;
  const encoded = Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data?.error?.message || 'Gmail send failed');
  return { messageId: data.id ? `<${data.id}@gmail.googleusercontent.com>` : undefined };
}

module.exports = {
  ensureAccessToken,
  fetchNewGmailMessages,
  sendGmailMessage,
};
