const { signOAuthState } = require('../utils/token');
const { encryptJson, decryptJson } = require('../utils/crypto');

function getApiBaseUrl() {
  return (process.env.APP_API_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, '');
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
    if (host === 'localhost' || host.endsWith('.localhost')) return url.origin;
    if (host === baseDomain || host.endsWith(`.${baseDomain}`)) return url.origin;
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
    if (url.pathname !== '/settings' && url.pathname !== '/setup' && url.pathname !== '/auth/login') {
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function buildAppRedirect(subdomain, path, params = {}, returnOrigin = null) {
  const origin = normalizeReturnOrigin(returnOrigin) || getFrontendOrigin(subdomain);
  const url = new URL(path || '/', origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function buildSettingsRedirect(subdomain, params = {}, returnOrigin = null, returnPath = null) {
  const origin = normalizeReturnOrigin(returnOrigin) || getFrontendOrigin(subdomain);
  const path = normalizeReturnPath(returnPath) || '/settings';
  const url = new URL(path, origin);
  if (url.pathname === '/settings' && !url.searchParams.get('item')) {
    url.searchParams.set('item', params.item || 'email');
  }
  for (const [key, value] of Object.entries(params)) {
    if (key === 'item') continue;
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function isMicrosoftConfigured() {
  return Boolean(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET);
}

function googleRedirectUri(kind) {
  if (kind === 'auth') return `${getApiBaseUrl()}/api/v1/auth/google/callback`;
  return `${getApiBaseUrl()}/api/v1/channels/email/google/callback`;
}

function microsoftRedirectUri(kind) {
  if (kind === 'auth') return `${getApiBaseUrl()}/api/v1/auth/microsoft/callback`;
  return `${getApiBaseUrl()}/api/v1/channels/email/microsoft/callback`;
}

function microsoftTenant() {
  return process.env.MS_TENANT_ID || 'common';
}

const GOOGLE_AUTH_SCOPES = ['openid', 'email', 'profile'].join(' ');
const GOOGLE_EMAIL_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
].join(' ');

const MS_AUTH_SCOPES = ['openid', 'profile', 'email', 'User.Read', 'offline_access'].join(' ');
const MS_EMAIL_SCOPES = [
  'openid',
  'profile',
  'email',
  'User.Read',
  'offline_access',
  'Mail.Read',
  'Mail.Send',
].join(' ');

function buildGoogleAuthUrl({ purpose, companyId, subdomain, userId, returnOrigin, returnPath }) {
  if (!isGoogleConfigured()) throw new Error('Google OAuth is not configured');
  const kind = purpose.includes('email') ? 'email' : 'auth';
  const state = signOAuthState({
    purpose,
    companyId: companyId?.toString(),
    subdomain,
    userId: userId?.toString(),
    returnOrigin: normalizeReturnOrigin(returnOrigin),
    returnPath: normalizeReturnPath(returnPath),
  });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', googleRedirectUri(kind));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', kind === 'email' ? GOOGLE_EMAIL_SCOPES : GOOGLE_AUTH_SCOPES);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', kind === 'email' ? 'consent' : 'select_account');
  url.searchParams.set('state', state);
  return url.toString();
}

function buildMicrosoftAuthUrl({ purpose, companyId, subdomain, userId, returnOrigin, returnPath }) {
  if (!isMicrosoftConfigured()) throw new Error('Microsoft OAuth is not configured');
  const kind = purpose.includes('email') ? 'email' : 'auth';
  const state = signOAuthState({
    purpose,
    companyId: companyId?.toString(),
    subdomain,
    userId: userId?.toString(),
    returnOrigin: normalizeReturnOrigin(returnOrigin),
    returnPath: normalizeReturnPath(returnPath),
  });
  const url = new URL(`https://login.microsoftonline.com/${microsoftTenant()}/oauth2/v2.0/authorize`);
  url.searchParams.set('client_id', process.env.MS_CLIENT_ID);
  url.searchParams.set('redirect_uri', microsoftRedirectUri(kind));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', kind === 'email' ? MS_EMAIL_SCOPES : MS_AUTH_SCOPES);
  url.searchParams.set('state', state);
  return url.toString();
}

async function readJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function exchangeGoogleCode(code, kind) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(kind),
      grant_type: 'authorization_code',
    }),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || 'Google token exchange failed');
  }
  return data;
}

async function refreshGoogleToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || 'Google token refresh failed');
  }
  return data;
}

async function fetchGoogleProfile(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data?.error_description || 'Could not load Google profile');
  return {
    id: data.sub,
    email: String(data.email || '').toLowerCase(),
    emailVerified: Boolean(data.email_verified),
    firstName: data.given_name || '',
    lastName: data.family_name || '',
    name: data.name || '',
  };
}

async function exchangeMicrosoftCode(code, kind) {
  const res = await fetch(
    `https://login.microsoftonline.com/${microsoftTenant()}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.MS_CLIENT_ID,
        client_secret: process.env.MS_CLIENT_SECRET,
        redirect_uri: microsoftRedirectUri(kind),
        grant_type: 'authorization_code',
        scope: kind === 'email' ? MS_EMAIL_SCOPES : MS_AUTH_SCOPES,
      }),
    },
  );
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || 'Microsoft token exchange failed');
  }
  return data;
}

async function refreshMicrosoftToken(refreshToken) {
  const res = await fetch(
    `https://login.microsoftonline.com/${microsoftTenant()}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MS_CLIENT_ID,
        client_secret: process.env.MS_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: MS_EMAIL_SCOPES,
      }),
    },
  );
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error(data?.error_description || data?.error || 'Microsoft token refresh failed');
  }
  return data;
}

async function fetchMicrosoftProfile(accessToken) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data?.error?.message || 'Could not load Microsoft profile');
  const email = String(data.mail || data.userPrincipalName || '').toLowerCase();
  return {
    id: data.id,
    email,
    emailVerified: true,
    firstName: data.givenName || '',
    lastName: data.surname || '',
    name: data.displayName || '',
  };
}

function packOAuthSecret(bundle) {
  return encryptJson(bundle);
}

function unpackOAuthSecret(secret) {
  return decryptJson(secret);
}

function tokenExpiryDate(expiresInSeconds) {
  const seconds = Number(expiresInSeconds) || 3600;
  return new Date(Date.now() + Math.max(60, seconds - 60) * 1000);
}

module.exports = {
  getApiBaseUrl,
  getFrontendOrigin,
  normalizeReturnOrigin,
  normalizeReturnPath,
  buildAppRedirect,
  buildSettingsRedirect,
  isGoogleConfigured,
  isMicrosoftConfigured,
  googleRedirectUri,
  microsoftRedirectUri,
  buildGoogleAuthUrl,
  buildMicrosoftAuthUrl,
  exchangeGoogleCode,
  refreshGoogleToken,
  fetchGoogleProfile,
  exchangeMicrosoftCode,
  refreshMicrosoftToken,
  fetchMicrosoftProfile,
  packOAuthSecret,
  unpackOAuthSecret,
  tokenExpiryDate,
};
