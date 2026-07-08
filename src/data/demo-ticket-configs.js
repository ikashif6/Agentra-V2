const INBOX_SOURCES = ['email', 'portal', 'instagram', 'facebook', 'whatsapp'];

const SOURCE_LABELS = {
  email: 'Email',
  portal: 'Help center',
  chat: 'Live chat',
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  chatbot: 'Chatbot',
};

const INBOX_SUBJECTS = [
  'Order has not shipped yet',
  'Wrong item received',
  'Refund request for order',
  'Cannot reset my password',
  'Delivery address change',
  'Product arrived damaged',
  'Billing charge looks incorrect',
  'Need invoice for expense report',
  'Subscription cancellation',
  'Exchange for different size',
  'Where is my tracking number?',
  'Account locked after login attempts',
  'Promo code did not apply',
  'Missing item from package',
  'Warranty claim for defective unit',
  'Bulk order pricing question',
  'Update phone number on account',
  'Return label request',
  'Late delivery compensation',
  'VIP customer escalation',
];

const CHATBOT_SUBJECTS = [
  'Can I change my delivery address?',
  'Bot could not find my order',
  'Handoff: payment failed at checkout',
  'Need human for refund policy',
  'Update subscription through chatbot',
  'Bot stuck in shipping loop',
  'Speak to agent about damaged item',
  'Chatbot could not apply discount',
  'Cancel order before it ships',
  'Track package status',
];

const LIVE_CHAT_SUBJECTS = [
  'Need help finishing checkout',
  'Question about same-day delivery',
  'Can you confirm my order details?',
  'Agent requested during live chat',
  'Sizing advice before purchase',
  'Stock availability check',
  'Help applying a discount code',
  'Change pickup location',
  'Gift wrap request',
  'Speak with support about a return',
];

const DEMO_CUSTOMERS = [
  { firstName: 'Sarah', lastName: 'Mitchell' },
  { firstName: 'Alex', lastName: 'Chen' },
  { firstName: 'Jordan', lastName: 'Lee' },
  { firstName: 'Morgan', lastName: 'Patel' },
  { firstName: 'Taylor', lastName: 'Brooks' },
  { firstName: 'Riley', lastName: 'Nguyen' },
  { firstName: 'Casey', lastName: 'Wright' },
  { firstName: 'Jamie', lastName: 'Foster' },
  { firstName: 'Avery', lastName: 'Kim' },
  { firstName: 'Quinn', lastName: 'Rivera' },
];

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

function legacyDemoTitle(source, subject) {
  return `Demo (${SOURCE_LABELS[source] || source}): ${subject}`;
}

function openingMessage(subject, source) {
  return `Hi, I need help with: ${subject.toLowerCase()}. I contacted you via ${SOURCE_LABELS[source] || source}.`;
}

function buildMessages(customerId, assigneeId, now, opening, hasAgentReply) {
  const messages = [
    {
      sender: customerId,
      body: opening,
      sentAt: new Date(now - (45 + Math.floor(Math.random() * 30)) * 60 * 1000),
    },
  ];

  if (hasAgentReply) {
    messages.push({
      sender: assigneeId,
      body: 'Thanks for reaching out. I am looking into this now and will update you shortly.',
      sentAt: new Date(now - (8 + Math.floor(Math.random() * 10)) * 60 * 1000),
    });
  }

  return messages;
}

function buildDemoConfig({
  seedKey,
  title,
  source,
  priority,
  status,
  customer,
  openingMessage: opening,
  lastActivityMinutesAgo,
  hasAgentReply = true,
  tags = ['demo'],
  legacyTitles = [],
  legacySeedKeys = [],
}) {
  return {
    seedKey,
    title,
    source,
    priority,
    status,
    tags,
    legacyTitles,
    legacySeedKeys,
    details: {
      contactReason: ['chatbot', 'chat'].includes(source) ? 'order-change' : 'shipping-delay',
      product: 'general',
    },
    customer,
    openingMessage: opening,
    lastActivityMinutesAgo,
    hasAgentReply,
    messages: (customerId, assigneeId, baseNow) =>
      buildMessages(customerId, assigneeId, baseNow, opening, hasAgentReply),
  };
}

function buildInboxDemoConfigs() {
  return Array.from({ length: 20 }, (_, index) => {
    const source = INBOX_SOURCES[index % INBOX_SOURCES.length];
    const subject = INBOX_SUBJECTS[index];
    const customer = DEMO_CUSTOMERS[index % DEMO_CUSTOMERS.length];
    const status = index < 13 ? 'open' : index < 16 ? 'in_progress' : index < 18 ? 'resolved' : 'closed';

    return buildDemoConfig({
      seedKey: `inbox-${index}`,
      title: subject,
      legacyTitles: [legacyDemoTitle(source, subject)],
      source,
      priority: PRIORITIES[index % PRIORITIES.length],
      status,
      customer,
      openingMessage: openingMessage(subject, source),
      lastActivityMinutesAgo: 10 + index * 3,
      hasAgentReply: index % 3 !== 0,
      tags: ['demo', 'inbox'],
    });
  });
}

function buildLiveChatDemoConfigs(companySubdomain) {
  return Array.from({ length: 20 }, (_, index) => {
    const source = index % 2 === 0 ? 'chatbot' : 'chat';
    const pairIndex = Math.floor(index / 2);
    const subject = source === 'chatbot'
      ? CHATBOT_SUBJECTS[pairIndex]
      : LIVE_CHAT_SUBJECTS[pairIndex];
    const customer = {
      ...DEMO_CUSTOMERS[(index + 3) % DEMO_CUSTOMERS.length],
      email: `demo.livechat.${index + 1}@${companySubdomain}.agentraa.local`,
    };
    const status = index < 15 ? 'open' : index < 18 ? 'in_progress' : 'resolved';

    return buildDemoConfig({
      seedKey: `live-chat-${index}`,
      title: subject,
      legacyTitles: [legacyDemoTitle(source, subject)],
      legacySeedKeys: [`ai-agent-${index}`],
      source,
      priority: PRIORITIES[(index + 1) % PRIORITIES.length],
      status,
      customer,
      openingMessage: openingMessage(subject, 'chat'),
      lastActivityMinutesAgo: 5 + index * 2,
      hasAgentReply: index % 4 === 0,
      tags: ['demo', 'live-chat'],
    });
  });
}

module.exports = {
  buildInboxDemoConfigs,
  buildLiveChatDemoConfigs,
  buildAiAgentDemoConfigs: buildLiveChatDemoConfigs,
};
