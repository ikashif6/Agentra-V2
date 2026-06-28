const User    = require('../models/User');
const response = require('../utils/apiResponse');

/**
 * GET /users/staff
 * Returns admin + agent users in the caller's company.
 * Supports ?search=<name or email> for live search.
 * Owner / Admin only.
 */
exports.listStaff = async (req, res, next) => {
  try {
    const { search = '', limit = 20, page = 1 } = req.query;

    const base = {
      company: req.company._id,
      role: { $in: ['admin', 'agent'] },
      isActive: true,
    };

    if (search.trim()) {
      const re = new RegExp(search.trim(), 'i');
      base.$or = [
        { firstName: re },
        { lastName:  re },
        { email:     re },
        { jobTitle:  re },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(base)
        .select('_id firstName lastName email role avatar jobTitle isActive')
        .sort({ firstName: 1, lastName: 1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(base),
    ]);

    return response.success(res, {
      users,
      pagination: {
        total,
        page:  Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /users/members
 * Returns ALL non-owner users (admin + agent + customer) in the company.
 * Useful for ticket people-picker etc.
 * Owner / Admin / Agent.
 */
exports.listMembers = async (req, res, next) => {
  try {
    const { search = '', role, limit = 30, page = 1 } = req.query;

    const base = {
      company: req.company._id,
      role: role ? role : { $in: ['admin', 'agent', 'customer'] },
      isActive: true,
    };

    if (search.trim()) {
      const re = new RegExp(search.trim(), 'i');
      base.$or = [
        { firstName: re },
        { lastName:  re },
        { email:     re },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(base)
        .select('_id firstName lastName email role avatar jobTitle')
        .sort({ firstName: 1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(base),
    ]);

    return response.success(res, { users, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /users/invite
 * Owner / Admin — invite a new agent/admin into the company via email (magic link).
 * Body: { email, role: 'agent' | 'admin', firstName, lastName }
 */
exports.inviteUser = async (req, res, next) => {
  try {
    const { email, role, firstName, lastName } = req.body;
    const company = req.company;

    if (!['agent', 'admin'].includes(role)) {
      return response.badRequest(res, 'Role must be agent or admin');
    }

    // Check if already exists in this company
    const existing = await User.findOne({ email: email.toLowerCase(), company: company._id });
    if (existing) {
      return response.conflict(res, 'A user with this email already exists in this workspace');
    }

    const tokenUtil    = require('../utils/token');
    const emailService = require('../services/email.service');

    const { raw, hashed } = tokenUtil.generateSecureToken();

    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      company: company._id,
      role,
      isEmailVerified: false,
      magicLinkToken: hashed,
      magicLinkTokenExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7-day invite window
    });

    try {
      await emailService.sendTeamInviteByOwner({
        user,
        token: raw,
        company,
        inviter: req.user,
      });
    } catch (emailErr) {
      console.error('[Invite] Failed to send invite email:', emailErr.message);
    }

    return response.created(res, {
      user: { _id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    }, `Invitation sent to ${email}`);
  } catch (err) {
    next(err);
  }
};
