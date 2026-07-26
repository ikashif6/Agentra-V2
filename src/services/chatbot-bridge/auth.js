/**
 * Shared-secret auth for chatbot ↔ Agentra bridge calls.
 */

function getBridgeSecret() {
  return String(process.env.CHATBOT_BRIDGE_SECRET || process.env.ENGINE_SHARED_SECRET || '').trim();
}

function assertBridgeAuth(req) {
  const expected = getBridgeSecret();
  if (!expected) {
    const err = new Error('Chatbot bridge secret is not configured');
    err.status = 503;
    throw err;
  }
  const header = String(req.headers['x-chatbot-bridge-secret'] || req.headers['x-engine-secret'] || '').trim();
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const provided = header || bearer;
  if (!provided || provided !== expected) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
}

function bridgeAuthMiddleware(req, res, next) {
  try {
    assertBridgeAuth(req);
    next();
  } catch (err) {
    res.status(err.status || 401).json({ success: false, message: err.message || 'Unauthorized' });
  }
}

module.exports = {
  getBridgeSecret,
  assertBridgeAuth,
  bridgeAuthMiddleware,
};
