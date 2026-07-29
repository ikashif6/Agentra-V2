const response = require('../utils/apiResponse');
const { listCustomers, getCustomerDetail } = require('../services/customers.service');

/**
 * GET /customers?search=&page=&limit=
 */
exports.list = async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const data = await listCustomers(req.company._id, {
      search: String(search || ''),
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
    return response.success(res, data);
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /customers/:email
 */
exports.getOne = async (req, res, next) => {
  try {
    let email = String(req.params.email || '');
    try {
      email = decodeURIComponent(email);
    } catch {
      // keep raw param
    }
    const customer = await getCustomerDetail(req.company._id, email);
    if (!customer) {
      return response.notFound(res, 'Customer not found');
    }
    return response.success(res, { customer });
  } catch (err) {
    return next(err);
  }
};
