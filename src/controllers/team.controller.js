const Team       = require('../models/Team');
const Department = require('../models/Department');
const User       = require('../models/User');
const response   = require('../utils/apiResponse');
const emailService = require('../services/email.service');
const { logTeamCreated } = require('../services/activity.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isStaff(role) {
  return ['owner', 'admin'].includes(role);
}

function isTeamLead(team, userId) {
  return team.teamLead.toString() === userId.toString();
}

function isDeptHead(department, userId) {
  return department.heads.some((h) => h.toString() === userId.toString());
}

/**
 * Can the requester manage (create/edit/invite in) this team?
 * — owner / admin always yes
 * — department head of the team's department yes
 * — team lead of this specific team yes
 */
async function canManageTeam(team, req) {
  if (isStaff(req.user.role)) return true;
  if (isTeamLead(team, req.user._id)) return true;

  const dept = await Department.findById(team.department);
  if (dept && isDeptHead(dept, req.user._id)) return true;

  return false;
}

// ─── Team CRUD ────────────────────────────────────────────────────────────────

/**
 * POST /departments/:deptId/teams
 * Who can create: owner / admin / department head of that department
 */
exports.createTeam = async (req, res, next) => {
  try {
    const { name, description, teamLead } = req.body;
    const company = req.company;
    const { deptId } = req.params;

    // Verify department exists in this company
    const department = await Department.findOne({ _id: deptId, company: company._id, isActive: true });
    if (!department) return response.notFound(res, 'Department not found');

    // Access: owner/admin OR head of this department
    const userCanCreate =
      isStaff(req.user.role) || isDeptHead(department, req.user._id);

    if (!userCanCreate) {
      return response.forbidden(res, 'Only owner, admin, or a department head can create teams');
    }

    // Validate team lead — must be admin or agent in this company
    const leadUser = await User.findOne({
      _id: teamLead,
      company: company._id,
      role: { $in: ['admin', 'agent'] },
      isActive: true,
    });

    if (!leadUser) {
      return response.badRequest(res, 'Team lead must be an active admin or agent in this workspace');
    }

    const team = await Team.create({
      company: company._id,
      department: department._id,
      name,
      description,
      teamLead,
      // Automatically add the lead as a member
      members: [{ user: teamLead, invitedBy: req.user._id }],
    });

    await team.populate([
      { path: 'teamLead', select: 'firstName lastName email avatar' },
      { path: 'members.user', select: 'firstName lastName email avatar' },
    ]);

    logTeamCreated({ company, actor: req.user, team, req });

    return response.created(res, { team }, 'Team created');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /departments/:deptId/teams
 * Owner / admin / agent — list teams in a department
 */
exports.listTeams = async (req, res, next) => {
  try {
    const { deptId } = req.params;

    const department = await Department.findOne({
      _id: deptId,
      company: req.company._id,
    });
    if (!department) return response.notFound(res, 'Department not found');

    const teams = await Team.find({ department: deptId, company: req.company._id, isActive: true })
      .populate('teamLead', 'firstName lastName email avatar')
      .populate('members.user', 'firstName lastName email avatar')
      .sort({ name: 1 });

    return response.success(res, { teams });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /teams  (company-wide — all teams across all departments)
 * Query: page, limit, search
 */
exports.listAllTeams = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, search } = req.query;

    const base = { company: req.company._id, isActive: true };
    if (search && search.trim()) {
      base.name = { $regex: search.trim(), $options: 'i' };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [teams, total] = await Promise.all([
      Team.find(base)
        .populate('department', 'name')
        .populate('teamLead', 'firstName lastName email avatar')
        .populate('members.user', 'firstName lastName email avatar')
        .sort({ name: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Team.countDocuments(base),
    ]);

    return response.success(res, {
      teams,
      pagination: {
        total,
        page:  Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /teams/:id  (also accessible via /departments/:deptId/teams/:id)
 */
exports.getTeam = async (req, res, next) => {
  try {
    const team = await Team.findOne({ _id: req.params.id, company: req.company._id })
      .populate('department', 'name description')
      .populate('teamLead', 'firstName lastName email avatar role')
      .populate('members.user', 'firstName lastName email avatar role')
      .populate('members.invitedBy', 'firstName lastName email');

    if (!team) return response.notFound(res, 'Team not found');
    return response.success(res, { team });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /teams/:id
 * owner / admin / dept head / team lead — update name, description, teamLead
 */
exports.updateTeam = async (req, res, next) => {
  try {
    const team = await Team.findOne({ _id: req.params.id, company: req.company._id });
    if (!team) return response.notFound(res, 'Team not found');

    if (!(await canManageTeam(team, req))) {
      return response.forbidden(res, 'Access denied');
    }

    const { name, description, teamLead } = req.body;

    if (name !== undefined) team.name = name;
    if (description !== undefined) team.description = description;

    // Only owner / admin / dept head can reassign the team lead
    if (teamLead !== undefined) {
      const canReassign = isStaff(req.user.role) || (await (async () => {
        const dept = await Department.findById(team.department);
        return dept && isDeptHead(dept, req.user._id);
      })());

      if (!canReassign) {
        return response.forbidden(res, 'Only owner, admin, or the department head can reassign the team lead');
      }

      const newLead = await User.findOne({
        _id: teamLead,
        company: req.company._id,
        role: { $in: ['admin', 'agent'] },
        isActive: true,
      });

      if (!newLead) return response.badRequest(res, 'New team lead must be an active admin or agent');

      team.teamLead = teamLead;

      // Ensure the new lead is in members
      const alreadyMember = team.members.some((m) => m.user.toString() === teamLead.toString());
      if (!alreadyMember) {
        team.members.push({ user: teamLead, invitedBy: req.user._id });
      }
    }

    await team.save();
    await team.populate([
      { path: 'teamLead', select: 'firstName lastName email avatar' },
      { path: 'members.user', select: 'firstName lastName email avatar' },
    ]);

    return response.success(res, { team }, 'Team updated');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /teams/:id
 * Owner / admin only — soft-delete
 */
exports.deleteTeam = async (req, res, next) => {
  try {
    if (!isStaff(req.user.role)) return response.forbidden(res, 'Only owner or admin can delete teams');

    const team = await Team.findOne({ _id: req.params.id, company: req.company._id });
    if (!team) return response.notFound(res, 'Team not found');

    team.isActive = false;
    await team.save();

    return response.success(res, {}, 'Team deactivated');
  } catch (err) {
    next(err);
  }
};

// ─── Member management ────────────────────────────────────────────────────────

/**
 * POST /teams/:id/members
 * Invite a user into the team.
 * Who can invite: owner / admin / dept head / team lead
 *
 * Body: { userId }
 *   userId — must be a user in this company (any role except customer)
 *
 * Sends an email notification to the invited user.
 */
exports.addMember = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const team = await Team.findOne({ _id: req.params.id, company: req.company._id });
    if (!team) return response.notFound(res, 'Team not found');

    if (!(await canManageTeam(team, req))) {
      return response.forbidden(res, 'Only owner, admin, department head, or team lead can invite members');
    }

    // The invited user must exist in this company and be admin/agent
    const targetUser = await User.findOne({
      _id: userId,
      company: req.company._id,
      role: { $in: ['admin', 'agent'] },
      isActive: true,
    });

    if (!targetUser) {
      return response.badRequest(res, 'User must be an active admin or agent in this workspace');
    }

    const alreadyIn = team.members.some((m) => m.user.toString() === userId.toString());
    if (alreadyIn) return response.conflict(res, 'User is already a member of this team');

    team.members.push({ user: userId, invitedBy: req.user._id });
    await team.save();

    // Fire-and-forget invite notification
    try {
      await emailService.sendTeamInvite({
        invitee: targetUser,
        inviter: req.user,
        team,
        company: req.company,
      });
    } catch (emailErr) {
      console.error('[Team] Failed to send invite email:', emailErr.message);
    }

    await team.populate('members.user', 'firstName lastName email avatar role');
    return response.success(res, { team }, 'Member added to team');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /teams/:id/members/:userId
 * Remove a member from the team.
 * Who can remove: owner / admin / dept head / team lead
 * Cannot remove the team lead (must reassign lead first).
 */
exports.removeMember = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const team = await Team.findOne({ _id: req.params.id, company: req.company._id });
    if (!team) return response.notFound(res, 'Team not found');

    if (!(await canManageTeam(team, req))) {
      return response.forbidden(res, 'Access denied');
    }

    if (team.teamLead.toString() === userId) {
      return response.badRequest(res, 'Cannot remove the team lead. Reassign the team lead first.');
    }

    const before = team.members.length;
    team.members = team.members.filter((m) => m.user.toString() !== userId);

    if (team.members.length === before) return response.notFound(res, 'User is not a member of this team');

    await team.save();
    return response.success(res, {}, 'Member removed from team');
  } catch (err) {
    next(err);
  }
};
