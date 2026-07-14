const express = require('express');
const helpdeskAiController = require('../controllers/helpdesk-ai.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(resolveTenant);
router.use(protect);

router.get('/settings', authorize('owner', 'admin'), helpdeskAiController.getSettings);
router.patch('/settings', authorize('owner', 'admin'), helpdeskAiController.updateSettings);
router.get('/transforms', authorize('owner', 'admin', 'manager', 'agent'), helpdeskAiController.listTransforms);
router.get('/manager', authorize('owner', 'admin', 'manager'), helpdeskAiController.getManagerIntelligence);
router.get('/knowledge', authorize('owner', 'admin', 'manager'), helpdeskAiController.getKnowledgeIntelligence);
router.post(
  '/knowledge/drafts/generate',
  authorize('owner', 'admin'),
  helpdeskAiController.generateKnowledgeDrafts,
);
router.post(
  '/knowledge/drafts/:id/publish',
  authorize('owner', 'admin'),
  helpdeskAiController.publishKnowledgeDraft,
);
router.delete(
  '/knowledge/drafts/:id',
  authorize('owner', 'admin'),
  helpdeskAiController.dismissKnowledgeDraft,
);

module.exports = router;
