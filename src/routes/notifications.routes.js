const express = require('express');
const { body } = require('express-validator');

const notificationsController = require('../controllers/notifications.controller');
const { resolveTenant, protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

router.use(resolveTenant);
router.use(protect);

router.get('/', notificationsController.getSettings);

router.patch(
  '/',
  [
    body('volume').optional().isInt({ min: 0, max: 100 }),
    body('rules').optional().isObject(),
  ],
  validate,
  notificationsController.updateSettings,
);

module.exports = router;
