const Department = require('../models/Department');
const Team       = require('../models/Team');
const User       = require('../models/User');
const Counter    = require('../models/Counter');
const response   = require('../utils/apiResponse');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Check the requester is an owner, admin, OR a head of this specific department.
 */
function isDeptHead(department, userId) {
  return department.heads.some((h) => h.toString() === userId.toString());
}

function isStaff(role) {
  return ['owner', 'admin'].includes(role);
}

function canManageDept(department, req) {
  return isStaff(req.user.role) || isDeptHead(department, req.user._id);
}

// ─── Department CRUD ──────────────────────────────────────────────────────────

/**
 * POST /departments
 * Owner / admin only — create a department
 */
exports.createDepartment = async (req, res, next) => {
  try {
    const { name, description, heads } = req.body;
    const company = req.company;

    // Validate proposed heads exist in this company and are admin/agent
    if (heads && heads.length > 0) {
      const headUsers = await User.find({
        _id: { $in: heads },
        company: company._id,
        role: { $in: ['admin', 'agent'] },
        isActive: true,
      });

      if (headUsers.length !== heads.length) {
        return response.badRequest(
          res,
          'One or more department heads are invalid. Heads must be active admin or agent users in this workspace.'
        );
      }
    }

    const department = await Department.create({
      company: company._id,
      name,
      description,
      heads: heads || [],
    });

    await Counter.increment(`company:${company._id}`, 'totalDepartments');

    return response.created(res, { department }, 'Department created');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /departments
 * All authenticated staff — list departments with server-side pagination.
 * Query: page, limit, search
 */
exports.listDepartments = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, search } = req.query;

    const base = { company: req.company._id, isActive: true };
    if (search && search.trim()) {
      base.name = { $regex: search.trim(), $options: 'i' };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [departments, total] = await Promise.all([
      Department.find(base)
        .populate('heads', 'firstName lastName email avatar role')
        .sort({ name: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Department.countDocuments(base),
    ]);

    return response.success(res, {
      departments,
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
 * GET /departments/:id
 */
exports.getDepartment = async (req, res, next) => {
  try {
    const department = await Department.findOne({
      _id: req.params.id,
      company: req.company._id,
    }).populate('heads', 'firstName lastName email avatar role');

    if (!department) return response.notFound(res, 'Department not found');

    // Attach teams in this department
    const teams = await Team.find({ department: department._id, isActive: true })
      .populate('teamLead', 'firstName lastName email avatar')
      .populate('members.user', 'firstName lastName email avatar');

    return response.success(res, { department, teams });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /departments/:id
 * Owner / admin / department head
 */
exports.updateDepartment = async (req, res, next) => {
  try {
    const department = await Department.findOne({
      _id: req.params.id,
      company: req.company._id,
    });

    if (!department) return response.notFound(res, 'Department not found');
    if (!canManageDept(department, req)) return response.forbidden(res, 'Access denied');

    const { name, description } = req.body;
    if (name !== undefined) department.name = name;
    if (description !== undefined) department.description = description;

    await department.save();
    return response.success(res, { department }, 'Department updated');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /departments/:id
 * Owner / admin only — also deactivates all child teams
 */
exports.deleteDepartment = async (req, res, next) => {
  try {
    if (!isStaff(req.user.role)) return response.forbidden(res, 'Only owner or admin can delete departments');

    const department = await Department.findOne({
      _id: req.params.id,
      company: req.company._id,
    });

    if (!department) return response.notFound(res, 'Department not found');

    // Soft-delete: deactivate department and its teams
    department.isActive = false;
    await department.save();

    await Team.updateMany({ department: department._id }, { isActive: false });

    await Counter.increment(`company:${req.company._id}`, 'totalDepartments', -1);

    return response.success(res, {}, 'Department deactivated');
  } catch (err) {
    next(err);
  }
};

// ─── Department Heads ─────────────────────────────────────────────────────────

/**
 * POST /departments/:id/heads
 * Owner / admin — add a department head (must be admin/agent)
 */
exports.addHead = async (req, res, next) => {
  try {
    if (!isStaff(req.user.role)) return response.forbidden(res, 'Only owner or admin can manage department heads');

    const { userId } = req.body;
    const department = await Department.findOne({ _id: req.params.id, company: req.company._id });
    if (!department) return response.notFound(res, 'Department not found');

    const targetUser = await User.findOne({
      _id: userId,
      company: req.company._id,
      role: { $in: ['admin', 'agent'] },
      isActive: true,
    });

    if (!targetUser) {
      return response.badRequest(res, 'User not found or is not an admin/agent in this workspace');
    }

    if (department.heads.some((h) => h.toString() === userId)) {
      return response.conflict(res, 'User is already a department head');
    }

    department.heads.push(userId);
    await department.save();

    await department.populate('heads', 'firstName lastName email avatar role');
    return response.success(res, { department }, 'Department head added');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /departments/:id/heads/:userId
 * Owner / admin — remove a department head
 */
exports.removeHead = async (req, res, next) => {
  try {
    if (!isStaff(req.user.role)) return response.forbidden(res, 'Only owner or admin can manage department heads');

    const department = await Department.findOne({ _id: req.params.id, company: req.company._id });
    if (!department) return response.notFound(res, 'Department not found');

    const before = department.heads.length;
    department.heads = department.heads.filter((h) => h.toString() !== req.params.userId);

    if (department.heads.length === before) return response.notFound(res, 'User is not a head of this department');

    await department.save();
    await department.populate('heads', 'firstName lastName email avatar role');
    return response.success(res, { department }, 'Department head removed');
  } catch (err) {
    next(err);
  }
};
