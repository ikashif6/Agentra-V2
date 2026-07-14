/**
 * Seed 3 long handoff conversations for Vastora Bridal (thebuildclub):
 *   1. Email
 *   2. Live chat (chatbot)
 *   3. WhatsApp
 *
 * Each ends with a request for a human agent, then runs Helpdesk AI
 * (overview + auto-assign + tags/priority).
 *
 * Usage: node scripts/seed-handoff-conversations.js [subdomain]
 */
require('dotenv').config();

const crypto = require('crypto');
const mongoose = require('mongoose');
const Company = require('../src/models/Company');
const User = require('../src/models/User');
const Ticket = require('../src/models/Ticket');
const ChatSession = require('../src/models/ChatSession');
const Counter = require('../src/models/Counter');
const { processTicketAiReply } = require('../src/services/ai-agent-ticket.service');
const { processCustomerMessage } = require('../src/services/live-chat-ai.service');
const {
  findOrCreateCustomerByEmail,
  syncMessageToTicket,
} = require('../src/services/live-chat-session.service');
const { generateTicketIntelligence } = require('../src/services/ticket-intelligence.service');
const { updateHelpdeskAiConfig } = require('../src/services/helpdesk-ai-config.service');

function minutesAgo(n) {
  return new Date(Date.now() - n * 60 * 1000);
}

async function ensureCustomer(company, { email, firstName, lastName }) {
  let user = await User.findOne({ company: company._id, email: email.toLowerCase() });
  if (user) return user;
  user = await User.create({
    email: email.toLowerCase(),
    company: company._id,
    firstName,
    lastName,
    role: 'customer',
    password: crypto.randomBytes(24).toString('hex'),
    isEmailVerified: true,
  });
  return user;
}

async function ensureBotSender(company) {
  let bot = await User.findOne({ company: company._id, email: 'bot@agentra.local' });
  if (bot) return bot;
  bot = await User.create({
    email: 'bot@agentra.local',
    company: company._id,
    firstName: 'Support',
    lastName: 'Assistant',
    role: 'agent',
    password: crypto.randomBytes(24).toString('hex'),
    isActive: true,
  });
  return bot;
}

function buildThread(pairs, { customer, bot, startMinutesAgo = 180 }) {
  const messages = [];
  let t = startMinutesAgo;
  for (const [customerText, botText] of pairs) {
    messages.push({
      sender: customer._id,
      senderEmail: customer.email,
      body: customerText,
      sentAt: minutesAgo(t),
      isInternal: false,
      isAi: false,
    });
    t -= 8;
    if (botText) {
      messages.push({
        sender: bot._id,
        senderEmail: 'bot@agentra.local',
        body: botText,
        sentAt: minutesAgo(t),
        isInternal: false,
        isAi: true,
      });
      t -= 6;
    }
  }
  return messages;
}

const EMAIL_PAIRS = [
  [
    'Hi Vastora Bridal support,\n\nI ordered the Celestine lace gown (order #VB-44128) on June 2 for my sister\'s wedding on August 18. The confirmation email said 4–6 week production, but the tracking page still says "In production" with no courier scan.\n\nCan you confirm whether the dress has left the atelier yet? I also need to know if I can still request a bustle alteration before it ships.\n\nThank you,\nAmelia Chen',
    'Hello Amelia,\n\nThank you for writing in — I\'m happy to help with order #VB-44128.\n\nI can see the Celestine lace gown is still marked In production on our side. Production sometimes lands at the end of the quoted window for made-to-order pieces. I don\'t have a courier scan yet, which usually means it hasn\'t been handed to shipping.\n\nBustle requests: if the gown hasn\'t shipped, we can often add a single-point bustle. Could you reply with:\n1) Your checkout email\n2) Preferred bustle style (American / French / ballroom)\n3) A photo of the gown back if you already have a sample or fitting note\n\nOnce I have those, I\'ll check with production.\n\nKind regards,\nVastora Bridal Support',
  ],
  [
    'Checkout email is amelia.chen.bridal@gmail.com. We want an American bustle (3 points if possible). I don\'t have a fitting photo yet — our appointment is next week.\n\nAlso, your site said express shipping was included over $2,000 and this gown was $2,480. Can you confirm that is still locked in? I\'m getting anxious because the wedding party arrival flights are already booked.',
    'Thanks Amelia — noted on American bustle (targeting 3 points) for #VB-44128, and I\'ll flag production before it leaves the atelier.\n\nOn shipping: for made-to-order gowns over $2,000, express shipping is typically included when it\'s selected at checkout. I don\'t want to confirm carrier dates until production clears the gown for pack-out. I\'ll push a status check and come back with:\n- Expected pack-out window\n- Whether express is on the order\n- Whether the bustle can be completed pre-ship\n\nI\'ll follow up as soon as production replies.\n\nKind regards,\nVastora Bridal Support',
  ],
  [
    'That\'s been two days with no update. Production still hasn\'t replied in the portal. My sister is panicking. Please escalate — I need a real person who can call the atelier today and get a firm ship date. If we miss this window we will need overnight shipping at your cost.\n\nI want to speak to a human agent / manager now.',
    null,
  ],
];

const WHATSAPP_PAIRS = [
  [
    'Hi! Quick question — do you ship international bridal accessories to Canada? Looking at the pearl hair vine + matching earrings.',
    'Hi! Yes — we ship bridal accessories to Canada. Duties/taxes may apply at customs depending on your province. Which pearl hair vine are you looking at (product name or link), and do you need it before a specific date?',
  ],
  [
    'The "Luna Cascade" vine + "Luna Drop" earrings. Need them by Aug 1 for a Vancouver wedding. Also curious if they come in rose gold — the site only shows silver.',
    'Got it — Luna Cascade + Luna Drop for Aug 1 / Vancouver. The site listing is silver-tone. Rose gold is sometimes available as a limited finish; I can check stock, but I need a quick confirm: are you ordering as guest checkout or will you use a past order email so we can attach notes?',
  ],
  [
    'Guest is fine. Email will be sofia.martinez.wa@gmail.com. Please also tell me the return window if the vine arrives damaged — last time a flower crown from another shop arrived crushed and support was useless.',
    'Thanks Sofia. For accessories, damaged-in-transit claims are usually covered if you send photos within 48 hours of delivery. I\'ll note your Canada / Aug 1 need and check rose-gold availability on Luna Cascade + Drop.\n\nOne more thing: preferred courier for Canada (standard vs express)? Express is safer for Aug 1.',
  ],
  [
    'Express please. Actually this is taking too long and I still don\'t have a clear yes/no on rose gold. Please connect me to a human agent who can confirm inventory and place the order with me on the phone / chat.',
    null,
  ],
];

const LIVECHAT_PAIRS = [
  [
    'Hi — I\'m on your sizing guide page. I measured myself for the Seraphine midi dress but your chart has overlapping bust ranges and I\'m stuck between S and M.',
    'Welcome! Happy to help with Seraphine sizing. Bust is usually the priority for this midi. Share your bust / waist / hip (inches or cm) and whether you prefer a closer fit or room to move, and I\'ll recommend S vs M.',
  ],
  [
    'Bust 36", waist 29", hips 39". I prefer closer fit but not skin tight — there will be a champagne toast and I\'ll be sitting a lot. Also do you recommend sizing up if I\'m between sizes for stretch crepe?',
    'With 36 / 29 / 39 and a closer-but-comfortable fit, Size M is usually safer on Seraphine stretch crepe when the bust sits near the top of S. S can work if you like compression and are ok if the bust feels snug in photos. Many customers between sizes choose M for event sitting comfort.\n\nWant me to check current stock for ivory M?',
  ],
  [
    'Yes check ivory M. Also — if it doesn\'t fit can I exchange within 14 days? Your FAQ says 7 for sale items and I\'m not sure if Seraphine is full price.',
    'I\'ll flag ivory M for Seraphine. Returns: full-price garments are often eligible for exchange within the standard window; sale / final-sale pieces can be shorter (sometimes 7 days). If you paste the product URL or confirm the price shown, I can tell you which policy applies before you buy.',
  ],
  [
    'Here is the URL path /products/seraphine-midi-ivory — it shows $189. I still feel unsure and would rather talk to someone. Please connect me with a human agent.',
    null,
  ],
];

async function createChannelTicket(company, bot, {
  source,
  customer,
  title,
  description,
  pairs,
  extra = {},
}) {
  const historyPairs = pairs.slice(0, -1);
  const lastCustomer = pairs[pairs.length - 1][0];
  const messages = buildThread(historyPairs, { customer, bot, startMinutesAgo: 200 });

  // Append the handoff-triggering customer message (AI path will handle next)
  messages.push({
    sender: customer._id,
    senderEmail: customer.email,
    body: lastCustomer,
    sentAt: minutesAgo(2),
    isInternal: false,
    isAi: false,
  });

  const ticket_code = await Ticket.generateCode(company._id, 'TKT');
  const ticket = await Ticket.create({
    ticket_code,
    company_subdomain: company.subdomain,
    company: company._id,
    ticket_title: title,
    ticket_description: description,
    source,
    status: 'open',
    priority: 'high',
    inboxFolder: 'inbox',
    createdBy: customer._id,
    assigned_agent: null,
    peoples: [{ user: customer._id, role: 'customer' }],
    details: {
      customerEmail: customer.email,
      customerType: 'shopper',
      contactReason: '',
    },
    messages,
    isUnread: true,
    lastActivity: new Date(),
    ...extra,
  });

  await Counter.increment(`company:${company._id}`, 'totalTickets').catch(() => {});
  return { ticket, lastCustomer };
}

async function seedLiveChat(company, bot, customer) {
  const ticket_code = await Ticket.generateCode(company._id, 'TKT');
  const ticket = await Ticket.create({
    ticket_code,
    company_subdomain: company.subdomain,
    company: company._id,
    ticket_title: 'Seraphine midi sizing + returns — live chat',
    ticket_description: 'Live chat conversation',
    source: 'chatbot',
    status: 'open',
    priority: 'medium',
    inboxFolder: 'inbox',
    createdBy: customer._id,
    assigned_agent: null,
    peoples: [{ user: customer._id, role: 'customer' }],
    details: { customerEmail: customer.email },
    messages: [],
    isUnread: true,
    lastActivity: new Date(),
  });

  const sessionMessages = [
    {
      role: 'bot',
      body: 'Hi! Welcome to Vastora Bridal. How can I help with your dress or order today?',
      contentType: 'text',
      senderName: 'Support Assistant',
      sentAt: minutesAgo(90),
    },
  ];

  // Historical turns (already answered by AI) — leave last human request for processCustomerMessage
  const history = LIVECHAT_PAIRS.slice(0, -1);
  let t = 80;
  for (const [customerText, botText] of history) {
    sessionMessages.push({
      role: 'customer',
      body: customerText,
      contentType: 'text',
      senderName: customer.email,
      sentAt: minutesAgo(t),
    });
    t -= 10;
    sessionMessages.push({
      role: 'bot',
      body: botText,
      contentType: 'text',
      senderName: 'Support Assistant',
      sentAt: minutesAgo(t),
    });
    t -= 8;

    await syncMessageToTicket(ticket, {
      role: 'customer',
      body: customerText,
      senderName: customer.email,
      customerUser: customer,
    });
    await syncMessageToTicket(ticket, {
      role: 'bot',
      body: botText,
      senderName: 'Support Assistant',
      customerUser: customer,
    });
    // Fix timestamps on last two ticket messages
    if (ticket.messages.length >= 2) {
      ticket.messages[ticket.messages.length - 2].sentAt = minutesAgo(t + 18);
      ticket.messages[ticket.messages.length - 1].sentAt = minutesAgo(t + 8);
      ticket.messages[ticket.messages.length - 1].isAi = true;
      ticket.messages[ticket.messages.length - 1].senderEmail = 'bot@agentra.local';
      ticket.messages[ticket.messages.length - 1].sender = bot._id;
    }
  }
  await ticket.save();

  const session = await ChatSession.create({
    company: company._id,
    ticket: ticket._id,
    sessionToken: crypto.randomBytes(24).toString('hex'),
    visitorEmail: customer.email,
    status: 'active',
    metadata: {
      pageUrl: 'https://vaptorabridal.example/products/seraphine-midi-ivory',
      origin: 'https://vaptorabridal.example',
    },
    messages: sessionMessages,
    lastActivityAt: new Date(),
  });

  const handoffText = LIVECHAT_PAIRS[LIVECHAT_PAIRS.length - 1][0];
  const result = await processCustomerMessage(company, session, handoffText);

  await syncMessageToTicket(ticket, {
    role: 'customer',
    body: handoffText,
    senderName: customer.email,
    customerUser: customer,
  });
  for (const msg of result.messages || []) {
    if (!msg.body) continue;
    await syncMessageToTicket(ticket, {
      role: msg.role === 'bot' ? 'bot' : 'system',
      body: msg.body,
      senderName: msg.senderName,
      customerUser: customer,
    });
  }

  // Reload ticket id for intelligence
  let intelligence = null;
  if (result.handoff) {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const latest = await Ticket.findById(ticket._id)
        .populate('assigned_agent', 'firstName lastName')
        .lean();
      if (latest?.aiIntelligence?.summary) {
        intelligence = {
          aiIntelligence: latest.aiIntelligence,
          assignment: latest.assigned_agent
            ? {
                assignedAgentName: [latest.assigned_agent.firstName, latest.assigned_agent.lastName]
                  .filter(Boolean)
                  .join(' '),
              }
            : null,
        };
        break;
      }
    }
  }
  if (!intelligence) {
    intelligence = await generateTicketIntelligence(company._id, ticket._id, { force: true });
  }

  const fresh = await Ticket.findById(ticket._id);

  return {
    source: 'chatbot',
    ticketCode: fresh.ticket_code,
    handoff: Boolean(result.handoff),
    assigned: intelligence?.assignment?.assignedAgentName || null,
    summary: intelligence?.aiIntelligence?.summary || null,
    urgency: intelligence?.aiIntelligence?.urgency || null,
    sessionStatus: session.status,
  };
}

async function prepareCompany(company) {
  // Allow handoff outside business-hours window for reliable demos
  if (!company.liveChat) company.liveChat = {};
  if (!company.liveChat.behavior) company.liveChat.behavior = {};
  company.liveChat.behavior.handoffOnlyInBusinessHours = false;
  company.liveChat.enabled = true;
  company.markModified('liveChat');

  if (!company.aiAgent) company.aiAgent = {};
  if (!company.aiAgent.enabledChannels) company.aiAgent.enabledChannels = {};
  company.aiAgent.enabledChannels.email = true;
  company.aiAgent.enabledChannels.whatsapp = true;
  company.aiAgent.enabledChannels.liveChat = true;
  company.markModified('aiAgent');

  await company.save();

  // Turn on full Helpdesk AI (including auto-routing)
  await updateHelpdeskAiConfig(company, {
    overview: true,
    suggestedReply: true,
    replyTools: true,
    recommendedAction: true,
    riskDetection: true,
    autoTag: true,
    autoRouting: true,
    similarTickets: true,
    customerProfile: true,
    customerTimeline: true,
    contradictions: true,
    incidentDetection: true,
    mergeSuggestions: true,
    slaPrediction: true,
    resolutionCheck: true,
    qualityAssurance: true,
    agentCoaching: true,
    managerFeed: true,
    rootCauseAnalysis: true,
    churnRecovery: true,
    knowledgeGaps: true,
    draftArticles: true,
    outdatedKnowledge: true,
  });

  return Company.findById(company._id);
}

async function runInboxHandoff(company, ticket, lastCustomer) {
  const aiResult = await processTicketAiReply(company._id, ticket._id, lastCustomer);

  // processTicketAiReply schedules intelligence async — wait, then load results.
  // If nothing landed (race / groq flake), generate once ourselves.
  let intelligence = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const latest = await Ticket.findById(ticket._id)
      .populate('assigned_agent', 'firstName lastName')
      .lean();
    if (latest?.aiIntelligence?.summary) {
      intelligence = {
        aiIntelligence: latest.aiIntelligence,
        assignment: latest.assigned_agent
          ? {
              assignedAgentName: [latest.assigned_agent.firstName, latest.assigned_agent.lastName]
                .filter(Boolean)
                .join(' '),
            }
          : null,
      };
      break;
    }
  }

  if (!intelligence) {
    intelligence = await generateTicketIntelligence(company._id, ticket._id, { force: true });
  }

  return { aiResult, intelligence };
}

async function main() {
  const subdomainArg = process.argv[2] || 'thebuildclub';
  await mongoose.connect(process.env.MONGODB_URI);

  let company = await Company.findOne({ subdomain: subdomainArg.toLowerCase(), isActive: true });
  if (!company) {
    console.error(`Workspace not found: ${subdomainArg}`);
    process.exit(1);
  }

  if (!process.env.GROQ_API_KEY) {
    console.warn('WARNING: GROQ_API_KEY is missing — AI overview may skip.');
  }

  console.log(`Preparing ${company.name} (${company.subdomain})…`);
  company = await prepareCompany(company);
  const bot = await ensureBotSender(company);

  const emailCustomer = await ensureCustomer(company, {
    email: 'amelia.chen.bridal@gmail.com',
    firstName: 'Amelia',
    lastName: 'Chen',
  });
  const waCustomer = await ensureCustomer(company, {
    email: 'sofia.martinez.wa@gmail.com',
    firstName: 'Sofia',
    lastName: 'Martinez',
  });
  const chatCustomer = await ensureCustomer(company, {
    email: 'priya.kapoor.chat@gmail.com',
    firstName: 'Priya',
    lastName: 'Kapoor',
  });

  const results = [];

  // 1) Email
  console.log('\n1/3 Email thread…');
  const email = await createChannelTicket(company, bot, {
    source: 'email',
    customer: emailCustomer,
    title: 'Order #VB-44128 — ship date + bustle (need human)',
    description: EMAIL_PAIRS[0][0].slice(0, 500),
    pairs: EMAIL_PAIRS,
    extra: {
      email: {
        fromAddress: emailCustomer.email,
        subject: 'Order #VB-44128 production delay + bustle request',
      },
    },
  });
  const emailRun = await runInboxHandoff(company, email.ticket, email.lastCustomer);
  results.push({
    source: 'email',
    ticketCode: email.ticket.ticket_code,
    handoff: Boolean(emailRun.aiResult?.handoff),
    aiSkip: emailRun.aiResult?.skipped ? emailRun.aiResult.reason : null,
    assigned: emailRun.intelligence?.assignment?.assignedAgentName || null,
    summary: emailRun.intelligence?.aiIntelligence?.summary || null,
    urgency: emailRun.intelligence?.aiIntelligence?.urgency || null,
  });

  // 2) Live chat
  console.log('2/3 Live chat…');
  results.push(await seedLiveChat(company, bot, chatCustomer));

  // 3) WhatsApp
  console.log('3/3 WhatsApp…');
  const wa = await createChannelTicket(company, bot, {
    source: 'whatsapp',
    customer: waCustomer,
    title: 'Luna Cascade rose gold — Canada express (need human)',
    description: WHATSAPP_PAIRS[0][0],
    pairs: WHATSAPP_PAIRS,
    extra: {
      whatsapp: {
        waId: '15551230987',
      },
    },
  });
  const waRun = await runInboxHandoff(company, wa.ticket, wa.lastCustomer);
  results.push({
    source: 'whatsapp',
    ticketCode: wa.ticket.ticket_code,
    handoff: Boolean(waRun.aiResult?.handoff),
    aiSkip: waRun.aiResult?.skipped ? waRun.aiResult.reason : null,
    assigned: waRun.intelligence?.assignment?.assignedAgentName || null,
    summary: waRun.intelligence?.aiIntelligence?.summary || null,
    urgency: waRun.intelligence?.aiIntelligence?.urgency || null,
  });

  console.log('\nDone. Open Inbox / AI Agent inbox:\n');
  for (const r of results) {
    console.log(
      `  [${r.source}] ${r.ticketCode}  handoff=${r.handoff}  assigned=${r.assigned || '—'}  urgency=${r.urgency || '—'}`,
    );
    if (r.summary) console.log(`           ${r.summary.slice(0, 140)}…`);
    if (r.aiSkip) console.log(`           (ai note: ${r.aiSkip})`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
