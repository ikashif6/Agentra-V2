const express = require('express');
const { param, query } = require('express-validator');

const customersController = require('../controllers/customers.controller');
const { resolveTenant, protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

router.use(resolveTenant);
router.use(protect);

// GET /customers?search=&page=&limit=
router.get(
  '/',
  authorize('owner', 'admin', 'manager', 'agent'),
  [
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  customersController.list,
);

// GET /customers/:email
router.get(
  '/:email',
  authorize('owner', 'admin', 'manager', 'agent'),
  [param('email').trim().notEmpty().withMessage('Email required')],
  validate,
  customersController.getOne,
);

module.exports = router;
