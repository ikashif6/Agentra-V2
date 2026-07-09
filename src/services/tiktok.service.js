function getApiBaseUrl() {
  return (process.env.APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
}

function isTiktokConfigured() {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

function getOAuthRedirectUri() {
  return `${getApiBaseUrl()}/api/v1/channels/tiktok/oauth/callback`;
}

function getWebhookUrl() {
  return `${getApiBaseUrl()}/api/v1/webhooks/tiktok`;
}

function buildSettingsRedirect(subdomain, params = {}, returnOrigin) {
  const base =
    returnOrigin ||
    process.env.APP_FRONTEND_URL ||
    `https://${subdomain}.${process.env.APP_BASE_DOMAIN || 'agentraa.com'}`;
  const url = new URL('/settings', base.replace(/\/$/, ''));
  url.searchParams.set('section', 'tiktok');
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

module.exports = {
  isTiktokConfigured,
  getOAuthRedirectUri,
  getWebhookUrl,
  buildSettingsRedirect,
};
