const Company = require('../models/Company');
const response = require('../utils/apiResponse');
const { ensureChannelIntegrations } = require('../services/channel-integrations.util');
const {
  isWhatsAppConfigured,
  getEmbeddedSignupConfig,
  getWhatsAppIntegration,
  sanitizeWhatsAppIntegration,
  connectFromEmbeddedSignup,
  connectWithToken,
  disconnectWhatsApp,
} = require('../services/whatsapp.service');

async function loadCompanyWithSecrets(companyId) {
  return Company.findById(companyId).select('+channelIntegrations.whatsapp.accessToken');
}

exports.getStatus = async (req, res, next) => {
  try {
    const company = await loadCompanyWithSecrets(req.company._id);
    const integration = getWhatsAppIntegration(company);
    // A number with no stored token can neither reply nor receive, so don't
    // keep showing it as connected — the workspace has to reconnect.
    if (integration.status === 'connected' && !integration.accessToken) {
      integration.status = 'error';
      integration.lastError =
        'WhatsApp credentials are missing. Reconnect WhatsApp to resume messaging.';
      await company.save();
    }
    return response.success(res, {
      whatsapp: sanitizeWhatsAppIntegration(integration),
      configured: isWhatsAppConfigured(),
    });
  } catch (err) {
    next(err);
  }
};

exports.getConfig = async (req, res, next) => {
  try {
    return response.success(res, { config: getEmbeddedSignupConfig() });
  } catch (err) {
    next(err);
  }
};

exports.connect = async (req, res, next) => {
  try {
    if (!isWhatsAppConfigured()) {
      return response.badRequest(
        res,
        'WhatsApp is not configured yet. Add META_APP_ID, META_APP_SECRET, and META_WA_CONFIG_ID to the server environment.',
      );
    }

    const { code, wabaId, phoneNumberId } = req.body;
    if (!code) return response.badRequest(res, 'Authorization code is required');
    if (!wabaId) return response.badRequest(res, 'wabaId is required');
    if (!phoneNumberId) return response.badRequest(res, 'phoneNumberId is required');

    const company = await loadCompanyWithSecrets(req.company._id);

    let whatsapp;
    try {
      whatsapp = await connectFromEmbeddedSignup(company, {
        code: String(code),
        wabaId: String(wabaId),
        phoneNumberId: String(phoneNumberId),
      });
    } catch (connectErr) {
      console.error('[whatsapp connect]', connectErr);
      ensureChannelIntegrations(company);
      company.channelIntegrations.whatsapp = {
        ...(company.channelIntegrations.whatsapp || {}),
        status: 'error',
        lastError: connectErr.message,
      };
      await company.save();
      return response.badRequest(res, connectErr.message || 'Could not connect WhatsApp');
    }

    return response.success(res, { whatsapp }, 'WhatsApp connected');
  } catch (err) {
    next(err);
  }
};

exports.connectManual = async (req, res, next) => {
  try {
    const { accessToken, wabaId, phoneNumberId } = req.body;
    if (!accessToken) return response.badRequest(res, 'accessToken is required');
    if (!wabaId) return response.badRequest(res, 'wabaId is required');
    if (!phoneNumberId) return response.badRequest(res, 'phoneNumberId is required');

    const company = await loadCompanyWithSecrets(req.company._id);

    let whatsapp;
    try {
      whatsapp = await connectWithToken(company, {
        accessToken: String(accessToken).trim(),
        wabaId: String(wabaId).trim(),
        phoneNumberId: String(phoneNumberId).trim(),
      });
    } catch (connectErr) {
      console.error('[whatsapp connect manual]', connectErr);
      ensureChannelIntegrations(company);
      company.channelIntegrations.whatsapp = {
        ...(company.channelIntegrations.whatsapp || {}),
        status: 'error',
        lastError: connectErr.message,
      };
      await company.save();
      return response.badRequest(res, connectErr.message || 'Could not connect WhatsApp');
    }

    return response.success(res, { whatsapp }, 'WhatsApp connected');
  } catch (err) {
    next(err);
  }
};

exports.disconnect = async (req, res, next) => {
  try {
    const company = await loadCompanyWithSecrets(req.company._id);
    const whatsapp = await disconnectWhatsApp(company);
    return response.success(res, { whatsapp }, 'WhatsApp disconnected');
  } catch (err) {
    next(err);
  }
};
