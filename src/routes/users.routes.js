const express = require('express');
const { body, param, query } = require('express-validator');

const usersController = require('../controllers/users.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

router.use(resolveTenant);
router.use(protect);

// GET /users/workspace?search=&page=&limit= — owner/admin workspace directory
router.get(
  '/workspace',
  authorize('owner', 'admin'),
  [
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  usersController.listWorkspace,
);

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

// PATCH /users/:id — owner/admin update member
router.patch(
  '/:id',
  authorize('owner', 'admin'),
  [
    param('id').isMongoId().withMessage('Valid user id required'),
    body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required'),
    body('role').optional().isIn(['agent', 'admin']).withMessage('Role must be agent or admin'),
    body('jobTitle').optional().trim(),
  ],
  validate,
  usersController.updateUser,
);

// DELETE /users/:id — owner/admin deactivate member
router.delete(
  '/:id',
  authorize('owner', 'admin'),
  [param('id').isMongoId().withMessage('Valid user id required')],
  validate,
  usersController.removeUser,
);

module.exports = router;
