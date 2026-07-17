/**
 * Fresh per-turn workspace + channel runtime configuration.
 * Cache is keyed by workspaceId + channel + assistantConfigVersion only.
 */

const { mergeLiveChatConfig } = require('../live-chat-config.service');
const { resolveChannelAiConfig, isChannelAiEnabled } = require('../ai-agent-config.service');
const { mapAllowedActionsToCapabilities } = require('./assistant-capability.service');
const {
  readAssistantConfigVersion,
  readAssistantEngineMode,
} = require('./assistant-config-version.service');

/** @type {Map<string, { expires: number, value: object }>} */
const cache = new Map();
const CACHE_TTL_MS = Number(process.env.ASSISTANT_RUNTIME_CONFIG_CACHE_MS || 5000);

function cacheKey(workspaceId, channel, version) {
  return `${workspaceId}:${channel}:${version}`;
}

function normalizeRuntimeConfig(company, channel = 'liveChat') {
  const channelKey = channel || 'liveChat';
  const liveChat = mergeLiveChatConfig(company);
  const channelAi = resolveChannelAiConfig(company, channelKey);
  const version = readAssistantConfigVersion(company);
  const capabilities = mapAllowedActionsToCapabilities(channelAi.allowedActions || {}, {
    currency: company.currency || 'USD',
  });

  const sharedInstructions = String(liveChat.ai?.instructions || '');
  const channelInstructions = String(channelAi.instructions || '');
  const combinedBehavioralGuidance = [
    channelAi.styleGuidance || '',
    sharedInstructions && channelInstructions && sharedInstructions !== channelInstructions
      ? `Shared guidance:\n${sharedInstructions}`
      : '',
    channelInstructions ? `Channel guidance:\n${channelInstructions}` : sharedInstructions,
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim();

  const storeStatus = company.storeIntegration?.status || 'disconnected';
  const provider = company.storeIntegration?.provider || null;

  return {
    workspaceId: String(company._id),
    workspaceName: company.name || 'Store',
    channel: channelKey,
    assistantConfigVersion: version,
    assistantEngine: readAssistantEngineMode(company),
    currency: company.currency || 'USD',
    locale: company.locale || 'en',
    timezone: company.timezone || company.settings?.businessHours?.timezone || 'UTC',
    agentName: channelAi.agentName || liveChat.content?.agentName || 'Support Assistant',
    offlineMessage: channelAi.offlineMessage || liveChat.content?.offlineMessage || '',
    channelAiEnabled: isChannelAiEnabled(company, channelKey),
    liveChatAiEnabled: liveChat.ai?.enabled !== false,
    sharedInstructions,
    channelInstructions,
    combinedBehavioralGuidance,
    styleGuidance: channelAi.styleGuidance || '',
    escalationKeywords: [...(channelAi.escalationKeywords || [])],
    allowedActions: { ...(channelAi.allowedActions || {}) },
    capabilities,
    requireOrderVerification: Boolean(channelAi.requireOrderVerification),
    handoffOnlyInBusinessHours: Boolean(channelAi.handoffOnlyInBusinessHours),
    behavior: {
      typingIndicator: liveChat.behavior?.typingIndicator !== false,
      retrievalIndicator: liveChat.behavior?.retrievalIndicator !== false,
      requireEmailBeforeChat: Boolean(liveChat.behavior?.requireEmailBeforeChat),
      requireOrderVerification: Boolean(liveChat.behavior?.requireOrderVerification),
      handoffOnlyInBusinessHours: Boolean(liveChat.behavior?.handoffOnlyInBusinessHours),
    },
    knowledgeEnabled: true,
    businessHours: company.settings?.businessHours || { enabled: false },
    integrations: {
      storeStatus,
      provider,
      catalogueAvailable: storeStatus === 'connected',
      orderLookupAvailable: storeStatus === 'connected',
    },
    liveChatConfig: liveChat,
    channelAi,
  };
}

/**
 * Load runtime config for a turn. Prefer a fresh company document when possible.
 */
function loadRuntimeConfig(company, channel = 'liveChat', { bypassCache = false } = {}) {
  const version = readAssistantConfigVersion(company);
  const workspaceId = String(company._id);
  const key = cacheKey(workspaceId, channel, version);
  if (!bypassCache) {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
  }
  const value = normalizeRuntimeConfig(company, channel);
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
  return value;
}

function clearRuntimeConfigCache(workspaceId = null) {
  if (!workspaceId) {
    cache.clear();
    return;
  }
  const prefix = `${workspaceId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

module.exports = {
  loadRuntimeConfig,
  normalizeRuntimeConfig,
  clearRuntimeConfigCache,
  cacheKey,
};
