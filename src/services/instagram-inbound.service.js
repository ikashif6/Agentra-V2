const Company = require('../models/Company');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');
const { getInstagramUserProfile } = require('./instagram.service');

const ACTIVE_STATUSES = ['open', 'in_progress', 'on_hold'];

function truncate(text, max) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function buildTitle(body) {
  return truncate(body, 80) || 'New Instagram conversation';
}

function mapAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .filter((att) => att?.payload?.url)
    .map((att, index) => ({
      url: att.payload.url,
      filename: `${att.type || 'attachment'}-${index + 1}`,
      mimetype:
        att.type === 'image'
          ? 'image/*'
          : att.type === 'video'
            ? 'video/*'
            : att.type === 'audio'
              ? 'audio/*'
              : 'application/octet-stream',
    }));
}

async function findOrCreateCustomer(company, pageToken, igsid) {
  const email = `ig-${igsid}@instagram.agentra.local`;

  let customer = await User.findOne({ email, company: company._id });
  if (customer) return customer;

  let firstName = 'Instagram';
  let lastName = 'User';
  let avatar;

  if (pageToken) {
    try {
      const profile = await getInstagramUserProfile(pageToken, igsid);
      const name = (profile?.name || profile?.username || '').trim();
      if (name) {
        const parts = name.split(/\s+/);
        firstName = parts[0];
        lastName = parts.slice(1).join(' ') || (profile?.username ? `@${profile.username}` : 'User');
      }
      if (profile?.profile_pic) avatar = profile.profile_pic;
    } catch (err) {
      console.warn('[instagram profile]', err.message);
    }
  }

  customer = await User.create({
    firstName: truncate(firstName, 50) || 'Instagram',
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

async function findOrCreateTicket(company, customer, igUserId, igsid, firstBody, attachments) {
  const existing = await Ticket.findOne({
    company: company._id,
    source: 'instagram',
    'instagram.igsid': igsid,
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
    source: 'instagram',
    status: 'open',
    inboxFolder: 'inbox',
    isUnread: true,
    priority: company.settings?.defaultTicketPriority || 'medium',
    createdBy: customer._id,
    instagram: { igUserId, igsid },
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

async function handleMessagingEvent(company, pageToken, igUserId, event) {
  const message = event.message;
  if (!message || message.is_echo) return;

  const igsid = event.sender?.id;
  if (!igsid) return;
  // Ignore events the business account sends to itself.
  if (igsid === igUserId) return;

  const text = (message.text || '').trim();
  const attachments = mapAttachments(message.attachments);
  if (!text && attachments.length === 0) return;

  const body = text || (attachments.length ? '(sent an attachment)' : '');
  if (!body) return;

  const customer = await findOrCreateCustomer(company, pageToken, igsid);
  const { ticket, isNew } = await findOrCreateTicket(
    company,
    customer,
    igUserId,
    igsid,
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
 * Entry point for Instagram webhook payloads (object === 'instagram').
 * The recipient / entry id is our Instagram business account id.
 */
async function processInstagramWebhook(body) {
  if (!body || body.object !== 'instagram' || !Array.isArray(body.entry)) return;

  for (const entry of body.entry) {
    const events = entry.messaging || [];
    if (!events.length) continue;

    // The business account id is the entry id (and each event's recipient.id).
    const igUserId = String(entry.id);

    const company = await Company.findOne({
      'channelIntegrations.instagram.igUserId': igUserId,
    }).select('+channelIntegrations.instagram.pageAccessToken');

    if (!company) {
      console.warn('[instagram ingest] no workspace for ig account', igUserId);
      continue;
    }

    const pageToken = company.channelIntegrations?.instagram?.pageAccessToken;

    for (const event of events) {
      try {
        await handleMessagingEvent(company, pageToken, igUserId, event);
      } catch (err) {
        console.error('[instagram ingest]', err.message);
      }
    }
  }
}

module.exports = { processInstagramWebhook };
