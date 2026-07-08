const response = require('../utils/apiResponse');
const {
  getBillingOverview,
  cancelSubscription,
  reactivateSubscription,
} = require('../services/billing.service');
const {
  logBillingPlanCanceled,
  logBillingPlanReactivated,
} = require('../services/activity.service');

/**
 * GET /billing
 * Owner only — subscription, payment method, and invoice history.
 */
exports.getOverview = async (req, res, next) => {
  try {
    return response.success(res, {
      billing: getBillingOverview(req.company),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /billing/cancel
 * Owner only — schedule cancellation at end of current billing period.
 */
exports.cancelPlan = async (req, res, next) => {
  try {
    const billing = await cancelSubscription(req.company);
    logBillingPlanCanceled({ company: req.company, actor: req.user, req });
    return response.success(
      res,
      { billing },
      'Your plan will cancel at the end of the current billing period',
    );
  } catch (err) {
    if (err.statusCode === 400) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};

/**
 * POST /billing/reactivate
 * Owner only — undo a scheduled cancellation.
 */
exports.reactivatePlan = async (req, res, next) => {
  try {
    const billing = await reactivateSubscription(req.company);
    logBillingPlanReactivated({ company: req.company, actor: req.user, req });
    return response.success(res, { billing }, 'Your plan will continue as normal');
  } catch (err) {
    if (err.statusCode === 400) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};
