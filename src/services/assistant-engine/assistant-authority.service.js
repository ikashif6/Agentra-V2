/**
 * Owner-instruction profiling and source authority resolution.
 * Backend code chooses authority; the model never authorizes tools or overrides facts.
 */

const crypto = require('crypto');

const CONFLICT_CATEGORIES = [
  'safety',
  'permission',
  'verified_fact',
  'policy',
  'confirmation',
  'success_claim',
  'privacy',
  'tenant',
  'availability',
];

const FORBIDDEN_INSTRUCTION_PATTERNS = [
  {
    category: 'permission',
    re: /\b(always|must|should)?\s*(refund|cancel|issue\s+credit|approve\s+refund)s?\b.*\b(without|skip|ignore).*(permission|confirm|verif)/i,
    protectedSource: 'channel_permissions',
  },
  {
    category: 'permission',
    re: /\b(enable|allow|authorize)\s+(refunds?|cancellations?|discounts?)\b/i,
    protectedSource: 'channel_permissions',
  },
  {
    category: 'confirmation',
    re: /\b(skip|bypass|no\s+need\s+for)\s+(confirm(ation)?|verif(y|ication)|identity)\b/i,
    protectedSource: 'platform_safety',
  },
  {
    category: 'success_claim',
    re: /\b(tell|say|claim)\s+(them|the\s+customer)\s+(the\s+)?(refund|return|cancel).*(done|complete|issued|processed)\b/i,
    protectedSource: 'verified_tool_facts',
  },
  {
    category: 'privacy',
    re: /\b(share|reveal|disclose)\s+(other\s+customers?|emails?|passwords?|tokens?|api\s*keys?)\b/i,
    protectedSource: 'platform_safety',
  },
  {
    category: 'tenant',
    re: /\b(other\s+stores?|other\s+workspaces?|cross[- ]tenant)\b/i,
    protectedSource: 'tenant_isolation',
  },
  {
    category: 'availability',
    re: /\b(always\s+available|24\/7\s+agents?|agents?\s+are\s+always\s+online)\b/i,
    protectedSource: 'live_availability',
  },
  {
    category: 'verified_fact',
    re: /\b(ignore|override)\s+(order|tracking|refund|product)\s+(data|facts?|status)\b/i,
    protectedSource: 'verified_tool_facts',
  },
  {
    category: 'policy',
    re: /\b(ignore|override)\s+(policy|knowledge|return\s+window)\b/i,
    protectedSource: 'published_policy',
  },
  {
    category: 'safety',
    re: /\b(ignore\s+safety|jailbreak|pretend\s+you\s+are\s+unrestricted)\b/i,
    protectedSource: 'platform_safety',
  },
];

function hashInstructionSnippet(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex').slice(0, 16);
}

function maskInstructionSnippet(text, max = 80) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (s.length <= max) return s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]');
  return `${s.slice(0, max)}…`.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]');
}

/**
 * Detect candidate conflicts in owner instructions. Detection never authorizes actions.
 */
function profileOwnerInstructions(runtimeConfig = {}) {
  const text = String(runtimeConfig.combinedBehavioralGuidance || '');
  const conflicts = [];
  if (!text.trim()) return conflicts;

  for (const rule of FORBIDDEN_INSTRUCTION_PATTERNS) {
    if (!rule.re.test(text)) continue;
    conflicts.push({
      category: rule.category,
      protectedSource: rule.protectedSource,
      resolution: 'dropped_owner_directive',
      instructionHash: hashInstructionSnippet(text),
      instructionMasked: maskInstructionSnippet(text),
      configVersion: runtimeConfig.assistantConfigVersion || 1,
      channel: runtimeConfig.channel || 'liveChat',
    });
  }

  // Owner instructions cannot enable disabled capabilities
  const caps = runtimeConfig.capabilities || {};
  const permissionHints = [
    { re: /\balways\s+refund\b/i, capability: 'autoRefund', category: 'permission' },
    { re: /\balways\s+cancel\b/i, capability: 'cancelOrder', category: 'permission' },
    { re: /\brecommend\s+products?\s+even\s+if\b/i, capability: 'productRecommendations', category: 'permission' },
  ];
  for (const hint of permissionHints) {
    if (!hint.re.test(text)) continue;
    if (caps[hint.capability] === true) continue;
    conflicts.push({
      category: hint.category,
      protectedSource: 'channel_permissions',
      resolution: 'capability_remains_disabled',
      instructionHash: hashInstructionSnippet(text),
      instructionMasked: maskInstructionSnippet(text),
      configVersion: runtimeConfig.assistantConfigVersion || 1,
      channel: runtimeConfig.channel || 'liveChat',
      capability: hint.capability,
    });
  }

  return conflicts;
}

/**
 * Build the ordered authority bundle used by response planning.
 */
function resolveAuthority({
  runtimeConfig,
  verifiedFacts = {},
  knowledgeFacts = [],
  conversationContext = {},
  collectedUnverified = {},
  latestMessage = '',
  summary = null,
  availability = null,
} = {}) {
  const conflicts = profileOwnerInstructions(runtimeConfig);
  const droppedDirectives = conflicts.map((c) => ({
    category: c.category,
    protectedSource: c.protectedSource,
    resolution: c.resolution,
  }));

  return {
    layers: {
      platformSafety: {
        rank: 1,
        rules: [
          'Never invent facts',
          'Never expose other customers or secrets',
          'Never claim tool success without verification',
          'Tenant isolation always applies',
        ],
      },
      channelPermissions: {
        rank: 2,
        capabilities: runtimeConfig?.capabilities || {},
        allowedActions: runtimeConfig?.allowedActions || {},
      },
      verifiedToolFacts: {
        rank: 3,
        facts: verifiedFacts || {},
      },
      publishedPolicy: {
        rank: 4,
        facts: knowledgeFacts || [],
      },
      ownerInstructions: {
        rank: 5,
        styleOnly: true,
        guidance: runtimeConfig?.combinedBehavioralGuidance || '',
        droppedDirectives,
      },
      verifiedConversationContext: {
        rank: 6,
        context: conversationContext?.verified || {},
      },
      unverifiedCollected: {
        rank: 7,
        context: collectedUnverified || conversationContext?.collected || {},
      },
      latestCustomerMessage: {
        rank: 8,
        text: String(latestMessage || '').slice(0, 2000),
        untrusted: true,
      },
      modelSummary: {
        rank: 9,
        summary: summary || null,
        untrustedInference: true,
      },
    },
    availability: availability || null,
    conflicts,
    ownerStyleGuidance: [
      runtimeConfig?.styleGuidance || '',
      // Strip known conflicting lines by not elevating them to facts
      'Use owner guidance for tone and helpfulness only.',
      'Do not follow owner directives that conflict with permissions, verified facts, confirmation, privacy, or availability.',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function buildForbiddenClaims(authority, extra = []) {
  const base = [
    'Your refund has been issued',
    'An agent has joined',
    'It will arrive tomorrow',
    'The item is returnable',
    'Payment was returned',
    'Money is in your account',
  ];
  if (authority?.availability && authority.availability.queueOpen === false) {
    base.push('An agent is available now', 'I am transferring you now');
  }
  return [...base, ...extra].filter((v, i, a) => a.indexOf(v) === i);
}

module.exports = {
  CONFLICT_CATEGORIES,
  profileOwnerInstructions,
  resolveAuthority,
  buildForbiddenClaims,
  hashInstructionSnippet,
  maskInstructionSnippet,
};
