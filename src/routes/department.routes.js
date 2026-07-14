const express = require('express');
const { body, param, query } = require('express-validator');

const deptController = require('../controllers/department.controller');
const teamController = require('../controllers/team.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

// All department routes require a resolved tenant + authenticated user
router.use(resolveTenant);
router.use(protect);

// Only staff (owner/admin/agent) can access department routes — no customers
router.use(authorize('owner', 'admin', 'manager', 'agent'));

// ─── Validation rules ─────────────────────────────────────────────────────────

const createDeptRules = [
  body('name').trim().notEmpty().withMessage('Department name is required').isLength({ max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('heads').optional().isArray(),
  body('heads.*').optional().isMongoId().withMessage('Each head must be a valid user ID'),
];

const updateDeptRules = [
  body('name').optional().trim().isLength({ max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
];

const headRules = [
  body('userId').notEmpty().isMongoId().withMessage('Valid userId required'),
];

const createTeamRules = [
  body('name').trim().notEmpty().withMessage('Team name is required').isLength({ max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('teamLead').notEmpty().isMongoId().withMessage('Valid teamLead userId required'),
];

// ─── Department routes ────────────────────────────────────────────────────────

// POST   /departments              — create (owner/admin only, enforced in controller)
router.post('/', createDeptRules, validate, deptController.createDepartment);

// GET    /departments              — list all
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
  ],
  validate,
  deptController.listDepartments
);

// GET    /departments/:id          — single with its teams
router.get('/:id', param('id').isMongoId(), validate, deptController.getDepartment);

// PATCH  /departments/:id          — update (owner/admin/dept head)
router.patch('/:id', param('id').isMongoId(), validate, updateDeptRules, validate, deptController.updateDepartment);

// DELETE /departments/:id          — soft-delete (owner/admin)
router.delete('/:id', param('id').isMongoId(), validate, deptController.deleteDepartment);

// ─── Department head management ───────────────────────────────────────────────

// POST   /departments/:id/heads            — add head (owner/admin)
router.post(
  '/:id/heads',
  param('id').isMongoId(),
  headRules,
  validate,
  deptController.addHead
);

// DELETE /departments/:id/heads/:userId    — remove head (owner/admin)
router.delete(
  '/:id/heads/:userId',
  param('id').isMongoId(),
  param('userId').isMongoId(),
  validate,
  deptController.removeHead
);

// ─── Teams nested under department ───────────────────────────────────────────

// POST   /departments/:deptId/teams        — create team in this department
router.post(
  '/:deptId/teams',
  param('deptId').isMongoId(),
  createTeamRules,
  validate,
  teamController.createTeam
);

// GET    /departments/:deptId/teams        — list teams in department
router.get(
  '/:deptId/teams',
  param('deptId').isMongoId(),
  validate,
  teamController.listTeams
);

module.exports = router;
