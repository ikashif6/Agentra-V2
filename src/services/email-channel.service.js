const imapService = require('./email-imap.service');
const { processInboundEmail } = require('./email-inbound.service');
const { ensureChannelIntegrations } = require('./channel-integrations.util');

function getSupportedProviders() {
  return {
    imap: true,
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    microsoft: Boolean(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET),
  };
}

function getEmailIntegration(company) {
  return company.channelIntegrations?.email || {};
}

function sanitizeEmailIntegration(integration) {
  const plain = integration?.toObject ? integration.toObject() : { ...integration };
  return {
    status: plain.status || 'disconnected',
    provider: plain.provider || null,
    address: plain.address || null,
    displayName: plain.displayName || null,
    outboundVia: plain.outboundVia || 'smtp',
    connectedAt: plain.connectedAt || null,
    lastSyncAt: plain.lastSyncAt || null,
    lastError: plain.lastError || null,
    imap: plain.imap
      ? {
          host: plain.imap.host || null,
          port: plain.imap.port || null,
          smtpHost: plain.imap.smtpHost || null,
          smtpPort: plain.imap.smtpPort || null,
        }
      : null,
  };
}

function defaultEmailIntegration() {
  return {
    status: 'disconnected',
    provider: null,
    address: null,
    displayName: null,
    connectedAt: null,
    lastSyncAt: null,
    lastError: null,
    lastSeenUid: null,
    imap: undefined,
    secret: null,
  };
}

// ─── Connect (IMAP/SMTP) ──────────────────────────────────────────────────────
async function connectImap(company, input) {
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  if (!email || !password) throw new Error('Email and password are required');

  const cfg = imapService.resolveConfig({ ...input, email });
  if (!cfg.imapHost || !cfg.smtpHost) {
    throw new Error('Could not detect mail server settings for this address. Enter them manually.');
  }

  const { maxUid, smtp, outboundVia } = await imapService.testConnection(cfg, password);

  ensureChannelIntegrations(company);
  company.channelIntegrations.email = {
    status: 'connected',
    provider: 'imap',
    address: email,
    displayName: input.displayName || company.name,
    outboundVia,
    connectedAt: new Date(),
    lastSyncAt: new Date(),
    lastError: null,
    lastSeenUid: maxUid,
    imap: {
      host: cfg.imapHost,
      port: cfg.imapPort,
      secure: cfg.imapSecure,
      user: cfg.user,
      smtpHost: smtp.smtpHost,
      smtpPort: smtp.smtpPort,
      smtpSecure: smtp.smtpSecure,
    },
    secret: imapService.packSecret(cfg, password),
  };

  await company.save();
  return sanitizeEmailIntegration(company.channelIntegrations.email);
}

async function connectGoogleOAuth(company, { tokens, profile }) {
  const oauth = require('./oauth-providers.service');
  ensureChannelIntegrations(company);
  company.channelIntegrations.email = {
    status: 'connected',
    provider: 'google',
    address: profile.email,
    displayName: profile.name || company.name,
    outboundVia: 'smtp',
    connectedAt: new Date(),
    lastSyncAt: new Date(),
    lastError: null,
    lastSeenUid: 0,
    imap: undefined,
    secret: oauth.packOAuthSecret({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: oauth.tokenExpiryDate(tokens.expires_in).toISOString(),
      lastPolledAt: new Date().toISOString(),
      scope: tokens.scope || '',
    }),
  };
  await company.save();
  return sanitizeEmailIntegration(company.channelIntegrations.email);
}

async function connectMicrosoftOAuth(company, { tokens, profile }) {
  const oauth = require('./oauth-providers.service');
  ensureChannelIntegrations(company);
  company.channelIntegrations.email = {
    status: 'connected',
    provider: 'microsoft',
    address: profile.email,
    displayName: profile.name || company.name,
    outboundVia: 'smtp',
    connectedAt: new Date(),
    lastSyncAt: new Date(),
    lastError: null,
    lastSeenUid: 0,
    imap: undefined,
    secret: oauth.packOAuthSecret({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: oauth.tokenExpiryDate(tokens.expires_in).toISOString(),
      lastPolledAt: new Date().toISOString(),
      scope: tokens.scope || '',
    }),
  };
  await company.save();
  return sanitizeEmailIntegration(company.channelIntegrations.email);
}

async function disconnectEmail(company) {
  ensureChannelIntegrations(company);
  company.channelIntegrations.email = defaultEmailIntegration();
  await company.save();
  return sanitizeEmailIntegration(company.channelIntegrations.email);
}

// Reconstruct the connection config + password from a company loaded WITH secret.
function getStoredImapConfig(company) {
  const email = company.channelIntegrations?.email;
  if (!email || email.provider !== 'imap' || !email.imap) return null;
  const password = imapService.unpackSecret(email.secret);
  if (!password) return null;

  return {
    cfg: {
      imapHost: email.imap.host,
      imapPort: email.imap.port,
      imapSecure: email.imap.secure,
      smtpHost: email.imap.smtpHost,
      smtpPort: email.imap.smtpPort,
      smtpSecure: email.imap.smtpSecure,
      user: email.imap.user || email.address,
    },
    password,
    address: email.address,
    displayName: email.displayName || company.name,
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function linkify(value) {
  return value.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) =>
      `<a href="${url}" style="color:#5b35b5;text-decoration:underline;word-break:break-word;">${url}</a>`,
  );
}

/**
 * AI replies are plain text, but the email transport expects HTML. Convert
 * paragraphs and lists into a small email-safe layout instead of letting mail
 * clients collapse every newline into one long line.
 *
 * Manual replies from the rich-text editor already contain HTML and pass
 * through unchanged.
 */
function formatSupportEmail(content) {
  const raw = String(content || '').trim();
  if (!raw) return { html: '', text: '' };
  if (
    /<\/?(?:p|div|br|span|strong|em|b|i|u|a|ul|ol|li|blockquote|h[1-6]|table|tr|td|th)\b[^>]*>/i.test(
      raw,
    )
  ) {
    return { html: raw, text: require('./facebook.service').htmlToPlainText(raw) };
  }

  const text = raw.replace(/\r\n?/g, '\n');
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim());
  const html = blocks
    .map((block) => {
      const lines = block.split('\n').map((line) => line.trim());
      if (lines.every((line) => /^[-*]\s+/.test(line))) {
        const items = lines
          .map((line) => `<li style="margin:0 0 6px;">${linkify(escapeHtml(line.replace(/^[-*]\s+/, '')))}</li>`)
          .join('');
        return `<ul style="margin:0 0 16px;padding-left:22px;">${items}</ul>`;
      }
      return `<p style="margin:0 0 16px;line-height:1.65;">${linkify(
        escapeHtml(lines.join('\n')),
      ).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');

  return {
    text,
    html:
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#273142;max-width:640px;">' +
      html +
      '</div>',
  };
}

// ─── Outbound reply ───────────────────────────────────────────────────────────
async function sendReplyForTicket(companyId, ticket, content) {
  const to = ticket.email?.fromAddress;
  if (!to) throw new Error('This ticket has no email recipient');

  const Company = require('../models/Company');
  const company = await Company.findById(companyId).select(
    '+channelIntegrations.email.secret',
  );
  const integration = company?.channelIntegrations?.email;
  if (!integration || integration.status !== 'connected') {
    throw new Error('Email is not connected for this workspace');
  }

  const baseTitle = ticket.ticket_title || 'your request';
  const subject = `Re: [${ticket.ticket_code}] ${baseTitle}`;
  const headers = {};
  if (ticket.email?.lastMessageId) {
    headers['In-Reply-To'] = ticket.email.lastMessageId;
    headers['References'] = (ticket.email.references || ticket.email.lastMessageId).trim();
  }
  const formatted = formatSupportEmail(content);

  if (integration.provider === 'google') {
    const gmailApi = require('./gmail-api.service');
    const info = await gmailApi.sendGmailMessage(company, {
      to,
      subject,
      html: formatted.html,
      text: formatted.text,
      headers,
    });
    if (info?.messageId) {
      ticket.email = ticket.email || {};
      ticket.email.lastMessageId = info.messageId;
      ticket.email.references = `${ticket.email.references || ''} ${info.messageId}`.trim();
      await ticket.save().catch(() => {});
    }
    return info;
  }

  if (integration.provider === 'microsoft') {
    const msMail = require('./microsoft-mail.service');
    return msMail.sendMicrosoftMessage(company, {
      to,
      subject,
      html: formatted.html,
      text: formatted.text,
      headers,
    });
  }

  if (integration.provider !== 'imap') {
    throw new Error(`Sending via ${integration.provider} is not available yet`);
  }

  const stored = getStoredImapConfig(company);
  if (!stored) throw new Error('Email credentials are unavailable');

  const from = `${stored.displayName} <${stored.address}>`;
  let info;
  if (integration.outboundVia === 'resend') {
    const { sendChannelReplyViaResend } = require('./email.service');
    info = await sendChannelReplyViaResend({
      displayName: stored.displayName,
      fromAddress: stored.address,
      to,
      subject,
      html: formatted.html,
      text: formatted.text,
      headers,
    });
  } else {
    info = await imapService.sendMail(stored.cfg, stored.password, {
      from,
      to,
      subject,
      html: formatted.html,
      text: formatted.text,
      headers,
    });
  }

  // Record our outbound Message-ID so the customer's reply threads correctly.
  if (info?.messageId) {
    ticket.email = ticket.email || {};
    ticket.email.lastMessageId = info.messageId;
    ticket.email.references = `${ticket.email.references || ''} ${info.messageId}`.trim();
    await ticket.save().catch(() => {});
  }

  return info;
}

/**
 * Send a customer-facing email as the workspace (transcripts, etc.).
 * Uses the connected support mailbox when available; otherwise Resend with Reply-To.
 */
async function sendCompanyCustomerEmail(companyIdOrDoc, { to, subject, html, text, headers = {} }) {
  if (!to) throw new Error('Missing recipient email');

  const Company = require('../models/Company');
  const company = await Company.findById(companyIdOrDoc?._id || companyIdOrDoc).select(
    '+channelIntegrations.email.secret',
  );
  if (!company) throw new Error('Company not found');

  const integration = company.channelIntegrations?.email;
  const displayName =
    integration?.displayName || company.name || company.liveChat?.content?.agentName || 'Support';
  const supportAddress = integration?.address || company.settings?.supportEmail || null;

  if (integration?.status === 'connected' && integration.provider === 'google') {
    const gmailApi = require('./gmail-api.service');
    return gmailApi.sendGmailMessage(company, { to, subject, html, text, headers });
  }

  if (integration?.status === 'connected' && integration.provider === 'microsoft') {
    const msMail = require('./microsoft-mail.service');
    return msMail.sendMicrosoftMessage(company, { to, subject, html, text, headers });
  }

  if (integration?.status === 'connected' && integration.provider === 'imap') {
    const stored = getStoredImapConfig(company);
    if (!stored) throw new Error('Email credentials are unavailable');
    const from = `${stored.displayName} <${stored.address}>`;
    if (integration.outboundVia === 'resend') {
      const { sendChannelReplyViaResend } = require('./email.service');
      return sendChannelReplyViaResend({
        displayName: stored.displayName,
        fromAddress: stored.address,
        to,
        subject,
        html,
        text,
        headers,
      });
    }
    return imapService.sendMail(stored.cfg, stored.password, {
      from,
      to,
      subject,
      html,
      text,
      headers,
    });
  }

  const { sendChannelReplyViaResend } = require('./email.service');
  if (!process.env.RESEND_API_KEY) {
    throw new Error('No support mailbox connected and RESEND_API_KEY is not configured');
  }
  return sendChannelReplyViaResend({
    displayName,
    fromAddress: supportAddress || process.env.RESEND_FROM_EMAIL || 'noreply@agentraa.com',
    to,
    subject,
    html,
    text,
    headers,
  });
}

// ─── Polling ──────────────────────────────────────────────────────────────────
async function pollCompany(company) {
  const provider = company.channelIntegrations?.email?.provider;

  if (provider === 'google') {
    const gmailApi = require('./gmail-api.service');
    const messages = await gmailApi.fetchNewGmailMessages(company);
    let processed = 0;
    for (const parsed of messages) {
      try {
        await processInboundEmail(company, parsed);
        processed += 1;
      } catch (err) {
        console.error('[email ingest google]', err.message);
      }
    }
    company.channelIntegrations.email.lastSyncAt = new Date();
    company.channelIntegrations.email.lastError = null;
    await company.save();
    return { processed };
  }

  if (provider === 'microsoft') {
    const msMail = require('./microsoft-mail.service');
    const messages = await msMail.fetchNewMicrosoftMessages(company);
    let processed = 0;
    for (const parsed of messages) {
      try {
        await processInboundEmail(company, parsed);
        processed += 1;
      } catch (err) {
        console.error('[email ingest microsoft]', err.message);
      }
    }
    company.channelIntegrations.email.lastSyncAt = new Date();
    company.channelIntegrations.email.lastError = null;
    await company.save();
    return { processed };
  }

  const stored = getStoredImapConfig(company);
  if (!stored) {
    // Without a usable secret the mailbox can never sync, so stop reporting it
    // as healthy — otherwise it sits "connected" while silently ingesting nothing.
    if (company.channelIntegrations?.email?.status === 'connected') {
      company.channelIntegrations.email.status = 'error';
      company.channelIntegrations.email.lastError =
        'Mailbox credentials are missing. Reconnect the mailbox to resume syncing.';
      await company.save();
    }
    return { processed: 0 };
  }

  const sinceUid = company.channelIntegrations.email.lastSeenUid || 0;
  const { messages, maxUid } = await imapService.fetchNewMessages(
    stored.cfg,
    stored.password,
    sinceUid,
  );

  let processed = 0;
  for (const { parsed } of messages) {
    try {
      await processInboundEmail(company, parsed);
      processed += 1;
    } catch (err) {
      console.error('[email ingest]', err.message);
    }
  }

  company.channelIntegrations.email.lastSeenUid = Math.max(sinceUid, maxUid);
  company.channelIntegrations.email.lastSyncAt = new Date();
  company.channelIntegrations.email.lastError = null;
  await company.save();

  return { processed };
}

async function pollAllMailboxes() {
  const Company = require('../models/Company');
  const companies = await Company.find({
    'channelIntegrations.email.status': 'connected',
    'channelIntegrations.email.provider': { $in: ['imap', 'google', 'microsoft'] },
  }).select('+channelIntegrations.email.secret');

  for (const company of companies) {
    try {
      await pollCompany(company);
    } catch (err) {
      console.error(`[email poll ${company.subdomain}]`, err.message);
      try {
        company.channelIntegrations.email.lastError = err.message;
        await company.save();
      } catch {
        /* ignore */
      }
    }
  }
}

module.exports = {
  getSupportedProviders,
  getEmailIntegration,
  sanitizeEmailIntegration,
  connectImap,
  connectGoogleOAuth,
  connectMicrosoftOAuth,
  disconnectEmail,
  sendReplyForTicket,
  sendCompanyCustomerEmail,
  formatSupportEmail,
  pollCompany,
  pollAllMailboxes,
  providerPresets: imapService.PROVIDER_PRESETS,
  guessPreset: imapService.guessPreset,
};
