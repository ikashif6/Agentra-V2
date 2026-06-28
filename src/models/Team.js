const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Team Model
 *
 * Teams live inside a Department.
 * Each team has a single team lead (any agent/admin in the company).
 * Members are users belonging to this team.
 *
 * Invite flow:
 *   - Department head  → can create a team inside their department
 *                      → can invite anyone into that team
 *   - Team lead        → can invite people into their own team
 */

const memberSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // How the member was added
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const teamSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Team must belong to a company'],
    },

    department: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Team must belong to a department'],
    },

    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      maxlength: [100, 'Team name cannot exceed 100 characters'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    // The team lead — any agent or admin in the company
    teamLead: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Team must have a team lead'],
    },

    members: { type: [memberSchema], default: [] },

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Unique team name per department
teamSchema.index({ department: 1, name: 1 }, { unique: true });
teamSchema.index({ company: 1 });
teamSchema.index({ department: 1 });
teamSchema.index({ teamLead: 1 });
teamSchema.index({ 'members.user': 1 });

module.exports = mongoose.model('Team', teamSchema);
