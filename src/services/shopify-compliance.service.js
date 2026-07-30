const Company = require('../models/Company');
const StoreOrder = require('../models/StoreOrder');
const StoreProduct = require('../models/StoreProduct');
const { getStoreSecrets } = require('./store.service');
const { revokeShopifyAppAccess } = require('./store-oauth.service');
const emailService = require('./email.service');

function normalizeShopDomain(domain) {
  return String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}

async function findCompanyByShopDomain(shopDomain) {
  const domain = normalizeShopDomain(shopDomain);
  if (!domain) return null;
  return Company.findOne({
    'storeIntegration.provider': 'shopify',
    'storeIntegration.shopify.shopDomain': domain,
  }).select(
    '+storeIntegration.shopify.accessToken +storeIntegration.shopify.refreshToken subdomain name',
  );
}

function complianceNotifyEmail() {
  return process.env.SHOPIFY_COMPLIANCE_EMAIL || process.env.RESEND_FROM_EMAIL || 'hello@agentraa.com';
}

async function notifyCompliance(subject, text) {
  try {
    await emailService.sendEmail({
      to: complianceNotifyEmail(),
      subject,
      text,
      html: `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')}</pre>`,
    });
  } catch (err) {
    console.error('[shopify compliance email]', err.message);
  }
}

/**
 * customers/data_request — assemble a summary of customer data Agentra holds.
 */
async function handleCustomersDataRequest(payload, shopDomainHeader) {
  const shopDomain = normalizeShopDomain(payload?.shop_domain || shopDomainHeader);
  const customer = payload?.customer || {};
  const company = await findCompanyByShopDomain(shopDomain);

  const query = { company: company?._id, provider: 'shopify' };
  const or = [];
  if (customer.id != null) or.push({ 'customer.externalId': String(customer.id) });
  if (customer.email) or.push({ 'customer.email': String(customer.email).toLowerCase() });
  if (customer.phone) or.push({ 'customer.phone': String(customer.phone) });

  let orders = [];
  if (company && or.length) {
    orders = await StoreOrder.find({ ...query, $or: or })
      .select('orderNumber name totalPrice currency financialStatus customer placedAt')
      .limit(200)
      .lean();
  }

  const summary = [
    'Shopify customers/data_request received',
    `Shop: ${shopDomain}`,
    `Workspace: ${company ? `${company.name || company.subdomain} (${company._id})` : 'not found'}`,
    `Customer id: ${customer.id || 'n/a'}`,
    `Customer email: ${customer.email || 'n/a'}`,
    `Customer phone: ${customer.phone || 'n/a'}`,
    `Orders requested ids: ${(payload?.orders_requested || []).join(', ') || 'n/a'}`,
    `Data request id: ${payload?.data_request?.id || 'n/a'}`,
    `Matching StoreOrder rows: ${orders.length}`,
    '',
    orders
      .map(
        (o) =>
          `- ${o.orderNumber || o.name || o._id} | ${o.customer?.email || ''} | ${o.totalPrice || ''} ${o.currency || ''} | ${o.financialStatus || ''}`,
      )
      .join('\n'),
  ].join('\n');

  console.log('[shopify compliance]', summary);
  await notifyCompliance(`[Shopify] Customer data request — ${shopDomain}`, summary);
  return { ok: true, orders: orders.length };
}

/**
 * customers/redact — anonymize customer PII on synced orders.
 */
async function handleCustomersRedact(payload, shopDomainHeader) {
  const shopDomain = normalizeShopDomain(payload?.shop_domain || shopDomainHeader);
  const customer = payload?.customer || {};
  const company = await findCompanyByShopDomain(shopDomain);
  if (!company) {
    console.log('[shopify compliance] customers/redact: shop not found', shopDomain);
    return { ok: true, redacted: 0 };
  }

  const or = [];
  if (customer.id != null) or.push({ 'customer.externalId': String(customer.id) });
  if (customer.email) or.push({ 'customer.email': String(customer.email).toLowerCase() });
  if (customer.phone) or.push({ 'customer.phone': String(customer.phone) });
  if (!or.length) return { ok: true, redacted: 0 };

  const result = await StoreOrder.updateMany(
    { company: company._id, provider: 'shopify', $or: or },
    {
      $set: {
        customer: {
          externalId: customer.id != null ? String(customer.id) : undefined,
          name: 'Redacted',
          email: 'redacted@example.com',
          phone: '',
        },
        shippingAddress: {
          name: 'Redacted',
          address1: '',
          address2: '',
          city: '',
          province: '',
          zip: '',
          country: '',
          phone: '',
        },
        billingAddress: {
          name: 'Redacted',
          address1: '',
          address2: '',
          city: '',
          province: '',
          zip: '',
          country: '',
          phone: '',
        },
        note: '',
      },
      $unset: { raw: 1 },
    },
  );

  console.log(
    '[shopify compliance] customers/redact',
    shopDomain,
    'modified',
    result.modifiedCount || 0,
  );
  return { ok: true, redacted: result.modifiedCount || 0 };
}

/**
 * Clear Shopify connection + synced store data for a shop.
 */
async function disconnectShopByDomain(shopDomain, { deleteOrders = true } = {}) {
  const domain = normalizeShopDomain(shopDomain);
  const company = await findCompanyByShopDomain(domain);
  if (!company) {
    console.log('[shopify compliance] shop disconnect: not found', domain);
    return { ok: true, disconnected: false };
  }

  try {
    const { uninstallShopifyWidget } = require('./live-chat-shopify.service');
    await uninstallShopifyWidget(company);
    if (company.liveChat) {
      company.liveChat.widgetInstalled = false;
      company.liveChat.installMethod = null;
      company.liveChat.shopifyScriptTagId = undefined;
      company.markModified('liveChat');
    }
  } catch (err) {
    console.warn('[shopify compliance] widget uninstall', err.message);
  }

  const integration = company.storeIntegration;
  if (integration?.provider === 'shopify') {
    try {
      const secrets = getStoreSecrets(integration);
      const accessToken = secrets.shopify?.accessToken;
      if (domain && accessToken) {
        await revokeShopifyAppAccess(domain, accessToken);
      }
    } catch (err) {
      console.warn('[shopify compliance] revoke', err.message);
    }
  }

  company.storeIntegration = {
    status: 'disconnected',
    syncSettings: { syncOrders: true, syncCustomers: true, syncProducts: true },
  };
  await company.save();

  if (deleteOrders) {
    await Promise.all([
      StoreOrder.deleteMany({ company: company._id, provider: 'shopify' }),
      StoreProduct.deleteMany({ company: company._id, provider: 'shopify' }).catch(() => null),
    ]);
  }

  console.log('[shopify compliance] shop disconnected', domain, company._id.toString());
  return { ok: true, disconnected: true, companyId: company._id.toString() };
}

async function handleShopRedact(payload, shopDomainHeader) {
  const shopDomain = normalizeShopDomain(payload?.shop_domain || shopDomainHeader);
  return disconnectShopByDomain(shopDomain, { deleteOrders: true });
}

async function handleAppUninstalled(_payload, shopDomainHeader) {
  const shopDomain = normalizeShopDomain(shopDomainHeader);
  return disconnectShopByDomain(shopDomain, { deleteOrders: false });
}

module.exports = {
  normalizeShopDomain,
  findCompanyByShopDomain,
  handleCustomersDataRequest,
  handleCustomersRedact,
  handleShopRedact,
  handleAppUninstalled,
};
