const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Department Model
 *
 * Departments belong to a company (tenant).
 * Each department can have one or more department heads (admin or agent).
 * Teams are children of departments.
 */
const departmentSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Department must belong to a company'],
    },

    name: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
      maxlength: [100, 'Department name cannot exceed 100 characters'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    // Department heads — must be admin or agent within the company
    heads: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Unique department name per company
departmentSchema.index({ company: 1, name: 1 }, { unique: true });
departmentSchema.index({ company: 1 });
departmentSchema.index({ heads: 1 });

module.exports = mongoose.model('Department', departmentSchema);
