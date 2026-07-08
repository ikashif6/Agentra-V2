const AGENTRA_PRO_PLAN = {
  id: 'pro',
  label: 'Pro',
  priceMonthly: 6000,
  billingCycle: 'monthly',
  unlimited: true,
};

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
      description: inv.description || 'Agentra Pro monthly',
      pdfUrl: inv.pdfUrl || undefined,
    }))
    .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
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

  return {
    plan: {
      id: AGENTRA_PRO_PLAN.id,
      label: AGENTRA_PRO_PLAN.label,
      status: plan.status || 'trialing',
      billingCycle: AGENTRA_PRO_PLAN.billingCycle,
      priceMonthly: AGENTRA_PRO_PLAN.priceMonthly,
      unlimited: AGENTRA_PRO_PLAN.unlimited,
      trialEndsAt: plan.trialEndsAt || null,
      currentPeriodStart: plan.currentPeriodStart || null,
      currentPeriodEnd: plan.currentPeriodEnd || null,
      cancelAtPeriodEnd: Boolean(plan.cancelAtPeriodEnd),
      canceledAt: plan.canceledAt || null,
      accessEndsAt,
    },
    usage: {
      totalUsers: company.usage?.totalUsers ?? 0,
      totalAgents: company.usage?.totalAgents ?? 0,
      totalTickets: company.usage?.totalTickets ?? 0,
      openTickets: company.usage?.openTickets ?? 0,
    },
    paymentMethod: sanitizePaymentMethod(company.billing?.paymentMethod),
    invoices: sanitizeInvoices(company.billing?.invoices),
  };
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

  company.plan.cancelAtPeriodEnd = false;
  company.plan.canceledAt = undefined;
  company.markModified('plan');
  await company.save();

  return getBillingOverview(company);
}

module.exports = {
  getBillingOverview,
  getAccessEndsAt,
  cancelSubscription,
  reactivateSubscription,
  sanitizePaymentMethod,
  sanitizeInvoices,
};
