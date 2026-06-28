const express = require('express');
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/auth.controller');
const { resolveTenant, protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  message: { success: false, message: 'Too many auth attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, message: 'Too many OTP requests. Please try again in 1 hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Validation Rules ─────────────────────────────────────────────────────────

const registerRules = [
  body('firstName').trim().notEmpty().withMessage('First name is required').isLength({ max: 50 }),
  body('lastName').trim().notEmpty().withMessage('Last name is required').isLength({ max: 50 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .optional()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
  body('companyName').trim().notEmpty().withMessage('Company name is required').isLength({ min: 2, max: 100 }),
  body('subdomain')
    .trim()
    .notEmpty().withMessage('Subdomain is required')
    .isLength({ min: 2, max: 63 }).withMessage('Subdomain must be 2–63 characters')
    .matches(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/)
    .withMessage('Subdomain can only contain lowercase letters, numbers, and hyphens'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const emailRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
];

const tokenBodyRule = [
  body('token').notEmpty().withMessage('Token is required'),
];

const otpVerifyRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be a 6-digit number'),
];

const resetPasswordRules = [
  body('token').notEmpty().withMessage('Token is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
];

const changePasswordRules = [
  body('currentPassword').optional().notEmpty(),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
];

// ─── Public Routes ────────────────────────────────────────────────────────────

// Company registration (no tenant context needed)
router.post('/register', authLimiter, registerRules, validate, authController.register);

// Check subdomain availability
router.get('/check-subdomain/:subdomain', param('subdomain').trim().notEmpty(), validate, authController.checkSubdomain);

// Password login (requires tenant)
router.post('/login', authLimiter, resolveTenant, loginRules, validate, authController.login);

// Passwordless: magic link
router.post('/magic-link/request', authLimiter, resolveTenant, emailRules, validate, authController.requestMagicLink);
router.post('/magic-link/verify', authLimiter, resolveTenant, tokenBodyRule, validate, authController.verifyMagicLink);

// Passwordless: OTP
router.post('/otp/request', otpLimiter, resolveTenant, emailRules, validate, authController.requestOtp);
router.post('/otp/verify', authLimiter, resolveTenant, otpVerifyRules, validate, authController.verifyOtp);

// Email verification
router.post('/verify-email', tokenBodyRule, validate, authController.verifyEmail);

// Accept workspace invite — NO tenant context required (workspace derived from token)
router.post(
  '/accept-invite',
  authLimiter,
  [
    body('token').notEmpty().withMessage('Invite token is required'),
    body('password')
      .optional()
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and a number'),
  ],
  validate,
  authController.acceptInvite
);

// Password reset
router.post('/forgot-password', authLimiter, resolveTenant, emailRules, validate, authController.forgotPassword);
router.post('/reset-password', authLimiter, resetPasswordRules, validate, authController.resetPassword);

// Token refresh
router.post('/refresh', body('refreshToken').notEmpty(), validate, authController.refreshTokens);

// ─── Protected Routes ─────────────────────────────────────────────────────────

router.use(protect); // all routes below require auth

router.post('/logout', authController.logout);
router.post('/logout-all', authController.logoutAll);

router.get('/me', authController.getMe);
router.patch('/me', authController.updateMe);

router.post('/verify-email/resend', authController.resendVerification);
router.post('/change-password', changePasswordRules, validate, authController.changePassword);

module.exports = router;
