/**
 * Maps Agentra company/live-chat settings → chatbot WorkspaceConfig DTO.
 * Owner instructions stay priority-5 tone only — never merged into safety rules.
 */

const { mergeLiveChatConfig } = require('../live-chat-config.service');
const { resolveChannelAiConfig } = require('../ai-agent-config.service');
const { defaultPermissions } = require('../live-chat-permissions.service');
const {
  hasOnlineLiveChatAgents,
  isWithinBusinessHours,
} = require('../live-chat-hours.service');
const Company = require('../../models/Company');

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function workspaceIdForCompany(company) {
  return String(company.subdomain || company._id);
}

async function findCompanyByWorkspaceId(workspaceId) {
  const id = String(workspaceId || '').trim();
  if (!id) return null;
  if (/^[a-f0-9]{24}$/i.test(id)) {
    const byId = await Company.findById(id);
    if (byId) return byId;
  }
  return Company.findOne({ subdomain: id.toLowerCase() });
}

function scheduleToDaysAndHours(settings) {
  const schedule = settings?.schedule || {};
  const days = [];
  let start = '09:00';
  let end = '17:00';
  DAYS.forEach((key, index) => {
    const slot = schedule[key];
    if (slot?.enabled) {
      days.push(index);
      if (slot.start) start = slot.start;
      if (slot.end) end = slot.end;
    }
  });
  return {
    days: days.length ? days : [1, 2, 3, 4, 5],
    start,
    end,
    timezone: settings?.timezone || 'UTC',
  };
}

function mapFeatureFlags(permissions, channelAi) {
  const actions = channelAi?.allowedActions || {};
  return {
    product_discovery: permissions.recommendProducts !== false,
    order_lookup: permissions.viewOrders !== false,
    tracking: permissions.trackOrders !== false,
    returns: permissions.startReturns !== false,
    exchanges: Boolean(permissions.exchangeItems),
    partial_returns: permissions.startReturns !== false,
    cancellations: Boolean(permissions.cancelOrders),
    address_change: Boolean(permissions.changeDeliveryAddress),
    refund_status: true,
    initiate_refund: Boolean(permissions.issueRefunds),
    discounts: Boolean(permissions.applyDiscounts?.enabled),
    shipping_estimates: true,
    payment_help: true,
    handoff: permissions.handoffToHuman !== false,
    back_in_stock: true,
    custom_product_request: true,
    abandoned_cart: true,
    product_compare: true,
    reorder: true,
    knowledge_search: permissions.answerPolicies !== false,
    // keep unused keys explicit for chatbot contract
    ...(actions.maxRefundAmount != null ? {} : {}),
  };
}

function parseKnownCoupons(company) {
  const raw = company.liveChat?.commerce?.knownCoupons || company.settings?.knownCoupons || [];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && (c.code || c.couponCode))
    .map((c) => ({
      code: String(c.code || c.couponCode).trim().toUpperCase(),
      description: String(c.description || c.code || c.couponCode).trim(),
      percentOff: c.percentOff,
      minSubtotal: c.minSubtotal,
      freeShipping: Boolean(c.freeShipping),
    }));
}

async function buildWorkspaceConfig(company, { channel = 'web' } = {}) {
  const liveChat = mergeLiveChatConfig(company);
  const channelAi = resolveChannelAiConfig(company, 'liveChat');
  const permissions = defaultPermissions(channelAi);
  const hoursSettings = company.settings?.businessHours || {};
  const mappedHours = scheduleToDaysAndHours(hoursSettings);
  const agentsOnline = await hasOnlineLiveChatAgents(company);
  const withinHours = isWithinBusinessHours(company);
  const handoffOnlyInHours = liveChat.behavior?.handoffOnlyInBusinessHours !== false;

  const ownerText = String(channelAi.instructions || liveChat.ai?.instructions || '').trim();
  const channelInstructions = [];
  for (const key of ['liveChat', 'email', 'facebook', 'instagram', 'whatsapp', 'tiktok']) {
    const cfg = resolveChannelAiConfig(company, key);
    const text = String(cfg.instructions || '').trim();
    if (!text) continue;
    const channelName = key === 'liveChat' ? 'web' : key;
    channelInstructions.push({ channel: channelName, text });
  }

  const store = company.storeIntegration || {};
  const contactEmail =
    company.settings?.supportEmail ||
    company.settings?.notificationEmail ||
    undefined;

  return {
    workspaceId: workspaceIdForCompany(company),
    branding: {
      storeName:
        liveChat.content?.storeDisplayName ||
        company.name ||
        'Store',
      agentName: liveChat.content?.agentName || 'Support Assistant',
      widgetColor: liveChat.appearance?.brandColor || '#d85a30',
      storePublicDomain:
        store.shopify?.shopDomain ||
        store.custom?.storeUrl ||
        undefined,
      contactEmail,
      contactPhone: company.settings?.supportPhone || undefined,
      welcomeMessage: liveChat.content?.welcomeMessage || undefined,
    },
    businessHours: {
      timezone: mappedHours.timezone,
      days: mappedHours.days,
      start: mappedHours.start,
      end: mappedHours.end,
      agentsAvailable: agentsOnline && (!handoffOnlyInHours || withinHours),
    },
    features: mapFeatureFlags(permissions, channelAi),
    commerce: {
      knownCoupons: parseKnownCoupons(company),
      returnWindowDays: Number(company.liveChat?.commerce?.returnWindowDays || 14) || 14,
    },
    knowledge: {
      mode: 'agentra',
    },
    ownerInstructions: ownerText
      ? {
          text: ownerText,
          tone: undefined,
          responseLength: 'short',
        }
      : undefined,
    channelInstructions: channelInstructions.length ? channelInstructions : undefined,
    allowDemoSandboxData: false,
    source: 'agentra',
    // Agentra-only metadata (ignored by chatbot if unknown)
    meta: {
      companyId: String(company._id),
      channel,
      maxRefundAmount: permissions.maxRefundAmount,
      storeProvider: store.provider || null,
      storeStatus: store.status || 'disconnected',
    },
  };
}

module.exports = {
  workspaceIdForCompany,
  findCompanyByWorkspaceId,
  buildWorkspaceConfig,
};
