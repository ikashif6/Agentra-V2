const express = require('express');
const { body } = require('express-validator');

const workspaceController = require('../controllers/workspace.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

router.use(resolveTenant);
router.use(protect);

router.get(
  '/branding',
  authorize('owner', 'admin', 'manager', 'agent'),
  workspaceController.getBranding,
);

router.get(
  '/setup-status',
  authorize('owner', 'admin'),
  workspaceController.getSetupStatus,
);

router.patch(
  '/branding',
  authorize('owner', 'admin'),
  [
    body('primaryColor').optional().matches(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/),
    body('theme').optional().isIn(['light', 'dark', 'system']),
    body('logo').optional({ nullable: true }).isString(),
    body('logoDark').optional({ nullable: true }).isString(),
    body('favicon').optional({ nullable: true }).isString(),
    body('browserTitle').optional({ nullable: true }).isString().isLength({ max: 80 }),
    body('tagline').optional({ nullable: true }).isString().isLength({ max: 160 }),
    body('logoWidth').optional().isInt({ min: 24, max: 280 }),
    body('logoHeight').optional().isInt({ min: 16, max: 120 }),
  ],
  validate,
  workspaceController.updateBranding,
);

router.delete(
  '/',
  authorize('owner', 'admin'),
  [body('confirmSubdomain').trim().notEmpty().withMessage('confirmSubdomain is required')],
  validate,
  workspaceController.deleteWorkspace,
);

module.exports = router;
