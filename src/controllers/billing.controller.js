const response = require('../utils/apiResponse');
const {
  getBillingOverview,
  getCheckoutSession,
  getPortalUrl,
  cancelSubscription,
  reactivateSubscription,
  getInvoicePdfUrl,
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
 * POST /billing/checkout
 * Body: { billingCycle?: 'monthly' | 'yearly' }
 */
exports.createCheckout = async (req, res, next) => {
  try {
    const billingCycle = req.body?.billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const checkout = await getCheckoutSession(req.company, {
      billingCycle,
      email: req.user.email,
      name: req.user.name || req.company.name,
    });
    return response.success(res, { checkout });
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 503 || err.statusCode === 502) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};

/**
 * POST /billing/portal — Paddle customer portal (update payment / manage).
 */
exports.createPortal = async (req, res, next) => {
  try {
    const portal = await getPortalUrl(req.company);
    return response.success(res, portal);
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 502) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};

/**
 * POST /billing/cancel
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

/**
 * GET /billing/invoices/:invoiceNumber/pdf
 * Returns a short-lived Paddle invoice PDF URL.
 */
exports.getInvoicePdf = async (req, res, next) => {
  try {
    const invoiceNumber = decodeURIComponent(req.params.invoiceNumber || '');
    const pdf = await getInvoicePdfUrl(req.company, invoiceNumber);
    return response.success(res, pdf);
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404 || err.statusCode === 502) {
      return response.badRequest(res, err.message);
    }
    next(err);
  }
};
