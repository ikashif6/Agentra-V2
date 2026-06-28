const express = require('express');
const { body, query } = require('express-validator');

const usersController = require('../controllers/users.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

router.use(resolveTenant);
router.use(protect);

// GET /users/staff?search=&page=&limit=   — owner/admin only
router.get(
  '/staff',
  authorize('owner', 'admin'),
  [
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  usersController.listStaff
);

// GET /users/members?search=&role=&page=&limit=  — owner/admin/agent
router.get(
  '/members',
  authorize('owner', 'admin', 'agent'),
  [
    query('search').optional().trim(),
    query('role').optional().isIn(['admin', 'agent', 'customer']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  usersController.listMembers
);

// POST /users/invite  — owner/admin only
router.post(
  '/invite',
  authorize('owner', 'admin'),
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('role').isIn(['agent', 'admin']).withMessage('Role must be agent or admin'),
    body('firstName').trim().notEmpty().withMessage('First name required'),
    body('lastName').trim().notEmpty().withMessage('Last name required'),
  ],
  validate,
  usersController.inviteUser
);

module.exports = router;
