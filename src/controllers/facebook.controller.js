const crypto = require('crypto');
const Company = require('../models/Company');
const response = require('../utils/apiResponse');
const { verifyOAuthState } = require('../utils/token');
const { processMessengerWebhook } = require('../services/messenger-inbound.service');
const { processInstagramWebhook } = require('../services/instagram-inbound.service');
const {
  isFacebookConfigured,
  buildFacebookOAuthUrl,
  buildSettingsRedirect,
  getOAuthRedirectUri,
  getFacebookIntegration,
  sanitizeFacebookIntegration,
  handleOAuthCallback,
  connectPendingPage,
  disconnectFacebook,
  verifyWebhookRequest,
} = require('../services/facebook.service');

async function loadCompanyWithSecrets(companyId) {
  return Company.findById(companyId).select(
    '+channelIntegrations.facebook.pageAccessToken +channelIntegrations.facebook.userAccessToken',
  );
}

exports.getStatus = async (req, res, next) => {
  try {
    const integration = getFacebookIntegration(req.company);
    return response.success(res, {
      facebook: sanitizeFacebookIntegration(integration),
      configured: isFacebookConfigured(),
      oauthRedirectUri: getOAuthRedirectUri(),
    });
  } catch (err) {
    next(err);
  }
};

exports.getOAuthUrl = async (req, res, next) => {
  try {
    if (!isFacebookConfigured()) {
      return response.badRequest(
        res,
        'Facebook is not configured yet. Add META_APP_ID and META_APP_SECRET to the server environment.',
      );
    }

    const returnOrigin = req.query.returnOrigin || req.headers.origin;

    const url = buildFacebookOAuthUrl({
      companyId: req.company._id,
      subdomain: req.company.subdomain,
      userId: req.user._id,
      returnOrigin,
    });

    return response.success(res, { url });
  } catch (err) {
    next(err);
  }
};

exports.oauthCallback = async (req, res, next) => {
  try {
    const { code, state, error, error_description: errorDescription } = req.query;

    if (!state) {
      return res.status(400).send('Missing OAuth state');
    }

    let payload;
    try {
      payload = verifyOAuthState(String(state));
    } catch {
      return res.status(400).send('OAuth session expired');
    }

    const subdomain = payload.subdomain;
    const returnOrigin = payload.returnOrigin;

    if (error) {
      return res.redirect(
        buildSettingsRedirect(subdomain, {
          facebook: 'error',
          message: errorDescription || error,
        }, returnOrigin),
      );
    }

    if (!code) {
      return res.redirect(
        buildSettingsRedirect(subdomain, {
          facebook: 'error',
          message: 'Facebook did not return an authorization code',
        }, returnOrigin),
      );
    }

    const company = await loadCompanyWithSecrets(payload.companyId);
    if (!company) {
      return res.redirect(
        buildSettingsRedirect(subdomain, {
          facebook: 'error',
          message: 'Workspace not found',
        }, returnOrigin),
      );
    }

    let result;
    try {
      result = await handleOAuthCallback(String(code), company);
    } catch (connectErr) {
      console.error('[facebook oauth callback]', connectErr);
      return res.redirect(
        buildSettingsRedirect(subdomain, {
          facebook: 'error',
          message: connectErr.message || 'Could not connect Facebook',
        }, returnOrigin),
      );
    }

    if (result.kind === 'connected') {
      return res.redirect(
        buildSettingsRedirect(subdomain, {
          facebook: 'connected',
          page: result.pageName || '',
        }, returnOrigin),
      );
    }

    if (result.kind === 'select_page') {
      return res.redirect(
        buildSettingsRedirect(subdomain, {
          facebook: 'select_page',
        }, returnOrigin),
      );
    }

    return res.redirect(
      buildSettingsRedirect(subdomain, {
        facebook: 'error',
        message: result.message || 'Could not connect Facebook',
      }, returnOrigin),
    );
  } catch (err) {
    next(err);
  }
};

exports.connectPage = async (req, res, next) => {
  try {
    const { pageId } = req.body;
    if (!pageId) {
      return response.badRequest(res, 'pageId is required');
    }

    const company = await loadCompanyWithSecrets(req.company._id);
    const facebook = await connectPendingPage(company, String(pageId));

    return response.success(res, { facebook }, 'Facebook Page connected');
  } catch (err) {
    next(err);
  }
};

exports.disconnect = async (req, res, next) => {
  try {
    const company = await loadCompanyWithSecrets(req.company._id);
    const facebook = await disconnectFacebook(company);
    return response.success(res, { facebook }, 'Facebook disconnected');
  } catch (err) {
    next(err);
  }
};

exports.verifyWebhook = (req, res) => {
  const challenge = verifyWebhookRequest(
    req.query['hub.mode'],
    req.query['hub.verify_token'],
    req.query['hub.challenge'],
  );

  if (challenge) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

function verifyWebhookSignature(req) {
  const secret = process.env.META_APP_SECRET;
  const signature = req.get('x-hub-signature-256');

  // If we cannot verify (missing secret / header / raw body), don't block delivery.
  if (!secret || !signature || !req.rawBody) return true;

  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

exports.handleWebhook = async (req, res) => {
  if (!verifyWebhookSignature(req)) {
    return res.sendStatus(403);
  }

  // Acknowledge immediately — Meta requires a fast 200 or it retries/disables.
  res.sendStatus(200);

  try {
    const object = req.body?.object;
    if (object === 'instagram') {
      await processInstagramWebhook(req.body);
    } else {
      await processMessengerWebhook(req.body);
    }
  } catch (err) {
    console.error('[meta webhook]', err.message);
  }
};
