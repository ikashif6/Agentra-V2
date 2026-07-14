const { SHOPIFY_API_VERSION, getStoreSecrets } = require('./store.service');
const {
  getApiBaseUrl,
  configuredShopifyScriptTagsScope,
  shopifyScopesIncludeScriptTags,
} = require('./store-oauth.service');

async function readJsonResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function widgetLoaderUrl(widgetKey) {
  const base = getApiBaseUrl();
  return `${base}/widget-loader.js?key=${encodeURIComponent(widgetKey)}`;
}

function shopifyHeaders(accessToken) {
  return {
    'X-Shopify-Access-Token': accessToken,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function listAgentraScriptTags(shopDomain, accessToken) {
  const res = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/script_tags.json`,
    { headers: shopifyHeaders(accessToken) },
  );
  const body = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(body?.errors || `Could not list Shopify script tags (${res.status})`);
  }
  const loaderPrefix = `${getApiBaseUrl()}/widget-loader.js`;
  return (body?.script_tags || []).filter((tag) => String(tag.src || '').startsWith(loaderPrefix));
}

async function deleteScriptTag(shopDomain, accessToken, id) {
  const res = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/script_tags/${id}.json`,
    { method: 'DELETE', headers: shopifyHeaders(accessToken) },
  );
  if (!res.ok && res.status !== 404) {
    const body = await readJsonResponse(res);
    throw new Error(body?.errors || `Could not delete Shopify script tag (${res.status})`);
  }
}

async function installShopifyWidget(company) {
  const integration = company.storeIntegration;
  if (integration?.provider !== 'shopify' || integration?.status !== 'connected') {
    throw new Error('Connect a Shopify store first to use one-click widget install');
  }

  const shopDomain = integration.shopify?.shopDomain;
  const secrets = getStoreSecrets(integration);
  const accessToken = secrets.shopify?.accessToken;
  const widgetKey = company.liveChat?.widgetKey;
  if (!shopDomain || !accessToken) {
    throw new Error('Shopify credentials unavailable');
  }
  if (!widgetKey) {
    throw new Error('Widget key is missing — save live chat settings first');
  }

  const existing = await listAgentraScriptTags(shopDomain, accessToken);
  for (const tag of existing) {
    await deleteScriptTag(shopDomain, accessToken, tag.id);
  }

  const src = widgetLoaderUrl(widgetKey);
  const res = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/script_tags.json`,
    {
      method: 'POST',
      headers: shopifyHeaders(accessToken),
      body: JSON.stringify({
        script_tag: {
          event: 'onload',
          src,
          display_scope: 'online_store',
        },
      }),
    },
  );
  const body = await readJsonResponse(res);
  if (!res.ok) {
    const message =
      typeof body?.errors === 'string'
        ? body.errors
        : body?.errors?.[0] || body?.error || `Shopify script tag install failed (${res.status})`;
    if (String(message).toLowerCase().includes('script_tags')) {
      throw new Error(
        'Shopify needs the write_script_tags scope. Disconnect and reconnect your store in Settings › Store.',
      );
    }
    throw new Error(message);
  }

  return {
    scriptTagId: String(body?.script_tag?.id || ''),
    src,
    shopDomain,
  };
}

async function uninstallShopifyWidget(company) {
  const integration = company.storeIntegration;
  if (integration?.provider !== 'shopify' || integration?.status !== 'connected') {
    return { removed: 0 };
  }

  const shopDomain = integration.shopify?.shopDomain;
  const secrets = getStoreSecrets(integration);
  const accessToken = secrets.shopify?.accessToken;
  if (!shopDomain || !accessToken) return { removed: 0 };

  const storedId = company.liveChat?.shopifyScriptTagId;
  let removed = 0;

  if (storedId) {
    try {
      await deleteScriptTag(shopDomain, accessToken, storedId);
      removed += 1;
    } catch {
      // fall through to scan
    }
  }

  const existing = await listAgentraScriptTags(shopDomain, accessToken);
  for (const tag of existing) {
    await deleteScriptTag(shopDomain, accessToken, tag.id);
    removed += 1;
  }

  return { removed };
}

function shopifyStoreDomains(company) {
  const shopDomain = company.storeIntegration?.shopify?.shopDomain;
  if (!shopDomain) return [];
  const host = shopDomain.replace(/^https?:\/\//, '').split('/')[0];
  const custom = company.storeIntegration?.shopify?.primaryDomain;
  const domains = [host, custom].filter(Boolean);
  if (host.endsWith('.myshopify.com')) {
    domains.push(host.replace('.myshopify.com', '.com'));
  }
  return [...new Set(domains)];
}

function storeHasScriptTagsScope(company) {
  const granted = company.storeIntegration?.shopify?.scope || '';
  return shopifyScopesIncludeScriptTags(granted);
}

function canUseShopifyAutoInstall(company) {
  const integration = company.storeIntegration;
  if (integration?.provider !== 'shopify' || integration?.status !== 'connected') {
    return false;
  }
  return configuredShopifyScriptTagsScope() && storeHasScriptTagsScope(company);
}

function applyShopifyAllowedOrigins(liveChat, company) {
  const domains = shopifyStoreDomains(company);
  const origins = new Set(liveChat.allowedOrigins || []);
  for (const d of domains) {
    if (d) origins.add(d);
  }
  liveChat.allowedOrigins = [...origins];
}

async function syncWidgetInstall(company) {
  const liveChat = company.liveChat || {};
  const enabled = Boolean(liveChat.enabled);
  const provider = company.storeIntegration?.provider;
  const connected = company.storeIntegration?.status === 'connected';

  if (!enabled) {
    if (provider === 'shopify' && connected && liveChat.shopifyScriptTagId) {
      await uninstallShopifyWidget(company);
    }
    liveChat.widgetInstalled = false;
    liveChat.installMethod = null;
    liveChat.shopifyScriptTagId = undefined;
    liveChat.lastError = null;
    return { installed: false, method: null };
  }

  if (provider === 'shopify' && connected) {
    applyShopifyAllowedOrigins(liveChat, company);

    if (!canUseShopifyAutoInstall(company)) {
      liveChat.widgetInstalled = false;
      liveChat.installMethod = 'manual';
      liveChat.shopifyScriptTagId = undefined;
      liveChat.lastError = null;
      return {
        installed: false,
        method: 'manual',
        pendingScriptTagsScope: true,
      };
    }

    const result = await installShopifyWidget(company);
    liveChat.widgetInstalled = true;
    liveChat.installMethod = 'shopify_script';
    liveChat.shopifyScriptTagId = result.scriptTagId;
    liveChat.lastError = null;
    return { installed: true, method: 'shopify_script', shopDomain: result.shopDomain };
  }

  liveChat.widgetInstalled = false;
  liveChat.installMethod = 'manual';
  return { installed: false, method: 'manual' };
}

module.exports = {
  widgetLoaderUrl,
  installShopifyWidget,
  uninstallShopifyWidget,
  syncWidgetInstall,
  canUseShopifyAutoInstall,
};
