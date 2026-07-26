const Company = require('../models/Company');
const User = require('../models/User');
const response = require('../utils/apiResponse');
const {
  generateWidgetKey,
  sanitizeLiveChatForSettings,
  mergeLiveChatConfig,
} = require('../services/live-chat-config.service');
const {
  listKnowledge,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
} = require('../services/live-chat-knowledge.service');
const { createKnowledgeFromDocument } = require('../services/live-chat-knowledge-upload.service');
const { syncStoreProducts } = require('../services/product-sync.service');
const { syncWidgetInstall, uninstallShopifyWidget } = require('../services/live-chat-shopify.service');
const { bumpAssistantConfigVersion } = require('../services/assistant-engine/assistant-config-version.service');
const { clearRuntimeConfigCache } = require('../services/assistant-engine/assistant-runtime-config.service');

async function bumpConfigAfterWrite(companyId, reason) {
  try {
    await bumpAssistantConfigVersion(companyId, reason);
    clearRuntimeConfigCache(String(companyId));
  } catch (err) {
    console.warn('[live-chat] assistant config version bump failed', err.message);
  }
}

const STORE_SECRET_SELECT =
  '+storeIntegration.shopify.accessToken ' +
  '+storeIntegration.shopify.refreshToken ' +
  '+storeIntegration.woocommerce.consumerKey ' +
  '+storeIntegration.woocommerce.consumerSecret ' +
  '+storeIntegration.custom.apiKey';

const AGENT_POPULATE = {
  path: 'liveChat.agents',
  select: 'firstName lastName avatar role isActive isOnline',
};

function apiBaseFromReq(req) {
  return `${req.protocol}://${req.get('host')}/api/v1`;
}

async function populateLiveChatAgents(company) {
  if (!company) return company;
  await company.populate(AGENT_POPULATE);
  return company;
}

exports.getSettings = async (req, res, next) => {
  try {
    const company = await populateLiveChatAgents(req.company);
    return response.success(res, {
      liveChat: sanitizeLiveChatForSettings(company, apiBaseFromReq(req)),
    });
  } catch (err) {
    next(err);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const company = req.company;
    const body = req.body || {};
    const liveChat = company.liveChat || {};

    if (body.enabled !== undefined) liveChat.enabled = Boolean(body.enabled);
    // Domains come from the connected store — do not accept a manual list from the client.
    if (body.appearance) liveChat.appearance = { ...liveChat.appearance?.toObject?.(), ...body.appearance };
    if (body.content) {
      const content = { ...liveChat.content?.toObject?.(), ...body.content };
      if (body.content.quickReplies !== undefined) {
        content.quickReplies = Array.isArray(body.content.quickReplies)
          ? body.content.quickReplies
              .slice(0, 4)
              .map((s) => String(s || '').trim())
              .filter(Boolean)
          : [];
      }
      liveChat.content = content;
    }
    if (body.behavior) liveChat.behavior = { ...liveChat.behavior?.toObject?.(), ...body.behavior };
    if (body.ai) {
      liveChat.ai = {
        ...mergeLiveChatConfig(company).ai,
        ...body.ai,
        allowedActions: {
          ...mergeLiveChatConfig(company).ai.allowedActions,
          ...(body.ai.allowedActions || {}),
        },
      };
      if (liveChat.ai.allowedActions.maxRefundAmount == null) {
        liveChat.ai.allowedActions.maxRefundAmount = 100;
      }
    }

    if (body.agents !== undefined) {
      const requested = Array.isArray(body.agents)
        ? body.agents.map((id) => String(id || '').trim()).filter(Boolean).slice(0, 8)
        : [];
      if (!requested.length) {
        liveChat.agents = [];
      } else {
        const valid = await User.find({
          _id: { $in: requested },
          company: company._id,
          role: { $in: ['owner', 'admin', 'manager', 'agent'] },
          isActive: true,
        }).select('_id');
        const allowed = new Set(valid.map((u) => String(u._id)));
        // Preserve client order
        liveChat.agents = requested.filter((id) => allowed.has(id));
      }
    }

    if (!liveChat.widgetKey) {
      liveChat.widgetKey = generateWidgetKey();
    }
    if (liveChat.enabled && !liveChat.connectedAt) {
      liveChat.connectedAt = new Date();
    }

    company.liveChat = liveChat;
    company.markModified('liveChat');

    try {
      const withSecrets = await Company.findById(company._id).select(STORE_SECRET_SELECT);
      withSecrets.liveChat = { ...(withSecrets.liveChat?.toObject?.() || {}), ...liveChat };
      await syncWidgetInstall(withSecrets);
      company.liveChat = withSecrets.liveChat;
      company.markModified('liveChat');
    } catch (installErr) {
      liveChat.lastError = installErr.message;
      company.liveChat = liveChat;
      company.markModified('liveChat');
    }

    await company.save();

    if (body.ai || body.behavior) {
      await bumpConfigAfterWrite(company._id, 'live_chat_settings');
    }

    if (body.syncProducts) {
      try {
        const withSecrets = await Company.findById(company._id).select(STORE_SECRET_SELECT);
        await syncStoreProducts(withSecrets);
      } catch (syncErr) {
        liveChat.lastError = syncErr.message;
        company.liveChat = liveChat;
        company.markModified('liveChat');
        await company.save();
      }
    }

    await populateLiveChatAgents(company);

    return response.success(
      res,
      { liveChat: sanitizeLiveChatForSettings(company, apiBaseFromReq(req)) },
      'Live chat settings saved',
    );
  } catch (err) {
    next(err);
  }
};

exports.regenerateWidgetKey = async (req, res, next) => {
  try {
    const company = await Company.findById(req.company._id).select(STORE_SECRET_SELECT);
    company.liveChat = company.liveChat || {};
    company.liveChat.widgetKey = generateWidgetKey();
    company.markModified('liveChat');
    await company.save();

    if (company.liveChat.enabled && company.storeIntegration?.provider === 'shopify') {
      try {
        await syncWidgetInstall(company);
        company.markModified('liveChat');
        await company.save();
      } catch (err) {
        company.liveChat.lastError = err.message;
        company.markModified('liveChat');
        await company.save();
      }
    }

    await populateLiveChatAgents(company);
    return response.success(
      res,
      { liveChat: sanitizeLiveChatForSettings(company, apiBaseFromReq(req)) },
      'Widget key regenerated',
    );
  } catch (err) {
    next(err);
  }
};

exports.installWidget = async (req, res, next) => {
  try {
    const company = await Company.findById(req.company._id).select(STORE_SECRET_SELECT);
    if (!company.liveChat?.widgetKey) {
      company.liveChat = company.liveChat || {};
      company.liveChat.widgetKey = generateWidgetKey();
    }
    company.liveChat.enabled = true;
    company.markModified('liveChat');
    const result = await syncWidgetInstall(company);
    company.markModified('liveChat');
    await company.save();
    await populateLiveChatAgents(company);
    return response.success(
      res,
      { liveChat: sanitizeLiveChatForSettings(company, apiBaseFromReq(req)), install: result },
      result.installed ? 'Chat widget installed on your store' : 'Live chat enabled',
    );
  } catch (err) {
    if (err.message && !err.statusCode) return response.badRequest(res, err.message);
    next(err);
  }
};

exports.uninstallWidget = async (req, res, next) => {
  try {
    const company = await Company.findById(req.company._id).select(STORE_SECRET_SELECT);
    await uninstallShopifyWidget(company);
    company.liveChat = company.liveChat || {};
    company.liveChat.enabled = false;
    company.liveChat.widgetInstalled = false;
    company.liveChat.installMethod = null;
    company.liveChat.shopifyScriptTagId = undefined;
    company.markModified('liveChat');
    await company.save();
    await populateLiveChatAgents(company);
    return response.success(
      res,
      { liveChat: sanitizeLiveChatForSettings(company, apiBaseFromReq(req)) },
      'Chat widget removed from your store',
    );
  } catch (err) {
    next(err);
  }
};

exports.listKnowledge = async (req, res, next) => {
  try {
    const articles = await listKnowledge(req.company._id);
    return response.success(res, { articles });
  } catch (err) {
    next(err);
  }
};

exports.createKnowledge = async (req, res, next) => {
  try {
    const article = await createKnowledge(req.company._id, {
      title: req.body.title,
      content: req.body.content,
      category: req.body.category,
      active: req.body.active !== false,
      sortOrder: req.body.sortOrder ?? 0,
    });
    await bumpConfigAfterWrite(req.company._id, 'knowledge_create');
    return response.created(res, { article }, 'Knowledge article created');
  } catch (err) {
    next(err);
  }
};

exports.uploadKnowledgeDocument = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) return response.badRequest(res, 'Choose a PDF, TXT, MD, or CSV file');
    const result = await createKnowledgeFromDocument(req.company._id, file);
    await bumpConfigAfterWrite(req.company._id, 'knowledge_import');
    return response.created(
      res,
      {
        articles: result.articles,
        sourceFileName: result.sourceFileName,
        chunkCount: result.chunkCount,
      },
      result.chunkCount > 1
        ? `Imported ${result.chunkCount} articles from ${result.sourceFileName}`
        : `Imported knowledge from ${result.sourceFileName}`,
    );
  } catch (err) {
    if (err.statusCode === 400) return response.badRequest(res, err.message);
    next(err);
  }
};

exports.updateKnowledge = async (req, res, next) => {
  try {
    const article = await updateKnowledge(req.company._id, req.params.id, req.body);
    if (!article) return response.notFound(res, 'Article not found');
    await bumpConfigAfterWrite(req.company._id, 'knowledge_update');
    return response.success(res, { article }, 'Knowledge article updated');
  } catch (err) {
    if (err.statusCode === 400) return response.badRequest(res, err.message);
    next(err);
  }
};

exports.deleteKnowledge = async (req, res, next) => {
  try {
    const article = await deleteKnowledge(req.company._id, req.params.id);
    if (!article) return response.notFound(res, 'Article not found');
    await bumpConfigAfterWrite(req.company._id, 'knowledge_delete');
    return response.success(res, {}, 'Knowledge article deleted');
  } catch (err) {
    next(err);
  }
};

exports.syncProducts = async (req, res, next) => {
  try {
    const company = await Company.findById(req.company._id).select(STORE_SECRET_SELECT);
    const result = await syncStoreProducts(company);
    await bumpConfigAfterWrite(req.company._id, 'product_sync');
    return response.success(res, result, 'Products synced');
  } catch (err) {
    if (err.message && !err.statusCode) return response.badRequest(res, err.message);
    next(err);
  }
};
