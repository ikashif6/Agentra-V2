const { verifyAccessToken } = require('../utils/token');
const { unauthorized, forbidden } = require('../utils/apiResponse');
const User = require('../models/User');
const Company = require('../models/Company');

/**
 * Resolve the tenant (company) from the request.
 * Reads the subdomain from:
 *  1. req.headers['x-tenant'] (explicit header — useful for mobile/API clients)
 *  2. The host header: lyca.agentraa.com → subdomain = "lyca"
 *
 * Attaches req.tenant (Company doc) for downstream use.
 */
const resolveTenant = async (req, res, next) => {
  try {
    let subdomain =
      req.headers['x-tenant'] ||
      req.query.subdomain; // fallback for dev

    // Parse host header if no explicit header
    if (!subdomain) {
      const host = req.headers.host || '';
      const baseDomain = process.env.APP_BASE_DOMAIN || 'agentraa.com';
      const hostWithoutPort = host.split(':')[0];

      if (hostWithoutPort.endsWith('.localhost')) {
        subdomain = hostWithoutPort.slice(0, -'.localhost'.length);
      } else if (hostWithoutPort.endsWith(`.${baseDomain}`)) {
        subdomain = hostWithoutPort.replace(`.${baseDomain}`, '');
      }
    }

    if (!subdomain) {
      // No subdomain — either the root domain or a dev environment
      // Allow the request through without a tenant (registration flows use this)
      return next();
    }

    const company = await Company.findOne({ subdomain: subdomain.toLowerCase(), isActive: true });

    if (!company) {
      return forbidden(res, `Workspace "${subdomain}" not found or inactive`);
    }

    req.tenant = company;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Protect routes — require a valid access JWT.
 * Attaches req.user and req.company.
 *
 * If req.trackSession is already set (OTP guest flow resolved by resolveTrackSession),
 * this middleware passes through without requiring a user JWT.
 */
const protect = async (req, res, next) => {
  try {
    // Track-session already resolved — skip JWT check
    if (req.trackSession) return next();

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'Access token required');
    }

    const token = authHeader.split(' ')[1];
    let decoded;

    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return unauthorized(res, 'Access token expired');
      }
      return unauthorized(res, 'Invalid access token');
    }

    // Load user — explicitly select fields we need
    const user = await User.findById(decoded.sub).select('+refreshTokens');

    if (!user) {
      return unauthorized(res, 'User not found');
    }

    if (!user.isActive) {
      return forbidden(res, 'Your account has been deactivated');
    }

    if (user.isLocked) {
      return forbidden(res, 'Your account is temporarily locked due to multiple failed login attempts');
    }

    // Load company
    const company = await Company.findById(decoded.companyId);

    if (!company || !company.isActive) {
      return forbidden(res, 'This workspace is inactive or does not exist');
    }

    // Tenant-guard: if a tenant was resolved from subdomain, ensure the token matches
    if (req.tenant && req.tenant._id.toString() !== company._id.toString()) {
      return forbidden(res, 'Token does not belong to this workspace');
    }

    req.user = user;
    req.company = company;

    // Update last seen (fire-and-forget, don't block the request)
    User.findByIdAndUpdate(user._id, { lastSeenAt: new Date() }).catch(() => {});

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Role-based access control.
 * Usage: authorize('admin', 'owner')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return unauthorized(res);
    }

    if (!roles.includes(req.user.role)) {
      return forbidden(res, `Role "${req.user.role}" is not allowed to perform this action`);
    }

    next();
  };
};

/**
 * Require email to be verified before accessing a route
 */
const requireEmailVerified = (req, res, next) => {
  if (!req.user) return unauthorized(res);

  if (!req.user.isEmailVerified) {
    return forbidden(res, 'Please verify your email address before continuing');
  }

  next();
};

module.exports = { resolveTenant, protect, authorize, requireEmailVerified };
