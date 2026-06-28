const { verifyTrackToken } = require('../utils/token');
const { unauthorized, forbidden } = require('../utils/apiResponse');
const Company = require('../models/Company');

/**
 * resolveTrackSession
 *
 * Reads the Authorization header. If the bearer token is a valid track token
 * (audience = 'agentraa-track'), it attaches req.trackSession and skips the
 * normal protect() middleware.
 *
 * If the token is NOT a track token this middleware does nothing and falls
 * through to the normal protect() check.
 *
 * Usage in routes:  router.use(resolveTrackOrProtect)
 *   — which tries the track session first, then falls back to JWT auth.
 */
const resolveTrackSession = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // no header — let protect() handle it
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = verifyTrackToken(token);
  } catch {
    // Not a track token or expired — fall through to normal auth
    return next();
  }

  // Make sure audience matches track tokens
  if (decoded.aud !== 'agentraa-track' && decoded.audience !== 'agentraa-track') {
    // jwt.verify with audience option already enforces this — but double check
    return next();
  }

  // Verify the company is still active
  const company = await Company.findById(decoded.companyId);
  if (!company || !company.isActive) {
    return forbidden(res, 'Workspace inactive');
  }

  // Attach the track session context — downstream can check req.trackSession
  req.trackSession = {
    ticketId: decoded.ticketId,
    ticket_code: decoded.ticket_code,
    email: decoded.email,
    companyId: decoded.companyId,
    subdomain: decoded.subdomain,
  };

  req.company = company; // also attach company for downstream use

  next();
};

/**
 * requireTicketAccess
 *
 * Combines track-session and normal authentication.
 * Place AFTER resolveTenant and AFTER protect in the middleware chain.
 * — If req.trackSession is set (OTP guest), the request is allowed.
 * — If req.user is set (normal JWT), the request is allowed.
 * — Otherwise 401.
 *
 * Use this on any endpoint that should be reachable by BOTH auth methods.
 */
const requireTicketAccess = (req, res, next) => {
  if (req.trackSession || req.user) return next();
  return unauthorized(res, 'Authentication required');
};

module.exports = { resolveTrackSession, requireTicketAccess };
