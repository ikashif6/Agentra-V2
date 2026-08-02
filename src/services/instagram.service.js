const { signOAuthState } = require('../utils/token');
const { ensureChannelIntegrations } = require('./channel-integrations.util');
const {
  normalizeReturnOrigin,
  normalizeReturnPath,
  buildSettingsRedirect,
  getApiBaseUrl,
  subscribePageToApp,
  sendMessengerMessage,
  htmlToPlainText,
} = require('./facebook.service');

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';

// Instagram messaging (via a Page-linked professional account).
const SCOPES = [
  'instagram_basic',
  'instagram_manage_messages',
  'pages_show_list',
  'pages_manage_metadata',
  'pages_messaging',
  'pages_read_engagement',
  'business_management',
].join(',');

function isInstagramConfigured() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

function getOAuthRedirectUri() {
  return `${getApiBaseUrl()}/api/v1/channels/instagram/oauth/callback`;
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
    throw new Error(body?.error?.message || `Instagram API error (${res.status})`);
  }
  return body;
}

function buildInstagramOAuthUrl({ companyId, subdomain, userId, returnOrigin, returnPath }) {
  if (!isInstagramConfigured()) {
    throw new Error('Instagram integration is not configured on the server');
  }

  const state = signOAuthState({
    purpose: 'instagram_oauth',
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
    throw new Error(body?.error?.message || 'Could not exchange Instagram authorization code');
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
    throw new Error(body?.error?.message || 'Could not obtain long-lived Instagram token');
  }
  return body.access_token;
}

// Find Pages that have a linked Instagram professional account.
async function fetchInstagramAccounts(userAccessToken) {
  const body = await graphGet('/me/accounts', userAccessToken, {
    fields:
      'id,name,access_token,instagram_business_account{id,username,profile_picture_url},connected_instagram_account{id,username,profile_picture_url}',
  });

  const pages = body?.data ?? [];
  const accounts = [];

  for (const page of pages) {
    let ig = page.instagram_business_account;
    if (!ig?.id && page.connected_instagram_account?.id) {
      ig = page.connected_instagram_account;
    }

    // Some New Page Experience assets only expose IG when queried on the Page token.
    if (!ig?.id && page.id && page.access_token) {
      try {
        const detail = await graphGet(`/${page.id}`, page.access_token, {
          fields:
            'instagram_business_account{id,username,profile_picture_url},connected_instagram_account{id,username,profile_picture_url}',
        });
        ig = detail?.instagram_business_account || detail?.connected_instagram_account || null;
      } catch {
        // Keep scanning other pages.
      }
    }

    if (!ig?.id) continue;

    accounts.push({
      igUserId: ig.id,
      igUsername: ig.username || '',
      igPictureUrl: ig.profile_picture_url || '',
      pageId: page.id,
      pageName: page.name || '',
      pageAccessToken: page.access_token,
    });
  }

  return accounts;
}

async function labeledStep(step, fn) {
  try {
    return await fn();
  } catch (err) {
    err.message = `[${step}] ${err.message}`;
    throw err;
  }
}

function getInstagramIntegration(company) {
  return company.channelIntegrations?.instagram || {};
}

function sanitizeInstagramIntegration(integration) {
  const plain = integration?.toObject ? integration.toObject() : { ...integration };
  return {
    status: plain.status || 'disconnected',
    connectedAt: plain.connectedAt || null,
    lastError: plain.lastError || null,
    igUserId: plain.igUserId || null,
    igUsername: plain.igUsername || null,
    igPictureUrl: plain.igPictureUrl || null,
    pageId: plain.pageId || null,
    pageName: plain.pageName || null,
    hasPageAccessToken: Boolean(plain.pageAccessToken),
    pendingAccounts: (plain.pendingAccounts || []).map((account) => ({
      igUserId: account.igUserId,
      igUsername: account.igUsername,
      igPictureUrl: account.igPictureUrl,
      pageId: account.pageId,
      pageName: account.pageName,
    })),
  };
}

function defaultInstagramIntegration() {
  return {
    status: 'disconnected',
    connectedAt: null,
    lastError: null,
    igUserId: null,
    igUsername: null,
    igPictureUrl: null,
    pageId: null,
    pageName: null,
    pageAccessToken: null,
    userAccessToken: null,
    pendingAccounts: [],
  };
}

async function finalizeAccountConnection(company, account, userAccessToken) {
  if (!account.pageAccessToken) {
    throw new Error('[page-token] Facebook did not return a Page access token for this Instagram account.');
  }
  // Subscribing the linked Page routes Instagram messaging webhooks to the app.
  await labeledStep('subscribe', () => subscribePageToApp(account.pageId, account.pageAccessToken));

  ensureChannelIntegrations(company);
  company.channelIntegrations.instagram = {
    status: 'connected',
    connectedAt: new Date(),
    lastError: null,
    igUserId: account.igUserId,
    igUsername: account.igUsername,
    igPictureUrl: account.igPictureUrl,
    pageId: account.pageId,
    pageName: account.pageName,
    pageAccessToken: account.pageAccessToken,
    userAccessToken,
    pendingAccounts: [],
  };

  await company.save();
  return sanitizeInstagramIntegration(company.channelIntegrations.instagram);
}

async function handleOAuthCallback(code, company) {
  const shortToken = await labeledStep('exchange-code', () => exchangeCodeForUserToken(code));
  const userAccessToken = await labeledStep('long-lived', () => exchangeForLongLivedUserToken(shortToken));
  const accounts = await labeledStep('list-accounts', () => fetchInstagramAccounts(userAccessToken));

  if (!accounts.length) {
    ensureChannelIntegrations(company);
    company.channelIntegrations.instagram = {
      ...defaultInstagramIntegration(),
      status: 'error',
      lastError:
        'No Instagram professional account was found on your Facebook Pages for this app. Reconnect and use Edit settings — approve business_management plus Page access for the Vastora Page that has @vastora.pk linked. If this keeps failing, deploy the latest API and try again.',
      userAccessToken,
      pendingAccounts: [],
    };
    await company.save();
    return { kind: 'error', message: company.channelIntegrations.instagram.lastError };
  }

  if (accounts.length === 1) {
    const instagram = await finalizeAccountConnection(company, accounts[0], userAccessToken);
    return { kind: 'connected', instagram, username: instagram.igUsername };
  }

  ensureChannelIntegrations(company);
  company.channelIntegrations.instagram = {
    ...defaultInstagramIntegration(),
    status: 'pending',
    userAccessToken,
    pendingAccounts: accounts.map(({ igUserId, igUsername, igPictureUrl, pageId, pageName }) => ({
      igUserId,
      igUsername,
      igPictureUrl,
      pageId,
      pageName,
    })),
  };
  await company.save();

  return { kind: 'select_account', accounts: company.channelIntegrations.instagram.pendingAccounts };
}

async function connectPendingAccount(company, igUserId) {
  const integration = getInstagramIntegration(company);
  if (integration.status !== 'pending' || !integration.userAccessToken) {
    throw new Error('No pending Instagram connection. Start by connecting your account again.');
  }

  const accounts = await fetchInstagramAccounts(integration.userAccessToken);
  const account = accounts.find((entry) => entry.igUserId === igUserId);
  if (!account) {
    throw new Error('Selected Instagram account is no longer available for this login');
  }

  return finalizeAccountConnection(company, account, integration.userAccessToken);
}

async function disconnectInstagram(company) {
  ensureChannelIntegrations(company);
  company.channelIntegrations.instagram = defaultInstagramIntegration();
  await company.save();
  return sanitizeInstagramIntegration(company.channelIntegrations.instagram);
}

async function getInstagramUserProfile(pageAccessToken, igsid) {
  return graphGet(`/${igsid}`, pageAccessToken, {
    fields: 'name,username,profile_pic',
  });
}

async function sendReplyForTicket(companyId, ticket, text) {
  const igsid = ticket.instagram?.igsid;
  if (!igsid) {
    throw new Error('This ticket has no Instagram recipient');
  }

  const plainText = htmlToPlainText(text);
  if (!plainText) return null;

  const Company = require('../models/Company');
  const company = await Company.findById(companyId).select(
    '+channelIntegrations.instagram.pageAccessToken',
  );
  const token = company?.channelIntegrations?.instagram?.pageAccessToken;
  if (!token) {
    throw new Error('Instagram is not connected for this workspace');
  }

  return sendMessengerMessage(token, igsid, plainText);
}

module.exports = {
  isInstagramConfigured,
  buildInstagramOAuthUrl,
  getOAuthRedirectUri,
  getInstagramIntegration,
  sanitizeInstagramIntegration,
  defaultInstagramIntegration,
  handleOAuthCallback,
  connectPendingAccount,
  disconnectInstagram,
  getInstagramUserProfile,
  sendReplyForTicket,
  buildSettingsRedirect,
};
