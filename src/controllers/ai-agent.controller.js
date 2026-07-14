const response = require('../utils/apiResponse');
const {
  getAiAgentConfig,
  updateAiAgentConfig,
  AI_CHANNEL_KEYS,
} = require('../services/ai-agent-config.service');

exports.getSettings = async (req, res, next) => {
  try {
    const config = getAiAgentConfig(req.company);
    return response.success(res, {
      aiAgent: config,
      channelKeys: AI_CHANNEL_KEYS,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const config = await updateAiAgentConfig(req.company, req.body || {});
    return response.success(res, { aiAgent: config }, 'AI Agent settings updated');
  } catch (err) {
    if (err.statusCode === 400) return response.badRequest(res, err.message);
    next(err);
  }
};
