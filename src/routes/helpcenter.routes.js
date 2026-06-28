const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

const helpCenterController = require('../controllers/helpcenter.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { resolveHelpCenter } = require('../middleware/helpcenter.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

// ─── Rate limiter for public contact form ─────────────────────────────────────
const contactFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  message: { success: false, message: 'Too many submissions. Please try again later.' },
});

// ─── Validation rules ─────────────────────────────────────────────────────────

const settingsRules = [
  body('layout').optional().isIn(['classic', 'sidebar', 'cards']).withMessage('layout must be classic, sidebar, or cards'),
  body('title').optional().trim().isLength({ max: 100 }),
  body('subtitle').optional().trim().isLength({ max: 300 }),
  body('primaryColor').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Invalid hex color'),
  body('features.contactForm').optional().isBoolean(),
  body('features.raiseTicket').optional().isBoolean(),
  body('features.ticketTracking').optional().isBoolean(),
  body('features.search').optional().isBoolean(),
  body('isPublished').optional().isBoolean(),
];

const domainRules = [
  body('domain')
    .trim()
    .notEmpty().withMessage('domain is required')
    .isLength({ max: 253 }).withMessage('Domain too long')
    .matches(/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/)
    .withMessage('Invalid domain format. Example: help.yourcompany.com'),
];

const contactFormRules = [
  body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('subject').trim().notEmpty().withMessage('subject is required').isLength({ max: 200 }),
  body('message').trim().notEmpty().withMessage('message is required').isLength({ max: 10000 }),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
];

// ─── Protected: owner / admin manage their help center ───────────────────────
// All these routes require tenant context + auth

router.get(
  '/settings',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  helpCenterController.getSettings
);

router.post(
  '/settings',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  settingsRules,
  validate,
  helpCenterController.saveSettings
);

router.post(
  '/domain',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  domainRules,
  validate,
  helpCenterController.connectDomain
);

router.post(
  '/domain/verify',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  helpCenterController.verifyDomain
);

router.delete(
  '/domain',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  helpCenterController.disconnectDomain
);

// ─── Public: help center portal (no auth required) ───────────────────────────
// resolveHelpCenter resolves the company from the host / header

router.get(
  '/public',
  resolveHelpCenter,
  helpCenterController.getPublic
);

router.post(
  '/public/contact',
  resolveHelpCenter,
  contactFormLimiter,
  contactFormRules,
  validate,
  helpCenterController.submitContactForm
);

module.exports = router;
