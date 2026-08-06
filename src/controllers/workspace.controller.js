const response = require('../utils/apiResponse');
const {
  getWorkspaceBranding,
  updateWorkspaceBranding,
} = require('../services/workspace-branding.service');
const { getSetupChecklist } = require('../services/setup-checklist.service');
const { deleteWorkspace } = require('../services/workspace-delete.service');

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

/**
 * DELETE /workspace
 * Permanently delete this workspace. Owner or admin only.
 * Body: { confirmSubdomain: string } must match company.subdomain
 */
exports.deleteWorkspace = async (req, res, next) => {
  try {
    const confirmSubdomain = String(req.body?.confirmSubdomain || '')
      .trim()
      .toLowerCase();
    const expected = String(req.company.subdomain || '').toLowerCase();

    if (!confirmSubdomain || confirmSubdomain !== expected) {
      return response.badRequest(
        res,
        'Type your workspace subdomain exactly to confirm deletion.',
      );
    }

    if (!['owner', 'admin'].includes(req.user.role)) {
      return response.forbidden(res, 'Only workspace owners and admins can delete this workspace.');
    }

    const deleted = await deleteWorkspace(req.company._id);

    return response.success(
      res,
      { subdomain: deleted.subdomain },
      'Workspace deleted permanently',
    );
  } catch (err) {
    if (err.statusCode === 404) {
      return response.notFound(res, err.message);
    }
    next(err);
  }
};
