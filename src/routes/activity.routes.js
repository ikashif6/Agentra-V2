const express = require('express');
const { query } = require('express-validator');

const activityController = require('../controllers/activity.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

router.get(
  '/',
  resolveTenant,
  protect,
  authorize('owner', 'admin'),
  [
    query('actorId').optional().isMongoId(),
    query('event').optional().trim(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  activityController.list,
);

module.exports = router;
