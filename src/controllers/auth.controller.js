const User = require('../models/User');
const Company = require('../models/Company');
const emailService = require('../services/email.service');
const tokenUtil = require('../utils/token');
const response = require('../utils/apiResponse');
const { logUserLogin, logProfileUpdated, logPasswordChanged } = require('../services/activity.service');
const { publicCompanyBranding } = require('../services/workspace-branding.service');

const MAGIC_LINK_TTL_MS = (parseInt(process.env.MAGIC_LINK_EXPIRES_MINUTES) || 15) * 60 * 1000;
const OTP_TTL_MS = (parseInt(process.env.OTP_EXPIRES_MINUTES) || 10) * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build token pair and persist refresh token to user document
 */
async function issueTokenPair(user, company, meta = {}) {
  const payload = tokenUtil.buildTokenPayload(user, company);
  const accessToken = tokenUtil.signAccessToken(payload);
  const refreshToken = tokenUtil.signRefreshToken({ sub: user._id.toString() });

  // Store hashed refresh token
  const hashedRefresh = tokenUtil.hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Keep max 5 refresh token sessions per user
  if (user.refreshTokens.length >= 5) {
    user.refreshTokens.shift();
  }

  user.refreshTokens.push({
    token: hashedRefresh,
    userAgent: meta.userAgent || '',
    ip: meta.ip || '',
    expiresAt,
  });

  user.lastLoginAt = new Date();
  user.lastLoginIp = meta.ip || '';
  user.isOnline = true;
  await user.save();

  return { accessToken, refreshToken };
}

/**
 * Extract client metadata from request
 */
function clientMeta(req) {
  return {
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

// ─── Company Registration ─────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Creates a new company + owner user in one step.
 * Sends email verification.
 */
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, companyName, subdomain } = req.body;

    // Check subdomain availability
    const subdomainTaken = await Company.findOne({ subdomain: subdomain.toLowerCase() });
    if (subdomainTaken) {
      return response.conflict(res, `Subdomain "${subdomain}" is already taken`);
    }

    // Check if email already used in another company with the same subdomain
    // (email is unique per company — but on registration the company doesn't exist yet)
    // We also want to prevent the same email registering two companies
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      // Allow same email for different companies (multi-tenant), but block duplicate company owners
      const existingOwner = await User.findOne({ email: email.toLowerCase(), role: 'owner' });
      if (existingOwner) {
        return response.conflict(res, 'An account with this email already exists as a workspace owner');
      }
    }

    // Create company first (needs owner ref after user creation — use a two-step)
    // Step 1: create company with a placeholder owner (updated below)
    const company = await Company.create({
      name: companyName,
      subdomain: subdomain.toLowerCase(),
      owner: new (require('mongoose').Types.ObjectId)(), // temp
      plan: {
        name: 'free',
        status: 'trialing',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 day trial
      },
    });

    // Step 2: create owner user
    const { raw: verifyRaw, hashed: verifyHashed } = tokenUtil.generateSecureToken();

    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: password || undefined,
      company: company._id,
      role: 'owner',
      emailVerificationToken: verifyHashed,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // Step 3: set the real owner on the company
    company.owner = user._id;
    company.usage.totalUsers = 1;
    await company.save();

    // Send verification email
    try {
      await emailService.sendEmailVerification({
        user,
        token: verifyRaw,
        subdomain: company.subdomain,
      });
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr.message);
      // Don't fail the registration — just log it
    }

    return response.created(res, { user: user.toSafeObject(), company }, 'Workspace created. Please verify your email.');
  } catch (err) {
    next(err);
  }
};

// ─── Password Login ───────────────────────────────────────────────────────────

/**
 * POST /auth/login
 * Standard email + password login. Requires tenant context (subdomain).
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password, workspace } = req.body;
    let company = req.tenant;

    // If workspace is provided in body, use it to find the company
    if (workspace && !company) {
      // Check if workspace is an ID (MongoDB ObjectId) or subdomain
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(workspace);
      
      if (isObjectId) {
        company = await Company.findById(workspace);
      } else {
        company = await Company.findOne({ 
          $or: [
            { subdomain: workspace.toLowerCase() },
            { name: { $regex: new RegExp(`^${workspace}$`, 'i') } }
          ]
        });
      }

      if (!company) {
        return response.badRequest(res, 'Invalid workspace. No company found.');
      }
    }

    if (!company) {
      return response.badRequest(res, 'No workspace context. Use subdomain header, query param, or workspace in request body.');
    }

    // Load user with password and refresh tokens
    const user = await User.findOne({ email: email.toLowerCase(), company: company._id })
      .select('+password +refreshTokens +loginAttempts +lockUntil +otpCode +otpAttempts');

    if (!user) {
      return response.unauthorized(res, 'Invalid email or password');
    }

    if (!user.isActive) {
      return response.forbidden(res, 'Your account has been deactivated');
    }

    if (user.isLocked) {
      return response.forbidden(res, 'Account temporarily locked due to failed login attempts. Try again in 2 hours or use a magic link.');
    }

    if (!user.hasPassword) {
      return response.badRequest(res, 'This account uses passwordless login. Please request a magic link or OTP.');
    }

    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      await user.incLoginAttempts();
      return response.unauthorized(res, 'Invalid email or password');
    }

    if (!user.isEmailVerified) {
      return response.forbidden(
        res,
        'Please verify your email before signing in. Check your inbox for the verification link we sent when you signed up.',
        { code: 'EMAIL_NOT_VERIFIED' },
      );
    }

    // Reset attempts on success
    await user.resetLoginAttempts();

    const { accessToken, refreshToken } = await issueTokenPair(user, company, clientMeta(req));

    logUserLogin({ company, user, req });

    return response.success(res, {
      accessToken,
      refreshToken,
      user: user.toSafeObject(),
      company: publicCompanyBranding(company),
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
};
// ─── Passwordless: Magic Link ─────────────────────────────────────────────────

/**
 * POST /auth/magic-link/request
 * Send a one-time sign-in link to the user's email.
 */
exports.requestMagicLink = async (req, res, next) => {
  try {
    const { email } = req.body;
    const company = req.tenant;

    if (!company) {
      return response.badRequest(res, 'No workspace context.');
    }

    const user = await User.findOne({ email: email.toLowerCase(), company: company._id });

    // Always return 200 — don't reveal whether the email exists (security)
    if (!user || !user.isActive) {
      return response.success(res, {}, 'If that email exists in this workspace, a sign-in link has been sent.');
    }

    const { raw, hashed } = tokenUtil.generateSecureToken();

    await User.findByIdAndUpdate(user._id, {
      magicLinkToken: hashed,
      magicLinkTokenExpires: new Date(Date.now() + MAGIC_LINK_TTL_MS),
    });

    try {
      await emailService.sendMagicLink({ user, token: raw, subdomain: company.subdomain });
    } catch (emailErr) {
      console.error('Failed to send magic link:', emailErr.message);
      return response.error(res, 'Failed to send email. Please try again.');
    }

    return response.success(res, {}, 'If that email exists in this workspace, a sign-in link has been sent.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/magic-link/verify
 * Exchange a magic link token for an access + refresh token pair.
 * Requires tenant context for standard logins.
 */
exports.verifyMagicLink = async (req, res, next) => {
  try {
    const { token } = req.body;
    const company = req.tenant;

    if (!company) {
      return response.badRequest(res, 'No workspace context.');
    }

    const hashedToken = tokenUtil.hashToken(token);

    const user = await User.findOne({
      magicLinkToken: hashedToken,
      magicLinkTokenExpires: { $gt: new Date() },
      company: company._id,
    }).select('+refreshTokens +magicLinkToken +magicLinkTokenExpires');

    if (!user) {
      return response.unauthorized(res, 'Invalid or expired magic link');
    }

    // Clear the token — one-time use
    await User.findByIdAndUpdate(user._id, {
      $unset: { magicLinkToken: 1, magicLinkTokenExpires: 1 },
      isEmailVerified: true,
    });

    const { accessToken, refreshToken } = await issueTokenPair(user, company, clientMeta(req));

    logUserLogin({ company, user, req });

    return response.success(res, {
      accessToken,
      refreshToken,
      user: user.toSafeObject(),
      company: publicCompanyBranding(company),
    }, 'Magic link verified successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/accept-invite
 * Public — no workspace context required.
 * Token is looked up globally; the workspace is derived from the invited user's company.
 * Optionally sets a password on first use.
 *
 * Body: { token, password? }
 */
exports.acceptInvite = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token) {
      return response.badRequest(res, 'Invite token is required');
    }

    const hashedToken = tokenUtil.hashToken(token);

    // Find user by magic link token — no company filter (workspace-agnostic)
    const user = await User.findOne({
      magicLinkToken: hashedToken,
      magicLinkTokenExpires: { $gt: new Date() },
    }).select('+refreshTokens +magicLinkToken +magicLinkTokenExpires +password');

    if (!user) {
      return response.unauthorized(res, 'Invalid or expired invite link. Please ask for a new invitation.');
    }

    // Load the user's company (the workspace they were invited to)
    const company = await Company.findById(user.company);
    if (!company || !company.isActive) {
      return response.forbidden(res, 'The workspace this invite belongs to is inactive.');
    }

    // Set password if provided on first accept
    if (password) {
      user.password = password;
      user.hasPassword = true;
    }

    user.isEmailVerified = true;
    user.magicLinkToken = undefined;
    user.magicLinkTokenExpires = undefined;
    await user.save();

    const { accessToken, refreshToken } = await issueTokenPair(user, company, clientMeta(req));

    logUserLogin({ company, user, req });

    return response.success(res, {
      accessToken,
      refreshToken,
      user: user.toSafeObject(),
      company: publicCompanyBranding(company),
    }, `Welcome to ${company.name}! You're now signed in.`);
  } catch (err) {
    next(err);
  }
};

// ─── Passwordless: OTP ────────────────────────────────────────────────────────

/**
 * POST /auth/otp/request
 * Send a 6-digit OTP to the user's email.
 */
exports.requestOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const company = req.tenant;

    if (!company) {
      return response.badRequest(res, 'No workspace context.');
    }

    const user = await User.findOne({ email: email.toLowerCase(), company: company._id });

    if (!user || !user.isActive) {
      return response.success(res, {}, 'If that email exists in this workspace, an OTP has been sent.');
    }

    const otp = tokenUtil.generateOtp(6);
    const hashedOtp = tokenUtil.hashToken(otp);

    await User.findByIdAndUpdate(user._id, {
      otpCode: hashedOtp,
      otpCodeExpires: new Date(Date.now() + OTP_TTL_MS),
      otpAttempts: 0,
    });

    try {
      await emailService.sendOtpCode({ user, otp, subdomain: company.subdomain });
    } catch (emailErr) {
      console.error('Failed to send OTP:', emailErr.message);
      return response.error(res, 'Failed to send email. Please try again.');
    }

    return response.success(res, {}, 'If that email exists in this workspace, an OTP has been sent.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/otp/verify
 * Verify OTP and return token pair.
 */
exports.verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const company = req.tenant;

    if (!company) {
      return response.badRequest(res, 'No workspace context.');
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      company: company._id,
    }).select('+otpCode +otpCodeExpires +otpAttempts +refreshTokens');

    if (!user || !user.isActive) {
      return response.unauthorized(res, 'Invalid OTP');
    }

    if (!user.otpCode || !user.otpCodeExpires || user.otpCodeExpires < new Date()) {
      return response.unauthorized(res, 'OTP has expired. Please request a new one.');
    }

    if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
      return response.forbidden(res, 'Too many incorrect attempts. Please request a new OTP.');
    }

    const hashedInput = tokenUtil.hashToken(otp);

    if (hashedInput !== user.otpCode) {
      await User.findByIdAndUpdate(user._id, { $inc: { otpAttempts: 1 } });
      const remaining = OTP_MAX_ATTEMPTS - (user.otpAttempts + 1);
      return response.unauthorized(res, `Invalid OTP. ${remaining} attempt(s) remaining.`);
    }

    // Clear OTP — one-time use
    await User.findByIdAndUpdate(user._id, {
      $unset: { otpCode: 1, otpCodeExpires: 1, otpAttempts: 1 },
      isEmailVerified: true,
    });

    const { accessToken, refreshToken } = await issueTokenPair(user, company, clientMeta(req));

    logUserLogin({ company, user, req });

    return response.success(res, {
      accessToken,
      refreshToken,
      user: user.toSafeObject(),
      company: publicCompanyBranding(company),
    }, 'OTP verified successfully');
  } catch (err) {
    next(err);
  }
};

// ─── Email Verification ───────────────────────────────────────────────────────

/**
 * POST /auth/verify-email
 */
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;

    const hashedToken = tokenUtil.hashToken(token);

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires +refreshTokens');

    if (!user) {
      return response.badRequest(res, 'Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    const company = await Company.findById(user.company);
    if (!company) {
      return response.badRequest(res, 'Workspace not found for this account');
    }

    // Send welcome email (non-fatal)
    try {
      await emailService.sendWelcomeEmail({ user, company });
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr.message);
    }

    const { accessToken, refreshToken } = await issueTokenPair(user, company, clientMeta(req));

    logUserLogin({ company, user, req });

    return response.success(
      res,
      {
        accessToken,
        refreshToken,
        user: user.toSafeObject(),
        company: publicCompanyBranding(company),
      },
      'Email verified successfully'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/verify-email/resend
 * Resend email verification to the logged-in user
 */
exports.resendVerification = async (req, res, next) => {
  try {
    // Can be called by authenticated user
    const user = await User.findById(req.user._id).select('+emailVerificationToken +emailVerificationExpires');

    if (user.isEmailVerified) {
      return response.badRequest(res, 'Email is already verified');
    }

    // Throttle: don't allow resend within 2 minutes
    if (user.emailVerificationExpires) {
      const originalSentAt = new Date(user.emailVerificationExpires) - 24 * 60 * 60 * 1000;
      if (Date.now() - originalSentAt < 2 * 60 * 1000) {
        return response.tooMany(res, 'Please wait a moment before requesting another verification email');
      }
    }

    const { raw, hashed } = tokenUtil.generateSecureToken();

    await User.findByIdAndUpdate(user._id, {
      emailVerificationToken: hashed,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const company = req.company;
    await emailService.sendEmailVerification({ user, token: raw, subdomain: company.subdomain });

    return response.success(res, {}, 'Verification email sent');
  } catch (err) {
    next(err);
  }
};

// ─── Password Reset ───────────────────────────────────────────────────────────

/**
 * POST /auth/forgot-password
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const company = req.tenant;

    if (!company) {
      return response.badRequest(res, 'No workspace context.');
    }

    const user = await User.findOne({ email: email.toLowerCase(), company: company._id });

    // Always 200 to prevent user enumeration
    if (!user || !user.isActive || !user.hasPassword) {
      return response.success(res, {}, 'If that email exists, a password reset link has been sent.');
    }

    const { raw, hashed } = tokenUtil.generateSecureToken();

    await User.findByIdAndUpdate(user._id, {
      passwordResetToken: hashed,
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    try {
      await emailService.sendPasswordReset({ user, token: raw, subdomain: company.subdomain });
    } catch (emailErr) {
      console.error('Failed to send password reset email:', emailErr.message);
      return response.error(res, 'Failed to send email. Please try again.');
    }

    return response.success(res, {}, 'If that email exists, a password reset link has been sent.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/reset-password
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const hashedToken = tokenUtil.hashToken(token);

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return response.badRequest(res, 'Invalid or expired password reset token');
    }

    user.password = password;
    user.hasPassword = true;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    // Invalidate all refresh tokens for security
    user.refreshTokens = [];
    await user.save();

    return response.success(res, {}, 'Password reset successfully. Please log in again.');
  } catch (err) {
    next(err);
  }
};

// ─── Token Refresh ────────────────────────────────────────────────────────────

/**
 * POST /auth/refresh
 * Exchange a valid refresh token for a new access + refresh token pair (rotation).
 */
exports.refreshTokens = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return response.badRequest(res, 'Refresh token required');
    }

    let decoded;
    try {
      decoded = tokenUtil.verifyRefreshToken(refreshToken);
    } catch (err) {
      return response.unauthorized(res, 'Invalid or expired refresh token');
    }

    const hashedToken = tokenUtil.hashToken(refreshToken);

    const user = await User.findOne({
      _id: decoded.sub,
      'refreshTokens.token': hashedToken,
    }).select('+refreshTokens');

    if (!user) {
      return response.unauthorized(res, 'Refresh token not recognised. Possible token reuse');
    }

    // Remove used token (rotation)
    user.refreshTokens = user.refreshTokens.filter((rt) => rt.token !== hashedToken);

    const company = await Company.findById(user.company);
    if (!company || !company.isActive) {
      return response.forbidden(res, 'Workspace inactive');
    }

    const { accessToken, refreshToken: newRefreshToken } = await issueTokenPair(
      user,
      company,
      clientMeta(req)
    );

    return response.success(res, { accessToken, refreshToken: newRefreshToken }, 'Tokens refreshed');
  } catch (err) {
    next(err);
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * POST /auth/logout
 * Invalidate the current refresh token session.
 */
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken && req.user) {
      const hashedToken = tokenUtil.hashToken(refreshToken);
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { refreshTokens: { token: hashedToken } },
      });
    }

    return response.success(res, {}, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/logout-all
 * Invalidate ALL sessions for this user.
 */
exports.logoutAll = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshTokens: [] });
    return response.success(res, {}, 'Logged out from all devices');
  } catch (err) {
    next(err);
  }
};

// ─── Current User ─────────────────────────────────────────────────────────────

/**
 * GET /auth/me
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate(
      'company',
      'name subdomain logo timezone branding plan.name plan.status plan.trialEndsAt plan.currentPeriodEnd plan.cancelAtPeriodEnd plan.canceledAt',
    );

    const safe = user.toSafeObject();
    if (safe.company && typeof safe.company === 'object') {
      safe.company = publicCompanyBranding(safe.company);
    }

    return response.success(res, { user: safe });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /auth/me
 * Update own profile (name, preferences, etc. — NOT role or company)
 */
exports.updateMe = async (req, res, next) => {
  try {
    const allowed = ['firstName', 'lastName', 'phone', 'jobTitle', 'bio', 'preferences', 'avatar', 'isOnline'];
    const updates = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (updates.preferences) {
      const existingUser = await User.findById(req.user._id);
      const existingPrefs = existingUser?.preferences
        ? { ...(existingUser.preferences.toObject?.() ?? existingUser.preferences) }
        : {};
      updates.preferences = { ...existingPrefs, ...updates.preferences };
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });

    logProfileUpdated({ company: req.company, actor: user, req });

    return response.success(res, { user: user.toSafeObject() }, 'Profile updated');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/change-password
 * Change password while logged in
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password +refreshTokens');

    if (user.hasPassword) {
      const match = await user.comparePassword(currentPassword);
      if (!match) {
        return response.badRequest(res, 'Current password is incorrect');
      }
    }

    user.password = newPassword;
    // Revoke all other sessions
    user.refreshTokens = [];
    await user.save();

    logPasswordChanged({ company: req.company, actor: user, req });

    return response.success(res, {}, 'Password changed successfully. Please log in again.');
  } catch (err) {
    next(err);
  }
};

// ─── Subdomain Check ──────────────────────────────────────────────────────────

/**
 * GET /auth/check-subdomain/:subdomain
 * Public endpoint — check if a subdomain is available
 */
exports.checkSubdomain = async (req, res, next) => {
  try {
    const { subdomain } = req.params;

    // Validation
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
      return response.badRequest(res, 'Invalid subdomain format');
    }

    // Reserved subdomains
    const reserved = ['www', 'api', 'app', 'admin', 'mail', 'ftp', 'support', 'help', 'status', 'blog', 'docs'];
    if (reserved.includes(subdomain.toLowerCase())) {
      return response.success(res, { available: false, reason: 'This subdomain is reserved' });
    }

    const existing = await Company.findOne({ subdomain: subdomain.toLowerCase() });

    return response.success(res, {
      available: !existing,
      subdomain: subdomain.toLowerCase(),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Google / Microsoft staff login ───────────────────────────────────────────

function resolveCompanyForOAuth(workspace) {
  if (!workspace) return null;
  const value = String(workspace).toLowerCase().trim();
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(value);
  if (isObjectId) return Company.findById(value);
  return Company.findOne({
    $or: [{ subdomain: value }, { name: { $regex: new RegExp(`^${value}$`, 'i') } }],
  });
}

exports.getGoogleLoginUrl = async (req, res, next) => {
  try {
    const oauth = require('../services/oauth-providers.service');
    if (!oauth.isGoogleConfigured()) {
      return response.badRequest(res, 'Google sign-in is not configured on this server');
    }
    const workspace = req.query.workspace || req.headers['x-tenant'];
    const company = (req.tenant && req.tenant._id ? req.tenant : null) || (await resolveCompanyForOAuth(workspace));
    if (!company) {
      return response.badRequest(res, 'Workspace is required for Google sign-in');
    }
    const url = oauth.buildGoogleAuthUrl({
      purpose: 'google_auth',
      companyId: company._id,
      subdomain: company.subdomain,
      returnOrigin: req.query.returnOrigin || req.headers.origin,
      returnPath: '/auth/login',
    });
    return response.success(res, { url });
  } catch (err) {
    next(err);
  }
};

exports.getMicrosoftLoginUrl = async (req, res, next) => {
  try {
    const oauth = require('../services/oauth-providers.service');
    if (!oauth.isMicrosoftConfigured()) {
      return response.badRequest(res, 'Microsoft sign-in is not configured on this server');
    }
    const workspace = req.query.workspace || req.headers['x-tenant'];
    const company = (req.tenant && req.tenant._id ? req.tenant : null) || (await resolveCompanyForOAuth(workspace));
    if (!company) {
      return response.badRequest(res, 'Workspace is required for Microsoft sign-in');
    }
    const url = oauth.buildMicrosoftAuthUrl({
      purpose: 'microsoft_auth',
      companyId: company._id,
      subdomain: company.subdomain,
      returnOrigin: req.query.returnOrigin || req.headers.origin,
      returnPath: '/auth/login',
    });
    return response.success(res, { url });
  } catch (err) {
    next(err);
  }
};

function validateSocialSignupInput(body) {
  const companyName = String(body.companyName || '').trim();
  const subdomain = String(body.subdomain || '').trim().toLowerCase();
  const website = String(body.website || '').trim();

  if (companyName.length < 2 || companyName.length > 100) {
    throw new Error('Company name must be between 2 and 100 characters');
  }
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
    throw new Error('Invalid workspace URL');
  }
  let parsedWebsite;
  try {
    parsedWebsite = new URL(website);
  } catch {
    throw new Error('Enter a valid website URL');
  }
  if (!['http:', 'https:'].includes(parsedWebsite.protocol)) {
    throw new Error('Website must use HTTP or HTTPS');
  }

  return {
    companyName,
    subdomain,
    website: parsedWebsite.toString(),
  };
}

async function getSocialSignupUrl(req, res, next, provider) {
  try {
    const oauth = require('../services/oauth-providers.service');
    const configured =
      provider === 'google' ? oauth.isGoogleConfigured() : oauth.isMicrosoftConfigured();
    if (!configured) {
      return response.badRequest(res, `${provider === 'google' ? 'Google' : 'Microsoft'} signup is not configured`);
    }

    let signupData;
    try {
      signupData = validateSocialSignupInput(req.body);
    } catch (err) {
      return response.badRequest(res, err.message);
    }

    const existing = await Company.findOne({ subdomain: signupData.subdomain }).select('_id');
    if (existing) return response.conflict(res, 'That workspace URL is already taken');

    const builder =
      provider === 'google' ? oauth.buildGoogleAuthUrl : oauth.buildMicrosoftAuthUrl;
    const url = builder({
      purpose: `${provider}_signup`,
      subdomain: signupData.subdomain,
      returnOrigin: req.body.returnOrigin || req.headers.origin,
      returnPath: '/auth/signup',
      signupData,
    });
    return response.success(res, { url });
  } catch (err) {
    next(err);
  }
}

exports.getGoogleSignupUrl = (req, res, next) =>
  getSocialSignupUrl(req, res, next, 'google');

exports.getMicrosoftSignupUrl = (req, res, next) =>
  getSocialSignupUrl(req, res, next, 'microsoft');

async function finishSocialSignup({ provider, profile, signupData, req, res }) {
  const mongoose = require('mongoose');
  const oauth = require('../services/oauth-providers.service');
  const data = validateSocialSignupInput(signupData || {});
  const idField = provider === 'google' ? 'googleId' : 'microsoftId';

  const [subdomainTaken, existingOwner] = await Promise.all([
    Company.findOne({ subdomain: data.subdomain }).select('_id'),
    User.findOne({ email: profile.email, role: 'owner' }).select('_id'),
  ]);
  if (subdomainTaken) {
    return res.redirect(
      oauth.buildAppRedirect(
        data.subdomain,
        '/auth/signup',
        { oauth: 'error', message: 'That workspace URL is already taken' },
        signupData.returnOrigin,
      ),
    );
  }
  if (existingOwner) {
    return res.redirect(
      oauth.buildAppRedirect(
        data.subdomain,
        '/auth/signup',
        { oauth: 'error', message: 'An owner account already exists for this email. Sign in instead.' },
        signupData.returnOrigin,
      ),
    );
  }

  let company;
  try {
    company = await Company.create({
      name: data.companyName,
      subdomain: data.subdomain,
      website: data.website,
      owner: new mongoose.Types.ObjectId(),
      plan: {
        name: 'pro',
        status: 'trialing',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    const user = await User.create({
      firstName: profile.firstName || profile.name || 'Workspace',
      lastName: profile.lastName || '',
      email: profile.email,
      company: company._id,
      role: 'owner',
      isEmailVerified: true,
      [idField]: profile.id,
    });

    company.owner = user._id;
    company.usage.totalUsers = 1;
    await company.save();

    const loaded = await User.findById(user._id).select('+refreshTokens');
    const { accessToken, refreshToken } = await issueTokenPair(loaded, company, clientMeta(req));
    logUserLogin({ company, user: loaded, req });

    const resultCode = tokenUtil.signOAuthState({
      purpose: 'oauth_login_result',
      accessToken,
      refreshToken,
      subdomain: company.subdomain,
    });

    return res.redirect(
      oauth.buildAppRedirect(
        company.subdomain,
        '/auth/oauth/complete',
        { code: resultCode, provider, created: '1' },
        null,
      ),
    );
  } catch (err) {
    if (company?._id) await Company.findByIdAndDelete(company._id).catch(() => {});
    throw err;
  }
}

async function finishStaffSocialLogin({
  provider,
  profile,
  companyId,
  subdomain,
  returnOrigin,
  req,
  res,
}) {
  const oauth = require('../services/oauth-providers.service');
  const company = await Company.findById(companyId);
  if (!company || !company.isActive) {
    return res.redirect(
      oauth.buildAppRedirect(subdomain, '/auth/login', { oauth: 'error', message: 'Workspace not found' }, returnOrigin),
    );
  }

  const idField = provider === 'google' ? 'googleId' : 'microsoftId';
  let user =
    (await User.findOne({ company: company._id, [idField]: profile.id })) ||
    (await User.findOne({ company: company._id, email: profile.email }));

  if (!user || !user.isActive) {
    return res.redirect(
      oauth.buildAppRedirect(
        subdomain,
        '/auth/login',
        {
          oauth: 'error',
          message: 'No Agentra account matches this email in this workspace. Ask an owner to invite you first.',
        },
        returnOrigin,
      ),
    );
  }

  if (['customer'].includes(user.role)) {
    return res.redirect(
      oauth.buildAppRedirect(
        subdomain,
        '/auth/login',
        { oauth: 'error', message: 'This account cannot sign in to the agent workspace' },
        returnOrigin,
      ),
    );
  }

  user[idField] = profile.id;
  user.isEmailVerified = true;
  if (!user.firstName && profile.firstName) user.firstName = profile.firstName;
  if (!user.lastName && profile.lastName) user.lastName = profile.lastName;
  await user.save();

  const loaded = await User.findById(user._id).select('+refreshTokens');
  const { accessToken, refreshToken } = await issueTokenPair(loaded, company, clientMeta(req));
  logUserLogin({ company, user: loaded, req });

  const code = tokenUtil.signOAuthState({
    purpose: 'oauth_login_result',
    accessToken,
    refreshToken,
    subdomain: company.subdomain,
  });

  return res.redirect(
    oauth.buildAppRedirect(subdomain, '/auth/oauth/complete', { code, provider }, returnOrigin),
  );
}

exports.googleLoginCallback = async (req, res) => {
  const oauth = require('../services/oauth-providers.service');
  try {
    const { code, state, error, error_description: errorDescription } = req.query;
    if (!state) return res.status(400).send('Missing OAuth state');
    let payload;
    try {
      payload = tokenUtil.verifyOAuthState(String(state));
    } catch {
      return res.status(400).send('OAuth session expired');
    }
    if (!['google_auth', 'google_signup'].includes(payload.purpose)) {
      return res.status(400).send('Invalid OAuth state');
    }

    if (error || !code) {
      const targetPath = payload.purpose === 'google_signup' ? '/auth/signup' : '/auth/login';
      return res.redirect(
        oauth.buildAppRedirect(
          payload.subdomain,
          targetPath,
          { oauth: 'error', message: errorDescription || error || 'Google login cancelled' },
          payload.returnOrigin,
        ),
      );
    }

    const tokens = await oauth.exchangeGoogleCode(String(code), 'auth');
    const profile = await oauth.fetchGoogleProfile(tokens.access_token);
    if (!profile.email) {
      const targetPath = payload.purpose === 'google_signup' ? '/auth/signup' : '/auth/login';
      return res.redirect(
        oauth.buildAppRedirect(
          payload.subdomain,
          targetPath,
          { oauth: 'error', message: 'Google did not return an email' },
          payload.returnOrigin,
        ),
      );
    }

    if (payload.purpose === 'google_signup') {
      return finishSocialSignup({
        provider: 'google',
        profile,
        signupData: { ...payload.signupData, returnOrigin: payload.returnOrigin },
        req,
        res,
      });
    }

    return finishStaffSocialLogin({
      provider: 'google',
      profile,
      companyId: payload.companyId,
      subdomain: payload.subdomain,
      returnOrigin: payload.returnOrigin,
      req,
      res,
    });
  } catch (err) {
    console.error('[google login]', err);
    return res.status(500).send(err.message || 'Google login failed');
  }
};

exports.microsoftLoginCallback = async (req, res) => {
  const oauth = require('../services/oauth-providers.service');
  try {
    const { code, state, error, error_description: errorDescription } = req.query;
    if (!state) return res.status(400).send('Missing OAuth state');
    let payload;
    try {
      payload = tokenUtil.verifyOAuthState(String(state));
    } catch {
      return res.status(400).send('OAuth session expired');
    }
    if (!['microsoft_auth', 'microsoft_signup'].includes(payload.purpose)) {
      return res.status(400).send('Invalid OAuth state');
    }

    if (error || !code) {
      const targetPath =
        payload.purpose === 'microsoft_signup' ? '/auth/signup' : '/auth/login';
      return res.redirect(
        oauth.buildAppRedirect(
          payload.subdomain,
          targetPath,
          { oauth: 'error', message: errorDescription || error || 'Microsoft login cancelled' },
          payload.returnOrigin,
        ),
      );
    }

    const tokens = await oauth.exchangeMicrosoftCode(String(code), 'auth');
    const profile = await oauth.fetchMicrosoftProfile(tokens.access_token);
    if (!profile.email) {
      const targetPath =
        payload.purpose === 'microsoft_signup' ? '/auth/signup' : '/auth/login';
      return res.redirect(
        oauth.buildAppRedirect(
          payload.subdomain,
          targetPath,
          { oauth: 'error', message: 'Microsoft did not return an email' },
          payload.returnOrigin,
        ),
      );
    }

    if (payload.purpose === 'microsoft_signup') {
      return finishSocialSignup({
        provider: 'microsoft',
        profile,
        signupData: { ...payload.signupData, returnOrigin: payload.returnOrigin },
        req,
        res,
      });
    }

    return finishStaffSocialLogin({
      provider: 'microsoft',
      profile,
      companyId: payload.companyId,
      subdomain: payload.subdomain,
      returnOrigin: payload.returnOrigin,
      req,
      res,
    });
  } catch (err) {
    console.error('[microsoft login]', err);
    return res.status(500).send(err.message || 'Microsoft login failed');
  }
};

exports.completeOAuthLogin = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return response.badRequest(res, 'OAuth code is required');
    let payload;
    try {
      payload = tokenUtil.verifyOAuthState(String(code));
    } catch {
      return response.unauthorized(res, 'Invalid or expired OAuth session');
    }
    if (payload.purpose !== 'oauth_login_result' || !payload.accessToken || !payload.refreshToken) {
      return response.unauthorized(res, 'Invalid OAuth session');
    }

    const decoded = tokenUtil.verifyAccessToken(payload.accessToken);
    const user = await User.findById(decoded.sub);
    const company = await Company.findById(decoded.companyId);
    if (!user || !company) return response.unauthorized(res, 'Account not found');

    return response.success(
      res,
      {
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: user.toSafeObject(),
        company: publicCompanyBranding(company),
      },
      'Signed in',
    );
  } catch (err) {
    next(err);
  }
};
