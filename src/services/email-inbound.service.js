const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');
const { saveBufferToUploads } = require('../utils/save-upload');
const { stripQuotedHtml, stripQuotedPlainText } = require('../utils/email-reply-strip');

const ACTIVE_STATUSES = ['open', 'in_progress', 'on_hold'];

function truncate(text, max) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function normalizeSubject(subject) {
  return String(subject || '')
    .replace(/^\s*((re|fwd|fw)\s*:\s*)+/i, '')
    .replace(/\[TKT-[A-Z0-9-]+\]/i, '')
    .trim();
}

function parseTicketCode(subject) {
  const m = String(subject || '').match(/\[(TKT-[A-Z0-9-]+|[A-Z]{2,10}-\d+)\]/i);
  return m ? m[1].toUpperCase() : null;
}

function extractAddress(addressObj) {
  // mailparser `from` => { value: [{ address, name }], text }
  const first = addressObj?.value?.[0];
  return {
    address: (first?.address || '').toLowerCase().trim(),
    name: (first?.name || '').trim(),
  };
}

function messageBody(parsed) {
  if (parsed.html) return stripQuotedHtml(parsed.html);
  if (parsed.textAsHtml) return stripQuotedHtml(parsed.textAsHtml);
  if (parsed.text) {
    const plain = stripQuotedPlainText(parsed.text);
    return `<p>${String(plain).replace(/\n/g, '<br>')}</p>`;
  }
  return '(empty message)';
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeContentId(contentId) {
  return String(contentId || '').replace(/^<|>$/g, '').trim();
}

function replaceCidInHtml(html, contentId, url) {
  const cid = normalizeContentId(contentId);
  if (!cid) return html;
  const pattern = new RegExp(`cid:<?${escapeRegex(cid)}>?`, 'gi');
  return html.replace(pattern, url);
}

function stripUnresolvedCidImages(html) {
  return html.replace(/<img\b[^>]*\bsrc=["']cid:[^"']+["'][^>]*>/gi, '');
}

function stripExternalImages(html) {
  const uploadsMarker = '/api/uploads/';
  const baseUrl = process.env.APP_API_URL || '';

  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\bclass=["'][^"']*inline-emoji/i.test(tag)) return tag;
    if (/\bdata-emoji=/i.test(tag)) return tag;

    const match = tag.match(/\bsrc=["']([^"']+)["']/i);
    if (!match) return '';
    const src = match[1];
    if (/^cid:/i.test(src)) return '';
    if (src.includes(uploadsMarker)) return tag;
    if (baseUrl && src.startsWith(baseUrl)) return tag;
    return '';
  });
}

function trimTrailingEmptyHtml(html) {
  return String(html || '')
    .replace(/(?:\s|<br\s*\/?>)+$/gi, '')
    .trim();
}

function getDisposition(att) {
  const d = att?.contentDisposition;
  if (typeof d === 'string') return d.toLowerCase();
  if (d?.value) return String(d.value).toLowerCase();
  return '';
}

async function processEmailBodyAndAttachments(company, parsed) {
  let html = messageBody(parsed);
  const attachments = [];

  for (const [index, att] of (parsed.attachments || []).entries()) {
    const raw = att?.content;
    if (!raw) continue;

    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    if (buffer.length === 0) continue;

    const filename = att.filename || `attachment-${index + 1}`;

    try {
      const saved = await saveBufferToUploads(company.subdomain, buffer, {
        originalFilename: filename,
        mimetype: att.contentType,
      });

      const cid = normalizeContentId(att.contentId || att.cid);
      const disposition = getDisposition(att);

      if (cid) {
        html = replaceCidInHtml(html, cid, saved.url);
      }

      if (disposition === 'attachment' || (!cid && disposition !== 'inline' && !att.related)) {
        attachments.push({
          url: saved.url,
          filename: saved.filename,
          mimetype: saved.mimetype,
          size: saved.size,
        });
      }
    } catch (err) {
      console.error('[email-inbound] Failed to save attachment:', err.message);
    }
  }

  return {
    body: trimTrailingEmptyHtml(stripExternalImages(stripUnresolvedCidImages(html))),
    attachments,
  };
}

async function findOrCreateCustomer(company, address, name) {
  let customer = await User.findOne({ email: address, company: company._id });
  if (customer) return customer;

  let firstName = 'Email';
  let lastName = 'Contact';
  const clean = (name || '').trim();
  if (clean) {
    const parts = clean.split(/\s+/);
    firstName = parts[0];
    lastName = parts.slice(1).join(' ') || 'Contact';
  } else {
    firstName = address.split('@')[0] || 'Email';
    lastName = 'Contact';
  }

  customer = await User.create({
    firstName: truncate(firstName, 50) || 'Email',
    lastName: truncate(lastName, 50) || 'Contact',
    email: address,
    company: company._id,
    role: 'customer',
    isEmailVerified: false,
    isActive: true,
    onboardingCompleted: true,
  });

  return customer;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findExistingTicket(company, subject, customer) {
  const code = parseTicketCode(subject);
  if (code) {
    const byCode = await Ticket.findOne({
      company: company._id,
      source: 'email',
      ticket_code: code,
    });
    if (byCode) return byCode;
  }

  const normalized = normalizeSubject(subject);
  if (normalized) {
    const byThread = await Ticket.findOne({
      company: company._id,
      source: 'email',
      'email.fromAddress': customer.email,
      ticket_title: new RegExp(`^${escapeRegex(normalized)}$`, 'i'),
      status: { $in: ACTIVE_STATUSES },
      inboxFolder: { $nin: ['trash', 'spam'] },
    }).sort({ lastActivity: -1 });
    if (byThread) return byThread;
  }

  return null;
}

/**
 * Turn one parsed inbound email into a ticket (new or appended).
 * `company` must be a loaded Company document.
 */
async function processInboundEmail(company, parsed) {
  const { address, name } = extractAddress(parsed.from);
  if (!address) return;

  // Ignore mail sent by the connected mailbox itself (avoids loops).
  const connected = (company.channelIntegrations?.email?.address || '').toLowerCase();
  if (connected && address === connected) return;

  const subject = parsed.subject || '(no subject)';
  const { body, attachments } = await processEmailBodyAndAttachments(company, parsed);
  const messageId = parsed.messageId || null;
  const customer = await findOrCreateCustomer(company, address, name);

  // Overlapping pollers (local + deployed) can fetch the same UID before either
  // advances the cursor. Message-IDs are unique per email, so this keeps a
  // second delivery from creating a duplicate ticket or message.
  const alreadyIngested = messageId
    ? await Ticket.findOne({
        company: company._id,
        source: 'email',
        'email.references': { $regex: escapeRegex(messageId) },
      })
    : null;
  if (alreadyIngested) return alreadyIngested;

  const existing = await findExistingTicket(company, subject, customer);
  const now = parsed.date ? new Date(parsed.date) : new Date();

  if (existing) {
    existing.messages.push({
      sender: customer._id,
      senderEmail: customer.email,
      body,
      attachments,
      sentAt: now,
    });
    if (['resolved', 'closed', 'self_closed'].includes(existing.status)) {
      existing.status = 'open';
    }
    existing.isUnread = true;
    existing.lastActivity = now;
    existing.email = existing.email || {};
    existing.email.lastMessageId = messageId;
    if (messageId) {
      existing.email.references = `${existing.email.references || ''} ${messageId}`.trim();
    }
    await existing.save();
    const { scheduleTicketAiReply } = require('./ai-agent-ticket.service');
    scheduleTicketAiReply(company._id, existing._id, body);
    return existing;
  }

  const prefix = company.settings?.ticketPrefix || 'TKT';
  const ticket_code = await Ticket.generateCode(company._id, prefix);

  const ticket = await Ticket.create({
    ticket_code,
    company_subdomain: company.subdomain,
    company: company._id,
    ticket_title: truncate(normalizeSubject(subject) || subject, 200) || 'New email',
    ticket_description: truncate(parsed.text || '', 2000),
    source: 'email',
    status: 'open',
    inboxFolder: 'inbox',
    isUnread: true,
    priority: company.settings?.defaultTicketPriority || 'medium',
    createdBy: customer._id,
    email: { fromAddress: address, lastMessageId: messageId, references: messageId || '' },
    peoples: [{ user: customer._id, role: 'customer' }],
    messages: [
      {
        sender: customer._id,
        senderEmail: customer.email,
        body,
        attachments,
        sentAt: now,
      },
    ],
    lastActivity: now,
  });

  await Counter.increment(`company:${company._id}`, 'totalTickets');
  const { scheduleTicketAiReply } = require('./ai-agent-ticket.service');
  scheduleTicketAiReply(company._id, ticket._id, body);
  return ticket;
}

module.exports = { processInboundEmail, parseTicketCode, normalizeSubject };
