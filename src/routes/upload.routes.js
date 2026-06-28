const express = require('express');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const { protect } = require('../middleware/auth.middleware');
const { resolveTrackSession, requireTicketAccess } = require('../middleware/ticket.middleware');
const uploadController = require('../controllers/upload.controller');

const router = express.Router();

// ─── Multer storage config ────────────────────────────────────────────────────

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Isolate per tenant
    const subdomain =
      req.company?.subdomain ||
      req.trackSession?.subdomain ||
      'shared';

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dir = path.join(UPLOAD_DIR, subdomain, today);

    // Create directory if needed (sync is fine here; multer callback blocks the stream)
    require('fs').mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },

  filename: (req, file, cb) => {
    // <timestamp>-<random>-<originalname> to avoid collisions
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    cb(null, `${unique}-${base}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  // Block executables
  const blocked = ['.exe', '.bat', '.sh', '.cmd', '.ps1', '.vbs', '.js', '.jar', '.php'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (blocked.includes(ext)) {
    return cb(new Error(`File type "${ext}" is not allowed`), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10') * 1024 * 1024, // default 10 MB
    files: 5, // max 5 files per request
  },
});

// ─── Rate limiter ─────────────────────────────────────────────────────────────

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many upload requests. Please slow down.' },
});

// ─── Multer error wrapper ─────────────────────────────────────────────────────

const handleMulterErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const limit = process.env.MAX_UPLOAD_SIZE_MB || 10;
      return res.status(400).json({ success: false, message: `File too large. Maximum size is ${limit} MB.` });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'Too many files. Maximum 5 files per request.' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * POST /api/uploads
 * Accepts: multipart/form-data, field name "files"
 * Auth:    Bearer JWT (normal auth) OR Bearer track token (OTP guest)
 * Returns: { attachments: [{ url, filename, mimetype, size }] }
 */
router.post(
  '/',
  uploadLimiter,
  resolveTrackSession,   // sets req.trackSession if track-token; also sets req.company
  protect,               // if no trackSession → validates JWT, sets req.user + req.company
  requireTicketAccess,   // at least one of req.user / req.trackSession must exist
  (req, res, next) => upload.array('files', 5)(req, res, (err) => {
    if (err) return handleMulterErrors(err, req, res, next);
    next();
  }),
  uploadController.uploadFiles
);

module.exports = router;
