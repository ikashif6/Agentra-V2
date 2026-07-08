const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const { encryptJson, decryptJson } = require('../utils/crypto');

// ─── Provider presets ─────────────────────────────────────────────────────────
// Lets users connect with just email + app password for popular providers.
const PROVIDER_PRESETS = {
  gmail: {
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecure: true,
  },
  outlook: {
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecure: false, // STARTTLS
  },
  yahoo: {
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 465,
    smtpSecure: true,
  },
  zoho: {
    imapHost: 'imap.zoho.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.zoho.com',
    smtpPort: 465,
    smtpSecure: true,
  },
  icloud: {
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.mail.me.com',
    smtpPort: 587,
    smtpSecure: false,
  },
};

const DOMAIN_TO_PRESET = {
  'gmail.com': 'gmail',
  'googlemail.com': 'gmail',
  'outlook.com': 'outlook',
  'hotmail.com': 'outlook',
  'live.com': 'outlook',
  'office365.com': 'outlook',
  'yahoo.com': 'yahoo',
  'zoho.com': 'zoho',
  'icloud.com': 'icloud',
  'me.com': 'icloud',
};

function guessPreset(email) {
  const domain = String(email || '').split('@')[1]?.toLowerCase();
  const key = DOMAIN_TO_PRESET[domain];
  return key ? { key, ...PROVIDER_PRESETS[key] } : null;
}

// Build a normalised connection config from user input (+ presets/guesses).
function resolveConfig(input) {
  const { email, preset } = input;
  const base = preset && PROVIDER_PRESETS[preset] ? PROVIDER_PRESETS[preset] : guessPreset(email) || {};

  return {
    imapHost: input.imapHost || base.imapHost,
    imapPort: Number(input.imapPort || base.imapPort || 993),
    imapSecure: input.imapSecure !== undefined ? Boolean(input.imapSecure) : base.imapSecure ?? true,
    smtpHost: input.smtpHost || base.smtpHost,
    smtpPort: Number(input.smtpPort || base.smtpPort || 465),
    smtpSecure: input.smtpSecure !== undefined ? Boolean(input.smtpSecure) : base.smtpSecure ?? true,
    user: input.user || email,
  };
}

function buildImapClient(cfg, password) {
  return new ImapFlow({
    host: cfg.imapHost,
    port: cfg.imapPort,
    secure: cfg.imapSecure,
    auth: { user: cfg.user, pass: password },
    logger: false,
  });
}

function buildSmtpTransport(cfg, password) {
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth: { user: cfg.user, pass: password },
  });
}

// Verify both IMAP login and SMTP login work before saving.
async function testConnection(cfg, password) {
  if (!cfg.imapHost || !cfg.smtpHost) {
    throw new Error('Could not determine mail server settings. Enter them manually.');
  }

  const client = buildImapClient(cfg, password);
  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
  } catch (err) {
    throw new Error(`IMAP login failed: ${err.message}`);
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }

  const transport = buildSmtpTransport(cfg, password);
  try {
    await transport.verify();
  } catch (err) {
    throw new Error(`SMTP login failed: ${err.message}`);
  }
}

// Current highest UID in INBOX, used as a sync cursor so we skip old mail.
async function getCurrentMaxUid(cfg, password) {
  const client = buildImapClient(cfg, password);
  try {
    await client.connect();
    const mailbox = await client.mailboxOpen('INBOX');
    return Math.max(0, (mailbox.uidNext || 1) - 1);
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }
}

// Fetch and parse messages newer than `sinceUid`. Returns { messages, maxUid }.
async function fetchNewMessages(cfg, password, sinceUid) {
  const client = buildImapClient(cfg, password);
  const messages = [];
  let maxUid = sinceUid || 0;

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');

    const rangeStart = (sinceUid || 0) + 1;
    for await (const msg of client.fetch(
      { uid: `${rangeStart}:*` },
      { uid: true, source: true },
    )) {
      // IMAP returns the last message for `x:*` even when none are newer.
      if (!msg.uid || msg.uid <= (sinceUid || 0)) continue;
      if (msg.uid > maxUid) maxUid = msg.uid;

      try {
        const parsed = await simpleParser(msg.source);
        messages.push({ uid: msg.uid, parsed });
      } catch (err) {
        console.warn('[email-imap parse]', err.message);
      }
    }
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }

  return { messages, maxUid };
}

async function sendMail(cfg, password, { from, to, subject, html, text, headers }) {
  const transport = buildSmtpTransport(cfg, password);
  return transport.sendMail({ from, to, subject, html, text, headers });
}

// ─── Secret bundle helpers ──────────────────────────────────────────────────
function packSecret(cfg, password) {
  return encryptJson({ password });
}

function unpackSecret(encrypted) {
  const data = decryptJson(encrypted);
  return data?.password || null;
}

module.exports = {
  PROVIDER_PRESETS,
  guessPreset,
  resolveConfig,
  testConnection,
  getCurrentMaxUid,
  fetchNewMessages,
  sendMail,
  packSecret,
  unpackSecret,
};
