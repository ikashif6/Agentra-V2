const crypto = require('crypto');
const { buildSettingsRedirect } = require('../services/tiktok.service');

function verifyTiktokSignature(req) {
  const secret = process.env.TIKTOK_CLIENT_SECRET;
  const header = req.get('TikTok-Signature') || req.get('tiktok-signature');
  const rawBody = req.rawBody;

  if (!secret || !header || !rawBody) return true;

  const parts = Object.fromEntries(
    String(header)
      .split(',')
      .map((piece) => piece.trim().split('='))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, value]),
  );

  const timestamp = parts.t;
  const signature = parts.s;
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** TikTok portal "Test URL" and live events — must return 200 quickly. */
exports.handleWebhook = (req, res) => {
  if (!verifyTiktokSignature(req)) {
    return res.sendStatus(403);
  }

  res.status(200).json({ success: true });
};

/** OAuth redirect target after Login Kit authorization (full connect flow TBD). */
exports.oauthCallback = (req, res) => {
  const { error, error_description: errorDescription, state } = req.query;

  if (error) {
    const message = errorDescription || error;
    if (state) {
      try {
        const subdomain = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8')).subdomain;
        if (subdomain) {
          return res.redirect(buildSettingsRedirect(subdomain, { tiktok: 'error', message }));
        }
      } catch {
        // fall through
      }
    }
    return res.status(400).send(message);
  }

  res.status(200).send(
    'TikTok authorization received. Agentra will finish the TikTok channel connection in a future update.',
  );
};
