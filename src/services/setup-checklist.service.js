const SETUP_STEP_IDS = ['store', 'channels', 'ai', 'workspace', 'team'];

function isConnected(status) {
  return status === 'connected';
}

function liveStepFlags(company) {
  const emailConnected = isConnected(company.channelIntegrations?.email?.status);
  const liveChatEnabled = Boolean(company.liveChat?.enabled);
  const facebookConnected = isConnected(company.channelIntegrations?.facebook?.status);
  const instagramConnected = isConnected(company.channelIntegrations?.instagram?.status);
  const whatsappConnected = isConnected(company.channelIntegrations?.whatsapp?.status);

  const channels =
    emailConnected
    || liveChatEnabled
    || facebookConnected
    || instagramConnected
    || whatsappConnected;

  const enabled = company.aiAgent?.enabledChannels || {};
  const ai =
    (Boolean(enabled.liveChat) && Boolean(company.liveChat?.ai?.enabled) && liveChatEnabled)
    || (Boolean(enabled.email) && emailConnected)
    || (Boolean(enabled.facebook) && facebookConnected)
    || (Boolean(enabled.instagram) && instagramConnected)
    || (Boolean(enabled.whatsapp) && whatsappConnected);

  const saved = company.setupChecklist || {};

  return {
    store: Boolean(saved.store) || isConnected(company.storeIntegration?.status),
    channels: Boolean(saved.channels) || channels,
    ai: Boolean(saved.ai) || ai,
    workspace: Boolean(saved.workspace),
    team: Boolean(saved.team),
  };
}

function allDone(flags) {
  return SETUP_STEP_IDS.every((id) => Boolean(flags[id]));
}

/**
 * Resolve setup checklist for a company.
 * If setup was already completed, returns sticky flags without re-deriving.
 * Otherwise merges live company state into sticky flags and persists progress.
 */
async function getSetupChecklist(company) {
  const saved = company.setupChecklist || {};

  if (saved.completedAt) {
    return {
      store: true,
      channels: true,
      ai: true,
      workspace: true,
      team: true,
      completedAt: saved.completedAt,
      complete: true,
    };
  }

  const flags = liveStepFlags(company);
  const complete = allDone(flags);

  const next = {
    store: flags.store,
    channels: flags.channels,
    ai: flags.ai,
    workspace: flags.workspace,
    team: flags.team,
  };

  const changed =
    Boolean(saved.store) !== next.store
    || Boolean(saved.channels) !== next.channels
    || Boolean(saved.ai) !== next.ai
    || Boolean(saved.workspace) !== next.workspace
    || Boolean(saved.team) !== next.team
    || (complete && !saved.completedAt);

  if (changed) {
    company.setupChecklist = {
      ...saved,
      ...next,
      ...(complete ? { completedAt: new Date() } : {}),
    };
    company.markModified('setupChecklist');
    await company.save();
  }

  return {
    ...flags,
    completedAt: company.setupChecklist?.completedAt || null,
    complete,
  };
}

async function markSetupStep(company, stepId) {
  if (!SETUP_STEP_IDS.includes(stepId)) return getSetupChecklist(company);

  if (!company.setupChecklist) company.setupChecklist = {};
  company.setupChecklist[stepId] = true;
  company.markModified('setupChecklist');

  const flags = {
    store: Boolean(company.setupChecklist.store),
    channels: Boolean(company.setupChecklist.channels),
    ai: Boolean(company.setupChecklist.ai),
    workspace: Boolean(company.setupChecklist.workspace),
    team: Boolean(company.setupChecklist.team),
  };

  if (allDone(flags) && !company.setupChecklist.completedAt) {
    company.setupChecklist.completedAt = new Date();
    company.markModified('setupChecklist');
  }

  await company.save();
  return getSetupChecklist(company);
}

module.exports = {
  SETUP_STEP_IDS,
  getSetupChecklist,
  markSetupStep,
  liveStepFlags,
};
