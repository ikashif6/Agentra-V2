const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');

const liveChatController = require('../controllers/live-chat.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

const knowledgeUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10', 10) * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const ok =
      name.endsWith('.pdf') ||
      name.endsWith('.txt') ||
      name.endsWith('.md') ||
      name.endsWith('.markdown') ||
      name.endsWith('.csv') ||
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'text/plain' ||
      file.mimetype === 'text/markdown' ||
      file.mimetype === 'text/csv';
    if (!ok) {
      return cb(new Error('Unsupported file type. Use PDF, TXT, MD, or CSV.'));
    }
    cb(null, true);
  },
});

function handleKnowledgeUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const limit = process.env.MAX_UPLOAD_SIZE_MB || 10;
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size is ${limit} MB.`,
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  return next();
}

router.get('/', resolveTenant, protect, authorize('owner', 'admin'), liveChatController.getSettings);

router.put(
  '/',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  [
    body('enabled').optional().isBoolean(),
    body('allowedOrigins').optional().isArray(),
    body('appearance').optional().isObject(),
    body('content').optional().isObject(),
    body('behavior').optional().isObject(),
    body('ai').optional().isObject(),
    body('syncProducts').optional().isBoolean(),
  ],
  validate,
  liveChatController.updateSettings,
);

router.post(
  '/install',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  liveChatController.installWidget,
);

router.post(
  '/uninstall',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  liveChatController.uninstallWidget,
);

router.post(
  '/regenerate-key',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  liveChatController.regenerateWidgetKey,
);

router.post(
  '/sync-products',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  liveChatController.syncProducts,
);

router.get(
  '/knowledge',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  liveChatController.listKnowledge,
);

router.post(
  '/knowledge',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  [
    body('title').trim().notEmpty(),
    body('content').trim().notEmpty(),
    body('category').optional().isString(),
    body('active').optional().isBoolean(),
  ],
  validate,
  liveChatController.createKnowledge,
);

router.post(
  '/knowledge/upload',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  (req, res, next) =>
    knowledgeUpload.single('file')(req, res, (err) => {
      if (err) return handleKnowledgeUploadErrors(err, req, res, next);
      return next();
    }),
  liveChatController.uploadKnowledgeDocument,
);

router.patch(
  '/knowledge/:id',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  liveChatController.updateKnowledge,
);

router.delete(
  '/knowledge/:id',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  liveChatController.deleteKnowledge,
);

module.exports = router;
