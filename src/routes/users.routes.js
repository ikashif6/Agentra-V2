const express = require('express');
const { body, param, query } = require('express-validator');

const usersController = require('../controllers/users.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

router.use(resolveTenant);
router.use(protect);

// GET /users/workspace?search=&page=&limit= — staff directory for people management
router.get(
  '/workspace',
  authorize('owner', 'admin', 'manager'),
  [
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  usersController.listWorkspace,
);

// GET /users/staff?search=&page=&limit=
router.get(
  '/staff',
  authorize('owner', 'admin', 'manager'),
  [
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  usersController.listStaff
);

// GET /users/members?search=&role=&page=&limit=
router.get(
  '/members',
  authorize('owner', 'admin', 'manager', 'agent'),
  [
    query('search').optional().trim(),
    query('role').optional().isIn(['admin', 'manager', 'agent', 'customer']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  usersController.listMembers
);

// POST /users/invite
router.post(
  '/invite',
  authorize('owner', 'admin', 'manager'),
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('role').isIn(['agent', 'manager', 'admin']).withMessage('Role must be agent, manager, or admin'),
    body('firstName').trim().notEmpty().withMessage('First name required'),
    body('lastName').optional().isString().trim().isLength({ max: 50 }).withMessage('Last name is too long'),
  ],
  validate,
  usersController.inviteUser
);

// PATCH /users/:id
router.patch(
  '/:id',
  authorize('owner', 'admin', 'manager'),
  [
    param('id').isMongoId().withMessage('Valid user id required'),
    body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').optional().isString().trim().isLength({ max: 50 }).withMessage('Last name is too long'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required'),
    body('role').optional().isIn(['agent', 'manager', 'admin']).withMessage('Role must be agent, manager, or admin'),
    body('jobTitle').optional().trim(),
  ],
  validate,
  usersController.updateUser,
);

// DELETE /users/:id
router.delete(
  '/:id',
  authorize('owner', 'admin', 'manager'),
  [param('id').isMongoId().withMessage('Valid user id required')],
  validate,
  usersController.removeUser,
);

module.exports = router;
