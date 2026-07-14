const Company = require('../models/Company');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');

const ACTIVE_STATUSES = ['open', 'in_progress', 'on_hold'];

function truncate(text, max) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function buildTitle(body) {
  return truncate(body, 80) || 'New WhatsApp conversation';
}

// WhatsApp media arrives as an id (requires a signed download); for now we
// surface a readable placeholder rather than the binary.
function describeMessage(message) {
  switch (message.type) {
    case 'text':
      return (message.text?.body || '').trim();
    case 'image':
      return message.image?.caption?.trim() || '(sent an image)';
    case 'video':
      return message.video?.caption?.trim() || '(sent a video)';
    case 'audio':
      return '(sent a voice message)';
    case 'document':
      return message.document?.filename
        ? `(sent a document: ${message.document.filename})`
        : '(sent a document)';
    case 'sticker':
      return '(sent a sticker)';
    case 'location':
      return '(shared a location)';
    case 'contacts':
      return '(shared a contact)';
    case 'button':
      return (message.button?.text || '').trim() || '(tapped a button)';
    case 'interactive':
      return (
        message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        '(sent a reply)'
      ).trim();
    default:
      return '(sent a message)';
  }
}

async function findOrCreateCustomer(company, waId, profileName) {
  const email = `wa-${waId}@whatsapp.agentra.local`;

  let customer = await User.findOne({ email, company: company._id });
  if (customer) return customer;

  let firstName = 'WhatsApp';
  let lastName = 'User';

  const name = (profileName || '').trim();
  if (name) {
    const parts = name.split(/\s+/);
    firstName = parts[0];
    lastName = parts.slice(1).join(' ') || 'User';
  }

  customer = await User.create({
    firstName: truncate(firstName, 50) || 'WhatsApp',
    lastName: truncate(lastName, 50) || 'User',
    email,
    company: company._id,
    role: 'customer',
    isEmailVerified: false,
    isActive: true,
    onboardingCompleted: true,
  });

  return customer;
}

async function findOrCreateTicket(company, customer, phoneNumberId, waId, firstBody) {
  const existing = await Ticket.findOne({
    company: company._id,
    source: 'whatsapp',
    'whatsapp.waId': waId,
    status: { $in: ACTIVE_STATUSES },
    inboxFolder: { $nin: ['trash', 'spam'] },
  }).sort({ lastActivity: -1 });

  if (existing) return { ticket: existing, isNew: false };

  const prefix = company.settings?.ticketPrefix || 'TKT';
  const ticket_code = await Ticket.generateCode(company._id, prefix);
  const now = new Date();

  const ticket = await Ticket.create({
    ticket_code,
    company_subdomain: company.subdomain,
    company: company._id,
    ticket_title: buildTitle(firstBody),
    ticket_description: firstBody,
    source: 'whatsapp',
    status: 'open',
    inboxFolder: 'inbox',
    isUnread: true,
    priority: company.settings?.defaultTicketPriority || 'medium',
    createdBy: customer._id,
    whatsapp: { phoneNumberId, waId },
    peoples: [{ user: customer._id, role: 'customer' }],
    messages: [
      {
        sender: customer._id,
        senderEmail: customer.email,
        body: firstBody,
        sentAt: now,
      },
    ],
    lastActivity: now,
  });

  await Counter.increment(`company:${company._id}`, 'totalTickets');
  return { ticket, isNew: true };
}

async function handleInboundMessage(company, phoneNumberId, message, contactName) {
  const waId = message.from;
  if (!waId) return;

  const body = describeMessage(message);
  if (!body) return;

  const customer = await findOrCreateCustomer(company, waId, contactName);
  const { ticket, isNew } = await findOrCreateTicket(
    company,
    customer,
    phoneNumberId,
    waId,
    body,
  );

  if (!isNew) {
    ticket.messages.push({
      sender: customer._id,
      senderEmail: customer.email,
      body,
      sentAt: new Date(),
    });
    if (['resolved', 'closed', 'self_closed'].includes(ticket.status)) {
      ticket.status = 'open';
    }
    ticket.isUnread = true;
    ticket.lastActivity = new Date();
    await ticket.save();
  }

  const { scheduleTicketAiReply } = require('./ai-agent-ticket.service');
  scheduleTicketAiReply(company._id, ticket._id, body);
}

/**
 * Entry point for WhatsApp webhook payloads (object === 'whatsapp_business_account').
 */
async function processWhatsAppWebhook(body) {
  if (!body || body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) return;

  for (const entry of body.entry) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== 'messages') continue;

      const value = change.value || {};
      const messages = value.messages || [];
      if (!messages.length) continue; // ignore status/read receipts

      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const company = await Company.findOne({
        'channelIntegrations.whatsapp.phoneNumberId': String(phoneNumberId),
      });

      if (!company) {
        console.warn('[whatsapp ingest] no workspace for phone number', phoneNumberId);
        continue;
      }

      const contactsByWaId = {};
      for (const contact of value.contacts || []) {
        if (contact?.wa_id) contactsByWaId[contact.wa_id] = contact.profile?.name;
      }

      for (const message of messages) {
        try {
          await handleInboundMessage(
            company,
            String(phoneNumberId),
            message,
            contactsByWaId[message.from],
          );
        } catch (err) {
          console.error('[whatsapp ingest]', err.message);
        }
      }
    }
  }
}

module.exports = { processWhatsAppWebhook };
