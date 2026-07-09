const imapService = require('./email-imap.service');
const { processInboundEmail } = require('./email-inbound.service');

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

  company.channelIntegrations = company.channelIntegrations || {};
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

async function disconnectEmail(company) {
  company.channelIntegrations = company.channelIntegrations || {};
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

// ─── Outbound reply ───────────────────────────────────────────────────────────
async function sendReplyForTicket(companyId, ticket, html) {
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

  if (integration.provider !== 'imap') {
    throw new Error(`Sending via ${integration.provider} is not available yet`);
  }

  const stored = getStoredImapConfig(company);
  if (!stored) throw new Error('Email credentials are unavailable');

  const baseTitle = ticket.ticket_title || 'your request';
  // Always embed the ticket code so the customer's reply threads back correctly.
  const subject = `Re: [${ticket.ticket_code}] ${baseTitle}`;

  const from = `${stored.displayName} <${stored.address}>`;
  const headers = {};
  if (ticket.email?.lastMessageId) {
    headers['In-Reply-To'] = ticket.email.lastMessageId;
    headers['References'] = (ticket.email.references || ticket.email.lastMessageId).trim();
  }

  let info;
  if (integration.outboundVia === 'resend') {
    const { sendChannelReplyViaResend } = require('./email.service');
    info = await sendChannelReplyViaResend({
      displayName: stored.displayName,
      fromAddress: stored.address,
      to,
      subject,
      html,
      headers,
    });
  } else {
    info = await imapService.sendMail(stored.cfg, stored.password, {
      from,
      to,
      subject,
      html,
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

// ─── Polling ──────────────────────────────────────────────────────────────────
async function pollCompany(company) {
  const stored = getStoredImapConfig(company);
  if (!stored) return { processed: 0 };

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
    'channelIntegrations.email.provider': 'imap',
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
  disconnectEmail,
  sendReplyForTicket,
  pollCompany,
  pollAllMailboxes,
  providerPresets: imapService.PROVIDER_PRESETS,
  guessPreset: imapService.guessPreset,
};
