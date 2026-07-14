const Company = require('../models/Company');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');
const { getMessengerUserProfile } = require('./facebook.service');

const ACTIVE_STATUSES = ['open', 'in_progress', 'on_hold'];

function truncate(text, max) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function buildTitle(body) {
  const title = truncate(body, 80);
  return title || 'New Messenger conversation';
}

function mimeForAttachmentType(type) {
  switch (type) {
    case 'image':
      return 'image/*';
    case 'video':
      return 'video/*';
    case 'audio':
      return 'audio/*';
    default:
      return 'application/octet-stream';
  }
}

function filenameForAttachment(url, type, index) {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split('/').filter(Boolean).pop();
    if (last && last.includes('.')) return decodeURIComponent(last);
  } catch {
    // fall through to generated name
  }
  return `${type || 'attachment'}-${index + 1}`;
}

function mapAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .filter((att) => att?.payload?.url)
    .map((att, index) => ({
      url: att.payload.url,
      filename: filenameForAttachment(att.payload.url, att.type, index),
      mimetype: mimeForAttachmentType(att.type),
    }));
}

async function findOrCreateCustomer(company, pageToken, psid) {
  const email = `fb-${psid}@messenger.agentra.local`;

  let customer = await User.findOne({ email, company: company._id });
  if (customer) return customer;

  let firstName = 'Messenger';
  let lastName = 'User';
  let avatar;

  if (pageToken) {
    try {
      const profile = await getMessengerUserProfile(pageToken, psid);
      if (profile?.first_name) firstName = profile.first_name;
      if (profile?.last_name) lastName = profile.last_name;
      if (profile?.profile_pic) avatar = profile.profile_pic;
    } catch (err) {
      console.warn('[messenger profile]', err.message);
    }
  }

  customer = await User.create({
    firstName: truncate(firstName, 50) || 'Messenger',
    lastName: truncate(lastName, 50) || 'User',
    email,
    avatar,
    company: company._id,
    role: 'customer',
    isEmailVerified: false,
    isActive: true,
    onboardingCompleted: true,
  });

  return customer;
}

async function findOrCreateTicket(company, customer, pageId, psid, firstBody, attachments) {
  const existing = await Ticket.findOne({
    company: company._id,
    source: 'facebook',
    'facebook.psid': psid,
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
    source: 'facebook',
    status: 'open',
    inboxFolder: 'inbox',
    isUnread: true,
    priority: company.settings?.defaultTicketPriority || 'medium',
    createdBy: customer._id,
    facebook: { pageId, psid },
    peoples: [{ user: customer._id, role: 'customer' }],
    messages: [
      {
        sender: customer._id,
        senderEmail: customer.email,
        body: firstBody,
        attachments,
        sentAt: now,
      },
    ],
    lastActivity: now,
  });

  await Counter.increment(`company:${company._id}`, 'totalTickets');
  return { ticket, isNew: true };
}

async function handleMessagingEvent(company, pageToken, pageId, event) {
  const message = event.message;

  // Ignore echoes of our own outgoing messages, delivery + read receipts.
  if (!message || message.is_echo) return;

  const psid = event.sender?.id;
  if (!psid) return;

  const text = (message.text || '').trim();
  const attachments = mapAttachments(message.attachments);
  if (!text && attachments.length === 0) return;

  const body = text || (attachments.length ? '(sent an attachment)' : '');
  if (!body) return;

  const customer = await findOrCreateCustomer(company, pageToken, psid);
  const { ticket, isNew } = await findOrCreateTicket(
    company,
    customer,
    pageId,
    psid,
    body,
    attachments,
  );

  if (!isNew) {
    ticket.messages.push({
      sender: customer._id,
      senderEmail: customer.email,
      body,
      attachments,
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
 * Entry point for Messenger webhook payloads.
 * Resolves the workspace from the Page ID, then turns each inbound message
 * into (or appends it to) a Facebook ticket.
 */
async function processMessengerWebhook(body) {
  if (!body || body.object !== 'page' || !Array.isArray(body.entry)) return;

  for (const entry of body.entry) {
    const pageId = String(entry.id);
    const events = entry.messaging || [];
    if (!events.length) continue;

    const company = await Company.findOne({
      'channelIntegrations.facebook.pageId': pageId,
    }).select('+channelIntegrations.facebook.pageAccessToken');

    if (!company) {
      console.warn('[messenger ingest] no workspace for page', pageId);
      continue;
    }

    const pageToken = company.channelIntegrations?.facebook?.pageAccessToken;

    for (const event of events) {
      try {
        await handleMessagingEvent(company, pageToken, pageId, event);
      } catch (err) {
        console.error('[messenger ingest]', err.message);
      }
    }
  }
}

module.exports = { processMessengerWebhook };
