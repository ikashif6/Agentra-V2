/**
 * Tenant-scoped assistant conflict + turn audit records.
 */

const mongoose = require('mongoose');

const AssistantConflictAuditSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    channel: { type: String, default: 'liveChat', index: true },
    configVersion: { type: Number, default: 1, index: true },
    category: {
      type: String,
      enum: [
        'safety',
        'permission',
        'verified_fact',
        'policy',
        'confirmation',
        'success_claim',
        'privacy',
        'tenant',
        'availability',
        'turn',
      ],
      required: true,
      index: true,
    },
    protectedSource: { type: String },
    resolution: { type: String },
    instructionHash: { type: String, index: true },
    instructionMasked: { type: String },
    capability: { type: String },
    requestId: { type: String, index: true },
    conversationId: { type: String, index: true },
    sessionId: { type: String, index: true },
    route: { type: String },
    tools: [{ type: String }],
    permissionDecision: { type: mongoose.Schema.Types.Mixed },
    modelVersions: { type: mongoose.Schema.Types.Mixed },
    outcome: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

AssistantConflictAuditSchema.index(
  { company: 1, channel: 1, configVersion: 1, category: 1, instructionHash: 1 },
  { name: 'conflict_dedupe_idx' },
);

module.exports = mongoose.model('AssistantConflictAudit', AssistantConflictAuditSchema);
