const ChatSession = require('../models/ChatSession');
const {
  merchantEmailShell,
  emailHeading,
  emailParagraph,
  emailSection,
  escapeHtml,
  BRAND,
  FONT_BODY,
} = require('./email.service');
const { sendCompanyCustomerEmail } = require('./email-channel.service');
const { agentDisplayName } = require('./ticket-system-events.service');

const RATING_META = [
  { value: 1, emoji: '😞', label: 'Very bad', color: '#DC2626' },
  { value: 2, emoji: '🙁', label: 'Bad', color: '#EA580C' },
  { value: 3, emoji: '😐', label: 'Okay', color: '#CA8A04' },
  { value: 4, emoji: '🙂', label: 'Good', color: '#16A34A' },
  { value: 5, emoji: '😍', label: 'Excellent', color: '#15803D' },
];

function stripHtml(value) {
  return String(value || '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#3?9;|&apos;/gi, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function linkify(text) {
  return escapeHtml(text).replace(
    /(https?:\/\/[^\s<]+)/g,
    `<a href="$1" style="color:${BRAND.link};text-decoration:underline;" target="_blank" rel="noopener">$1</a>`,
  );
}

function formatMessageTime(date, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timeZone || 'UTC',
    }).format(new Date(date));
  } catch {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}

function formatSessionDate(date, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: timeZone || 'UTC',
    }).format(new Date(date));
  } catch {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

function greetingName(email, fallbackName) {
  const clean = String(fallbackName || '').trim();
  if (clean && !/^(visitor|guest|anonymous|unknown|chat|customer)$/i.test(clean)) {
    const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const local = String(email || '').split('@')[0];
    if (!local || key(clean) !== key(local)) return clean.split(/\s+/)[0];
  }
  return '';
}

function customerEmailFromTicket(ticket, session) {
  if (session?.visitorEmail) return String(session.visitorEmail).toLowerCase();
  if (ticket?.details?.customerEmail) return String(ticket.details.customerEmail).toLowerCase();
  if (ticket?.email?.fromAddress) return String(ticket.email.fromAddress).toLowerCase();
  const creator = ticket?.createdBy;
  if (creator && typeof creator === 'object' && creator.email) {
    return String(creator.email).toLowerCase();
  }
  return '';
}

function apiOrigin() {
  return (
    process.env.APP_API_URL ||
    process.env.API_PUBLIC_URL ||
    `http://localhost:${process.env.PORT || 5000}`
  ).replace(/\/$/, '');
}

function feedbackUrl({ widgetKey, sessionToken, rating }) {
  const url = new URL(`${apiOrigin()}/api/v1/widget/feedback`);
  url.searchParams.set('widgetKey', widgetKey);
  url.searchParams.set('session', sessionToken);
  url.searchParams.set('rating', String(rating));
  return url.toString();
}

function messageBodyHtml(msg) {
  const plain = stripHtml(msg.body || '');
  if (!plain && msg.contentType === 'order_card') {
    return escapeHtml(msg.payload?.orderNumber ? `Order #${msg.payload.orderNumber}` : 'Order update');
  }
  if (!plain && msg.contentType === 'product_cards') {
    const count = msg.payload?.products?.length || 0;
    return escapeHtml(count ? `Shared ${count} product${count === 1 ? '' : 's'}` : 'Product suggestions');
  }
  if (!plain) return `<em style="color:${BRAND.faint};">(no text)</em>`;
  return linkify(plain).replace(/\n/g, '<br/>');
}

function transcriptEntriesFromSession(session, brandName) {
  return (session.messages || [])
    .filter((m) => m.body || m.contentType === 'order_card' || m.contentType === 'product_cards' || (m.attachments && m.attachments.length))
    .map((m) => {
      let speaker = brandName || 'Support';
      let side = 'support';
      if (m.role === 'customer') {
        speaker = 'You';
        side = 'customer';
      } else if (m.role === 'agent') {
        speaker = m.senderName || 'Agent';
      } else if (m.role === 'bot') {
        speaker = m.senderName || brandName || 'Support Assistant';
      } else if (m.role === 'system' || m.contentType === 'system_event') {
        speaker = 'System';
        side = 'system';
      }
      return {
        sentAt: m.sentAt || session.createdAt,
        speaker,
        side,
        isSystem: side === 'system',
        html: messageBodyHtml(m),
        attachments: Array.isArray(m.attachments) ? m.attachments : [],
      };
    });
}

function transcriptEntriesFromTicket(ticket, brandName) {
  return (ticket.messages || [])
    .filter((m) => m.body && !m.isInternal)
    .map((m) => {
      let speaker = brandName || 'Support';
      let side = 'support';
      if (m.isSystem) {
        speaker = 'System';
        side = 'system';
      } else if (m.isAi || String(m.senderEmail || '').includes('bot@agentra')) {
        speaker = m.senderName || brandName || 'Support Assistant';
      } else if (m.sender && typeof m.sender === 'object' && m.sender.role === 'customer') {
        speaker = 'You';
        side = 'customer';
      } else if (m.sender && typeof m.sender === 'object') {
        speaker = agentDisplayName(m.sender) || m.senderName || 'Agent';
      } else if (m.senderName) {
        speaker = m.senderName;
      }
      return {
        sentAt: m.sentAt || ticket.createdAt,
        speaker,
        side,
        isSystem: side === 'system',
        html: messageBodyHtml(m),
        attachments: Array.isArray(m.attachments) ? m.attachments : [],
      };
    });
}

function buildRatingBlock({ widgetKey, sessionToken, alreadyRated }) {
  if (alreadyRated) {
    return emailSection(
      'Feedback received',
      `<p style="margin:0;color:${BRAND.muted};font-size:15px;line-height:1.65;font-family:${FONT_BODY};">Thanks — your rating for this conversation was already recorded.</p>`,
    );
  }
  if (!widgetKey || !sessionToken) return '';

  const buttons = RATING_META.map(
    (option) => `
      <td align="center" style="padding:4px 2px;vertical-align:top;">
        <a href="${escapeHtml(feedbackUrl({ widgetKey, sessionToken, rating: option.value }))}"
           style="display:block;text-decoration:none;text-align:center;min-width:52px;padding:10px 4px;border-radius:10px;background-color:${BRAND.white};border:1px solid ${BRAND.border};">
          <span style="display:block;font-size:28px;line-height:1;">${option.emoji}</span>
          <span style="display:block;margin-top:6px;font-size:11px;font-weight:600;color:${option.color};font-family:${FONT_BODY};">${escapeHtml(option.label)}</span>
        </a>
      </td>`,
  ).join('');

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:28px 0 0;width:100%;">
      <tr>
        <td style="background-color:${BRAND.surface};border-radius:12px;padding:22px 18px;">
          <p style="margin:0 0 6px;color:${BRAND.text};font-size:16px;font-weight:700;font-family:${FONT_BODY};">
            How was your support experience?
          </p>
          <p style="margin:0 0 16px;color:${BRAND.muted};font-size:13px;line-height:1.5;font-family:${FONT_BODY};">
            Tap a rating — it only takes a second.
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;">
            <tr>
              ${buttons}
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function attachmentHtml(attachments = []) {
  return (attachments || [])
    .filter((a) => a?.url)
    .map((a) => {
      const isImage = /^image\//i.test(a.contentType || '') || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(a.url);
      if (isImage) {
        return `<div style="margin-top:10px;"><img src="${escapeHtml(a.url)}" alt="${escapeHtml(a.filename || 'Image')}" style="max-width:100%;height:auto;border-radius:8px;border:1px solid ${BRAND.border};display:block;" /></div>`;
      }
      return `<div style="margin-top:8px;"><a href="${escapeHtml(a.url)}" style="color:${BRAND.link};font-size:13px;font-family:${FONT_BODY};text-decoration:underline;" target="_blank" rel="noopener">${escapeHtml(a.filename || 'Attachment')}</a></div>`;
    })
    .join('');
}

function buildTranscriptThread(entries, timeZone) {
  if (!entries.length) {
    return `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 0;width:100%;">
        <tr>
          <td style="padding:16px;background-color:${BRAND.surface};border-radius:10px;color:${BRAND.muted};font-size:14px;font-family:${FONT_BODY};">
            No messages were recorded for this conversation.
          </td>
        </tr>
      </table>`;
  }

  const rows = entries
    .map((entry, index) => {
      const time = formatMessageTime(entry.sentAt, timeZone);
      const attachments = attachmentHtml(entry.attachments);
      const isLast = index === entries.length - 1;

      if (entry.isSystem) {
        const text = escapeHtml(stripHtml(String(entry.html || '').replace(/<[^>]+>/g, ' '))) || escapeHtml(entry.speaker);
        return `
          <tr>
            <td style="padding:0 0 ${isLast ? '0' : '12px'};">
              <p style="margin:0;text-align:center;color:${BRAND.faint};font-size:12px;line-height:1.5;font-family:${FONT_BODY};">
                ${text}
              </p>
            </td>
          </tr>`;
      }

      const isCustomer = entry.side === 'customer';
      const bubbleBg = isCustomer ? BRAND.surface : '#FFF7F3';
      const bubbleBorder = isCustomer ? BRAND.border : '#F0D0C2';
      const label = isCustomer ? 'You' : escapeHtml(entry.speaker);

      return `
        <tr>
          <td style="padding:0 0 ${isLast ? '0' : '12px'};">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;background-color:${bubbleBg};border:1px solid ${bubbleBorder};border-radius:12px;">
              <tr>
                <td style="padding:14px 16px;">
                  <p style="margin:0 0 8px;font-family:${FONT_BODY};font-size:12px;line-height:1.4;">
                    <strong style="color:${BRAND.text};">${label}</strong>
                    <span style="color:${BRAND.faint};">&nbsp;·&nbsp;${escapeHtml(time)}</span>
                  </p>
                  <div style="color:${BRAND.text};font-size:15px;line-height:1.6;font-family:${FONT_BODY};">${entry.html}</div>
                  ${attachments}
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join('');

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 0;width:100%;">
      ${rows}
    </table>`;
}

function brandSignOff(brand) {
  return `<p style="margin:36px 0 0;color:${BRAND.text};font-size:15px;line-height:1.6;font-family:${FONT_BODY};">Thanks,<br/>The <strong>${escapeHtml(brand)}</strong> team</p>`;
}

function merchantWebsite(company) {
  const shopifyDomain = company?.storeIntegration?.shopify?.shopDomain;
  if (shopifyDomain) {
    return String(shopifyDomain).startsWith('http')
      ? shopifyDomain
      : `https://${shopifyDomain}`;
  }
  return (
    company?.website ||
    company?.storeIntegration?.woocommerce?.storeUrl ||
    company?.storeIntegration?.custom?.storeUrl ||
    ''
  );
}

function merchantLogo(company) {
  return company?.logo || company?.liveChat?.appearance?.logoUrl || '';
}

function buildTranscriptHtml({
  company,
  ticket,
  session,
  toEmail,
  customerName,
  entries,
  includeRating,
}) {
  const brand = company?.name || company?.liveChat?.content?.agentName || 'Support';
  const logo = merchantLogo(company);
  const websiteUrl = merchantWebsite(company);
  const sessionId = ticket?.ticket_code || String(session?._id || '').slice(-8);
  const sessionDate = formatSessionDate(
    session?.createdAt || ticket?.createdAt || new Date(),
    company?.businessHours?.default?.timezone,
  );
  const greet = greetingName(toEmail, customerName);
  const hello = greet ? `Hi ${escapeHtml(greet)},` : 'Hi there,';
  const timeZone = company?.businessHours?.default?.timezone;

  const ratingBlock = includeRating
    ? buildRatingBlock({
        widgetKey: company?.liveChat?.widgetKey,
        sessionToken: session?.sessionToken,
        alreadyRated: Boolean(session?.feedback?.submittedAt),
      })
    : '';

  const bodyHtml = `
    ${emailHeading('Your conversation transcript')}
    ${emailParagraph(hello)}
    ${emailParagraph(
      `Thanks for chatting with <strong>${escapeHtml(brand)}</strong>. Here’s a copy of your support conversation so you can keep it for your records.`,
    )}
    ${emailParagraph(
      `Session <strong>${escapeHtml(sessionId)}</strong> · ${escapeHtml(sessionDate)}`,
      { muted: true, size: 13 },
    )}
    ${ratingBlock}
    ${emailSection('Conversation', buildTranscriptThread(entries, timeZone))}
    ${emailSection(
      'Need more help?',
      `<p style="margin:0;">Reply to this email or start a new chat on our store anytime.</p>`,
    )}
    ${brandSignOff(brand)}
  `;

  return merchantEmailShell({
    title: `${brand} support chat`,
    preheader: `A copy of your ${brand} support conversation (${sessionId}).`,
    bodyHtml,
    brandName: brand,
    logoUrl: logo,
    websiteUrl,
    footerNote: `You received this email because you contacted ${escapeHtml(brand)} support.`,
  });
}

function buildTranscriptText({ brand, sessionId, sessionDate, entries, greet }) {
  const hello = greet ? `Hi ${greet},` : 'Hi there,';
  const lines = entries.map((entry) => {
    const time = formatMessageTime(entry.sentAt);
    const body = stripHtml(String(entry.html || '').replace(/<br\s*\/?>/gi, '\n'));
    if (entry.isSystem) return `[${time}] ${body}`;
    return `[${time}] ${entry.speaker}: ${body}`;
  });
  return [
    hello,
    '',
    `Thanks for chatting with ${brand}. Here’s a copy of your support conversation.`,
    '',
    `Session: ${sessionId}`,
    `Date: ${sessionDate}`,
    '',
    'Conversation',
    '-----------',
    ...lines,
    '',
    'Need more help? Reply to this email or start a new chat on our store.',
    '',
    `Thanks,`,
    `The ${brand} team`,
  ].join('\n');
}

/**
 * Email the full live-chat / ticket conversation to the customer.
 * Prefer ChatSession messages when available; fall back to ticket thread.
 */
async function sendConversationTranscriptEmail(company, ticket, { force = false } = {}) {
  if (!['chat', 'chatbot'].includes(String(ticket.source))) {
    const err = new Error('Transcript email is only available for live chat conversations');
    err.statusCode = 400;
    throw err;
  }

  const session = await ChatSession.findOne({
    company: company._id || company,
    ticket: ticket._id,
  }).sort({ updatedAt: -1 });

  if (!force && session?.transcriptEmail?.sentAt) {
    return { skipped: true, reason: 'already_sent', to: session.transcriptEmail.to };
  }

  const to = customerEmailFromTicket(ticket, session);
  if (!to) {
    const err = new Error('No customer email on this conversation');
    err.statusCode = 400;
    throw err;
  }

  const brand = company?.name || company?.liveChat?.content?.agentName || 'Support';
  const creator = ticket.createdBy && typeof ticket.createdBy === 'object' ? ticket.createdBy : null;
  const customerName = creator
    ? [creator.firstName, creator.lastName].filter(Boolean).join(' ')
    : '';
  const entries = session
    ? transcriptEntriesFromSession(session, brand)
    : transcriptEntriesFromTicket(ticket, brand);

  const sessionId = ticket.ticket_code || String(session?._id || '').slice(-8);
  const sessionDate = formatSessionDate(session?.createdAt || ticket.createdAt || new Date());
  const greet = greetingName(to, customerName);
  const html = buildTranscriptHtml({
    company,
    ticket,
    session,
    toEmail: to,
    customerName,
    entries,
    includeRating: Boolean(session?.sessionToken && company?.liveChat?.widgetKey),
  });
  const text = buildTranscriptText({
    brand,
    sessionId,
    sessionDate,
    entries,
    greet,
  });

  const subject = `${brand} Support Chat Logged [${sessionId}]`;
  const result = await sendCompanyCustomerEmail(company, { to, subject, html, text });

  if (session) {
    session.transcriptEmail = {
      sentAt: new Date(),
      to,
      messageId: result?.messageId || result?.id || undefined,
    };
    session.markModified('transcriptEmail');
    await session.save();
  }

  return {
    skipped: false,
    to,
    messageId: result?.messageId || result?.id || null,
    sessionId,
  };
}

module.exports = {
  sendConversationTranscriptEmail,
  buildTranscriptHtml,
  stripHtml,
};
