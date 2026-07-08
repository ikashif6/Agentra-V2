/**
 * Standardised API response helpers
 */

const success = (res, data = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const created = (res, data = {}, message = 'Created successfully') => {
  return success(res, data, message, 201);
};

const error = (res, message = 'An error occurred', statusCode = 500, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

const unauthorized = (res, message = 'Unauthorized', errors = null) => {
  return error(res, message, 401, errors);
};

const forbidden = (res, message = 'Forbidden', errors = null) => {
  return error(res, message, 403, errors);
};

const notFound = (res, message = 'Not found') => {
  return error(res, message, 404);
};

const badRequest = (res, message = 'Bad request', errors = null) => {
  return error(res, message, 400, errors);
};

const conflict = (res, message = 'Conflict') => {
  return error(res, message, 409);
};

const tooMany = (res, message = 'Too many requests') => {
  return error(res, message, 429);
};

module.exports = { success, created, error, unauthorized, forbidden, notFound, badRequest, conflict, tooMany };
