const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');

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
  if (parsed.html) return parsed.html;
  if (parsed.textAsHtml) return parsed.textAsHtml;
  if (parsed.text) return `<p>${String(parsed.text).replace(/\n/g, '<br>')}</p>`;
  return '(empty message)';
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
      ticket_title: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
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
  const body = messageBody(parsed);
  const messageId = parsed.messageId || null;
  const customer = await findOrCreateCustomer(company, address, name);

  const existing = await findExistingTicket(company, subject, customer);
  const now = parsed.date ? new Date(parsed.date) : new Date();

  if (existing) {
    existing.messages.push({
      sender: customer._id,
      senderEmail: customer.email,
      body,
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
        sentAt: now,
      },
    ],
    lastActivity: now,
  });

  await Counter.increment(`company:${company._id}`, 'totalTickets');
  return ticket;
}

module.exports = { processInboundEmail, parseTicketCode, normalizeSubject };
