const { signOAuthState } = require('../utils/token');

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const SCOPES = [
  'pages_show_list',
  'pages_messaging',
  'pages_manage_metadata',
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

function normalizeReturnOrigin(origin) {
  if (!origin || typeof origin !== 'string') return null;

  try {
    const url = new URL(origin);
    const baseDomain = process.env.APP_BASE_DOMAIN || 'agentraa.com';
    const host = url.hostname.toLowerCase();

    if (host === 'localhost' || host.endsWith('.localhost')) {
      return url.origin;
    }

    if (host === baseDomain || host.endsWith(`.${baseDomain}`)) {
      return url.origin;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeReturnPath(path) {
  if (!path || typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  const withoutHash = trimmed.split('#')[0];
  if (withoutHash.length > 512) return null;
  try {
    const url = new URL(withoutHash, 'http://local.invalid');
    if (url.pathname !== '/settings' && url.pathname !== '/setup') return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function buildSettingsRedirect(subdomain, params = {}, returnOrigin = null, returnPath = null) {
  const origin = normalizeReturnOrigin(returnOrigin) || getFrontendOrigin(subdomain);
  const path = normalizeReturnPath(returnPath) || '/settings';
  const url = new URL(path, origin);
  if (url.pathname === '/settings' && !url.searchParams.get('item')) {
    url.searchParams.set('item', params.item || 'facebook');
  }
  for (const [key, value] of Object.entries(params)) {
    if (key === 'item') continue;
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
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

function buildFacebookOAuthUrl({ companyId, subdomain, userId, returnOrigin, returnPath }) {
  if (!isFacebookConfigured()) {
    throw new Error('Facebook integration is not configured on the server');
  }

  const state = signOAuthState({
    purpose: 'facebook_oauth',
    companyId: companyId.toString(),
    subdomain,
    userId: userId.toString(),
    returnOrigin: normalizeReturnOrigin(returnOrigin) || undefined,
    returnPath: normalizeReturnPath(returnPath) || undefined,
  });

  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', process.env.META_APP_ID);
  url.searchParams.set('redirect_uri', getOAuthRedirectUri());
  url.searchParams.set('state', state);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('response_type', 'code');
  // Force the permission dialog so previously-granted (stale) scopes are re-requested.
  url.searchParams.set('auth_type', 'rerequest');

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

function getPublicPagePictureUrl(pageId) {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/picture?type=large`;
}

async function fetchManagedPages(userAccessToken) {
  const body = await graphGet('/me/accounts', userAccessToken, {
    fields: 'id,name,category,access_token',
  });

  return (body?.data ?? []).map((page) => ({
    id: page.id,
    name: page.name,
    category: page.category || '',
    pictureUrl: getPublicPagePictureUrl(page.id),
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
    fields: 'id,name',
  });

  return {
    pageId: body.id,
    pageName: body.name,
    pagePictureUrl: getPublicPagePictureUrl(body.id),
  };
}

async function getMessengerUserProfile(pageAccessToken, psid) {
  return graphGet(`/${psid}`, pageAccessToken, {
    fields: 'first_name,last_name,profile_pic',
  });
}

/**
 * Convert the rich-text (HTML) reply body from the inbox composer into the
 * plain text Messenger expects. Messenger's message.text has no markup, so
 * unstripped tags like <div><br></div> would show up literally to the user.
 */
function htmlToPlainText(html) {
  if (!html) return '';
  return String(html)
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

async function sendMessengerMessage(pageAccessToken, psid, text) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/messages`);
  url.searchParams.set('access_token', pageAccessToken);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: psid },
      messaging_type: 'RESPONSE',
      message: { text },
    }),
  });

  const body = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(body?.error?.message || 'Could not send Messenger reply');
  }
  return body;
}

/**
 * Send an agent reply back to the Messenger user attached to a ticket.
 * Loads the Page access token lazily to avoid keeping it in memory.
 */
async function sendReplyForTicket(companyId, ticket, text) {
  const psid = ticket.facebook?.psid;
  if (!psid) {
    throw new Error('This ticket has no Messenger recipient');
  }

  const plainText = htmlToPlainText(text);
  if (!plainText) return null;

  // Required lazily to avoid a require cycle (Company model does not need this service).
  const Company = require('../models/Company');
  const company = await Company.findById(companyId).select(
    '+channelIntegrations.facebook.pageAccessToken',
  );

  const token = company?.channelIntegrations?.facebook?.pageAccessToken;
  if (!token) {
    throw new Error('Facebook is not connected for this workspace');
  }

  return sendMessengerMessage(token, psid, plainText);
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

async function labeledStep(step, fn) {
  try {
    return await fn();
  } catch (err) {
    err.message = `[${step}] ${err.message}`;
    throw err;
  }
}

async function finalizePageConnection(company, page, userAccessToken) {
  if (!page.accessToken) {
    throw new Error('[page-token] Facebook did not return a Page access token. Re-connect and make sure the Page is selected with messaging permissions.');
  }
  await labeledStep('subscribe', () => subscribePageToApp(page.id, page.accessToken));

  company.channelIntegrations = company.channelIntegrations || {};
  company.channelIntegrations.facebook = {
    status: 'connected',
    connectedAt: new Date(),
    lastError: null,
    pageId: page.id,
    pageName: page.name,
    pagePictureUrl: page.pictureUrl || getPublicPagePictureUrl(page.id),
    pageAccessToken: page.accessToken,
    userAccessToken,
    pendingPages: [],
  };

  await company.save();
  return sanitizeFacebookIntegration(company.channelIntegrations.facebook);
}

async function handleOAuthCallback(code, company) {
  const shortToken = await labeledStep('exchange-code', () => exchangeCodeForUserToken(code));
  const userAccessToken = await labeledStep('long-lived', () => exchangeForLongLivedUserToken(shortToken));
  const pages = await labeledStep('list-pages', () => fetchManagedPages(userAccessToken));

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
  normalizeReturnOrigin,
  normalizeReturnPath,
  getMessengerUserProfile,
  sendMessengerMessage,
  sendReplyForTicket,
  htmlToPlainText,
  subscribePageToApp,
  getApiBaseUrl,
};
