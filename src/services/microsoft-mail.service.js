const {
  refreshMicrosoftToken,
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
  if (!secret?.accessToken) throw new Error('Microsoft mailbox tokens are missing');

  const expiresAt = secret.expiresAt ? new Date(secret.expiresAt) : null;
  if (expiresAt && expiresAt > new Date(Date.now() + 60_000)) {
    return secret;
  }
  if (!secret.refreshToken) throw new Error('Microsoft refresh token missing — reconnect Outlook');

  const refreshed = await refreshMicrosoftToken(secret.refreshToken);
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

async function graphGet(path, accessToken, params = {}) {
  const url = new URL(`https://graph.microsoft.com/v1.0${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data?.error?.message || `Graph API error (${res.status})`);
  return data;
}

function toMailparserShape(msg) {
  const address = String(msg.from?.emailAddress?.address || '').toLowerCase();
  const name = msg.from?.emailAddress?.name || '';
  return {
    messageId: msg.internetMessageId || `<${msg.id}@outlook.office365.com>`,
    inReplyTo: null,
    references: null,
    subject: msg.subject || '(no subject)',
    date: msg.receivedDateTime ? new Date(msg.receivedDateTime) : new Date(),
    from: { value: [{ address, name }], text: name ? `${name} <${address}>` : address },
    html: msg.body?.contentType === 'html' ? msg.body.content : null,
    text: msg.body?.contentType === 'text' ? msg.body.content : null,
    attachments: [],
  };
}

async function fetchNewMicrosoftMessages(company) {
  const secret = await ensureAccessToken(company);
  const since = secret.lastPolledAt
    ? new Date(secret.lastPolledAt)
    : new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const filter = `receivedDateTime ge ${since.toISOString()}`;

  const data = await graphGet('/me/mailFolders/inbox/messages', secret.accessToken, {
    $filter: filter,
    $orderby: 'receivedDateTime asc',
    $top: 25,
    $select: 'id,subject,from,receivedDateTime,body,internetMessageId',
  });

  const messages = (data.value || []).map(toMailparserShape);
  secret.lastPolledAt = new Date().toISOString();
  company.channelIntegrations.email.secret = packOAuthSecret(secret);
  return messages;
}

async function sendMicrosoftMessage(company, { to, subject, html, text, headers = {} }) {
  const secret = await ensureAccessToken(company);
  const payload = {
    message: {
      subject,
      body: {
        contentType: 'HTML',
        content: html || text || '',
      },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: true,
  };

  // Graph sendMail doesn't take In-Reply-To easily on this simple path; fine for MVP.
  void headers;

  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await readJson(res);
    throw new Error(data?.error?.message || 'Microsoft send failed');
  }
  return { messageId: undefined };
}

module.exports = {
  ensureAccessToken,
  fetchNewMicrosoftMessages,
  sendMicrosoftMessage,
};
