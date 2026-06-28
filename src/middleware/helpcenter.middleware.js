const HelpCenter = require('../models/HelpCenter');
const { notFound, forbidden } = require('../utils/apiResponse');

/**
 * resolveHelpCenter
 *
 * Resolves the company and help center config for public portal requests.
 * Checks (in order):
 *  1. x-helpcenter-subdomain header  (dev / API clients)
 *  2. Host = help.acme.com           → look up HelpCenter.customDomain (verified only)
 *  3. Host = help.lyca.agentraa.com  → company_subdomain = 'lyca'
 *  4. x-tenant header                → fallback to existing tenant header
 *
 * Attaches:
 *  req.helpCenter        — HelpCenter doc (lean + company populated)
 *  req.helpCenterCompany — Company doc shorthand
 *
 * The controller accesses req.helpCenter.company for the populated Company doc
 * and req.helpCenter.companyDoc as an alias set here.
 */
const resolveHelpCenter = async (req, res, next) => {
  try {
    const BASE_DOMAIN = process.env.APP_BASE_DOMAIN || 'agentraa.com';
    const host = (req.headers.host || '').split(':')[0].toLowerCase();

    let helpCenter = null;

    // ── 1. Explicit dev/client header ─────────────────────────────────────────
    const explicitSubdomain = req.headers['x-helpcenter-subdomain'];
    if (explicitSubdomain) {
      helpCenter = await HelpCenter.findOne({
        company_subdomain: explicitSubdomain.toLowerCase(),
      }).populate('company');
    }

    // ── 2. Custom domain: help.acme.com ───────────────────────────────────────
    if (!helpCenter && host && !host.endsWith(`.${BASE_DOMAIN}`) && host !== BASE_DOMAIN) {
      helpCenter = await HelpCenter.findOne({
        customDomain: host,
        customDomainVerified: true,
      }).populate('company');
    }

    // ── 3. Subdomain pattern: help.lyca.agentraa.com ─────────────────────────
    if (!helpCenter && host.endsWith(`.${BASE_DOMAIN}`)) {
      const withoutBase = host.replace(`.${BASE_DOMAIN}`, '');
      // Expect pattern: help.<subdomain>
      if (withoutBase.startsWith('help.')) {
        const subdomain = withoutBase.slice('help.'.length);
        if (subdomain) {
          helpCenter = await HelpCenter.findOne({
            company_subdomain: subdomain,
          }).populate('company');
        }
      }
    }

    // ── 4. Fall back to x-tenant header (used during settings preview) ────────
    if (!helpCenter && req.headers['x-tenant']) {
      helpCenter = await HelpCenter.findOne({
        company_subdomain: req.headers['x-tenant'].toLowerCase(),
      }).populate('company');
    }

    if (!helpCenter) {
      return notFound(res, 'Help center not found');
    }

    // helpCenter.company is the populated Company doc (via populate)
    const company = helpCenter.company;

    if (!company || !company.isActive) {
      return forbidden(res, 'This workspace is inactive');
    }

    // Attach to request — controller uses req.helpCenter.company (populated)
    // and req.helpCenterCompany as a convenience alias
    req.helpCenter = helpCenter;
    req.helpCenterCompany = company;

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { resolveHelpCenter };
