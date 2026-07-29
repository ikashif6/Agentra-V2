const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { body } = require('express-validator');

const widgetController = require('../controllers/widget.controller');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

const widgetUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const subdomain = req.company?.subdomain || 'shared';
      const today = new Date().toISOString().slice(0, 10);
      const dir = path.join(UPLOAD_DIR, subdomain, today);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      const ext = path.extname(file.originalname).toLowerCase();
      const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
      cb(null, `${unique}-${base}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const blocked = ['.exe', '.bat', '.sh', '.cmd', '.ps1', '.vbs', '.js', '.jar', '.php'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (blocked.includes(ext)) {
      return cb(new Error(`File type "${ext}" is not allowed`), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10', 10) * 1024 * 1024,
    files: 5,
  },
});

async function attachWidgetCompany(req, res, next) {
  try {
    const widgetKey =
      req.query.widgetKey ||
      req.query.key ||
      req.body?.widgetKey ||
      req.headers['x-widget-key'] ||
      '';
    const company = await widgetController.loadCompanyByWidgetKey(widgetKey);
    if (!company || !company.liveChat?.enabled) {
      return res.status(400).json({ success: false, message: 'Live chat is not enabled' });
    }
    req.company = company;
    next();
  } catch (err) {
    next(err);
  }
}

router.get('/config', widgetController.getConfig);

router.post(
  '/session/start',
  [
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('pageUrl').optional().isString(),
    body('origin').optional().isString(),
    body('widgetKey').optional().isString(),
  ],
  validate,
  widgetController.startSession,
);

router.post(
  '/session/message',
  [
    body('sessionToken').trim().notEmpty(),
    body('message').optional({ nullable: true }).isString(),
    body('attachments').optional().isArray({ max: 5 }),
    body('widgetKey').optional().isString(),
    body().custom((_, { req }) => {
      const text = String(req.body?.message || '').trim();
      const files = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
      if (!text && !files.length) {
        throw new Error('Message is required');
      }
      return true;
    }),
  ],
  validate,
  widgetController.sendMessage,
);

router.post(
  '/session/upload',
  attachWidgetCompany,
  (req, res, next) => {
    widgetUpload.array('files', 5)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const limit = process.env.MAX_UPLOAD_SIZE_MB || 10;
          return res
            .status(400)
            .json({ success: false, message: `File too large. Maximum size is ${limit} MB.` });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res
            .status(400)
            .json({ success: false, message: 'Too many files. Maximum 5 files per request.' });
        }
        return res.status(400).json({ success: false, message: err.message });
      }
      if (err) return res.status(400).json({ success: false, message: err.message });
      next();
    });
  },
  widgetController.uploadSessionFile,
);

router.post(
  '/session/feedback',
  [
    body('sessionToken').trim().notEmpty(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('widgetKey').optional().isString(),
  ],
  validate,
  widgetController.submitFeedback,
);

router.post(
  '/session/end',
  [
    body('sessionToken').trim().notEmpty(),
    body('widgetKey').optional().isString(),
  ],
  validate,
  widgetController.endSession,
);

router.get('/feedback', widgetController.feedbackLanding);

router.get('/session/:sessionToken', widgetController.getSession);

module.exports = router;
