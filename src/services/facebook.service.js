const { signOAuthState } = require('../utils/token');

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const SCOPES = [
  'pages_show_list',
  'pages_messaging',
  'pages_manage_metadata',
  'pages_read_engagement',
].join(',');

function isFacebookConfigured() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

function getApiBaseUrl() {
  return (process.env.APP_API_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, '');
}

function getOAuthRedirectUri() {
  return `${getApiBaseUrl()}/api/v1/channels/facebook/oauth/callback`;
}

function getFrontendOrigin(subdomain) {
  const port = process.env.APP_FRONTEND_DEV_PORT || 3000;
  const baseDomain = process.env.APP_BASE_DOMAIN || 'agentraa.com';

  if (process.env.NODE_ENV === 'production') {
    return `https://${subdomain}.${baseDomain}`;
  }

  return `http://${subdomain}.localhost:${port}`;
}

function buildSettingsRedirect(subdomain, params = {}) {
  const query = new URLSearchParams({ item: 'facebook', ...params });
  return `${getFrontendOrigin(subdomain)}/settings?${query.toString()}`;
}

async function readJsonResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function graphGet(path, accessToken, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}${path}`);
  url.searchParams.set('access_token', accessToken);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url);
  const body = await readJsonResponse(res);

  if (!res.ok) {
    const message = body?.error?.message || `Facebook API error (${res.status})`;
    throw new Error(message);
  }

  return body;
}

function buildFacebookOAuthUrl({ companyId, subdomain, userId }) {
  if (!isFacebookConfigured()) {
    throw new Error('Facebook integration is not configured on the server');
  }

  const state = signOAuthState({
    purpose: 'facebook_oauth',
    companyId: companyId.toString(),
    subdomain,
    userId: userId.toString(),
  });

  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', process.env.META_APP_ID);
  url.searchParams.set('redirect_uri', getOAuthRedirectUri());
  url.searchParams.set('state', state);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('response_type', 'code');

  return url.toString();
}

async function exchangeCodeForUserToken(code) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set('client_id', process.env.META_APP_ID);
  url.searchParams.set('client_secret', process.env.META_APP_SECRET);
  url.searchParams.set('redirect_uri', getOAuthRedirectUri());
  url.searchParams.set('code', code);

  const res = await fetch(url);
  const body = await readJsonResponse(res);

  if (!res.ok || !body?.access_token) {
    throw new Error(body?.error?.message || 'Could not exchange Facebook authorization code');
  }

  return body.access_token;
}

async function exchangeForLongLivedUserToken(shortLivedToken) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', process.env.META_APP_ID);
  url.searchParams.set('client_secret', process.env.META_APP_SECRET);
  url.searchParams.set('fb_exchange_token', shortLivedToken);

  const res = await fetch(url);
  const body = await readJsonResponse(res);

  if (!res.ok || !body?.access_token) {
    throw new Error(body?.error?.message || 'Could not obtain long-lived Facebook token');
  }

  return body.access_token;
}

async function fetchManagedPages(userAccessToken) {
  const body = await graphGet('/me/accounts', userAccessToken, {
    fields: 'id,name,category,access_token,picture{url}',
  });

  return (body?.data ?? []).map((page) => ({
    id: page.id,
    name: page.name,
    category: page.category || '',
    pictureUrl: page.picture?.data?.url || '',
    accessToken: page.access_token,
  }));
}

async function subscribePageToApp(pageId, pageAccessToken) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/subscribed_apps`);
  url.searchParams.set('access_token', pageAccessToken);
  url.searchParams.set('subscribed_fields', 'messages,messaging_postbacks,message_reads');

  const res = await fetch(url, { method: 'POST' });
  const body = await readJsonResponse(res);

  if (!res.ok) {
    throw new Error(body?.error?.message || 'Could not subscribe page to webhooks');
  }

  return body;
}

async function verifyPageAccess(pageId, pageAccessToken) {
  const body = await graphGet(`/${pageId}`, pageAccessToken, {
    fields: 'id,name,picture{url}',
  });

  return {
    pageId: body.id,
    pageName: body.name,
    pagePictureUrl: body.picture?.data?.url || '',
  };
}

function getFacebookIntegration(company) {
  return company.channelIntegrations?.facebook || {};
}

function sanitizeFacebookIntegration(integration) {
  const plain = integration?.toObject ? integration.toObject() : { ...integration };

  return {
    status: plain.status || 'disconnected',
    connectedAt: plain.connectedAt || null,
    lastError: plain.lastError || null,
    pageId: plain.pageId || null,
    pageName: plain.pageName || null,
    pagePictureUrl: plain.pagePictureUrl || null,
    hasPageAccessToken: Boolean(plain.pageAccessToken),
    pendingPages: (plain.pendingPages || []).map((page) => ({
      id: page.id,
      name: page.name,
      category: page.category,
      pictureUrl: page.pictureUrl,
    })),
  };
}

function defaultFacebookIntegration() {
  return {
    status: 'disconnected',
    connectedAt: null,
    lastError: null,
    pageId: null,
    pageName: null,
    pagePictureUrl: null,
    pageAccessToken: null,
    userAccessToken: null,
    pendingPages: [],
  };
}

async function finalizePageConnection(company, page, userAccessToken) {
  await subscribePageToApp(page.id, page.accessToken);
  const verified = await verifyPageAccess(page.id, page.accessToken);

  company.channelIntegrations = company.channelIntegrations || {};
  company.channelIntegrations.facebook = {
    status: 'connected',
    connectedAt: new Date(),
    lastError: null,
    pageId: verified.pageId,
    pageName: verified.pageName,
    pagePictureUrl: verified.pagePictureUrl || page.pictureUrl || '',
    pageAccessToken: page.accessToken,
    userAccessToken,
    pendingPages: [],
  };

  await company.save();
  return sanitizeFacebookIntegration(company.channelIntegrations.facebook);
}

async function handleOAuthCallback(code, company) {
  const shortToken = await exchangeCodeForUserToken(code);
  const userAccessToken = await exchangeForLongLivedUserToken(shortToken);
  const pages = await fetchManagedPages(userAccessToken);

  if (!pages.length) {
    company.channelIntegrations = company.channelIntegrations || {};
    company.channelIntegrations.facebook = {
      ...defaultFacebookIntegration(),
      status: 'error',
      lastError: 'No Facebook Pages found. Create a Page or grant Page access to this Facebook account.',
      userAccessToken,
      pendingPages: [],
    };
    await company.save();
    return { kind: 'error', message: company.channelIntegrations.facebook.lastError };
  }

  if (pages.length === 1) {
    const facebook = await finalizePageConnection(company, pages[0], userAccessToken);
    return { kind: 'connected', facebook, pageName: facebook.pageName };
  }

  company.channelIntegrations = company.channelIntegrations || {};
  company.channelIntegrations.facebook = {
    status: 'pending',
    connectedAt: null,
    lastError: null,
    pageId: null,
    pageName: null,
    pagePictureUrl: null,
    pageAccessToken: null,
    userAccessToken,
    pendingPages: pages.map(({ id, name, category, pictureUrl }) => ({
      id,
      name,
      category,
      pictureUrl,
    })),
  };

  await company.save();

  return {
    kind: 'select_page',
    pages: company.channelIntegrations.facebook.pendingPages,
  };
}

async function connectPendingPage(company, pageId) {
  const integration = getFacebookIntegration(company);
  if (integration.status !== 'pending' || !integration.userAccessToken) {
    throw new Error('No pending Facebook connection. Start by connecting your account again.');
  }

  const pages = await fetchManagedPages(integration.userAccessToken);
  const page = pages.find((entry) => entry.id === pageId);

  if (!page) {
    throw new Error('Selected Page is no longer available for this Facebook account');
  }

  return finalizePageConnection(company, page, integration.userAccessToken);
}

async function disconnectFacebook(company) {
  company.channelIntegrations = company.channelIntegrations || {};
  company.channelIntegrations.facebook = defaultFacebookIntegration();
  await company.save();
  return sanitizeFacebookIntegration(company.channelIntegrations.facebook);
}

function verifyWebhookRequest(mode, token, challenge) {
  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return challenge;
  }
  return null;
}

module.exports = {
  isFacebookConfigured,
  buildFacebookOAuthUrl,
  buildSettingsRedirect,
  getOAuthRedirectUri,
  getFacebookIntegration,
  sanitizeFacebookIntegration,
  defaultFacebookIntegration,
  handleOAuthCallback,
  connectPendingPage,
  disconnectFacebook,
  verifyWebhookRequest,
};
