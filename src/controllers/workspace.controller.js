const response = require('../utils/apiResponse');
const {
  getWorkspaceBranding,
  updateWorkspaceBranding,
} = require('../services/workspace-branding.service');

exports.getBranding = async (req, res, next) => {
  try {
    return response.success(res, {
      branding: getWorkspaceBranding(req.company),
      setupChecklist: {
        workspace: Boolean(req.company.setupChecklist?.workspace),
        team: Boolean(req.company.setupChecklist?.team),
      },
    });
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
