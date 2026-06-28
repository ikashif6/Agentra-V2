const express = require('express');
const { body, param, query } = require('express-validator');

const teamController = require('../controllers/team.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

router.use(resolveTenant);
router.use(protect);
router.use(authorize('owner', 'admin', 'agent'));

// ─── Validation rules ─────────────────────────────────────────────────────────

const updateTeamRules = [
  body('name').optional().trim().isLength({ max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('teamLead').optional().isMongoId().withMessage('teamLead must be a valid user ID'),
];

const memberRules = [
  body('userId').notEmpty().isMongoId().withMessage('Valid userId required'),
];

// ─── Team routes ──────────────────────────────────────────────────────────────

// GET    /teams                    — all teams in company (across departments)
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
  ],
  validate,
  teamController.listAllTeams
);

// GET    /teams/:id
router.get('/:id', param('id').isMongoId(), validate, teamController.getTeam);

// PATCH  /teams/:id
router.patch('/:id', param('id').isMongoId(), updateTeamRules, validate, teamController.updateTeam);

// DELETE /teams/:id                — soft-delete (owner/admin only, enforced in controller)
router.delete('/:id', param('id').isMongoId(), validate, teamController.deleteTeam);

// ─── Member management ────────────────────────────────────────────────────────

// POST   /teams/:id/members        — invite a member
router.post(
  '/:id/members',
  param('id').isMongoId(),
  memberRules,
  validate,
  teamController.addMember
);

// DELETE /teams/:id/members/:userId — remove a member
router.delete(
  '/:id/members/:userId',
  param('id').isMongoId(),
  param('userId').isMongoId(),
  validate,
  teamController.removeMember
);

module.exports = router;
