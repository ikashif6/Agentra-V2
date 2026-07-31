const ChatSession = require('../models/ChatSession');
const {
  sendEmail,
  emailShell,
  emailHeading,
  emailParagraph,
  emailCallout,
  escapeHtml,
  BRAND,
  FONT,
} = require('./email.service');
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
    `<a href="$1" style="color:${BRAND.orange};text-decoration:underline;" target="_blank" rel="noopener">$1</a>`,
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
      if (m.role === 'customer') speaker = 'You';
      else if (m.role === 'agent') speaker = m.senderName || 'Agent';
      else if (m.role === 'bot') speaker = m.senderName || brandName || 'Support Assistant';
      else if (m.role === 'system' || m.contentType === 'system_event') speaker = 'System';
      return {
        sentAt: m.sentAt || session.createdAt,
        speaker,
        isSystem: m.role === 'system' || m.contentType === 'system_event',
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
      if (m.isSystem) speaker = 'System';
      else if (m.isAi || String(m.senderEmail || '').includes('bot@agentra')) {
        speaker = m.senderName || brandName || 'Support Assistant';
      } else if (m.sender && typeof m.sender === 'object' && m.sender.role === 'customer') {
        speaker = 'You';
      } else if (m.sender && typeof m.sender === 'object') {
        speaker = agentDisplayName(m.sender) || m.senderName || 'Agent';
      } else if (m.senderName) {
        speaker = m.senderName;
      }
      return {
        sentAt: m.sentAt || ticket.createdAt,
        speaker,
        isSystem: Boolean(m.isSystem),
        html: messageBodyHtml(m),
        attachments: Array.isArray(m.attachments) ? m.attachments : [],
      };
    });
}

function buildRatingBlock({ widgetKey, sessionToken, alreadyRated }) {
  if (alreadyRated) {
    return emailCallout(
      'Feedback received',
      `<p style="margin:0;">Thanks — your feedback for this conversation was already recorded.</p>`,
    );
  }
  if (!widgetKey || !sessionToken) return '';

  const buttons = RATING_META.map(
    (option) => `
      <a href="${escapeHtml(feedbackUrl({ widgetKey, sessionToken, rating: option.value }))}"
         style="display:inline-block;margin:0 6px;text-decoration:none;text-align:center;min-width:56px;">
        <span style="display:block;font-size:32px;line-height:1;">${option.emoji}</span>
        <span style="display:block;margin-top:6px;font-size:11px;font-weight:600;color:${option.color};font-family:${FONT};">${escapeHtml(option.label)}</span>
      </a>`,
  ).join('');

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:28px 0 0;">
      <tr>
        <td style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;padding:20px 16px;text-align:center;">
          <p style="margin:0 0 14px;color:${BRAND.text};font-size:15px;font-weight:600;font-family:${FONT};">
            How was your support experience?
          </p>
          <div>${buttons}</div>
        </td>
      </tr>
    </table>`;
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
  const logo = company?.logo || company?.liveChat?.appearance?.logoUrl || '';
  const sessionId = ticket?.ticket_code || String(session?._id || '').slice(-8);
  const sessionDate = formatSessionDate(
    session?.createdAt || ticket?.createdAt || new Date(),
    company?.businessHours?.default?.timezone,
  );
  const greet = greetingName(toEmail, customerName);
  const hello = greet ? `Hi ${escapeHtml(greet)},` : 'Hi there,';
  const timeZone = company?.businessHours?.default?.timezone;

  const lines = entries
    .map((entry) => {
      const time = formatMessageTime(entry.sentAt, timeZone);
      const attachments = (entry.attachments || [])
        .filter((a) => a?.url)
        .map((a) => {
          const isImage = /^image\//i.test(a.contentType || '') || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(a.url);
          if (isImage) {
            return `<div style="margin-top:8px;"><img src="${escapeHtml(a.url)}" alt="${escapeHtml(a.filename || 'Image')}" style="max-width:100%;height:auto;border-radius:8px;border:1px solid ${BRAND.border};" /></div>`;
          }
          return `<div style="margin-top:6px;"><a href="${escapeHtml(a.url)}" style="color:${BRAND.orange};font-size:13px;font-family:${FONT};" target="_blank" rel="noopener">${escapeHtml(a.filename || 'Attachment')}</a></div>`;
        })
        .join('');
      if (entry.isSystem) {
        return `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};">
              <p style="margin:0;text-align:center;color:${BRAND.muted};font-size:12px;font-style:italic;font-family:${FONT};">
                ${escapeHtml(stripHtml(entry.html.replace(/<[^>]+>/g, ' '))) || escapeHtml(entry.speaker)}
              </p>
            </td>
          </tr>`;
      }
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};vertical-align:top;">
            <p style="margin:0 0 4px;color:${BRAND.muted};font-size:12px;font-family:${FONT};">
              <span style="font-variant-numeric:tabular-nums;">${escapeHtml(time)}</span>
              &nbsp;<strong style="color:${BRAND.text};">${escapeHtml(entry.speaker)}</strong>
            </p>
            <div style="color:${BRAND.text};font-size:14px;line-height:1.55;font-family:${FONT};">${entry.html}</div>
            ${attachments}
          </td>
        </tr>`;
    })
    .join('');

  const ratingBlock = includeRating
    ? buildRatingBlock({
        widgetKey: company?.liveChat?.widgetKey,
        sessionToken: session?.sessionToken,
        alreadyRated: Boolean(session?.feedback?.submittedAt),
      })
    : '';

  const merchantBrand = logo
    ? `<div style="margin:0 0 20px;"><img src="${escapeHtml(logo)}" alt="${escapeHtml(brand)}" style="max-height:36px;max-width:160px;display:block;" /></div>`
    : '';

  const bodyHtml = `
    ${merchantBrand}
    ${emailHeading('Your conversation transcript')}
    ${emailParagraph(hello)}
    ${emailParagraph(
      `Thank you for contacting <strong style="color:${BRAND.text};">${escapeHtml(brand)}</strong>. A copy of your support chat is below.`,
    )}
    ${ratingBlock}
    ${emailCallout(
      'Session details',
      `<p style="margin:0 0 6px;"><strong>Session ID:</strong> ${escapeHtml(sessionId)}</p>
       <p style="margin:0;"><strong>Date:</strong> ${escapeHtml(sessionDate)}</p>`,
    )}
    <p style="margin:28px 0 8px;color:${BRAND.text};font-size:15px;font-weight:700;font-family:${FONT};">Conversation</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      ${lines || `<tr><td style="padding:12px 0;color:${BRAND.muted};font-size:14px;font-family:${FONT};">No messages were recorded for this conversation.</td></tr>`}
    </table>
    ${emailParagraph(
      'Thank you again for your time. If you need more help, reply to this email or start a new chat on our store.',
      { muted: true },
    )}
  `;

  return emailShell({
    title: `${brand} support chat`,
    preheader: `A copy of your ${brand} support conversation (${sessionId}).`,
    bodyHtml,
  });
}

function buildTranscriptText({ brand, sessionId, sessionDate, entries, greet }) {
  const hello = greet ? `Hi ${greet},` : 'Hi there,';
  const lines = entries.map((entry) => {
    const time = formatMessageTime(entry.sentAt);
    const body = stripHtml(entry.html.replace(/<br\s*\/?>/gi, '\n'));
    if (entry.isSystem) return `[${time}] ${body}`;
    return `[${time}] ${entry.speaker}: ${body}`;
  });
  return [
    hello,
    '',
    `Thank you for contacting ${brand}. A copy of your support chat session is provided below.`,
    '',
    `Session ID: ${sessionId}`,
    `Date: ${sessionDate}`,
    '',
    'Conversation',
    '-----------',
    ...lines,
    '',
    'Thank you again for your time.',
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
  const result = await sendEmail({ to, subject, html, text });

  if (session) {
    session.transcriptEmail = {
      sentAt: new Date(),
      to,
      messageId: result?.id || undefined,
    };
    session.markModified('transcriptEmail');
    await session.save();
  }

  return { skipped: false, to, messageId: result?.id || null, sessionId };
}

module.exports = {
  sendConversationTranscriptEmail,
  buildTranscriptHtml,
  stripHtml,
};
