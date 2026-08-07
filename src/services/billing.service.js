const Company = require('../models/Company');
const paddle = require('./paddle.service');

const { AGENTRA_PRO_PLAN } = paddle;

function sanitizePaymentMethod(method) {
  if (!method || !method.type) return null;
  return {
    type: method.type,
    brand: method.brand || undefined,
    last4: method.last4 || undefined,
    expMonth: method.expMonth || undefined,
    expYear: method.expYear || undefined,
    name: method.name || undefined,
  };
}

function sanitizeInvoices(invoices) {
  if (!Array.isArray(invoices)) return [];
  return invoices
    .map((inv, index) => ({
      _id: inv._id?.toString() || String(index),
      number: inv.number,
      issuedAt: inv.issuedAt,
      amount: inv.amount,
      currency: inv.currency || 'USD',
      status: inv.status,
      description: inv.description || 'Agentra Pro',
      hasPdf: true,
      paddleTransactionId: inv.paddleTransactionId || undefined,
    }))
    .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
}

function extractTxnIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/[?&]_ptxn=(txn_[a-z0-9]+)/i);
  return match?.[1] || null;
}

function getAccessEndsAt(company) {
  const plan = company.plan || {};
  if (plan.currentPeriodEnd) return plan.currentPeriodEnd;
  if (plan.trialEndsAt) return plan.trialEndsAt;
  return null;
}

function getBillingOverview(company) {
  const plan = company.plan || {};
  const accessEndsAt = getAccessEndsAt(company);
  const billingCycle = plan.billingCycle === 'yearly' ? 'yearly' : 'monthly';

  return {
    plan: {
      id: AGENTRA_PRO_PLAN.id,
      label: AGENTRA_PRO_PLAN.label,
      status: plan.status || 'trialing',
      billingCycle,
      priceMonthly: AGENTRA_PRO_PLAN.priceMonthly,
      priceYearly: AGENTRA_PRO_PLAN.priceYearly,
      unlimited: AGENTRA_PRO_PLAN.unlimited,
      trialEndsAt: plan.trialEndsAt || null,
      currentPeriodStart: plan.currentPeriodStart || null,
      currentPeriodEnd: plan.currentPeriodEnd || null,
      cancelAtPeriodEnd: Boolean(plan.cancelAtPeriodEnd),
      canceledAt: plan.canceledAt || null,
      accessEndsAt,
      hasPaddleSubscription: Boolean(plan.paddleSubscriptionId),
    },
    usage: {
      totalUsers: company.usage?.totalUsers ?? 0,
      totalAgents: company.usage?.totalAgents ?? 0,
      totalTickets: company.usage?.totalTickets ?? 0,
      openTickets: company.usage?.openTickets ?? 0,
    },
    paymentMethod: sanitizePaymentMethod(company.billing?.paymentMethod),
    invoices: sanitizeInvoices(company.billing?.invoices),
    paddleConfigured: paddle.isPaddleConfigured(),
    paddleEnv: paddle.getPaddleEnv(),
  };
}

async function getCheckoutSession(company, { billingCycle, email, name }) {
  // Mutates + persists company when a stale paddleCustomerId is cleared.
  return paddle.createCheckoutTransaction({ company, billingCycle, email, name });
}

async function getPortalUrl(company) {
  const customerId = company.plan?.paddleCustomerId;
  const session = await paddle.createCustomerPortalSession(customerId);
  const urls = session?.data?.urls;
  const overview =
    urls?.general?.overview ||
    urls?.subscriptions?.[0]?.overview_url ||
    urls?.subscriptions?.[0]?.update_subscription_payment_method_url ||
    null;
  if (!overview) {
    const err = new Error('Paddle did not return a customer portal URL');
    err.statusCode = 502;
    throw err;
  }
  return { url: overview };
}

async function cancelSubscription(company) {
  const plan = company.plan || {};

  if (plan.cancelAtPeriodEnd) {
    const err = new Error('Subscription is already scheduled to cancel');
    err.statusCode = 400;
    throw err;
  }

  if (plan.status === 'canceled') {
    const err = new Error('Subscription is already canceled');
    err.statusCode = 400;
    throw err;
  }

  if (plan.paddleSubscriptionId) {
    await paddle.cancelPaddleSubscription(plan.paddleSubscriptionId, {
      effectiveFrom: 'next_billing_period',
    });
  }

  company.plan.cancelAtPeriodEnd = true;
  company.plan.canceledAt = new Date();
  company.markModified('plan');
  await company.save();

  return getBillingOverview(company);
}

async function reactivateSubscription(company) {
  const plan = company.plan || {};

  if (!plan.cancelAtPeriodEnd) {
    const err = new Error('Subscription is not scheduled to cancel');
    err.statusCode = 400;
    throw err;
  }

  if (plan.paddleSubscriptionId) {
    await paddle.removeScheduledCancel(plan.paddleSubscriptionId);
  }

  company.plan.cancelAtPeriodEnd = false;
  company.plan.canceledAt = undefined;
  company.markModified('plan');
  await company.save();

  return getBillingOverview(company);
}

function mapPaddleStatus(status, scheduledChange) {
  if (scheduledChange?.action === 'cancel') {
    return {
      status: status === 'canceled' ? 'canceled' : status === 'past_due' ? 'past_due' : 'active',
      cancelAtPeriodEnd: true,
    };
  }
  switch (status) {
    case 'active':
      return { status: 'active', cancelAtPeriodEnd: false };
    case 'trialing':
      return { status: 'trialing', cancelAtPeriodEnd: false };
    case 'past_due':
      return { status: 'past_due', cancelAtPeriodEnd: false };
    case 'canceled':
      return { status: 'canceled', cancelAtPeriodEnd: false };
    case 'paused':
      return { status: 'canceled', cancelAtPeriodEnd: false };
    default:
      return { status: 'active', cancelAtPeriodEnd: false };
  }
}

function billingCycleFromItems(items) {
  const interval = items?.[0]?.price?.billing_cycle?.interval;
  if (interval === 'year') return 'yearly';
  return 'monthly';
}

async function findCompanyForPaddleEvent(data) {
  const custom = data?.custom_data || data?.customData || null;
  const companyId = custom?.companyId || custom?.company_id;
  if (companyId) {
    const byId = await Company.findById(companyId);
    if (byId) return byId;
  }

  const subscriptionId = data?.id?.startsWith?.('sub_') ? data.id : data?.subscription_id;
  if (subscriptionId) {
    const bySub = await Company.findOne({ 'plan.paddleSubscriptionId': subscriptionId });
    if (bySub) return bySub;
  }

  const customerId = data?.customer_id;
  if (customerId) {
    const byCustomer = await Company.findOne({ 'plan.paddleCustomerId': customerId });
    if (byCustomer) return byCustomer;
  }

  return null;
}

function applySubscriptionToCompany(company, data) {
  if (!company.plan) company.plan = {};
  const mapped = mapPaddleStatus(data.status, data.scheduled_change);

  company.plan.name = 'pro';
  company.plan.status = mapped.status;
  company.plan.cancelAtPeriodEnd = mapped.cancelAtPeriodEnd;
  if (mapped.cancelAtPeriodEnd && !company.plan.canceledAt) {
    company.plan.canceledAt = new Date();
  }
  if (!mapped.cancelAtPeriodEnd) {
    company.plan.canceledAt = undefined;
  }
  if (mapped.status === 'canceled') {
    company.plan.canceledAt = company.plan.canceledAt || new Date();
  }

  if (data.id?.startsWith?.('sub_')) {
    company.plan.paddleSubscriptionId = data.id;
  }
  if (data.customer_id) {
    company.plan.paddleCustomerId = data.customer_id;
  }

  company.plan.billingCycle = billingCycleFromItems(data.items);

  if (data.current_billing_period?.starts_at) {
    company.plan.currentPeriodStart = new Date(data.current_billing_period.starts_at);
  }
  if (data.current_billing_period?.ends_at) {
    company.plan.currentPeriodEnd = new Date(data.current_billing_period.ends_at);
  }

  company.markModified('plan');
}

function appendInvoice(company, { number, issuedAt, amount, currency, status, description, pdfUrl, paddleTransactionId }) {
  if (!company.billing) company.billing = {};
  if (!Array.isArray(company.billing.invoices)) company.billing.invoices = [];

  const exists = company.billing.invoices.some((inv) => inv.number === number);
  if (exists) return;

  company.billing.invoices.unshift({
    number,
    issuedAt: issuedAt || new Date(),
    amount,
    currency: (currency || 'USD').toUpperCase(),
    status: status || 'paid',
    description: description || 'Agentra Pro',
    pdfUrl: pdfUrl || undefined,
    paddleTransactionId: paddleTransactionId || undefined,
  });
  company.billing.invoices = company.billing.invoices.slice(0, 50);
  company.markModified('billing');
}

async function handlePaddleWebhookEvent(eventType, data) {
  if (!data) return { handled: false, reason: 'no_data' };

  const company = await findCompanyForPaddleEvent(data);
  if (!company) {
    return { handled: false, reason: 'company_not_found' };
  }

  if (
    eventType === 'subscription.created' ||
    eventType === 'subscription.updated' ||
    eventType === 'subscription.canceled' ||
    eventType === 'subscription.past_due' ||
    eventType === 'subscription.activated'
  ) {
    applySubscriptionToCompany(company, data);
    if (eventType === 'subscription.past_due') {
      company.plan.status = 'past_due';
    }
    if (eventType === 'subscription.canceled' || data.status === 'canceled') {
      company.plan.status = 'canceled';
      company.plan.cancelAtPeriodEnd = false;
      company.plan.canceledAt = company.plan.canceledAt || new Date();
    }
    await company.save();
    return { handled: true, companyId: company._id.toString() };
  }

  if (eventType === 'transaction.completed') {
    if (data.customer_id) company.plan.paddleCustomerId = data.customer_id;
    if (data.subscription_id) company.plan.paddleSubscriptionId = data.subscription_id;

    if (
      company.plan.status === 'trialing' ||
      company.plan.status === 'canceled' ||
      company.plan.status === 'unpaid'
    ) {
      company.plan.status = 'active';
      company.plan.name = 'pro';
    }
    company.markModified('plan');

    const totals = data.details?.totals;
    const amount =
      totals?.grand_total != null
        ? Number(totals.grand_total)
        : totals?.total != null
          ? Number(totals.total)
          : 0;
    appendInvoice(company, {
      number: data.invoice_number || data.id,
      issuedAt: data.billed_at ? new Date(data.billed_at) : new Date(),
      amount,
      currency: data.currency_code || 'USD',
      status: 'paid',
      description: 'Agentra Pro',
      paddleTransactionId: data.id || undefined,
    });

    const method = data.payments?.[0]?.method_details?.card;
    if (method) {
      company.billing = company.billing || {};
      company.billing.paymentMethod = {
        type: 'card',
        brand: method.type || method.card_type || 'Card',
        last4: method.last4,
        expMonth: method.expiry_month,
        expYear: method.expiry_year,
      };
      company.markModified('billing');
    }

    await company.save();
    return { handled: true, companyId: company._id.toString() };
  }

  if (eventType === 'transaction.payment_failed') {
    company.plan.status = 'past_due';
    company.markModified('plan');
    await company.save();
    return { handled: true, companyId: company._id.toString() };
  }

  return { handled: false, reason: 'unhandled_event', eventType };
}

function resolveInvoiceTransactionId(invoice) {
  if (!invoice) return null;
  if (invoice.paddleTransactionId) return invoice.paddleTransactionId;
  if (String(invoice.number || '').startsWith('txn_')) return invoice.number;
  return extractTxnIdFromUrl(invoice.pdfUrl);
}

async function findTransactionIdForInvoice(company, invoice) {
  const fromUrl = extractTxnIdFromUrl(invoice.pdfUrl);
  if (fromUrl) return fromUrl;

  const customerId = company.plan?.paddleCustomerId;
  if (!customerId || !invoice.number) return null;

  const result = await paddle.listCustomerTransactions(customerId, { perPage: 30 });
  const rows = result?.data || [];
  const match = rows.find(
    (txn) => txn.invoice_number === invoice.number || txn.id === invoice.number,
  );
  return match?.id || null;
}

async function getInvoicePdfUrl(company, invoiceNumber) {
  const invoices = company.billing?.invoices || [];
  const invoice = invoices.find((inv) => inv.number === invoiceNumber);
  if (!invoice) {
    const err = new Error('Invoice not found');
    err.statusCode = 404;
    throw err;
  }

  let transactionId = resolveInvoiceTransactionId(invoice);
  if (!transactionId) {
    transactionId = await findTransactionIdForInvoice(company, invoice);
  }

  if (!transactionId) {
    const err = new Error('No Paddle transaction linked to this invoice yet');
    err.statusCode = 404;
    throw err;
  }

  if (!invoice.paddleTransactionId) {
    invoice.paddleTransactionId = transactionId;
    company.markModified('billing');
    await company.save();
  }

  const url = await paddle.getTransactionInvoicePdfUrl(transactionId, { disposition: 'inline' });
  return { url };
}

module.exports = {
  AGENTRA_PRO_PLAN,
  getBillingOverview,
  getAccessEndsAt,
  getCheckoutSession,
  getPortalUrl,
  cancelSubscription,
  reactivateSubscription,
  handlePaddleWebhookEvent,
  getInvoicePdfUrl,
  sanitizePaymentMethod,
  sanitizeInvoices,
};
