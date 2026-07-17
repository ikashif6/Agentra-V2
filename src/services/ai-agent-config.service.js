const { mergeLiveChatConfig } = require('./live-chat-config.service');

const AI_CHANNEL_KEYS = ['liveChat', 'email', 'facebook', 'instagram', 'whatsapp', 'tiktok'];

const DEFAULT_ENABLED_CHANNELS = {
  liveChat: true,
  email: false,
  facebook: false,
  instagram: false,
  whatsapp: false,
  tiktok: false,
};

/** Built-in tone/length guidance always layered into the system prompt per channel. */
const CHANNEL_STYLE_GUIDANCE = {
  liveChat:
    'Channel: live chat. Keep replies short (2–4 sentences). Conversational and clear. Prefer bullets only when listing steps.',
  email:
    'Channel: email. Write polished, professional replies. Use short paragraphs, cover the request fully, and end with a clear next step or offer to help further.',
  facebook:
    'Channel: Facebook Messenger. Friendly and brief. Keep messages scannable on mobile (a few short sentences). Avoid long policy essays.',
  instagram:
    'Channel: Instagram DM. Casual, warm, and concise. Short replies fit the channel; link out only when needed.',
  whatsapp:
    'Channel: WhatsApp. Concise and helpful. Mobile-friendly length; one idea per message when possible.',
  tiktok:
    'Channel: TikTok. Very short, casual, and on-brand. Keep answers tight for mobile; escalate complex order issues quickly.',
};

const CHANNEL_INSTRUCTION_PLACEHOLDERS = {
  liveChat:
    'Example: Greet briefly. Confirm order number before sharing tracking. Offer human help if the customer seems frustrated.',
  email:
    'Example: Open with a polite greeting and the order/ticket context. Explain policies clearly. Avoid slang. Suggest a reply if more info is needed.',
  facebook:
    'Example: Match a friendly messenger tone. Keep answers under a few sentences. Escalate refunds instead of processing them automatically.',
  instagram:
    'Example: Stay short and warm. Use plain language. Point to the help center for long policies.',
  whatsapp:
    'Example: Keep it conversational. Confirm you have the right order before giving details. Prefer yes/no clarity over long paragraphs.',
  tiktok:
    'Example: Keep it punchy and friendly. Avoid long policy dumps. Hand off to a human for refunds or shipping disputes.',
};

const ACTION_KEYS = [
  'lookupOrder',
  'cancelOrder',
  'refundOrder',
  'maxRefundAmount',
  'editOrder',
  'productRecommendations',
  'requestHuman',
];

/** Map Ticket.source → aiAgent.enabledChannels key */
function channelKeyFromTicketSource(source) {
  switch (source) {
    case 'chatbot':
    case 'chat':
      return 'liveChat';
    case 'email':
      return 'email';
    case 'facebook':
      return 'facebook';
    case 'instagram':
      return 'instagram';
    case 'whatsapp':
      return 'whatsapp';
    case 'tiktok':
      return 'tiktok';
    default:
      return null;
  }
}

function emptyOverridesMap() {
  return Object.fromEntries(AI_CHANNEL_KEYS.map((key) => [key, null]));
}

function readOverride(company, channelKey) {
  const value = company.aiAgent?.channelOverrides?.[channelKey];
  if (!value || typeof value !== 'object') return null;
  const plain = value.toObject?.() ?? value;
  const hasInstructions = plain.instructions !== undefined && plain.instructions !== null;
  const hasKeywords = Array.isArray(plain.escalationKeywords);
  const hasActions =
    plain.allowedActions &&
    typeof plain.allowedActions === 'object' &&
    ACTION_KEYS.some((k) => plain.allowedActions[k] !== undefined && plain.allowedActions[k] !== null);
  if (!hasInstructions && !hasKeywords && !hasActions) return null;
  return plain;
}

function packOverride(plain) {
  if (!plain || typeof plain !== 'object') return null;
  const packed = {};
  if (plain.instructions !== undefined && plain.instructions !== null) {
    packed.instructions = String(plain.instructions || '');
  }
  if (Array.isArray(plain.escalationKeywords)) {
    packed.escalationKeywords = plain.escalationKeywords.map(String).filter(Boolean);
  }
  if (plain.allowedActions && typeof plain.allowedActions === 'object') {
    packed.allowedActions = {};
    for (const actionKey of ACTION_KEYS) {
      if (plain.allowedActions[actionKey] !== undefined && plain.allowedActions[actionKey] !== null) {
        packed.allowedActions[actionKey] = plain.allowedActions[actionKey];
      }
    }
    if (!Object.keys(packed.allowedActions).length) delete packed.allowedActions;
  }
  return Object.keys(packed).length ? packed : null;
}

function serializeOverrides(company) {
  const out = emptyOverridesMap();
  for (const key of AI_CHANNEL_KEYS) {
    out[key] = packOverride(readOverride(company, key));
  }
  return out;
}

function getDefaultsFromCompany(company) {
  const liveChat = mergeLiveChatConfig(company);
  return {
    instructions: liveChat.ai?.instructions || '',
    escalationKeywords: [...(liveChat.ai?.escalationKeywords || [])],
    allowedActions: { ...(liveChat.ai?.allowedActions || {}) },
  };
}

/**
 * Resolve effective AI brain for a channel: shared defaults + sparse overrides + style guidance.
 */
function resolveChannelAiConfig(company, channelKey) {
  const liveChat = mergeLiveChatConfig(company);
  const defaults = getDefaultsFromCompany(company);
  const plain = readOverride(company, channelKey) || {};

  const instructions =
    plain.instructions !== undefined && plain.instructions !== null
      ? String(plain.instructions || '')
      : defaults.instructions;

  const escalationKeywords = Array.isArray(plain.escalationKeywords)
    && plain.escalationKeywords.map(String).filter(Boolean).length
    ? plain.escalationKeywords.map(String).filter(Boolean)
    : defaults.escalationKeywords;

  const allowedActions = {
    ...defaults.allowedActions,
    ...(plain.allowedActions && typeof plain.allowedActions === 'object' ? plain.allowedActions : {}),
  };

  const styleGuidance =
    (channelKey && CHANNEL_STYLE_GUIDANCE[channelKey]) || CHANNEL_STYLE_GUIDANCE.liveChat;

  return {
    channelKey: channelKey || null,
    agentName: liveChat.content?.agentName || 'Support Assistant',
    offlineMessage: liveChat.content?.offlineMessage || '',
    instructions,
    escalationKeywords,
    allowedActions,
    styleGuidance,
    requireOrderVerification: Boolean(liveChat.behavior?.requireOrderVerification),
    handoffOnlyInBusinessHours: Boolean(liveChat.behavior?.handoffOnlyInBusinessHours),
    liveChatAiEnabled: liveChat.ai?.enabled !== false,
  };
}

function getAiAgentConfig(company, channelKey = null) {
  const liveChat = mergeLiveChatConfig(company);
  const stored = company.aiAgent || {};
  const channels = { ...DEFAULT_ENABLED_CHANNELS, ...(stored.enabledChannels || {}) };
  const defaults = getDefaultsFromCompany(company);
  const channelOverrides = serializeOverrides(company);

  const base = {
    enabledChannels: channels,
    defaults,
    channelOverrides,
    instructionPlaceholders: CHANNEL_INSTRUCTION_PLACEHOLDERS,
    instructions: defaults.instructions,
    escalationKeywords: defaults.escalationKeywords,
    allowedActions: defaults.allowedActions,
    agentName: liveChat.content?.agentName || 'Support Assistant',
    offlineMessage: liveChat.content?.offlineMessage || '',
    requireOrderVerification: Boolean(liveChat.behavior?.requireOrderVerification),
    handoffOnlyInBusinessHours: Boolean(liveChat.behavior?.handoffOnlyInBusinessHours),
    liveChatAiEnabled: liveChat.ai?.enabled !== false,
    assistantConfigVersion: Number(stored.assistantConfigVersion) > 0 ? Number(stored.assistantConfigVersion) : 1,
    assistantEngine: stored.assistantEngine || null,
  };

  if (channelKey && AI_CHANNEL_KEYS.includes(channelKey)) {
    return {
      ...base,
      ...resolveChannelAiConfig(company, channelKey),
      enabledChannels: channels,
      defaults,
      channelOverrides,
    };
  }

  return base;
}

function isChannelAiEnabled(company, channelKey) {
  if (!channelKey || !AI_CHANNEL_KEYS.includes(channelKey)) return false;
  const config = getAiAgentConfig(company);
  if (channelKey === 'liveChat' && !config.liveChatAiEnabled) return false;
  return Boolean(config.enabledChannels[channelKey]);
}

function ensureAiAgent(company) {
  if (!company.aiAgent) {
    company.aiAgent = { enabledChannels: { ...DEFAULT_ENABLED_CHANNELS }, channelOverrides: {} };
  }
  if (!company.aiAgent.enabledChannels) {
    company.aiAgent.enabledChannels = { ...DEFAULT_ENABLED_CHANNELS };
  }
  if (!company.aiAgent.channelOverrides) {
    company.aiAgent.channelOverrides = {};
  }
}

function setChannelOverride(company, channelKey, patch) {
  ensureAiAgent(company);

  if (patch === null) {
    company.aiAgent.channelOverrides[channelKey] = undefined;
    delete company.aiAgent.channelOverrides[channelKey];
    return;
  }

  const current = packOverride(readOverride(company, channelKey)) || {};
  const next = { ...current };

  if (Object.prototype.hasOwnProperty.call(patch, 'instructions')) {
    if (patch.instructions === null) {
      delete next.instructions;
    } else {
      next.instructions = String(patch.instructions || '');
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'escalationKeywords')) {
    if (patch.escalationKeywords === null) {
      delete next.escalationKeywords;
    } else if (Array.isArray(patch.escalationKeywords)) {
      next.escalationKeywords = patch.escalationKeywords.map(String).filter(Boolean);
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'allowedActions')) {
    if (patch.allowedActions === null) {
      delete next.allowedActions;
    } else if (patch.allowedActions && typeof patch.allowedActions === 'object') {
      next.allowedActions = { ...(current.allowedActions || {}) };
      for (const actionKey of ACTION_KEYS) {
        if (patch.allowedActions[actionKey] === null) {
          delete next.allowedActions[actionKey];
        } else if (patch.allowedActions[actionKey] !== undefined) {
          next.allowedActions[actionKey] = patch.allowedActions[actionKey];
        }
      }
      if (!Object.keys(next.allowedActions).length) delete next.allowedActions;
    }
  }

  const packed = packOverride(next);
  if (!packed) {
    setChannelOverride(company, channelKey, null);
    return;
  }

  company.aiAgent.channelOverrides[channelKey] = packed;
}

async function updateAiAgentConfig(company, body = {}) {
  ensureAiAgent(company);

  if (body.enabledChannels && typeof body.enabledChannels === 'object') {
    for (const key of AI_CHANNEL_KEYS) {
      if (body.enabledChannels[key] !== undefined) {
        company.aiAgent.enabledChannels[key] = Boolean(body.enabledChannels[key]);
      }
    }
  }

  // Shared defaults stay on liveChat.ai so Live chat settings and AI Agent stay in sync.
  if (!company.liveChat) company.liveChat = {};
  if (!company.liveChat.ai) company.liveChat.ai = {};

  if (body.defaults && typeof body.defaults === 'object') {
    if (body.defaults.instructions !== undefined) {
      company.liveChat.ai.instructions = String(body.defaults.instructions || '');
    }
    if (Array.isArray(body.defaults.escalationKeywords)) {
      company.liveChat.ai.escalationKeywords = body.defaults.escalationKeywords
        .map(String)
        .filter(Boolean);
    }
    if (body.defaults.allowedActions && typeof body.defaults.allowedActions === 'object') {
      company.liveChat.ai.allowedActions = {
        ...(company.liveChat.ai.allowedActions || {}),
        ...body.defaults.allowedActions,
      };
    }
  } else {
    if (body.instructions !== undefined) {
      company.liveChat.ai.instructions = String(body.instructions || '');
    }
    if (Array.isArray(body.escalationKeywords)) {
      company.liveChat.ai.escalationKeywords = body.escalationKeywords.map(String).filter(Boolean);
    }
    if (body.allowedActions && typeof body.allowedActions === 'object') {
      company.liveChat.ai.allowedActions = {
        ...(company.liveChat.ai.allowedActions || {}),
        ...body.allowedActions,
      };
    }
  }

  if (body.liveChatAiEnabled !== undefined) {
    company.liveChat.ai.enabled = Boolean(body.liveChatAiEnabled);
  }

  if (body.channelOverrides && typeof body.channelOverrides === 'object') {
    for (const key of AI_CHANNEL_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(body.channelOverrides, key)) continue;
      setChannelOverride(company, key, body.channelOverrides[key]);
    }
  }

  company.markModified('aiAgent');
  company.markModified('liveChat');
  await company.save();
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1 && company._id) {
      const { bumpAssistantConfigVersion } = require('./assistant-engine/assistant-config-version.service');
      const { clearRuntimeConfigCache } = require('./assistant-engine/assistant-runtime-config.service');
      await bumpAssistantConfigVersion(company._id, 'ai_agent_settings');
      clearRuntimeConfigCache(String(company._id));
      const refreshed = await require('../models/Company')
        .findById(company._id)
        .select('aiAgent.assistantConfigVersion');
      if (refreshed?.aiAgent?.assistantConfigVersion != null) {
        company.aiAgent = company.aiAgent || {};
        company.aiAgent.assistantConfigVersion = refreshed.aiAgent.assistantConfigVersion;
      }
    }
  } catch (err) {
    console.warn('[ai-agent-config] version bump failed', err.message);
  }
  return getAiAgentConfig(company);
}

module.exports = {
  AI_CHANNEL_KEYS,
  DEFAULT_ENABLED_CHANNELS,
  CHANNEL_STYLE_GUIDANCE,
  CHANNEL_INSTRUCTION_PLACEHOLDERS,
  channelKeyFromTicketSource,
  getAiAgentConfig,
  resolveChannelAiConfig,
  isChannelAiEnabled,
  updateAiAgentConfig,
};
