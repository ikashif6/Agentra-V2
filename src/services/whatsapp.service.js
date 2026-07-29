const { htmlToPlainText } = require('./facebook.service');
const { ensureChannelIntegrations } = require('./channel-integrations.util');

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';

function isWhatsAppConfigured() {
  // Embedded Signup needs app credentials + a WhatsApp configuration id from Meta.
  return Boolean(
    process.env.META_APP_ID &&
      process.env.META_APP_SECRET &&
      process.env.META_WA_CONFIG_ID,
  );
}

function getEmbeddedSignupConfig() {
  return {
    appId: process.env.META_APP_ID || '',
    configId: process.env.META_WA_CONFIG_ID || '',
    graphVersion: GRAPH_VERSION,
    configured: isWhatsAppConfigured(),
  };
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
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  const res = await fetch(url);
  const body = await readJsonResponse(res);
  if (!res.ok) throw new Error(body?.error?.message || `WhatsApp API error (${res.status})`);
  return body;
}

async function graphPost(path, accessToken, payload) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}${path}`);
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  const body = await readJsonResponse(res);
  if (!res.ok) throw new Error(body?.error?.message || `WhatsApp API error (${res.status})`);
  return body;
}

// Exchange the Embedded Signup authorization code for a business access token.
async function exchangeCodeForToken(code) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set('client_id', process.env.META_APP_ID);
  url.searchParams.set('client_secret', process.env.META_APP_SECRET);
  url.searchParams.set('code', code);

  const res = await fetch(url);
  const body = await readJsonResponse(res);
  if (!res.ok || !body?.access_token) {
    throw new Error(body?.error?.message || 'Could not exchange WhatsApp authorization code');
  }
  return body.access_token;
}

async function fetchPhoneNumberDetails(phoneNumberId, accessToken) {
  return graphGet(`/${phoneNumberId}`, accessToken, {
    fields: 'id,display_phone_number,verified_name',
  });
}

async function subscribeWabaToApp(wabaId, accessToken) {
  return graphPost(`/${wabaId}/subscribed_apps`, accessToken, {});
}

// Best-effort Cloud API registration so the number can send via the API.
async function registerPhoneNumber(phoneNumberId, accessToken) {
  try {
    await graphPost(`/${phoneNumberId}/register`, accessToken, {
      messaging_product: 'whatsapp',
      pin: '000000',
    });
  } catch (err) {
    // Already registered or PIN required — safe to ignore for connection.
    console.warn('[whatsapp register]', err.message);
  }
}

async function labeledStep(step, fn) {
  try {
    return await fn();
  } catch (err) {
    err.message = `[${step}] ${err.message}`;
    throw err;
  }
}

function getWhatsAppIntegration(company) {
  return company.channelIntegrations?.whatsapp || {};
}

function sanitizeWhatsAppIntegration(integration) {
  const plain = integration?.toObject ? integration.toObject() : { ...integration };
  return {
    status: plain.status || 'disconnected',
    connectedAt: plain.connectedAt || null,
    lastError: plain.lastError || null,
    wabaId: plain.wabaId || null,
    phoneNumberId: plain.phoneNumberId || null,
    displayPhoneNumber: plain.displayPhoneNumber || null,
    verifiedName: plain.verifiedName || null,
    hasAccessToken: Boolean(plain.accessToken),
  };
}

function defaultWhatsAppIntegration() {
  return {
    status: 'disconnected',
    connectedAt: null,
    lastError: null,
    wabaId: null,
    phoneNumberId: null,
    displayPhoneNumber: null,
    verifiedName: null,
    accessToken: null,
  };
}

async function connectFromEmbeddedSignup(company, { code, wabaId, phoneNumberId }) {
  const accessToken = await labeledStep('exchange-code', () => exchangeCodeForToken(code));
  const details = await labeledStep('phone-details', () =>
    fetchPhoneNumberDetails(phoneNumberId, accessToken),
  );
  await labeledStep('subscribe', () => subscribeWabaToApp(wabaId, accessToken));
  await registerPhoneNumber(phoneNumberId, accessToken);

  ensureChannelIntegrations(company);
  company.channelIntegrations.whatsapp = {
    status: 'connected',
    connectedAt: new Date(),
    lastError: null,
    wabaId,
    phoneNumberId,
    displayPhoneNumber: details.display_phone_number || null,
    verifiedName: details.verified_name || null,
    accessToken,
  };

  await company.save();
  return sanitizeWhatsAppIntegration(company.channelIntegrations.whatsapp);
}

// Connect using an access token the user pastes in directly (test number or
// a long-lived system-user token). Skips the OAuth code exchange.
async function connectWithToken(company, { accessToken, wabaId, phoneNumberId }) {
  const details = await labeledStep('phone-details', () =>
    fetchPhoneNumberDetails(phoneNumberId, accessToken),
  );
  await labeledStep('subscribe', () => subscribeWabaToApp(wabaId, accessToken));
  await registerPhoneNumber(phoneNumberId, accessToken);

  ensureChannelIntegrations(company);
  company.channelIntegrations.whatsapp = {
    status: 'connected',
    connectedAt: new Date(),
    lastError: null,
    wabaId,
    phoneNumberId,
    displayPhoneNumber: details.display_phone_number || null,
    verifiedName: details.verified_name || null,
    accessToken,
  };

  await company.save();
  return sanitizeWhatsAppIntegration(company.channelIntegrations.whatsapp);
}

async function disconnectWhatsApp(company) {
  ensureChannelIntegrations(company);
  company.channelIntegrations.whatsapp = defaultWhatsAppIntegration();
  await company.save();
  return sanitizeWhatsAppIntegration(company.channelIntegrations.whatsapp);
}

async function sendWhatsAppMessage(accessToken, phoneNumberId, toWaId, text) {
  return graphPost(`/${phoneNumberId}/messages`, accessToken, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toWaId,
    type: 'text',
    text: { preview_url: false, body: text },
  });
}

async function sendReplyForTicket(companyId, ticket, text) {
  const waId = ticket.whatsapp?.waId;
  const phoneNumberId = ticket.whatsapp?.phoneNumberId;
  if (!waId || !phoneNumberId) {
    throw new Error('This ticket has no WhatsApp recipient');
  }

  const plainText = htmlToPlainText(text);
  if (!plainText) return null;

  const Company = require('../models/Company');
  const company = await Company.findById(companyId).select(
    '+channelIntegrations.whatsapp.accessToken',
  );
  const token = company?.channelIntegrations?.whatsapp?.accessToken;
  if (!token) throw new Error('WhatsApp is not connected for this workspace');

  return sendWhatsAppMessage(token, phoneNumberId, waId, plainText);
}

module.exports = {
  isWhatsAppConfigured,
  getEmbeddedSignupConfig,
  getWhatsAppIntegration,
  sanitizeWhatsAppIntegration,
  defaultWhatsAppIntegration,
  connectFromEmbeddedSignup,
  connectWithToken,
  disconnectWhatsApp,
  sendReplyForTicket,
};
