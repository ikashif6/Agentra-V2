const response = require('../utils/apiResponse');
const {
  getWorkspaceBranding,
  updateWorkspaceBranding,
} = require('../services/workspace-branding.service');
const { getSetupChecklist } = require('../services/setup-checklist.service');

exports.getBranding = async (req, res, next) => {
  try {
    const setupChecklist = await getSetupChecklist(req.company);
    return response.success(res, {
      branding: getWorkspaceBranding(req.company),
      setupChecklist: {
        store: Boolean(setupChecklist.store),
        channels: Boolean(setupChecklist.channels),
        ai: Boolean(setupChecklist.ai),
        workspace: Boolean(setupChecklist.workspace),
        team: Boolean(setupChecklist.team),
        completedAt: setupChecklist.completedAt || null,
        complete: Boolean(setupChecklist.complete),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getSetupStatus = async (req, res, next) => {
  try {
    const setupChecklist = await getSetupChecklist(req.company);
    return response.success(res, { setupChecklist });
  } catch (err) {
    next(err);
  }
};

exports.updateBranding = async (req, res, next) => {
  try {
    const branding = await updateWorkspaceBranding(req.company, req.body);
    return response.success(res, { branding }, 'Workspace appearance updated');
  } catch (err) {
    if (err.statusCode === 400) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};
