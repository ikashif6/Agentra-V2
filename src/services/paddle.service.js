const crypto = require('crypto');

const AGENTRA_PRO_PLAN = {
  id: 'pro',
  label: 'Pro',
  /** cents */
  priceMonthly: 10000,
  /** cents — $1,080/yr (= $90/mo) */
  priceYearly: 108000,
  billingCycle: 'monthly',
  unlimited: true,
};

function isPaddleConfigured() {
  return Boolean(
    process.env.PADDLE_API_KEY?.trim() &&
      process.env.PADDLE_CLIENT_TOKEN?.trim() &&
      process.env.PADDLE_PRICE_MONTHLY?.trim() &&
      process.env.PADDLE_PRICE_YEARLY?.trim(),
  );
}

function getPaddleEnv() {
  return (process.env.PADDLE_ENV || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox';
}

function getPaddleApiBase() {
  return getPaddleEnv() === 'live' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
}

function getPriceIdForCycle(billingCycle) {
  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const priceId =
    cycle === 'yearly'
      ? process.env.PADDLE_PRICE_YEARLY?.trim()
      : process.env.PADDLE_PRICE_MONTHLY?.trim();
  if (!priceId) {
    const err = new Error(`Paddle ${cycle} price is not configured`);
    err.statusCode = 500;
    throw err;
  }
  return { cycle, priceId };
}

async function paddleFetch(path, { method = 'GET', body } = {}) {
  const apiKey = process.env.PADDLE_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('Paddle is not configured');
    err.statusCode = 500;
    throw err;
  }
  const res = await fetch(`${getPaddleApiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const message =
      data?.error?.detail ||
      data?.error?.message ||
      (typeof data?.error === 'string' ? data.error : null) ||
      `Paddle API error (${res.status})`;
    const err = new Error(message);
    err.statusCode = res.status >= 400 && res.status < 500 ? 400 : 502;
    err.paddle = data;
    throw err;
  }
  return data;
}

function getCheckoutPayload({ company, billingCycle, email, name }) {
  if (!isPaddleConfigured()) {
    const err = new Error('Paddle billing is not configured yet');
    err.statusCode = 503;
    throw err;
  }
  const { cycle, priceId } = getPriceIdForCycle(billingCycle);
  const customer =
    company.plan?.paddleCustomerId || email
      ? {
          ...(company.plan?.paddleCustomerId
            ? { id: company.plan.paddleCustomerId }
            : { email: email || undefined }),
        }
      : undefined;

  return {
    env: getPaddleEnv(),
    clientToken: process.env.PADDLE_CLIENT_TOKEN.trim(),
    priceId,
    billingCycle: cycle,
    customData: {
      companyId: company._id.toString(),
      subdomain: company.subdomain,
    },
    customer,
    customerAuthEmail: email || undefined,
    customerName: name || company.name || undefined,
  };
}

function isMissingPaddleCustomerError(err) {
  const message = String(err?.message || '').toLowerCase();
  const detail = String(err?.paddle?.error?.detail || '').toLowerCase();
  const code = String(err?.paddle?.error?.code || '').toLowerCase();
  const blob = `${message} ${detail} ${code}`;
  return (
    blob.includes('customer') &&
    (blob.includes('not found') || blob.includes('does not exist') || code.includes('customer_not_found'))
  );
}

/**
 * Create a draft/automatic transaction so Checkout can open with transactionId
 * (more reliable than building the cart only in the browser).
 *
 * If the company still points at a stale paddleCustomerId (common after switching
 * sandbox → live), clear it and retry with email only.
 */
async function createCheckoutTransaction({ company, billingCycle, email, name }) {
  const attempt = async (useStoredCustomer) => {
    const payload = getCheckoutPayload({ company, billingCycle, email, name });
    if (!useStoredCustomer) {
      delete payload.customer?.id;
      if (email) {
        payload.customer = { email };
      } else {
        payload.customer = undefined;
      }
    }

    const body = {
      items: [{ price_id: payload.priceId, quantity: 1 }],
      collection_mode: 'automatic',
      currency_code: 'USD',
      custom_data: payload.customData,
    };
    if (useStoredCustomer && company.plan?.paddleCustomerId) {
      body.customer_id = company.plan.paddleCustomerId;
    } else if (email) {
      body.customer = { email };
    }

    const result = await paddleFetch('/transactions', {
      method: 'POST',
      body,
    });
    const transactionId = result?.data?.id;
    if (!transactionId) {
      const err = new Error('Paddle did not return a transaction id');
      err.statusCode = 502;
      throw err;
    }

    return {
      ...payload,
      transactionId,
      checkoutUrl: result?.data?.checkout?.url || null,
    };
  };

  try {
    return await attempt(Boolean(company.plan?.paddleCustomerId));
  } catch (err) {
    if (!company.plan?.paddleCustomerId || !isMissingPaddleCustomerError(err)) {
      throw err;
    }

    console.warn(
      '[paddle] Clearing stale paddleCustomerId',
      company.plan.paddleCustomerId,
      'for company',
      company.subdomain || company._id,
    );
    const Company = require('../models/Company');
    await Company.updateOne(
      { _id: company._id },
      { $unset: { 'plan.paddleCustomerId': 1 } },
    );
    if (company.plan) company.plan.paddleCustomerId = undefined;

    return attempt(false);
  }
}

async function cancelPaddleSubscription(subscriptionId, { effectiveFrom = 'next_billing_period' } = {}) {
  if (!subscriptionId) {
    const err = new Error('No Paddle subscription to cancel');
    err.statusCode = 400;
    throw err;
  }
  return paddleFetch(`/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    body: { effective_from: effectiveFrom },
  });
}

/**
 * Remove a scheduled cancellation so billing continues.
 * https://developer.paddle.com/api-reference/subscriptions/update-subscription
 */
async function removeScheduledCancel(subscriptionId) {
  if (!subscriptionId) {
    const err = new Error('No Paddle subscription to reactivate');
    err.statusCode = 400;
    throw err;
  }
  return paddleFetch(`/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    body: { scheduled_change: null },
  });
}

async function createCustomerPortalSession(customerId) {
  if (!customerId) {
    const err = new Error('No Paddle customer on file');
    err.statusCode = 400;
    throw err;
  }
  return paddleFetch(`/customers/${customerId}/portal-sessions`, {
    method: 'POST',
    body: {},
  });
}

async function getTransactionInvoicePdfUrl(transactionId, { disposition = 'inline' } = {}) {
  if (!transactionId) {
    const err = new Error('Transaction id is required');
    err.statusCode = 400;
    throw err;
  }
  const qs = disposition === 'attachment' ? 'disposition=attachment' : 'disposition=inline';
  const result = await paddleFetch(`/transactions/${encodeURIComponent(transactionId)}/invoice?${qs}`);
  const url = result?.data?.url;
  if (!url) {
    const err = new Error('Paddle did not return an invoice PDF url');
    err.statusCode = 502;
    throw err;
  }
  return url;
}

async function listCustomerTransactions(customerId, { perPage = 30 } = {}) {
  if (!customerId) return { data: [] };
  const qs = new URLSearchParams({
    customer_id: customerId,
    status: 'completed',
    per_page: String(perPage),
  });
  return paddleFetch(`/transactions?${qs.toString()}`);
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET?.trim();
  if (!secret || !signatureHeader || !rawBody) return false;

  let ts = '';
  let h1 = '';
  for (const part of String(signatureHeader).split(';')) {
    const [key, ...rest] = part.split('=');
    const value = rest.join('=');
    if (key === 'ts') ts = value;
    if (key === 'h1') h1 = value;
  }
  if (!ts || !h1) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  if (!Number.isFinite(age) || age > 300) return false;

  const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const signedPayload = `${ts}:${bodyString}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  try {
    const a = Buffer.from(h1, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = {
  AGENTRA_PRO_PLAN,
  isPaddleConfigured,
  getPaddleEnv,
  getCheckoutPayload,
  createCheckoutTransaction,
  cancelPaddleSubscription,
  removeScheduledCancel,
  createCustomerPortalSession,
  getTransactionInvoicePdfUrl,
  listCustomerTransactions,
  verifyWebhookSignature,
  getPriceIdForCycle,
};
