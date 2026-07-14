const crypto = require('crypto');
const {
  configuredShopifyScriptTagsScope,
  shopifyScopesIncludeScriptTags,
} = require('./store-oauth.service');

const DEFAULT_LIVE_CHAT = {
  enabled: false,
  appearance: {
    brandColor: '#2563eb',
    backgroundColor: '#ffffff',
    fontFamily: 'Sora',
    logoSize: 'medium',
    logoWidth: 120,
    logoHeight: 40,
    position: 'bottom-right',
    launcherOffsetX: 20,
    launcherOffsetY: 20,
    showBranding: true,
  },
  content: {
    agentName: 'Support Assistant',
    welcomeTitle: 'Hi there 👋\nHow can we help?',
    welcomeSubtitle: 'Ask about orders, products, returns & store support.',
    welcomeMessage: "I'm here to help with orders, products, and store questions.",
    emailGateTitle: 'Start a conversation',
    emailGateSubtitle: 'Enter your email so we can help you with your orders.',
    offlineMessage:
      'Our team is currently away. The assistant can still help, or you can leave a message.',
    quickReplies: [
      'Where is my order?',
      'Return or refund policy',
      'Talk to a human',
      'Product recommendations',
    ],
  },
  behavior: {
    typingIndicator: true,
    retrievalIndicator: true,
    requireEmailBeforeChat: true,
    requireOrderVerification: true,
    handoffOnlyInBusinessHours: true,
  },
  ai: {
    enabled: true,
    instructions: '',
    escalationKeywords: ['human', 'agent', 'representative', 'speak to someone', 'manager'],
    allowedActions: {
      lookupOrder: true,
      cancelOrder: false,
      refundOrder: true,
      maxRefundAmount: 100,
      editOrder: false,
      productRecommendations: true,
      requestHuman: true,
    },
  },
  allowedOrigins: [],
  agents: [],
};

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  const out = { ...base };
  for (const key of Object.keys(patch)) {
    const val = patch[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      out[key] = deepMerge(base[key] || {}, val);
    } else if (val !== undefined) {
      out[key] = val;
    }
  }
  return out;
}

function generateWidgetKey() {
  return `wk_${crypto.randomBytes(16).toString('hex')}`;
}

const TEAM_AGENT_COLORS = ['#a78bfa', '#f97316', '#22c55e', '#3b82f6', '#ec4899'];

function agentInitials(user) {
  const first = String(user?.firstName || '').trim();
  const last = String(user?.lastName || '').trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (last) return last.slice(0, 2).toUpperCase();
  return 'A';
}

function mapLiveChatAgents(company, apiOrigin) {
  const raw = company.liveChat?.agents || [];
  const toAbsolute = (url) => {
    if (!url) return null;
    if (!apiOrigin) return url;
    return String(url).startsWith('http') ? url : `${apiOrigin}${url}`;
  };
  return raw
    .filter((u) => u && typeof u === 'object' && u._id && u.firstName)
    .filter((u) => u.isActive !== false)
    .slice(0, 8)
    .map((u, i) => ({
      _id: String(u._id),
      firstName: u.firstName,
      lastName: u.lastName || '',
      fullName: `${u.firstName} ${u.lastName || ''}`.trim(),
      avatar: toAbsolute(u.avatar) || undefined,
      role: u.role,
      isOnline: Boolean(u.isOnline),
      initials: agentInitials(u),
      color: TEAM_AGENT_COLORS[i % TEAM_AGENT_COLORS.length],
    }));
}

function mergeLiveChatConfig(company) {
  const stored = company.liveChat?.toObject?.() ?? company.liveChat ?? {};
  return deepMerge(DEFAULT_LIVE_CHAT, stored);
}

function sanitizeLiveChatForSettings(company, apiBase) {
  const config = mergeLiveChatConfig(company);
  const widgetKey = company.liveChat?.widgetKey || null;
  const embedSnippet = widgetKey
    ? `<script>
  window.AgentraConfig = {
    widgetKey: "${widgetKey}",
    apiBase: "${apiBase}/widget"
  };
</script>
<script src="${apiBase.replace(/\/api\/v1$/, '')}/widget.js" async></script>`
    : null;

  return {
    enabled: Boolean(config.enabled),
    widgetKey,
    widgetInstalled: Boolean(company.liveChat?.widgetInstalled),
    installMethod: company.liveChat?.installMethod || null,
    canAutoInstall:
      company.storeIntegration?.provider === 'shopify' &&
      company.storeIntegration?.status === 'connected' &&
      configuredShopifyScriptTagsScope() &&
      shopifyScopesIncludeScriptTags(company.storeIntegration?.shopify?.scope),
    shopifyAutoInstallPending:
      company.storeIntegration?.provider === 'shopify' &&
      company.storeIntegration?.status === 'connected' &&
      !(
        configuredShopifyScriptTagsScope() &&
        shopifyScopesIncludeScriptTags(company.storeIntegration?.shopify?.scope)
      ),
    storeProvider: company.storeIntegration?.provider || null,
    storeConnected: company.storeIntegration?.status === 'connected',
    allowedOrigins: config.allowedOrigins || [],
    appearance: config.appearance,
    content: {
      ...config.content,
      storeDisplayName:
        config.content?.storeDisplayName ||
        company.storeIntegration?.shopify?.shopName ||
        company.storeIntegration?.woocommerce?.storeName ||
        company.storeIntegration?.custom?.storeName ||
        company.name,
    },
    behavior: config.behavior,
    ai: config.ai,
    agents: mapLiveChatAgents(company, apiBase ? apiBase.replace(/\/api\/v1$/, '') : null),
    connectedAt: company.liveChat?.connectedAt || null,
    lastError: company.liveChat?.lastError || null,
    embedSnippet,
  };
}

function buildPublicWidgetConfig(company, req) {
  const config = mergeLiveChatConfig(company);
  const apiOrigin = `${req.protocol}://${req.get('host')}`;
  const logoUrl = config.appearance?.logoUrl || company.logo || null;
  const faviconUrl = config.appearance?.faviconUrl || null;
  const toAbsolute = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${apiOrigin}${url}`;
  };

  return {
    enabled: Boolean(config.enabled),
    agentName: config.content.agentName,
    storeName: config.content.storeDisplayName || company.name,
    widgetColor: config.appearance.brandColor,
    backgroundColor: config.appearance.backgroundColor || '#ffffff',
    fontFamily: config.appearance.fontFamily,
    logoUrl: toAbsolute(logoUrl),
    faviconUrl: toAbsolute(faviconUrl),
    logoSize: config.appearance.logoSize || 'medium',
    logoWidth: Number(config.appearance.logoWidth) || 120,
    logoHeight: Number(config.appearance.logoHeight) || 40,
    position: config.appearance.position,
    launcherOffsetX: config.appearance.launcherOffsetX,
    launcherOffsetY: config.appearance.launcherOffsetY,
    welcomeTitle: config.content.welcomeTitle,
    welcomeSubtitle: config.content.welcomeSubtitle,
    welcomeMsg: config.content.welcomeMessage,
    emailGateTitle: config.content.emailGateTitle,
    emailGateSubtitle: config.content.emailGateSubtitle,
    offlineMessage: config.content.offlineMessage,
    quickReplies: (config.content.quickReplies || []).slice(0, 4),
    showBranding: config.appearance.showBranding,
    behavior: config.behavior,
    teamAgents: mapLiveChatAgents(company, apiOrigin).slice(0, 5).map((a) => ({
      initials: a.initials,
      name: a.fullName,
      avatarUrl: a.avatar || null,
      color: a.color,
    })),
    isActive: Boolean(config.enabled && config.ai?.enabled),
    wsUrl: `${apiOrigin.replace(/^http/, 'ws')}/api/v1/widget/ws`,
  };
}

function hostnameFromUrl(value) {
  if (!value) return null;
  try {
    const withProto = String(value).includes('://') ? String(value) : `https://${value}`;
    return new URL(withProto).hostname.toLowerCase();
  } catch {
    return String(value)
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .toLowerCase() || null;
  }
}

/** Domains for the connected storefront — no manual allow-list in settings. */
function connectedStoreDomains(company) {
  const integration = company.storeIntegration;
  if (!integration || integration.status !== 'connected') return [];

  if (integration.provider === 'shopify') {
    const domains = [];
    const shop = hostnameFromUrl(integration.shopify?.shopDomain);
    const primary = hostnameFromUrl(integration.shopify?.primaryDomain);
    if (shop) domains.push(shop);
    if (primary) domains.push(primary);
    return [...new Set(domains)];
  }

  if (integration.provider === 'woocommerce') {
    const host = hostnameFromUrl(integration.woocommerce?.storeUrl);
    return host ? [host] : [];
  }

  if (integration.provider === 'custom') {
    const host = hostnameFromUrl(integration.custom?.storeUrl);
    return host ? [host] : [];
  }

  return [];
}

function isOriginAllowed(company, origin) {
  if (!origin) return true;
  // Access is gated by widgetKey; domain list is a soft bound to the connected store.
  const allowed = connectedStoreDomains(company);
  if (!allowed.length) return true;

  // Shopify custom storefront domains (e.g. brand.com) aren't always stored — allow any
  // origin when we only know the .myshopify.com admin hostname.
  const integration = company.storeIntegration;
  if (integration?.provider === 'shopify') {
    const onlyMyshopify =
      allowed.length > 0 && allowed.every((d) => d.endsWith('.myshopify.com'));
    const hasPrimary = Boolean(hostnameFromUrl(integration.shopify?.primaryDomain));
    if (onlyMyshopify && !hasPrimary) return true;
  }

  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return allowed.some((entry) => {
      if (hostname === entry) return true;
      return hostname.endsWith(`.${entry}`);
    });
  } catch {
    return false;
  }
}

module.exports = {
  DEFAULT_LIVE_CHAT,
  generateWidgetKey,
  mergeLiveChatConfig,
  sanitizeLiveChatForSettings,
  buildPublicWidgetConfig,
  isOriginAllowed,
  mapLiveChatAgents,
};
