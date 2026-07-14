const DEFAULT_HELPDESK_AI = {
  overview: true,
  suggestedReply: true,
  replyTools: true,
  recommendedAction: true,
  riskDetection: true,
  autoTag: true,
  autoRouting: false,
  similarTickets: true,
  customerProfile: true,
  customerTimeline: true,
  contradictions: true,
  incidentDetection: true,
  mergeSuggestions: true,
  slaPrediction: true,
  resolutionCheck: true,
  qualityAssurance: true,
  agentCoaching: true,
  managerFeed: true,
  rootCauseAnalysis: true,
  churnRecovery: true,
  knowledgeGaps: true,
  draftArticles: true,
  outdatedKnowledge: true,
};

function getHelpdeskAiConfig(company) {
  const stored = company.helpdeskAi || {};
  const out = {};
  for (const [key, def] of Object.entries(DEFAULT_HELPDESK_AI)) {
    if (key === 'autoRouting') {
      out[key] = Boolean(stored[key]);
    } else {
      out[key] = stored[key] !== false;
    }
  }
  return out;
}

function isHelpdeskAiFeatureEnabled(company, featureKey) {
  const config = getHelpdeskAiConfig(company);
  return Boolean(config[featureKey]);
}

async function updateHelpdeskAiConfig(company, body = {}) {
  if (!company.helpdeskAi) company.helpdeskAi = { ...DEFAULT_HELPDESK_AI };

  for (const key of Object.keys(DEFAULT_HELPDESK_AI)) {
    if (body[key] !== undefined) {
      company.helpdeskAi[key] = Boolean(body[key]);
    }
  }

  if (body.autoRouting !== undefined) {
    if (!company.settings) company.settings = {};
    company.settings.autoAssignTickets = Boolean(body.autoRouting);
    company.markModified('settings');
  }

  company.markModified('helpdeskAi');
  await company.save();
  return getHelpdeskAiConfig(company);
}

module.exports = {
  DEFAULT_HELPDESK_AI,
  getHelpdeskAiConfig,
  isHelpdeskAiFeatureEnabled,
  updateHelpdeskAiConfig,
};
