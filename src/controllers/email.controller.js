const Company = require('../models/Company');
const response = require('../utils/apiResponse');
const {
  getSupportedProviders,
  getEmailIntegration,
  sanitizeEmailIntegration,
  connectImap,
  disconnectEmail,
  guessPreset,
  providerPresets,
} = require('../services/email-channel.service');

async function loadCompany(companyId) {
  return Company.findById(companyId).select('+channelIntegrations.email.secret');
}

exports.getStatus = async (req, res, next) => {
  try {
    const integration = getEmailIntegration(req.company);
    return response.success(res, {
      email: sanitizeEmailIntegration(integration),
      providers: getSupportedProviders(),
      presets: Object.keys(providerPresets),
    });
  } catch (err) {
    next(err);
  }
};

// Autofill IMAP/SMTP settings for a given address (best effort).
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
