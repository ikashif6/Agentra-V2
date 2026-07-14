const express = require('express');
const { body } = require('express-validator');

const widgetController = require('../controllers/widget.controller');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

router.get('/config', widgetController.getConfig);

router.post(
  '/session/start',
  [
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('pageUrl').optional().isString(),
    body('origin').optional().isString(),
    body('widgetKey').optional().isString(),
  ],
  validate,
  widgetController.startSession,
);

router.post(
  '/session/message',
  [
    body('sessionToken').trim().notEmpty(),
    body('message').trim().notEmpty(),
    body('widgetKey').optional().isString(),
  ],
  validate,
  widgetController.sendMessage,
);

router.get('/session/:sessionToken', widgetController.getSession);

module.exports = router;
