const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Generate a cryptographically secure random token
 * Returns both raw (for email) and hashed (for DB storage)
 */
function generateSecureToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hashed };
}

/**
 * Hash a raw token for DB lookup
 */
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Generate a numeric OTP
 */
function generateOtp(length = 6) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

/**
 * Sign an access JWT
 */
function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: 'agentraa',
    audience: 'agentraa-api',
  });
}

/**
 * Sign a refresh JWT
 */
function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    issuer: 'agentraa',
    audience: 'agentraa-api',
  });
}

/**
 * Verify an access JWT — returns decoded payload or throws
 */
function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    issuer: 'agentraa',
    audience: 'agentraa-api',
  });
}

/**
 * Verify a refresh JWT — returns decoded payload or throws
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
    issuer: 'agentraa',
    audience: 'agentraa-api',
  });
}

/**
 * Build the standard JWT payload from a user + company
 */
function buildTokenPayload(user, company) {
  return {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
    companyId: company._id.toString(),
    subdomain: company.subdomain,
  };
}

/**
 * Sign a short-lived ticket track token (for OTP-verified guest customers)
 * Payload: { ticketId, ticket_code, email, companyId, subdomain }
 */
function signTrackToken(payload) {
  return jwt.sign(payload, process.env.JWT_TRACK_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.TRACK_TOKEN_EXPIRES_IN || '30m',
    issuer: 'agentraa',
    audience: 'agentraa-track',
  });
}

/**
 * Verify a ticket track token — returns decoded payload or throws
 */
function verifyTrackToken(token) {
  return jwt.verify(token, process.env.JWT_TRACK_SECRET || process.env.JWT_SECRET, {
    issuer: 'agentraa',
    audience: 'agentraa-track',
  });
}

function signOAuthState(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '15m',
    issuer: 'agentraa',
    audience: 'agentraa-oauth',
  });
}

function verifyOAuthState(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    issuer: 'agentraa',
    audience: 'agentraa-oauth',
  });
}

module.exports = {
  generateSecureToken,
  hashToken,
  generateOtp,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  buildTokenPayload,
  signTrackToken,
  verifyTrackToken,
  signOAuthState,
  verifyOAuthState,
};
