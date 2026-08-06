const Company = require('../models/Company');
const { ingestInboundInstagramMessage } = require('./instagram-inbound.service');

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';

async function graphGet(path, accessToken, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}${path}`);
  url.searchParams.set('access_token', accessToken);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new Error(body?.error?.message || `Instagram poll API error (${res.status})`);
  }
  return body;
}

async function pollCompanyInstagram(company) {
  const ig = company.channelIntegrations?.instagram || {};
  const pageToken = ig.pageAccessToken;
  const pageId = ig.pageId;
  const igUserId = ig.igUserId ? String(ig.igUserId) : null;

  if (!pageToken || !pageId || !igUserId) return { ingested: 0 };

  const conversations = await graphGet(`/${pageId}/conversations`, pageToken, {
    platform: 'instagram',
    fields: 'id,updated_time,participants',
    limit: '15',
  });

  let ingested = 0;

  for (const conv of conversations?.data || []) {
    if (!conv?.id) continue;

    let thread;
    try {
      thread = await graphGet(`/${conv.id}`, pageToken, {
        fields: 'messages.limit(25){id,created_time,from,to,message}',
      });
    } catch (err) {
      console.warn('[instagram poll] thread', conv.id, err.message);
      continue;
    }

    // Graph returns newest-first; process oldest-first so ticket order is natural.
    const messages = [...(thread?.messages?.data || [])].reverse();

    for (const msg of messages) {
      const fromId = msg?.from?.id ? String(msg.from.id) : null;
      if (!fromId || fromId === igUserId) continue;

      const text = (msg.message || '').trim();
      if (!text) continue;

      try {
        const ticket = await ingestInboundInstagramMessage(company, pageToken, {
          igUserId,
          igsid: fromId,
          text,
          externalId: msg.id ? String(msg.id) : undefined,
          sentAt: msg.created_time,
          username: msg.from?.username,
        });
        if (ticket) ingested += 1;
      } catch (err) {
        console.error('[instagram poll] ingest', err.message);
      }
    }
  }

  return { ingested };
}

async function pollAllInstagramInboxes() {
  const companies = await Company.find({
    'channelIntegrations.instagram.status': 'connected',
  }).select('+channelIntegrations.instagram.pageAccessToken');

  let total = 0;
  for (const company of companies) {
    try {
      const result = await pollCompanyInstagram(company);
      total += result.ingested || 0;
    } catch (err) {
      console.error('[instagram poll]', company.subdomain, err.message);
    }
  }

  if (total > 0) {
    console.log(`[instagram poll] ingested ${total} message(s)`);
  }

  return { ingested: total };
}

module.exports = {
  pollAllInstagramInboxes,
  pollCompanyInstagram,
};
