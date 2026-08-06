const mongoose = require('mongoose');
const Company  = require('../models/Company');
const User     = require('../models/User');
const emailService = require('../services/email.service');
const tokenUtil    = require('../utils/token');
const response     = require('../utils/apiResponse');
const { PLANS, ONBOARDING_PLAN_IDS } = require('../config/plans');
const { logWorkspaceCreated } = require('../services/activity.service');

/**
 * POST /onboarding
 *
 * Public endpoint — creates a company + owner account in one atomic-ish step.
 *
 * Body:
 *   plan_id        : 'starter' | 'pro' | 'enterprise'
 *   companyName    : string
 *   subdomain      : string   (e.g. "lyca")
 *   firstName      : string
 *   lastName       : string
 *   email          : string
 *   password       : string   (optional — can use passwordless later)
 *   billingCycle   : 'monthly' | 'yearly'  (optional, default monthly)
 *   industry       : string   (optional)
 *   timezone       : string   (optional)
 */
exports.onboard = async (req, res, next) => {
  // Track created docs so we can clean up on failure (no replica-set needed)
  let company = null;
  let user = null;

  try {
    const {
      plan_id,
      companyName,
      subdomain,
      firstName,
      lastName,
      email,
      password,
      billingCycle = 'monthly',
      industry,
      timezone,
      website,
    } = req.body;

    // ── 1. Validate plan ──────────────────────────────────────────────────────
    if (!ONBOARDING_PLAN_IDS.includes(plan_id)) {
      return response.badRequest(
        res,
        `Invalid plan. Choose one of: ${ONBOARDING_PLAN_IDS.join(', ')}`
      );
    }

    const planConfig = PLANS[plan_id];

    // ── 2. Guard: subdomain taken ─────────────────────────────────────────────
    const subdomainTaken = await Company.findOne({ subdomain: subdomain.toLowerCase() });
    if (subdomainTaken) {
      return response.conflict(res, `Subdomain "${subdomain}" is already taken`);
    }

    // ── 3. Guard: one owner per email ─────────────────────────────────────────
    const existingOwner = await User.findOne({ email: email.toLowerCase(), role: 'owner' });
    if (existingOwner) {
      return response.conflict(res, 'An owner account with this email already exists');
    }

    // ── 4. Create company (temp owner id — patched after user creation) ───────
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    company = await Company.create({
      name: companyName,
      subdomain: subdomain.toLowerCase(),
      owner: new mongoose.Types.ObjectId(), // temp — replaced below
      industry: industry || undefined,
      timezone: timezone || 'UTC',
      website: website || undefined,
      plan: {
        name: plan_id,
        maxUsers: planConfig.maxUsers,
        maxAgents: planConfig.maxAgents,
        maxTickets: planConfig.maxTickets,
        features: planConfig.features,
        billingCycle,
        status: 'trialing',
        trialEndsAt,
      },
      usage: { totalUsers: 1 },
    });

    // ── 5. Create owner user ──────────────────────────────────────────────────
    const { raw: verifyRaw, hashed: verifyHashed } = tokenUtil.generateSecureToken();

    user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: password || undefined,
      company: company._id,
      role: 'owner',
      isEmailVerified: false,
      onboardingCompleted: true,
      emailVerificationToken: verifyHashed,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // ── 6. Patch company.owner to the real user id ────────────────────────────
    company.owner = user._id;
    await company.save();

    // ── 7. Send verification email (non-fatal) ────────────────────────────────
    try {
      await emailService.sendEmailVerification({
        user,
        token: verifyRaw,
        subdomain: company.subdomain,
      });
    } catch (emailErr) {
      console.error('[Onboarding] Failed to send verification email:', emailErr.message);
    }

    logWorkspaceCreated({ company, user, req });

    return response.created(
      res,
      {
        company: {
          id: company._id,
          name: company.name,
          subdomain: company.subdomain,
          plan: plan_id,
          trialEndsAt,
        },
        user: user.toSafeObject(),
      },
      `Workspace created on the ${plan_id} plan. Please verify your email to continue.`
    );
  } catch (err) {
    // ── Manual rollback: delete any partially-created docs ────────────────────
    try {
      if (user) await User.findByIdAndDelete(user._id);
      if (company) await Company.findByIdAndDelete(company._id);
    } catch (cleanupErr) {
      console.error('[Onboarding] Cleanup after failure:', cleanupErr.message);
    }
    next(err);
  }
};

/**
 * GET /onboarding/plans
 * Public — returns the plan catalogue so the frontend can render a pricing page.
 */
exports.getPlans = (req, res) => {
  const plans = ONBOARDING_PLAN_IDS.map((id) => ({
    plan_id: id,
    ...PLANS[id],
  }));
  return response.success(res, { plans });
};

/**
 * POST /onboarding/setup
 * Authenticated — save post-signup questionnaire and mark onboarding complete.
 */
exports.completeSetup = async (req, res, next) => {
  try {
    const company = req.company;
    const user = req.user;

    if (!['owner', 'admin'].includes(user.role)) {
      return response.forbidden(res, 'Only workspace admins can complete setup');
    }

    const { teamGoal, channels, ticketVolume, ecommercePlatform, aiInterest } = req.body;

    company.onboardingSetup = {
      teamGoal: teamGoal || undefined,
      channels: Array.isArray(channels) ? channels : undefined,
      ticketVolume: ticketVolume || undefined,
      ecommercePlatform: ecommercePlatform || undefined,
      aiInterest: aiInterest || undefined,
      completedAt: new Date(),
    };

    await company.save();

    user.onboardingCompleted = true;
    await user.save();

    return response.success(
      res,
      {
        company: {
          id: company._id,
          name: company.name,
          subdomain: company.subdomain,
          onboardingSetup: company.onboardingSetup,
        },
        user: user.toSafeObject(),
      },
      'Workspace setup complete'
    );
  } catch (err) {
    next(err);
  }
};
