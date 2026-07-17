const User       = require('../models/User');
const Team       = require('../models/Team');
const Department = require('../models/Department');
const Company    = require('../models/Company');
const response   = require('../utils/apiResponse');
const {
  logUserInvited,
  logUserUpdated,
  logUserRemoved,
} = require('../services/activity.service');

function getManagePermissions(actor, target) {
  const isSelf = actor._id.toString() === target._id.toString();

  if (isSelf) {
    return { canEdit: true, canChangeRole: false, canDelete: false };
  }

  if (target.role === 'owner') {
    return { canEdit: false, canChangeRole: false, canDelete: false };
  }

  if (actor.role === 'owner') {
    return { canEdit: true, canChangeRole: true, canDelete: true };
  }

  if (actor.role === 'admin' && ['agent', 'manager'].includes(target.role)) {
    return { canEdit: true, canChangeRole: true, canDelete: true };
  }

  if (actor.role === 'manager' && target.role === 'agent') {
    return { canEdit: true, canChangeRole: true, canDelete: true };
  }

  return { canEdit: false, canChangeRole: false, canDelete: false };
}

/**
 * GET /users/workspace
 * Owner / Admin — all workspace staff including the owner account.
 */
exports.listWorkspace = async (req, res, next) => {
  try {
    const { search = '', limit = 20, page = 1 } = req.query;

    const base = {
      company: req.company._id,
      role: { $in: ['owner', 'admin', 'manager', 'agent'] },
      isActive: true,
    };

    if (search.trim()) {
      const re = new RegExp(search.trim(), 'i');
      base.$or = [
        { firstName: re },
        { lastName: re },
        { email: re },
        { jobTitle: re },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(base)
        .select('_id firstName lastName email role avatar jobTitle isActive isOnline isEmailVerified')
        .sort({ role: 1, firstName: 1, lastName: 1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(base),
    ]);

    const roleOrder = { owner: 0, admin: 1, manager: 2, agent: 3 };
    users.sort((a, b) => {
      const diff = (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9);
      if (diff !== 0) return diff;
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });

    return response.success(res, {
      users,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
      limits: {
        maxUsers: req.company.plan?.maxUsers ?? null,
        currentUsers: req.company.usage?.totalUsers ?? total,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /users/staff
 * Returns admin / manager / agent users in the caller's company.
 * Supports ?search=<name or email> for live search.
 */
exports.listStaff = async (req, res, next) => {
  try {
    const { search = '', limit = 20, page = 1 } = req.query;

    const base = {
      company: req.company._id,
      role: { $in: ['admin', 'manager', 'agent'] },
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
 * Returns ALL non-owner users in the company.
 * Useful for ticket people-picker etc.
 */
exports.listMembers = async (req, res, next) => {
  try {
    const { search = '', role, limit = 30, page = 1 } = req.query;

    const base = {
      company: req.company._id,
      role: role ? role : { $in: ['admin', 'manager', 'agent', 'customer'] },
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

    if (!['agent', 'manager', 'admin'].includes(role)) {
      return response.badRequest(res, 'Role must be agent, manager, or admin');
    }

    if (req.user.role === 'manager' && role !== 'agent') {
      return response.forbidden(res, 'Managers can only invite support agents');
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

    await Company.findByIdAndUpdate(company._id, {
      $inc: { 'usage.totalUsers': 1 },
      $set: { 'setupChecklist.team': true },
    });

    // If every other setup step is already sticky-done, stamp completedAt
    const fresh = await Company.findById(company._id).select('setupChecklist');
    const c = fresh?.setupChecklist;
    if (
      c?.store
      && c?.channels
      && c?.ai
      && c?.workspace
      && c?.team
      && !c?.completedAt
    ) {
      await Company.findByIdAndUpdate(company._id, {
        $set: { 'setupChecklist.completedAt': new Date() },
      });
    }

    logUserInvited({ company, actor: req.user, target: user, req });

    return response.created(res, {
      user: { _id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    }, `Invitation sent to ${email}`);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /users/:id
 * Owner / Admin — update a workspace member's profile or role.
 */
exports.updateUser = async (req, res, next) => {
  try {
    const target = await User.findOne({
      _id: req.params.id,
      company: req.company._id,
      isActive: true,
    });

    if (!target) {
      return response.notFound(res, 'User not found');
    }

    const perms = getManagePermissions(req.user, target);
    if (!perms.canEdit) {
      return response.forbidden(res, 'You cannot edit this user');
    }

    const { firstName, lastName, role, jobTitle, email } = req.body;
    const updates = {};

    if (firstName !== undefined) updates.firstName = firstName.trim();
    if (lastName !== undefined) updates.lastName = lastName.trim();
    if (jobTitle !== undefined) updates.jobTitle = jobTitle.trim();

    if (email !== undefined) {
      const normalized = email.toLowerCase().trim();
      if (normalized !== target.email) {
        const taken = await User.findOne({
          email: normalized,
          company: req.company._id,
          _id: { $ne: target._id },
        });
        if (taken) {
          return response.conflict(res, 'A user with this email already exists in this workspace');
        }
        updates.email = normalized;
        updates.isEmailVerified = false;
      }
    }

    if (role !== undefined) {
      if (!perms.canChangeRole) {
        return response.forbidden(res, 'You cannot change this user\'s role');
      }
      if (!['agent', 'manager', 'admin'].includes(role)) {
        return response.badRequest(res, 'Role must be agent, manager, or admin');
      }
      if (req.user.role === 'manager' && role !== 'agent') {
        return response.forbidden(res, 'Managers can only assign the agent role');
      }
      updates.role = role;
    }

    if (Object.keys(updates).length === 0) {
      return response.badRequest(res, 'No valid fields to update');
    }

    Object.assign(target, updates);
    await target.save();

    logUserUpdated({
      company: req.company,
      actor: req.user,
      target,
      req,
      changes: updates,
    });

    return response.success(res, {
      user: {
        _id: target._id,
        email: target.email,
        firstName: target.firstName,
        lastName: target.lastName,
        role: target.role,
        jobTitle: target.jobTitle,
      },
    }, 'User updated');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /users/:id
 * Owner / Admin — deactivate a workspace member.
 */
exports.removeUser = async (req, res, next) => {
  try {
    const target = await User.findOne({
      _id: req.params.id,
      company: req.company._id,
      isActive: true,
    });

    if (!target) {
      return response.notFound(res, 'User not found');
    }

    const perms = getManagePermissions(req.user, target);
    if (!perms.canDelete) {
      return response.forbidden(res, 'You cannot remove this user');
    }

    const leadsTeam = await Team.exists({
      company: req.company._id,
      teamLead: target._id,
      isActive: true,
    });
    if (leadsTeam) {
      return response.badRequest(
        res,
        'This user leads a team. Reassign the team lead before removing them.',
      );
    }

    const headsDepartment = await Department.exists({
      company: req.company._id,
      heads: target._id,
      isActive: true,
    });
    if (headsDepartment) {
      return response.badRequest(
        res,
        'This user heads a department. Remove them as department head first.',
      );
    }

    target.isActive = false;
    target.isOnline = false;
    target.refreshTokens = [];
    await target.save({ validateBeforeSave: false });

    await Team.updateMany(
      { company: req.company._id, 'members.user': target._id },
      { $pull: { members: { user: target._id } } },
    );

    await Company.findByIdAndUpdate(req.company._id, {
      $inc: { 'usage.totalUsers': -1 },
    });

    logUserRemoved({ company: req.company, actor: req.user, target, req });

    return response.success(res, {}, 'User removed from workspace');
  } catch (err) {
    next(err);
  }
};
