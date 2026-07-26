/**
 * HTTP client for the standalone ecommerce chatbot (`Chatbot AI Agent`).
 */

function engineBaseUrl() {
  return String(process.env.CHATBOT_ENGINE_URL || 'http://localhost:5600').replace(/\/$/, '');
}

function sharedSecret() {
  return String(process.env.CHATBOT_BRIDGE_SECRET || process.env.ENGINE_SHARED_SECRET || '').trim();
}

async function engineFetch(path, { method = 'GET', body } = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const secret = sharedSecret();
  if (secret) {
    headers['x-chatbot-bridge-secret'] = secret;
  }

  const res = await fetch(`${engineBaseUrl()}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const err = new Error(json?.message || `Chatbot engine error (${res.status})`);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

async function createOrResumeSession({
  workspaceId,
  sessionToken,
  visitorEmail,
  channel = 'web',
  resumeOnly = false,
}) {
  const json = await engineFetch('/v1/chat/session', {
    method: 'POST',
    body: {
      workspaceId,
      sessionToken,
      visitorEmail,
      channel,
      resumeOnly,
    },
  });
  return json.data;
}

async function runTurn({
  workspaceId,
  conversationId,
  sessionToken,
  message,
  visitorEmail,
  channel = 'web',
  formSubmission,
  choiceId,
  attachments,
}) {
  const json = await engineFetch('/v1/chat/turn', {
    method: 'POST',
    body: {
      workspaceId,
      conversationId,
      sessionToken,
      message,
      visitorEmail,
      channel,
      formSubmission,
      choiceId,
      attachments,
    },
  });
  return json.data;
}

async function health() {
  const res = await fetch(`${engineBaseUrl()}/health`);
  if (!res.ok) throw new Error(`Chatbot engine unhealthy (${res.status})`);
  return res.json();
}

module.exports = {
  engineBaseUrl,
  createOrResumeSession,
  runTurn,
  health,
};
