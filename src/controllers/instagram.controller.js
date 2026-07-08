const Company = require('../models/Company');
const response = require('../utils/apiResponse');
const { verifyOAuthState } = require('../utils/token');
const {
  isInstagramConfigured,
  buildInstagramOAuthUrl,
  getOAuthRedirectUri,
  getInstagramIntegration,
  sanitizeInstagramIntegration,
  handleOAuthCallback,
  connectPendingAccount,
  disconnectInstagram,
  buildSettingsRedirect,
} = require('../services/instagram.service');

async function loadCompanyWithSecrets(companyId) {
  return Company.findById(companyId).select(
    '+channelIntegrations.instagram.pageAccessToken +channelIntegrations.instagram.userAccessToken',
  );
}

function igRedirect(subdomain, params, returnOrigin) {
  return buildSettingsRedirect(subdomain, { item: 'instagram', ...params }, returnOrigin);
}

exports.getStatus = async (req, res, next) => {
  try {
    const integration = getInstagramIntegration(req.company);
    return response.success(res, {
      instagram: sanitizeInstagramIntegration(integration),
      configured: isInstagramConfigured(),
      oauthRedirectUri: getOAuthRedirectUri(),
    });
  } catch (err) {
    next(err);
  }
};

exports.getOAuthUrl = async (req, res, next) => {
  try {
    if (!isInstagramConfigured()) {
      return response.badRequest(
        res,
        'Instagram is not configured yet. Add META_APP_ID and META_APP_SECRET to the server environment.',
      );
    }

    const returnOrigin = req.query.returnOrigin || req.headers.origin;
    const url = buildInstagramOAuthUrl({
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

    if (!state) return res.status(400).send('Missing OAuth state');

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
        igRedirect(subdomain, { instagram: 'error', message: errorDescription || error }, returnOrigin),
      );
    }

    if (!code) {
      return res.redirect(
        igRedirect(subdomain, { instagram: 'error', message: 'Instagram did not return an authorization code' }, returnOrigin),
      );
    }

    const company = await loadCompanyWithSecrets(payload.companyId);
    if (!company) {
      return res.redirect(
        igRedirect(subdomain, { instagram: 'error', message: 'Workspace not found' }, returnOrigin),
      );
    }

    let result;
    try {
      result = await handleOAuthCallback(String(code), company);
    } catch (connectErr) {
      console.error('[instagram oauth callback]', connectErr);
      return res.redirect(
        igRedirect(subdomain, { instagram: 'error', message: connectErr.message || 'Could not connect Instagram' }, returnOrigin),
      );
    }

    if (result.kind === 'connected') {
      return res.redirect(
        igRedirect(subdomain, { instagram: 'connected', account: result.username || '' }, returnOrigin),
      );
    }

    if (result.kind === 'select_account') {
      return res.redirect(igRedirect(subdomain, { instagram: 'select_account' }, returnOrigin));
    }

    return res.redirect(
      igRedirect(subdomain, { instagram: 'error', message: result.message || 'Could not connect Instagram' }, returnOrigin),
    );
  } catch (err) {
    next(err);
  }
};

exports.connectAccount = async (req, res, next) => {
  try {
    const { igUserId } = req.body;
    if (!igUserId) return response.badRequest(res, 'igUserId is required');

    const company = await loadCompanyWithSecrets(req.company._id);
    const instagram = await connectPendingAccount(company, String(igUserId));

    return response.success(res, { instagram }, 'Instagram account connected');
  } catch (err) {
    next(err);
  }
};

exports.disconnect = async (req, res, next) => {
  try {
    const company = await loadCompanyWithSecrets(req.company._id);
    const instagram = await disconnectInstagram(company);
    return response.success(res, { instagram }, 'Instagram disconnected');
  } catch (err) {
    next(err);
  }
};
