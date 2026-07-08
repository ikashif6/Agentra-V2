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
  authorize('owner', 'admin', 'agent'),
  workspaceController.getBranding,
);

router.patch(
  '/branding',
  authorize('owner', 'admin'),
  [
    body('primaryColor').optional().matches(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/),
    body('theme').optional().isIn(['light', 'dark', 'system']),
    body('logo').optional({ nullable: true }).isString(),
  ],
  validate,
  workspaceController.updateBranding,
);

module.exports = router;
