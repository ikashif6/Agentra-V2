const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const { encryptJson, decryptJson } = require('../utils/crypto');

const MAIL_TIMEOUT_MS = parseInt(process.env.MAIL_CONNECT_TIMEOUT_MS, 10) || 20000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

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
  'hostinger.com': 'hostinger',
};

const HOSTINGER_PRESET = {
  imapHost: 'imap.hostinger.com',
  imapPort: 993,
  imapSecure: true,
  smtpHost: 'smtp.hostinger.com',
  smtpPort: 465,
  smtpSecure: true,
};

PROVIDER_PRESETS.hostinger = HOSTINGER_PRESET;

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
    connectionTimeout: MAIL_TIMEOUT_MS,
    greetingTimeout: MAIL_TIMEOUT_MS,
    socketTimeout: MAIL_TIMEOUT_MS,
  });
}

function buildSmtpTransport(cfg, password) {
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth: { user: cfg.user, pass: password },
    connectionTimeout: MAIL_TIMEOUT_MS,
    greetingTimeout: MAIL_TIMEOUT_MS,
    socketTimeout: MAIL_TIMEOUT_MS,
  });
}

// Verify both IMAP login and SMTP login work before saving.
// Returns the current INBOX max UID so we don't need a second IMAP session.
async function testConnection(cfg, password) {
  if (!cfg.imapHost || !cfg.smtpHost) {
    throw new Error('Could not determine mail server settings. Enter them manually.');
  }

  let maxUid = 0;
  const client = buildImapClient(cfg, password);
  try {
    await withTimeout(client.connect(), MAIL_TIMEOUT_MS, 'IMAP connect');
    const mailbox = await withTimeout(client.mailboxOpen('INBOX'), MAIL_TIMEOUT_MS, 'IMAP login');
    maxUid = Math.max(0, (mailbox.uidNext || 1) - 1);
  } catch (err) {
    throw new Error(`IMAP login failed: ${err.message}`);
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }

  const smtpCfg = await verifySmtp(cfg, password);

  return { maxUid, smtp: smtpCfg };
}

async function verifySmtp(cfg, password) {
  const primary = buildSmtpTransport(cfg, password);
  try {
    await withTimeout(primary.verify(), MAIL_TIMEOUT_MS, 'SMTP login');
    return {
      smtpHost: cfg.smtpHost,
      smtpPort: cfg.smtpPort,
      smtpSecure: cfg.smtpSecure,
    };
  } catch (firstErr) {
    const isHostinger = /hostinger\.com$/i.test(cfg.smtpHost || '');
    if (!isHostinger || cfg.smtpPort === 587) {
      const hint =
        cfg.smtpPort === 465 ? ' Try SMTP port 587 with TLS instead of 465.' : '';
      throw new Error(`SMTP login failed: ${firstErr.message}.${hint}`);
    }

    const altCfg = { ...cfg, smtpPort: 587, smtpSecure: false };
    const alt = buildSmtpTransport(altCfg, password);
    try {
      await withTimeout(alt.verify(), MAIL_TIMEOUT_MS, 'SMTP login (port 587)');
      return {
        smtpHost: altCfg.smtpHost,
        smtpPort: altCfg.smtpPort,
        smtpSecure: altCfg.smtpSecure,
      };
    } catch (secondErr) {
      throw new Error(
        `SMTP login failed on ports 465 and 587: ${secondErr.message}`,
      );
    }
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
