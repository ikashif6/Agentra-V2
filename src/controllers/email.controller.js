const Company = require('../models/Company');
const response = require('../utils/apiResponse');
const {
  getSupportedProviders,
  getEmailIntegration,
  sanitizeEmailIntegration,
  connectImap,
  connectGoogleOAuth,
  connectMicrosoftOAuth,
  disconnectEmail,
  guessPreset,
  providerPresets,
} = require('../services/email-channel.service');
const { verifyOAuthState } = require('../utils/token');
const oauthProviders = require('../services/oauth-providers.service');

async function loadCompany(companyId) {
  return Company.findById(companyId).select('+channelIntegrations.email.secret');
}

exports.getStatus = async (req, res, next) => {
  try {
    const company = await loadCompany(req.company._id);
    const integration = getEmailIntegration(company);
    if (integration.status === 'connected' && !integration.secret) {
      integration.status = 'error';
      integration.lastError =
        'Mailbox credentials are missing. Reconnect the mailbox to resume syncing.';
      await company.save();
    }
    return response.success(res, {
      email: sanitizeEmailIntegration(integration),
      providers: getSupportedProviders(),
      presets: Object.keys(providerPresets),
    });
  } catch (err) {
    next(err);
  }
};

exports.guessSettings = async (req, res, next) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    const preset = guessPreset(email);
    return response.success(res, { preset: preset || null });
  } catch (err) {
    next(err);
  }
};

exports.connect = async (req, res, next) => {
  try {
    const {
      email,
      password,
      displayName,
      preset,
      imapHost,
      imapPort,
      imapSecure,
      smtpHost,
      smtpPort,
      smtpSecure,
    } = req.body;

    if (!email) return response.badRequest(res, 'Email is required');
    if (!password) return response.badRequest(res, 'Password is required');

    const company = await loadCompany(req.company._id);

    let integration;
    try {
      integration = await connectImap(company, {
        email,
        password,
        displayName,
        preset,
        imapHost,
        imapPort,
        imapSecure,
        smtpHost,
        smtpPort,
        smtpSecure,
      });
    } catch (connectErr) {
      console.error('[email connect]', connectErr.message);
      return response.badRequest(res, connectErr.message || 'Could not connect email');
    }

    return response.success(res, { email: integration }, 'Email connected');
  } catch (err) {
    next(err);
  }
};

exports.disconnect = async (req, res, next) => {
  try {
    const company = await loadCompany(req.company._id);
    const email = await disconnectEmail(company);
    return response.success(res, { email }, 'Email disconnected');
  } catch (err) {
    next(err);
  }
};

exports.getGoogleOAuthUrl = async (req, res, next) => {
  try {
    if (!oauthProviders.isGoogleConfigured()) {
      return response.badRequest(res, 'Google email connect is not configured');
    }
    const url = oauthProviders.buildGoogleAuthUrl({
      purpose: 'google_email',
      companyId: req.company._id,
      subdomain: req.company.subdomain,
      userId: req.user._id,
      returnOrigin: req.query.returnOrigin || req.headers.origin,
      returnPath:
        typeof req.query.returnPath === 'string' ? req.query.returnPath : '/settings?item=email',
    });
    return response.success(res, { url });
  } catch (err) {
    next(err);
  }
};

exports.getMicrosoftOAuthUrl = async (req, res, next) => {
  try {
    if (!oauthProviders.isMicrosoftConfigured()) {
      return response.badRequest(res, 'Microsoft email connect is not configured');
    }
    const url = oauthProviders.buildMicrosoftAuthUrl({
      purpose: 'microsoft_email',
      companyId: req.company._id,
      subdomain: req.company.subdomain,
      userId: req.user._id,
      returnOrigin: req.query.returnOrigin || req.headers.origin,
      returnPath:
        typeof req.query.returnPath === 'string' ? req.query.returnPath : '/settings?item=email',
    });
    return response.success(res, { url });
  } catch (err) {
    next(err);
  }
};

exports.googleOAuthCallback = async (req, res) => {
  try {
    const { code, state, error, error_description: errorDescription } = req.query;
    if (!state) return res.status(400).send('Missing OAuth state');
    let payload;
    try {
      payload = verifyOAuthState(String(state));
    } catch {
      return res.status(400).send('OAuth session expired');
    }
    if (payload.purpose !== 'google_email') return res.status(400).send('Invalid OAuth state');

    const redirectErr = (message) =>
      res.redirect(
        oauthProviders.buildSettingsRedirect(
          payload.subdomain,
          { email: 'error', message },
          payload.returnOrigin,
          payload.returnPath,
        ),
      );

    if (error) return redirectErr(errorDescription || error);
    if (!code) return redirectErr('Google did not return an authorization code');

    const company = await loadCompany(payload.companyId);
    if (!company) return redirectErr('Workspace not found');

    try {
      const tokens = await oauthProviders.exchangeGoogleCode(String(code), 'email');
      const profile = await oauthProviders.fetchGoogleProfile(tokens.access_token);
      if (!profile.email) return redirectErr('Google did not return an email address');
      if (!tokens.refresh_token) {
        return redirectErr(
          'Google did not return a refresh token. Remove Agentra from your Google account access and try again.',
        );
      }
      await connectGoogleOAuth(company, { tokens, profile });
    } catch (err) {
      console.error('[email google oauth]', err);
      return redirectErr(err.message || 'Could not connect Gmail');
    }

    return res.redirect(
      oauthProviders.buildSettingsRedirect(
        payload.subdomain,
        { email: 'connected', provider: 'google' },
        payload.returnOrigin,
        payload.returnPath,
      ),
    );
  } catch (err) {
    console.error('[email google oauth fatal]', err);
    return res.status(500).send(err.message || 'Google email connect failed');
  }
};

exports.microsoftOAuthCallback = async (req, res) => {
  try {
    const { code, state, error, error_description: errorDescription } = req.query;
    if (!state) return res.status(400).send('Missing OAuth state');
    let payload;
    try {
      payload = verifyOAuthState(String(state));
    } catch {
      return res.status(400).send('OAuth session expired');
    }
    if (payload.purpose !== 'microsoft_email') return res.status(400).send('Invalid OAuth state');

    const redirectErr = (message) =>
      res.redirect(
        oauthProviders.buildSettingsRedirect(
          payload.subdomain,
          { email: 'error', message },
          payload.returnOrigin,
          payload.returnPath,
        ),
      );

    if (error) return redirectErr(errorDescription || error);
    if (!code) return redirectErr('Microsoft did not return an authorization code');

    const company = await loadCompany(payload.companyId);
    if (!company) return redirectErr('Workspace not found');

    try {
      const tokens = await oauthProviders.exchangeMicrosoftCode(String(code), 'email');
      const profile = await oauthProviders.fetchMicrosoftProfile(tokens.access_token);
      if (!profile.email) return redirectErr('Microsoft did not return an email address');
      await connectMicrosoftOAuth(company, { tokens, profile });
    } catch (err) {
      console.error('[email microsoft oauth]', err);
      return redirectErr(err.message || 'Could not connect Outlook');
    }

    return res.redirect(
      oauthProviders.buildSettingsRedirect(
        payload.subdomain,
        { email: 'connected', provider: 'microsoft' },
        payload.returnOrigin,
        payload.returnPath,
      ),
    );
  } catch (err) {
    console.error('[email microsoft oauth fatal]', err);
    return res.status(500).send(err.message || 'Microsoft email connect failed');
  }
};
