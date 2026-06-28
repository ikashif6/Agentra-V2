const { validationResult } = require('express-validator');
const { badRequest } = require('../utils/apiResponse');

/**
 * Run express-validator checks and short-circuit with 400 if any fail.
 * Place this after your validation chain arrays in routes.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field: e.path,
      message: e.msg,
    }));

    return badRequest(res, 'Validation failed', formatted);
  }

  next();
};

module.exports = { validate };
