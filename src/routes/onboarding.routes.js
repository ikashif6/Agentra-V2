const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

const onboardingController = require('../controllers/onboarding.controller');
const { validate } = require('../middleware/validate.middleware');
const { resolveTenant, protect } = require('../middleware/auth.middleware');
const { ONBOARDING_PLAN_IDS } = require('../config/plans');

const router = express.Router();

// Strict rate-limit — onboarding creates DB records
const onboardLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { success: false, message: 'Too many onboarding attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const onboardRules = [
  body('plan_id')
    .notEmpty().withMessage('plan_id is required')
    .isIn(ONBOARDING_PLAN_IDS).withMessage(`plan_id must be one of: ${ONBOARDING_PLAN_IDS.join(', ')}`),

  body('companyName')
    .trim().notEmpty().withMessage('Company name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Company name must be 2–100 characters'),

  body('subdomain')
    .trim().notEmpty().withMessage('Subdomain is required')
    .isLength({ min: 2, max: 63 }).withMessage('Subdomain must be 2–63 characters')
    .matches(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/)
    .withMessage('Subdomain can only contain lowercase letters, numbers, and hyphens'),

  body('firstName')
    .trim().notEmpty().withMessage('First name is required')
    .isLength({ max: 50 }),

  body('lastName')
    .trim().notEmpty().withMessage('Last name is required')
    .isLength({ max: 50 }),

  body('email')
    .isEmail().normalizeEmail().withMessage('Valid email is required'),

  body('password')
    .optional()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),

  body('billingCycle')
    .optional()
    .isIn(['monthly', 'yearly']).withMessage('billingCycle must be monthly or yearly'),

  body('industry').optional().trim().isLength({ max: 100 }),
  body('timezone').optional().trim().isLength({ max: 100 }),

  body('website')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Website URL must be under 200 characters'),
];

// ─── Public routes ────────────────────────────────────────────────────────────

// GET  /onboarding/plans  — plan catalogue (no auth, no rate limit)
router.get('/plans', onboardingController.getPlans);

// POST /onboarding        — create company + owner
router.post('/', onboardLimiter, onboardRules, validate, onboardingController.onboard);

// POST /onboarding/setup — post-signup questionnaire (authenticated)
router.post('/setup', resolveTenant, protect, onboardingController.completeSetup);

module.exports = router;
