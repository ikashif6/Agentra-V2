const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    actorEmail: { type: String, trim: true },
    actorName: { type: String, trim: true },
    event: { type: String, required: true, index: true },
    eventLabel: { type: String, required: true },
    objectType: { type: String, trim: true },
    objectId: { type: String, trim: true },
    objectLabel: { type: String, trim: true },
    ip: { type: String },
    userAgent: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

activityLogSchema.index({ company: 1, createdAt: -1 });
activityLogSchema.index({ company: 1, actor: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
