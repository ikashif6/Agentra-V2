const express = require('express');
const { body } = require('express-validator');
const aiAgentController = require('../controllers/ai-agent.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

router.use(resolveTenant);
router.use(protect);

router.get(
  '/settings',
  authorize('owner', 'admin'),
  aiAgentController.getSettings,
);

router.patch(
  '/settings',
  authorize('owner', 'admin'),
  [
    body('enabledChannels').optional().isObject(),
    body('instructions').optional().isString(),
    body('escalationKeywords').optional().isArray(),
    body('allowedActions').optional().isObject(),
    body('liveChatAiEnabled').optional().isBoolean(),
  ],
  validate,
  aiAgentController.updateSettings,
);

module.exports = router;
